
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
    alert('createEmployee() called'); // Temp: confirm function runs

    // Debug: surface auth info
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) {
        alert(`Supabase auth error: ${userError.message}`);
        console.error('Error fetching user:', userError);
        return null;
    }

    if (!user) {
        alert('No Supabase user session found. Please log in.');
        return null;
    }

    const { data, error } = await supabase
        .from('employees')
        .insert([{ ...employee, user_id: user.id }])
        .select()
        .single();

    if (error) {
        alert(`Supabase insert error: ${error.message}`); // Temp: surface Supabase insert errors
        console.error('Error creating employee:', error);
        return null;
    }

    // Debug: confirm success
    alert(`Employee saved with id: ${data?.id || 'unknown'}`);
    return data;
};

export const updateEmployee = async (id, updates) => {
    const { data, error } = await supabase
        .from('employees')
        .update(updates)
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
