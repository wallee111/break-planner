# Break Planner

Retail break-scheduling MVP: enter shifts + break/coverage rules, auto-generate a
staggered break plan, visualize it on a timeline, and adjust by drag-and-drop with
live conflict warnings. React + Vite + Tailwind, Supabase backend.

## Secrets & Links Policy (enforced)

**Calendar links and secret tokens must never be committed to this repository.**

When I Work calendar feeds (and any `webcal:` schedule links) embed a private
token in the URL — anyone holding the link can read that person's shift
schedule. This is enforced by a pre-commit hook (`.githooks/pre-commit`) that
blocks any staged content containing feed URLs, When I Work calendar links, or
Supabase project URLs.

Where these values belong instead:

| Value | Where it lives |
|---|---|
| Employee calendar feed link | The roster's "Calendar Feed URL" field (stored in Supabase, per employee) |
| Supabase URL / anon key | `src/lib/supabase.js` local overrides or `.env` (gitignored) |
| Raw `.ics` files | Never in the repo — gitignored (`*.ics`) |

If the hook fires on a false positive, `git commit --no-verify` bypasses it.
Do not use that to commit a real link.

## Development

```bash
npm install
npm run dev      # dev server (includes /wiw-proxy → When I Work calendar proxy)
npm run build
npm run lint
node test_ics.mjs   # verify ICS parsing against a saved feed sample
node test_validation.mjs   # scheduler + coverage validation regression tests
node test_schedule_restore.mjs   # saved schedules restore exactly on load
npm run check:db    # verify every migration is applied to the database
```

### When I Work sync

Each roster member can store their private When I Work calendar feed URL.
On the daily Setup page, "Sync from When I Work" pulls the shifts for the
chosen date and builds the daily team automatically (times + role).

Because When I Work's calendar endpoint does not send CORS headers, the feed
is fetched through a proxy:

- **Dev**: Vite dev-server proxy (`/wiw-proxy/<token>.ics`), configured in `vite.config.js`.
- **Production**: Supabase Edge Function — source is ready in
  `supabase/functions/wiw-proxy/`; deploy with the Supabase CLI.
