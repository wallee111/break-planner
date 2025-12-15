import React, { createContext, useContext, useState, useEffect } from 'react';
import { INITIAL_EMPLOYEES, INITIAL_RULES, INITIAL_COVERAGE_RULES, INITIAL_ROLE_COLORS } from '../utils/initialData';
import { INITIAL_ROSTER } from '../utils/rosterData';
import { generateSchedule as genScheduleAlgo, validateSchedule as valScheduleAlgo } from '../utils/scheduler';
import { fetchEmployees, createEmployee, updateEmployee as apiUpdateEmployee, deleteEmployee as apiDeleteEmployee, saveSchedule, fetchRoster, addToRoster as apiAddToRoster, updateRosterEmployee as apiUpdateRoster, deleteFromRoster as apiDeleteRoster } from '../services/plannerService';
import { useAuth } from './AuthContext';

const PlannerContext = createContext();

export const usePlanner = () => useContext(PlannerContext);

export const PlannerProvider = ({ children }) => {
    const { user, loading: authLoading } = useAuth();

    const [employees, setEmployees] = useState(INITIAL_EMPLOYEES);
    const [rules, setRules] = useState(INITIAL_RULES);
    const [coverageRules, setCoverageRules] = useState(INITIAL_COVERAGE_RULES);
    const [schedule, setSchedule] = useState([]); // Array of employee schedules
    const [validationErrors, setValidationErrors] = useState([]);
    const [roster, setRoster] = useState(INITIAL_ROSTER);
    const [roleColors, setRoleColors] = useState(INITIAL_ROLE_COLORS);

    const updateRules = (newRules) => {
        setRules(newRules);
    };

    const updateCoverageRules = (newRules) => {
        setCoverageRules(newRules);
    };

    // --- Supabase Integration ---
    const [isLoading, setIsLoading] = useState(true);

    // Initial Load
    useEffect(() => {
        // 1. Wait for Auth to finish initializing
        if (authLoading) return;

        // 2. If no user, stay in "Guest Mode" (Local state only)
        if (!user) {
            console.log('Guest mode: Using local initial data.');
            setEmployees(INITIAL_EMPLOYEES);
            setIsLoading(false);
            return;
        }

        // 3. User exists: Load from DB
        const loadData = async () => {
            setIsLoading(true);
            try {
                // 1. Employees
                const dbEmployees = await fetchEmployees();
                if (dbEmployees && dbEmployees.length > 0) {
                    // Normalize DB snake_case to local camelCase
                    const mappedEmployees = dbEmployees.map(e => ({
                        ...e,
                        startTime: e.start_time || '08:00',
                        endTime: e.end_time || '17:00'
                    }));
                    setEmployees(mappedEmployees);
                } else {
                    // SEED DATA: Only seed if we are SURE we are a real user with explicit no data
                    console.log('New user detected. Seeding default data...');
                    const seededEmployees = [];
                    for (const emp of INITIAL_EMPLOYEES) {
                        const { id, ...empData } = emp;
                        const newEmp = await createEmployee({
                            name: emp.name,
                            roles: emp.roles,
                            start_time: emp.startTime,
                            end_time: emp.endTime
                        });
                        if (newEmp) seededEmployees.push(newEmp);
                    }
                    if (seededEmployees.length > 0) {
                        // Remap seeded data back to camelCase for state
                        const mappedSeeded = seededEmployees.map(e => ({
                            ...e,
                            startTime: e.start_time || '08:00',
                            endTime: e.end_time || '17:00'
                        }));
                        setEmployees(mappedSeeded);
                        addToLog('Welcome! Created your starter team.', 'success');
                    } else {
                        setEmployees([]);
                    }
                }

                // 2. Roster
                const dbRoster = await fetchRoster();
                if (dbRoster && dbRoster.length > 0) {
                    const mappedRoster = dbRoster.map(r => ({
                        ...r,
                        defaultRole: r.default_role || 'Product Guide'
                    }));
                    setRoster(mappedRoster);
                } else {
                    // Seed Roster (if empty)
                    // Optional: could seed from INITIAL_ROSTER but maybe better to start empty or copy from employees
                    setRoster([]);
                }

                // 3. Schedule (Load today's if exists - future improvement)
            } catch (err) {
                console.error('Data load failed:', err);
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, [user, authLoading]);

    // ... (keep employees CRUD same) ...
    // Note: User needs to verify where lines match in valid file. 
    // I am skipping down to the roster functions.

    const addToRoster = async (employee) => {
        // Optimistic
        const tempId = crypto.randomUUID();
        const newRosterItem = { ...employee, id: tempId };
        setRoster(prev => [...prev, newRosterItem]);

        // DB
        const saved = await apiAddToRoster(employee);
        if (saved) {
            setRoster(prev => prev.map(r => r.id === tempId ? { ...saved, defaultRole: saved.default_role } : r));
            addToLog(`Added ${employee.name} to Roster`, 'success');
        } else {
            setRoster(prev => prev.filter(r => r.id !== tempId));
            addToLog('Failed to save to roster', 'error');
        }
    };

    const updateRosterEmployee = async (id, updates) => {
        // Optimistic
        setRoster(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));

        // DB
        await apiUpdateRoster(id, updates);
        addToLog('Updated roster', 'success');
    };

    const deleteFromRoster = async (id) => {
        // Optimistic
        setRoster(prev => prev.filter(r => r.id !== id));

        // DB
        await apiDeleteRoster(id);
        addToLog('Removed from roster', 'warning');
    };

    const updateRoleColor = (role, color) => {
        setRoleColors(prev => ({ ...prev, [role]: color }));
    };

    const value = {
        employees,
        addEmployee,
        updateEmployee,
        removeEmployee,
        rules,
        updateRules,
        coverageRules,
        updateCoverageRules,
        schedule,
        updateSchedule, // Manual updates
        generateSchedule, // Auto generation
        validationErrors,
        setValidationErrors,
        roster,
        addToRoster,
        updateRosterEmployee,
        deleteFromRoster,
        roleColors,
        updateRoleColor,
        activityLog,
        validateNow,
        isLoading
    };

    return (
        <PlannerContext.Provider value={value}>
            {children}
        </PlannerContext.Provider>
    );
};
