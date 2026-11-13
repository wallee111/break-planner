// Verify the Supabase database has every expected table/column from
// schema.sql + all migration_*.sql files, WITHOUT needing the service key.
//
// Works via PostgREST: selecting a column that doesn't exist returns a 42703
// error even when RLS hides the rows, so the anon key is enough to probe the
// schema. Run: npm run check:db
//
import { readFileSync } from 'node:fs';

const env = {};
for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) env[m[1]] = m[2].trim();
}

const baseUrl = env.VITE_SUPABASE_URL;
const apiKey = env.VITE_SUPABASE_ANON_KEY;
if (!baseUrl || !apiKey) {
    console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env');
    process.exit(1);
}

// [label, migration file, table, column (null = table existence only)]
const CHECKS = [
    ['employees table', 'schema.sql', 'employees', null],
    ['employees.user_id', 'migration_auth.sql', 'employees', 'user_id'],
    ['employees.avatar_color', 'migration_avatar_color.sql', 'employees', 'avatar_color'],
    ['schedules table', 'schema.sql', 'schedules', null],
    ['schedules.user_id', 'migration_auth.sql', 'schedules', 'user_id'],
    ['roster table', 'migration_roster.sql', 'roster', null],
    ['roster.avatar_color', 'migration_avatar_color.sql', 'roster', 'avatar_color'],
    ['roster.feed_url', 'migration_feed_url.sql', 'roster', 'feed_url'],
    ['settings table', 'migration_settings.sql', 'settings', null],
    ['settings.store_hours', 'migration_store_hours.sql', 'settings', 'store_hours'],
    ['settings.view_range', 'migration_view_range.sql', 'settings', 'view_range'],
    ['settings.store_feed_url', 'migration_store_feed.sql', 'settings', 'store_feed_url']
];

const probe = async (table, column) => {
    // Column probe: a missing column 42703s even under RLS. Table probe: no
    // select param → PostgREST resolves the table itself (42P01 if missing).
    const qs = column ? `?select=${column}&limit=0` : '?limit=0';
    try {
        const res = await fetch(`${baseUrl}/rest/v1/${table}${qs}`, {
            headers: { apikey: apiKey, Authorization: `Bearer ${apiKey}` }
        });
        if (res.ok) return { ok: true };
        const body = await res.json().catch(() => ({}));
        if (body.code === '42703') return { ok: false, why: 'column missing' };
        if (body.code === '42P01') return { ok: false, why: 'table missing' };
        return { ok: false, why: `HTTP ${res.status} ${body.code || ''}`.trim() };
    } catch (e) {
        return { ok: false, why: `unreachable: ${e.message}` };
    }
};

console.log(`\nBreak Planner DB check — ${baseUrl}\n`);

let missing = 0;
let unreachable = 0;
for (const [label, file, table, column] of CHECKS) {
    const r = await probe(table, column);
    if (r.ok) {
        console.log(`  ✓ ${label}`);
    } else if (r.why?.startsWith('unreachable')) {
        unreachable++;
        console.error(`  ✗ ${label} — ${r.why}`);
    } else {
        missing++;
        console.error(`  ✗ ${label.padEnd(24)} (${r.why}) — apply ${file} in the Supabase SQL editor`);
    }
}

console.log('');
if (unreachable > 0) {
    console.error(`❌ Backend unreachable — restore the Supabase project, then re-run.\n`);
    process.exit(1);
}
if (missing > 0) {
    console.error(`❌ ${missing} migration(s) not applied. Paste the listed file(s) into\n   Supabase dashboard → SQL Editor → Run, then re-run npm run check:db\n`);
    process.exit(1);
}
console.log('✅ All migrations applied.\n');
