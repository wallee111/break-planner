# Break Planner

A daily break-scheduling tool for retail managers. It pulls the day's shifts from
**When I Work**, applies your break rules (by shift length) and coverage rules
(minimum staff per role), auto-generates a staggered break plan, and shows it on a
drag-editable timeline with live coverage warnings.

Built for the Arc'teryx Toronto (Queen St W) floor, but nothing in it is
store-specific.

- **Stack:** React 19 · Vite 7 · Tailwind 3 · Supabase (Auth + Postgres + RLS) · recharts 3 · date-fns 4
- **Status:** active MVP. Deployed on Vercel (auto-deploys from `main`); runs locally with `npm run dev`
- **Product brief:** [`brief.md`](brief.md) · **Backlog:** [`more-ideas.md`](more-ideas.md)

---

## Contents

- [Features](#features)
- [Getting started](#getting-started)
- [Daily workflow](#daily-workflow)
- [When I Work sync](#when-i-work-sync)
- [Coverage warnings](#coverage-warnings)
- [Data & persistence](#data--persistence)
- [Project structure](#project-structure)
- [Testing & verification](#testing--verification)
- [Secrets & links policy](#secrets--links-policy-enforced)
- [Known limitations](#known-limitations)

---

## Features

- **Auto-generated break plans.** Breaks are sized by shift length (e.g. ≤5h → one
  15-min break; 5–7h → 15 + 30-min meal; 7h+ → 2×15 + 30-min meal) and staggered
  so coverage rules hold where possible. Rules are editable on the Parameters tab.
- **When I Work sync.** Paste each person's private WIW calendar link, or one
  store-wide link, and **Sync WIW** builds the day's team with real shift times,
  roles and generated breaks. No manual entry, and no Generate click needed.
- **Drag-and-drop timeline.** Move or resize shifts, drag breaks (they snap to 15
  min and swap on overlap), merge/unlink breaks, arrow-key nudging, live labor
  coverage chart.
- **Live coverage warnings.** Recomputed on every change and split into *break
  conflicts* (fixable) and *staffing gaps* (from the shift schedule). Each warning
  can be dismissed.
- **Accounts.** Supabase email auth with forgot-password and set-new-password
  flows. Each user's roster, settings and schedules are private (row-level
  security).
- **A plan per day.** The date picker (‹ › and **Today**) switches between days;
  each day keeps its own team and breaks, saved automatically as you edit.
  Opening today or a future day that has nothing saved pulls its shifts from When
  I Work and places breaks for you.

## Getting started

### Prerequisites

- Node.js **20.19+** (Vite 7 requirement)
- A Supabase project (the free tier is fine)

### 1. Install

```bash
npm install
```

`npm install` also points git at the repo's pre-commit hook (`prepare` script →
`git config core.hooksPath .githooks`), so the [links policy](#secrets--links-policy-enforced)
is enforced from your first commit.

### 2. Configure environment

```bash
cp .env.example .env
```

| Variable | Required | Value |
|---|---|---|
| `VITE_SUPABASE_URL` | yes | Supabase dashboard → Project Settings → API → Project URL |
| `VITE_SUPABASE_ANON_KEY` | yes | Same page → `anon` / publishable key |
| `VITE_WIW_PROXY_URL` | production only | Base URL of the deployed `wiw-proxy` edge function (see [CORS proxy](#cors-proxy)) |

`.env` is gitignored. Never commit real values.

### 3. Set up the database

In the Supabase dashboard → **SQL Editor**, run these files **in this order**:

| # | File | Creates |
|---|---|---|
| 1 | `schema.sql` | `employees`, `schedules` tables |
| 2 | `migration_auth.sql` | `user_id` columns + per-user RLS policies. **Not idempotent, run it once.** |
| 3 | `migration_roster.sql` | `roster` table (master employee list) |
| 4 | `migration_avatar_color.sql` | Profile colours on employees + roster |
| 5 | `migration_settings.sql` | `settings` table (rules, colours, view range) + RLS |
| 6 | `migration_store_hours.sql` | Legacy `store_hours` column (feature removed; column kept harmlessly) |
| 7 | `migration_view_range.sql` | `settings.view_range` |
| 8 | `migration_feed_url.sql` | `roster.feed_url` (per-employee WIW link) |
| 9 | `migration_store_feed.sql` | `settings.store_feed_url` (store-wide WIW link) |
| 10 | `migration_plan_date.sql` | `employees.plan_date` + `schedules.updated_at` (a plan per day). Additive; assigns existing team rows to their last saved date |

Then verify everything is in place:

```bash
npm run check:db          # probes every table/column, names any missing migration
```

For a deeper check that also covers RLS policies, paste
[`verify-migrations.sql`](verify-migrations.sql) into the SQL Editor.

**Auth settings** (dashboard → Authentication):

- *Sign In / Providers → Email:* leave "Confirm email" on for real use. Turning it
  off is convenient for test accounts.
- *URL Configuration → Redirect URLs:* add `http://localhost:5173` (and your
  production URL later). Password-reset links only redirect to allowlisted URLs.

### 4. Run

```bash
npm run dev               # http://localhost:5173
```

## Daily workflow

1. **Employees tab.** Build the roster once: name, default role, colour, and
   optionally each person's WIW calendar link (*WIW Calendar Feed* column; save
   with Enter). Or paste one store-wide link into **Store Feed** at the top.
2. **Parameters tab.** Set break rules (by shift length), coverage rules (minimum
   staff per role, `Any` = everyone) and roles/colours. Edits are a draft: a
   **Save changes / Discard** bar slides up as soon as anything changes, and
   leaving the tab with unsaved edits asks whether to save or discard. Role
   renames and deletes reach the team and roster only when you save.
3. **Schedule tab.** Pick the day with the date picker. If nothing is saved for
   it yet (today or later) and feeds are set up, everyone working that day appears
   automatically with their shift and auto-placed breaks. **Sync WIW** re-pulls
   shifts at any time (e.g. after schedule changes in When I Work).
4. **Adjust.** Drag breaks and shifts and watch the warnings and the labor chart
   update live. **Generate** re-plans all breaks from scratch; **Clear** empties
   the breaks. Every change saves to that day; there's no Save button.

## When I Work sync

### Two kinds of feed

| Feed | Where to paste it | How shifts are matched |
|---|---|---|
| **Personal** (one person's schedule) | Employees → that person's *WIW Calendar Feed* | Every event belongs to that person. Role comes from the event title (`Shift as Product Guide at …`). |
| **Store-wide** (e.g. a manager's full-store link) | Employees → **Store Feed** | Each event is matched to a roster member whose **name appears in the event title or description** (case-insensitive). Unmatched shifts are counted in the sync result: `N unmatched (not on roster)`. |

Both can be used together. A personal feed wins over the store feed for the same
person.

Get the link from When I Work's calendar subscription option. It is a `webcal:`
or `https:` URL ending in `.ics`. The `openshifts.ics` variant only lists
unassigned shifts and won't populate anyone.

### What a sync does

For the chosen date it fetches each feed, parses the iCalendar events
([`src/utils/ics.js`](src/utils/ics.js), RFC 5545 folding/escaping, UTC times
converted to local), then for each matched person:

- adds them to the day's team, or updates their shift if already there
- creates a colour for any new role
- **generates their breaks** using your rules, merged into the existing plan.
  People you didn't re-sync keep any manual break edits.

### CORS proxy

When I Work's calendar endpoint sends no CORS headers, so browsers can't fetch it
directly. The app fetches `<proxy>/<token>.ics` instead:

- **Development:** Vite proxies `/wiw-proxy/*` to When I Work
  ([`vite.config.js`](vite.config.js)). Nothing to configure.
- **Production:** deploy the edge function in
  [`supabase/functions/wiw-proxy/`](supabase/functions/wiw-proxy/index.ts). It only
  accepts hex feed tokens, so it can't be used as an open proxy:

  ```bash
  npx supabase login                       # once, opens the browser
  npx supabase functions deploy wiw-proxy \
    --project-ref <project-ref> --no-verify-jwt --use-api
  # optional: lock CORS to your app's origin
  npx supabase secrets set ALLOWED_ORIGIN=https://your-app.example --project-ref <project-ref>
  ```

  Then set `VITE_WIW_PROXY_URL=https://<project-ref>.supabase.co/functions/v1/wiw-proxy`.
  `--no-verify-jwt` is required: the app's proxy request carries no Supabase JWT,
  so the default JWT check would reject it with 401. `--use-api` bundles the
  function on Supabase's side, so Docker isn't needed. (`npx supabase` works
  without a Homebrew install.) This is how the live deployment is set up.

## Coverage warnings

Validation runs automatically on every change. It walks the day in 15-minute slots
across the span of scheduled shifts and checks each `min_staff` coverage rule.
Each shortfall is one of two kinds:

| Kind | Meaning | Shown as |
|---|---|---|
| **Break conflict** | Enough people are scheduled, but breaks take the floor below the minimum. Fixable by moving breaks. | Red badge + red zone |
| **Staffing gap** | Too few people are scheduled at all (e.g. one person opening against a minimum of 2). No break plan can fix it; it comes from the shift schedule. | Amber badge + dashed amber zone |

Some break conflicts are inherently unavoidable. A sole manager's breaks always
violate a `Manager ≥ 1` rule. **Dismiss** (per warning or *Dismiss all*) hides
those. A dismissed warning comes back if the underlying problem changes.

## Data & persistence

All tables are per-user via RLS (`auth.uid() = user_id`).

| Table | Holds |
|---|---|
| `roster` | Master employee list: name, default role, colour, `feed_url` |
| `employees` | Each day's team: one row per person per `plan_date` (name, roles, shift start/end) |
| `settings` | One row per user: break rules, coverage rules, role colours, view range, `store_feed_url` |
| `schedules` | Each day's break plan (`schedule_data` JSONB): one row per user + `date`, updated in place (newest `updated_at` wins) |

The app opens on today. Changing the date loads that day's `employees` rows and
`schedules` row; a day with nothing saved loads empty. Dates are **local**
calendar days. Saves for a day are queued so they apply in order, and a slow
response for a day you've already left is ignored.

Break times are stored as JSON strings and re-anchored as time-of-day
([`src/utils/scheduleSerialization.js`](src/utils/scheduleSerialization.js)).

Before `migration_plan_date.sql`, every edit inserted a new `schedules` row. Those
old copies are still in the table, unused (the newest per day is the live one).

## Project structure

```
src/
  App.jsx                       tab routing (Schedule / Employees / Parameters / Profile)
  context/
    AuthContext.jsx             session, sign in/up, password reset, friendly network errors
    PlannerContext.jsx          app state + actions: team, roster, rules, schedule, WIW sync,
                                derived coverage validation
  components/
    Schedule/TimelineView.jsx   Schedule tab: header controls, timeline, warnings, activity log
    Schedule/components/        timeline pieces (TimelineRow, BreakBlock, ValidationOverlay, …)
    Schedule/LaborChart.jsx     staffed-vs-on-break area chart (recharts)
    Employees/EmployeeManager.jsx  Employees tab: roster table, feed links, store feed
    Setup/*Config.jsx           Parameters tab cards (break rules, coverage rules, roles)
    Auth/                       login / signup / reset screens, profile
    ui/                         Button, Card, Input
  services/
    plannerService.js           Supabase CRUD (roster, employees, settings, schedules)
    wheniworkSync.js            feed fetch (direct → proxy), date bucketing, store-feed matching
  utils/
    scheduler.js                break generator + coverage validation
    ics.js                      iCalendar parser
    scheduleSerialization.js    restore saved schedules
supabase/functions/wiw-proxy/   production CORS proxy (Deno edge function)
scripts/check-db.mjs            migration verifier (npm run check:db)
schema.sql, migration_*.sql     database setup (see Getting started)
.githooks/pre-commit            blocks committing calendar links / project URLs
```

## Testing & verification

```bash
npm run build                    # must pass
npm run lint                     # must be clean (0 errors)
node test_ics.mjs                # ICS parser + WIW sync helpers + store-feed matching (38 checks)
node test_validation.mjs         # generator + coverage validation regressions (9 checks)
node test_schedule_restore.mjs   # saved-schedule round trip / restore (14 checks)
node test_parameters.mjs         # Parameters draft: dirty tracking, role ops, validation (29 checks)
node test_clumping.mjs           # diagnostic printout of break spacing (not pass/fail)
npm run check:db                 # live database has every migration applied
```

Optional live feed check (the link goes in your shell only, never in a file):

```bash
WIW_FEED_URL='<your calendar link>' node test_ics.mjs
```

The test scripts are plain Node ESM (`"type": "module"`). App modules they import
must use explicit `.js` extensions on internal imports.

## Secrets & links policy (enforced)

**Calendar links and secret tokens must never be committed to this repository.**

When I Work calendar feeds (and any `webcal:` link) embed a private token. Anyone
holding the link can read that person's schedule. The pre-commit hook
(`.githooks/pre-commit`) blocks staged content containing feed links, When I Work
calendar URLs, or Supabase project URLs.

| Value | Where it lives |
|---|---|
| Per-employee WIW link | Employees tab → *WIW Calendar Feed* (stored in `roster.feed_url`) |
| Store-wide WIW link | Employees tab → *Store Feed* (stored in `settings.store_feed_url`) |
| Supabase URL / anon key | `.env` (gitignored) |
| Raw `.ics` files | Never in the repo (`*.ics` is gitignored) |

Tests that need a WIW-shaped URL build it from parts (e.g. a `'f'.repeat(40)`
token). If the hook fires on a genuine false positive, `git commit --no-verify`
bypasses it. Never use that to commit a real link.

## Known limitations

- **Past days never auto-sync.** They show only what was saved; use **Sync WIW**
  to pull them on purpose.
- **Roster edits don't reach other days.** Renaming someone or changing their
  colour updates the day on screen; other days keep the old values.
- **Old schedule copies.** Rows from before per-day saving remain in `schedules`
  (about 1,500 on the live database). Harmless; can be pruned.
- **Store-feed matching needs names in events.** If a store-wide feed carries no
  employee names, shifts can't be attributed (they show as *unmatched*); the When
  I Work API would be the fallback.

Planned work lives in [`more-ideas.md`](more-ideas.md).
