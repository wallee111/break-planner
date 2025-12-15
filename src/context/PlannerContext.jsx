import React, { createContext, useContext, useState, useEffect } from 'react';
import { INITIAL_EMPLOYEES, INITIAL_RULES, INITIAL_COVERAGE_RULES, INITIAL_ROLE_COLORS } from '../utils/initialData';
import { INITIAL_ROSTER } from '../utils/rosterData';
import { generateSchedule as genScheduleAlgo, validateSchedule as valScheduleAlgo } from '../utils/scheduler';
import {
    fetchEmployees, createEmployee, updateEmployee as apiUpdateEmployee, deleteEmployee as apiDeleteEmployee,
    fetchRoster, addToRoster as apiAddToRoster, updateRosterEmployee as apiUpdateRoster, deleteFromRoster as apiDeleteRoster,
    fetchSettings, updateSettings
} from '../services/plannerService';
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
        if (user) {
            updateSettings({ break_rules: newRules });
        }
    };

    const updateCoverageRules = (newRules) => {
        setCoverageRules(newRules);
        if (user) {
            updateSettings({ coverage_rules: newRules });
        }
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

                    // Sort by Start Time
                    mappedEmployees.sort((a, b) => {
                        const tA = (a.startTime || '00:00') > (b.startTime || '00:00') ? 1 : -1;
                        if ((a.startTime || '00:00') !== (b.startTime || '00:00')) return tA;
                        return 0;
                    });

                    setEmployees(mappedEmployees);
                } else {
                    // Start Empty (No Auto-Seeding)
                    setEmployees([]);
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
                    setRoster([]);
                }

                // 3. Settings (Rules & Colors)
                const dbSettings = await fetchSettings();
                console.log('[PlannerContext] Loaded Settings:', JSON.stringify(dbSettings, null, 2));

                if (dbSettings) {
                    if (dbSettings.break_rules && dbSettings.break_rules.length > 0) {
                        setRules(dbSettings.break_rules);
                    }
                    if (dbSettings.coverage_rules && dbSettings.coverage_rules.length > 0) {
                        setCoverageRules(dbSettings.coverage_rules);
                    }
                    // Fix: Check if role_colors is truthy, not just keys length, 
                    // though if it's {}, we might still want to merge or ignore.
                    // If DB has {}, and we skip, we use INITIAL. 
                    // If DB has valid colors, we use them.
                    if (dbSettings.role_colors && Object.keys(dbSettings.role_colors).length > 0) {
                        console.log('[PlannerContext] Applying Role Colors:', JSON.stringify(dbSettings.role_colors, null, 2));
                        setRoleColors(dbSettings.role_colors);
                    } else {
                        console.log('[PlannerContext] No (or empty) role_colors in DB. Using defaults.');
                        // We do NOT setRoleColors here, keeping INITIAL_ROLE_COLORS from state init.
                        // UNLESS check if dbSettings.role_colors is explicitly {} (meaning user wiped them?)
                        // For now, assume {} means "not set yet" -> use defaults.
                    }
                } else {
                    console.log('No settings found, using defaults.');
                }

                // 4. Schedule (Load today's if exists - future improvement)
            } catch (err) {
                console.error('Data load failed:', err);
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, [user, authLoading]);

    const clearTeam = async () => {
        if (!window.confirm('Are you sure you want to clear the entire daily team?')) return;

        // Optimistic
        const idsToDelete = employees.map(e => e.id);
        setEmployees([]);

        // DB
        // In a real app we'd use a bulk delete, but loop is fine for MVP size
        for (const id of idsToDelete) {
            await apiDeleteEmployee(id);
        }
        addToLog('Cleared daily team', 'warning');
    };

    // Helper to persist employee changes
    const addEmployee = async (empData) => {
        // Handle both (name, role) legacy calls if any, or object
        let name, role, startTime, endTime;

        if (typeof empData === 'string') {
            name = empData;
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
        setEmployees(prev => {
            const updated = [newEmp, ...prev];
            // Keep sorted
            return updated.sort((a, b) => {
                const tA = (a.startTime || '00:00') > (b.startTime || '00:00') ? 1 : -1;
                if ((a.startTime || '00:00') !== (b.startTime || '00:00')) return tA;
                return 0;
            });
        });

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
        const newColors = { ...roleColors, [role]: color };
        console.log(`[PlannerContext] Updating Color for ${role} to ${color}. Saving:`, newColors);
        setRoleColors(newColors);
        if (user) {
            updateSettings({ role_colors: newColors });
        }
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
        isLoading,
        clearTeam
    };

    return (
        <PlannerContext.Provider value={value}>
            {children}
        </PlannerContext.Provider>
    );
};
