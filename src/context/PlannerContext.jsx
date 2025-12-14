import React, { createContext, useContext, useState, useEffect } from 'react';
import { INITIAL_EMPLOYEES, INITIAL_RULES, INITIAL_COVERAGE_RULES, INITIAL_ROLE_COLORS } from '../utils/initialData';
import { INITIAL_ROSTER } from '../utils/rosterData';
import { generateSchedule as genScheduleAlgo, validateSchedule as valScheduleAlgo } from '../utils/scheduler';
import { fetchEmployees, createEmployee, updateEmployee as apiUpdateEmployee, deleteEmployee as apiDeleteEmployee, saveSchedule } from '../services/plannerService';
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

                // 2. Schedule (Load today's if exists - future improvement)
            } catch (err) {
                console.error('Data load failed:', err);
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, [user, authLoading]);

    // Helper to persist employee changes
    const addEmployee = async (empData) => {
        // Handle both (name, role) legacy calls if any, or object
        let name, role, startTime, endTime;

        if (typeof empData === 'string') {
            // arguments[1] would be role
            // But let's assume valid usage is object now based on EmployeeList
            name = empData;
            // role = arguments[1]; // fallback if needed
        } else {
            name = empData.name;
            role = empData.roles?.[0] || empData.default_role;
            startTime = empData.startTime || '08:00';
            endTime = empData.endTime || '17:00';
        }

        // Optimistic Update
        const tempId = crypto.randomUUID();
        const newEmp = {
            id: tempId,
            name,
            roles: [role],
            default_role: role,
            startTime,
            endTime
        };
        setEmployees(prev => [newEmp, ...prev]);

        // DB Save
        const saved = await createEmployee({
            name,
            roles: [role],
            start_time: startTime,
            end_time: endTime
        });

        if (saved) {
            // Replace temp ID with real DB ID
            setEmployees(prev => prev.map(e => e.id === tempId ? { ...saved, startTime, endTime } : e));
            addToLog(`Added ${name} to team`, 'success');
        } else {
            // Revert optimistic update if failed
            setEmployees(prev => prev.filter(e => e.id !== tempId));
            addToLog(`Failed to save ${name}`, 'error');
        }
    };

    const updateEmployee = async (id, updates) => {
        // Optimistic
        setEmployees(employees.map(emp => emp.id === id ? { ...emp, ...updates } : emp));

        // DB
        await apiUpdateEmployee(id, updates);
        addToLog('Updated employee', 'success');
    };

    const removeEmployee = async (id) => {
        // Optimistic
        setEmployees(employees.filter(emp => emp.id !== id));

        // DB
        await apiDeleteEmployee(id);
        addToLog('Removed employee', 'warning');
    };

    const [activityLog, setActivityLog] = useState([]);

    const addToLog = (message, type = 'info') => {
        const entry = {
            id: crypto.randomUUID(),
            timestamp: new Date(),
            message,
            type
        };
        setActivityLog(prev => [entry, ...prev]);
    };

    const updateSchedule = async (newSchedule, logAction = null) => {
        // Optimistic
        setSchedule(newSchedule);

        if (logAction) {
            console.log(`[Planner Action]: ${logAction} at ${new Date().toLocaleTimeString()}`);
            addToLog(logAction, 'action');
        }

        // Real-time validation
        const warnings = valScheduleAlgo(newSchedule, employees, coverageRules);
        setValidationErrors(warnings);

        if (warnings.length > 0 && logAction) {
            addToLog(`Validation found ${warnings.length} issues`, 'warning');
        }

        // DB Save
        // Assuming current date is 'today' or managed elsewhere. For MVP using ISO string date part.
        const today = new Date().toISOString().split('T')[0];
        await saveSchedule(today, newSchedule);
    };

    const validateNow = () => {
        const warnings = valScheduleAlgo(schedule, employees, coverageRules);
        setValidationErrors(warnings);

        if (warnings.length === 0) {
            addToLog('Manual Verification: Schedule is Valid', 'success');
            return true;
        } else {
            addToLog(`Manual Verification: Found ${warnings.length} issues`, 'warning');
            return false;
        }
    };

    const generateSchedule = () => {
        const newSchedule = genScheduleAlgo(employees, rules);
        updateSchedule(newSchedule, 'Generated Schedule');
    };

    const addToRoster = (employee) => {
        setRoster([...roster, { ...employee, id: crypto.randomUUID() }]);
    };

    const updateRosterEmployee = (id, updates) => {
        setRoster(roster.map(emp => emp.id === id ? { ...emp, ...updates } : emp));
    };

    const deleteFromRoster = (id) => {
        setRoster(roster.filter(emp => emp.id !== id));
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
