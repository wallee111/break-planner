import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import {
    INITIAL_EMPLOYEES, INITIAL_RULES, INITIAL_COVERAGE_RULES,
    INITIAL_ROLE_COLORS, INITIAL_STORE_HOURS
} from '../utils/initialData';
import { INITIAL_ROSTER } from '../utils/rosterData';
import { generateSchedule as genScheduleAlgo, validateSchedule as valScheduleAlgo } from '../utils/scheduler';
import * as api from '../services/plannerService';
import { useAuth } from './AuthContext';

const PlannerContext = createContext();

export const usePlanner = () => useContext(PlannerContext);

// --- Helpers ---

const sortEmployeesByTime = (a, b) => {
    const timeA = a.startTime || '00:00';
    const timeB = b.startTime || '00:00';
    return timeA.localeCompare(timeB);
};

const normalizeEmployee = (e) => ({
    ...e,
    startTime: e.start_time || '08:00',
    endTime: e.end_time || '17:00',
    avatarColor: e.avatar_color
});

const normalizeRosterItem = (r) => ({
    ...r,
    defaultRole: r.default_role || 'Product Guide',
    avatarColor: r.avatar_color
});

export const PlannerProvider = ({ children }) => {
    const { user, loading: authLoading } = useAuth();

    // --- State ---
    const [employees, setEmployees] = useState(INITIAL_EMPLOYEES);
    const [roster, setRoster] = useState(INITIAL_ROSTER);
    const [schedule, setSchedule] = useState([]);

    // Settings
    const [rules, setRules] = useState(INITIAL_RULES);
    const [coverageRules, setCoverageRules] = useState(INITIAL_COVERAGE_RULES);
    const [roleColors, setRoleColors] = useState(INITIAL_ROLE_COLORS);
    const [storeHours, setStoreHours] = useState(INITIAL_STORE_HOURS);

    // UI State
    const [viewRange, setViewRange] = useState({ start: 8, end: 20 });
    const updateViewRange = (range) => setViewRange(range);

    // Meta
    const [validationErrors, setValidationErrors] = useState([]);
    const [activityLog, setActivityLog] = useState([]);
    const [isLoading, setIsLoading] = useState(true);

    // --- Logging ---

    const addToLog = useCallback((message, type = 'info') => {
        setActivityLog(prev => [{
            id: crypto.randomUUID(),
            timestamp: new Date(),
            message,
            type
        }, ...prev]);
    }, []);

    // --- Data Loading ---

    useEffect(() => {
        if (authLoading) return;

        const loadData = async () => {
            if (!user) {
                console.log('Guest mode: Using local initial data.');
                setEmployees(INITIAL_EMPLOYEES);
                setIsLoading(false);
                return;
            }

            setIsLoading(true);
            try {
                // Load critical data in parallel
                const [dbEmployees, dbRoster, dbSettings] = await Promise.all([
                    api.fetchEmployees(),
                    api.fetchRoster(),
                    api.fetchSettings() // assume safe to fail? kept behavior similar to original
                ]);

                // 1. Employees
                if (dbEmployees?.length > 0) {
                    const mapped = dbEmployees.map(normalizeEmployee).sort(sortEmployeesByTime);
                    setEmployees(mapped);
                } else {
                    setEmployees([]);
                }

                // 2. Roster
                if (dbRoster?.length > 0) {
                    setRoster(dbRoster.map(normalizeRosterItem));
                } else {
                    setRoster([]);
                }

                // 3. Settings
                if (dbSettings) {
                    if (dbSettings.break_rules?.length) setRules(dbSettings.break_rules);
                    if (dbSettings.coverage_rules?.length) setCoverageRules(dbSettings.coverage_rules);
                    if (dbSettings.store_hours?.length) setStoreHours(dbSettings.store_hours);

                    // Only override colors if DB has valid data
                    if (dbSettings.role_colors && Object.keys(dbSettings.role_colors).length > 0) {
                        setRoleColors(dbSettings.role_colors);
                    }
                }
            } catch (err) {
                console.error('Data load failed:', err);
                addToLog('Failed to load cloud data', 'error');
            } finally {
                setIsLoading(false);
            }
        };

        loadData();
    }, [user, authLoading, addToLog]);

    // --- Actions: Employees ---

    const addEmployee = async (empData) => {
        // Handle input flexibility (legacy support)
        const isString = typeof empData === 'string';
        const name = isString ? empData : empData.name;
        const role = isString ? null : (empData.roles?.[0] || empData.default_role);
        const startTime = isString ? '08:00' : (empData.startTime || '08:00');
        const endTime = isString ? '17:00' : (empData.endTime || '17:00');
        const avatarColor = isString ? null : empData.avatarColor;

        const tempId = crypto.randomUUID();
        const newEmp = {
            id: tempId,
            name,
            roles: [role],
            default_role: role,
            startTime,
            endTime,
            avatarColor
        };

        // Optimistic Update
        setEmployees(prev => [...prev, newEmp].sort(sortEmployeesByTime));

        // DB Save
        const saved = await api.createEmployee({
            name,
            roles: [role],
            start_time: startTime,
            end_time: endTime,
            avatarColor
        });

        if (saved) {
            setEmployees(prev => prev.map(e => e.id === tempId ? { ...saved, startTime, endTime } : e));
            addToLog(`Added ${name} to team`, 'success');
        } else {
            setEmployees(prev => prev.filter(e => e.id !== tempId));
            addToLog(`Failed to save ${name}`, 'error');
        }
    };

    const updateEmployee = async (id, updates) => {
        setEmployees(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
        await api.updateEmployee(id, updates);
        addToLog('Updated employee', 'success');
    };

    const removeEmployee = async (id) => {
        setEmployees(prev => prev.filter(e => e.id !== id));
        await api.deleteEmployee(id);
        addToLog('Removed employee', 'warning');
    };

    const clearTeam = async () => {
        const idsToDelete = employees.map(e => e.id);
        setEmployees([]); // Optimistic clear

        // Execute deletions
        await Promise.all(idsToDelete.map(id => api.deleteEmployee(id)));
        addToLog('Cleared daily team', 'warning');
    };

    // --- Actions: Roster ---

    const addToRoster = async (employee) => {
        const tempId = crypto.randomUUID();
        const newRosterItem = { ...employee, id: tempId };

        setRoster(prev => [...prev, newRosterItem]);

        const saved = await api.addToRoster(employee);
        if (saved) {
            setRoster(prev => prev.map(r => r.id === tempId ? { ...saved, defaultRole: saved.default_role } : r));
            addToLog(`Added ${employee.name} to Roster`, 'success');
        } else {
            setRoster(prev => prev.filter(r => r.id !== tempId));
            addToLog('Failed to save to roster', 'error');
        }
    };

    const updateRosterEmployee = async (id, updates) => {
        // Find current name to match against active team
        const currentRosterItem = roster.find(r => r.id === id);
        const nameToMatch = currentRosterItem?.name;

        setRoster(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));

        // Propagate updates to active daily employees (Sync Roster -> Schedule)
        if (nameToMatch) {
            const activeMatches = employees.filter(e => e.name === nameToMatch);

            if (activeMatches.length > 0) {
                // 1. Update Local State
                setEmployees(prev => prev.map(e => {
                    if (e.name === nameToMatch) {
                        return {
                            ...e,
                            avatarColor: updates.avatarColor !== undefined ? updates.avatarColor : e.avatarColor,
                            name: updates.name || e.name,
                            default_role: updates.defaultRole || e.default_role
                        };
                    }
                    return e;
                }));

                // 2. Persist to DB for each active instance
                for (const match of activeMatches) {
                    await api.updateEmployee(match.id, {
                        avatarColor: updates.avatarColor,
                        name: updates.name,
                        // Note: normalizeRosterItem uses 'defaultRole', normalizeEmployee uses 'default_role' or 'roles'.
                        // Api usually expects snake_case but api wrapper might handle it. 
                        // normalizeEmployee maps incoming DB `avatar_color` -> `avatarColor`
                        // api.updateEmployee likely expects camelCase if it mirrors createEmployee logic or the wrapper handles it.
                        // Based on `addEmployee` logic: `api.createEmployee` uses `avatarColor`. 
                        // So we pass `avatarColor`.
                    });
                }
            }
        }

        await api.updateRosterEmployee(id, updates);
        addToLog('Updated roster', 'success');
    };

    const deleteFromRoster = async (id) => {
        setRoster(prev => prev.filter(r => r.id !== id));
        await api.deleteFromRoster(id);
        addToLog('Removed from roster', 'warning');
    };

    // --- Actions: Settings ---

    const updateRules = (newRules) => {
        setRules(newRules);
        if (user) api.updateSettings({ break_rules: newRules });
    };

    const updateCoverageRules = (newRules) => {
        setCoverageRules(newRules);
        if (user) api.updateSettings({ coverage_rules: newRules });
    };

    const updateStoreHours = (newHours) => {
        setStoreHours(newHours);
        if (user) api.updateSettings({ store_hours: newHours });
    };

    const updateRoleColor = (role, color) => {
        const newColors = { ...roleColors, [role]: color };
        setRoleColors(newColors);
        if (user) api.updateSettings({ role_colors: newColors });
    };

    // --- Actions: Schedule ---

    const updateSchedule = async (newSchedule, logAction = null) => {
        setSchedule(newSchedule);

        if (logAction) {
            addToLog(logAction, 'action');
        }

        const warnings = valScheduleAlgo(newSchedule, employees, coverageRules, storeHours);
        setValidationErrors(warnings);

        if (warnings.length > 0 && logAction) {
            addToLog(`Validation found ${warnings.length} issues`, 'warning');
        }

        const today = new Date().toISOString().split('T')[0];
        await api.saveSchedule(today, newSchedule);
    };

    const generateSchedule = () => {
        const newSchedule = genScheduleAlgo(employees, rules);
        updateSchedule(newSchedule, 'Generated Schedule');
    };

    const validateNow = () => {
        const warnings = valScheduleAlgo(schedule, employees, coverageRules, storeHours);
        setValidationErrors(warnings);
        const isValid = warnings.length === 0;
        addToLog(isValid ? 'Manual Verification: Schedule is Valid' : `Manual Verification: Found ${warnings.length} issues`, isValid ? 'success' : 'warning');
        return isValid;
    };

    // --- Context Value ---

    const value = useMemo(() => ({
        employees,
        addEmployee,
        updateEmployee,
        removeEmployee,
        clearTeam,
        rules,
        updateRules,
        coverageRules,
        updateCoverageRules,
        storeHours,
        updateStoreHours,
        viewRange,
        updateViewRange,
        schedule,
        updateSchedule,
        generateSchedule,
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
    }), [
        employees, rules, coverageRules, storeHours, schedule, validationErrors,
        roster, roleColors, activityLog, isLoading, user
    ]);

    return (
        <PlannerContext.Provider value={value}>
            {children}
        </PlannerContext.Provider>
    );
};
