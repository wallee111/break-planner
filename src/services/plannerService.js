
import { supabase } from '../lib/supabase';

// --- Employees ---

export const fetchEmployees = async () => {
    const { data, error } = await supabase
        .from('employees')
        .select('*')
        .order('name');

    if (error) {
        console.error('Error fetching employees:', error);
        return [];
    }
    return data;
};

export const createEmployee = async (employee) => {
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        console.error('Error fetching user for create:', userError);
        return null;
    }

    // Map App (Camel) -> DB (Snake)
    const dbPayload = {
        name: employee.name,
        roles: employee.roles, // Schema check: text[] is correct
        start_time: employee.startTime || employee.start_time || '09:00',
        end_time: employee.endTime || employee.end_time || '17:00',
        user_id: user.id
    };

    const { data, error } = await supabase
        .from('employees')
        .insert([dbPayload])
        .select()
        .single();

    if (error) {
        console.error('Error creating employee:', error);
        return null;
    }
    return data;
};

export const updateEmployee = async (id, updates) => {
    // Map App (Camel) -> DB (Snake) for partial updates
    const dbPayload = {};
    if (updates.name !== undefined) dbPayload.name = updates.name;
    if (updates.roles !== undefined) dbPayload.roles = updates.roles;
    if (updates.startTime !== undefined) dbPayload.start_time = updates.startTime;
    if (updates.endTime !== undefined) dbPayload.end_time = updates.endTime;

    const { data, error } = await supabase
        .from('employees')
        .update(dbPayload)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Error updating employee:', error);
        return null;
    }
    return data;
};

export const deleteEmployee = async (id) => {
    const { error } = await supabase
        .from('employees')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting employee:', error);
        return false;
    }
    return true;
};

// --- Roster ---

export const fetchRoster = async () => {
    const { data, error } = await supabase
        .from('roster')
        .select('*')
        .order('name');

    if (error) {
        console.error('Error fetching roster:', error);
        return [];
    }
    return data;
};

export const addToRoster = async (employee) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from('roster')
        .insert([{
            name: employee.name,
            default_role: employee.defaultRole || employee.default_role || 'Product Guide',
            user_id: user.id
        }])
        .select()
        .single();

    if (error) {
        console.error('Error adding to roster:', error);
        return null;
    }
    return data;
};

export const updateRosterEmployee = async (id, updates) => {
    const dbUpdates = {};
    if (updates.name) dbUpdates.name = updates.name;
    if (updates.defaultRole) dbUpdates.default_role = updates.defaultRole;

    const { data, error } = await supabase
        .from('roster')
        .update(dbUpdates)
        .eq('id', id)
        .select()
        .single();

    if (error) {
        console.error('Error updating roster:', error);
        return null;
    }
    return data;
};

export const deleteFromRoster = async (id) => {
    const { error } = await supabase
        .from('roster')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Error deleting from roster:', error);
        return false;
    }
    return true;
};

// --- Schedules ---


export const saveSchedule = async (date, scheduleData) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // For MVP, we just append a new record. 
    // Ideally we might update an existing one for the date, or keep version history.
    const { data, error } = await supabase
        .from('schedules')
        .insert([{
            date: date,
            schedule_data: scheduleData,
            user_id: user.id
        }])
        .select()
        .single();

    if (error) console.error('Error saving schedule:', error);
    return data;
};

export const fetchLatestSchedule = async (date) => {
    // Get the most recently created schedule for the date
    const { data, error } = await supabase
        .from('schedules')
        .select('*')
        .eq('date', date)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 is "no rows returned"
        console.error('Error fetching schedule:', error);
    }
    return data ? data.schedule_data : null;
};

// --- Settings ---

export const fetchSettings = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('user_id', user.id)
        .single();

    if (error && error.code !== 'PGRST116') {
        console.error('Error fetching settings:', error);
        return null;
    }
    return data;
};

export const updateSettings = async (updates) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Use upsert to handle both create and update
    const { data, error } = await supabase
        .from('settings')
        .upsert({
            user_id: user.id,
            ...updates,
            updated_at: new Date()
        })
        .select()
        .single();

    if (error) {
        console.error('Error saving settings:', error);
        return null;
    }
    return data;
};
