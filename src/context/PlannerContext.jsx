import React, { createContext, useContext, useState, useEffect } from 'react';
import { INITIAL_EMPLOYEES, INITIAL_RULES, INITIAL_COVERAGE_RULES, INITIAL_ROLE_COLORS } from '../utils/initialData';
import { INITIAL_ROSTER } from '../utils/rosterData';
import { generateSchedule as genScheduleAlgo, validateSchedule as valScheduleAlgo } from '../utils/scheduler';
import { fetchEmployees, createEmployee, updateEmployee as apiUpdateEmployee, deleteEmployee as apiDeleteEmployee, saveSchedule } from '../services/plannerService';

const PlannerContext = createContext();

export const usePlanner = () => useContext(PlannerContext);

export const PlannerProvider = ({ children }) => {
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
                    // SEED DATA: If user has no data, seed with defaults so they have something to play with
                    console.log('New user detected. Seeding default data...');
                    const seededEmployees = [];
                    for (const emp of INITIAL_EMPLOYEES) {
                        const { id, ...empData } = emp; // Strip local ID
                        // Map local keys to DB keys if needed, but logic uses same keys mostly
                        // service expects {name, roles, startTime, endTime} which matches INITIAL_EMPLOYEES (mostly)
                        // Actually INITIAL_EMPLOYEES might have StartTime/EndTime capitalized?
                        // Let's create proper object
                        const newEmp = await createEmployee({
                            name: emp.name,
                            roles: emp.roles,
                            start_time: emp.startTime,
                            end_time: emp.endTime
                        });
                        if (newEmp) seededEmployees.push(newEmp);
                    }
                    if (seededEmployees.length > 0) {
                        setEmployees(seededEmployees);
                        addToLog('Welcome! Created your starter team.', 'success');
                    } else {
                        setEmployees([]); // Should be empty if seed failed, not mock data with fake IDs
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
    }, []);

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
            // Update temp ID with real DB ID
            setEmployees(prev => prev.map(e => e.id === tempId ? { ...e, id: saved.id } : e));
            addToLog(`Added employee ${name} to Database`, 'success');
        } else {
            addToLog(`Failed to save ${name} to DB`, 'error');
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
