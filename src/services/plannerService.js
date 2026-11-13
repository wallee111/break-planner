
import { supabase } from '../lib/supabase';

// --- Employees ---
// Each employees row is one person on ONE day's team (plan_date). The same
// roster member appears once per day they work.

export const fetchEmployees = async (planDate) => {
    let query = supabase
        .from('employees')
        .select('*')
        .order('name');
    if (planDate) query = query.eq('plan_date', planDate);

    const { data, error } = await query;

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
        avatar_color: employee.avatarColor,
        plan_date: employee.planDate || null,
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
    if (updates.avatarColor !== undefined) dbPayload.avatar_color = updates.avatarColor;

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
            avatar_color: employee.avatarColor,
            feed_url: employee.feedUrl || employee.feed_url || null,
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
    if (updates.avatarColor) dbUpdates.avatar_color = updates.avatarColor;
    // Explicit undefined check so clearing a value saves an empty string
    if (updates.feedUrl !== undefined) dbUpdates.feed_url = updates.feedUrl || null;

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
// One row per (user, date), updated in place. Before migration_plan_date.sql
// every change inserted a new row; those older rows are left alone and the
// newest (by updated_at) wins on load.

// Row id per user+date, so each drag is a single UPDATE (no lookup).
const scheduleRowIds = new Map();
// Per-date write queue: saves run strictly in order, so a slow earlier save
// can never overwrite a newer one, and the first save for a new date can't
// race a second into inserting two rows.
const saveQueues = new Map();

const writeSchedule = async (userId, date, scheduleData) => {
    const key = `${userId}:${date}`;
    const now = new Date().toISOString();
    let id = scheduleRowIds.get(key);

    if (!id) {
        const { data: existing, error: findError } = await supabase
            .from('schedules')
            .select('id')
            .eq('date', date)
            .order('updated_at', { ascending: false })
            .limit(1)
            .maybeSingle();
        if (findError) console.error('Error finding schedule row:', findError);
        id = existing?.id;
    }

    if (id) {
        const { data, error } = await supabase
            .from('schedules')
            .update({ schedule_data: scheduleData, updated_at: now })
            .eq('id', id)
            .select('id')
            .maybeSingle();
        if (!error && data) {
            scheduleRowIds.set(key, id);
            return data;
        }
        if (error) console.error('Error updating schedule:', error);
        scheduleRowIds.delete(key); // row vanished — fall through to insert
    }

    const { data, error } = await supabase
        .from('schedules')
        .insert([{ date, schedule_data: scheduleData, user_id: userId, updated_at: now }])
        .select('id')
        .single();
    if (error) {
        console.error('Error saving schedule:', error);
        return null;
    }
    scheduleRowIds.set(key, data.id);
    return data;
};

export const saveSchedule = async (date, scheduleData) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const key = `${user.id}:${date}`;
    const prev = saveQueues.get(key) || Promise.resolve();
    const next = prev.catch(() => {}).then(() => writeSchedule(user.id, date, scheduleData));
    saveQueues.set(key, next);
    return next;
};

/**
 * The saved break plan for one date, or null if none exists.
 * Returns the raw schedule_data array.
 */
export const fetchScheduleForDate = async (date) => {
    const { data, error } = await supabase
        .from('schedules')
        .select('id, schedule_data')
        .eq('date', date)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) {
        console.error('Error fetching schedule:', error);
        return null;
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
