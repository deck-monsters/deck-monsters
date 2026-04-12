# Follow-up: remote Supabase manual test checklist

Use this checklist in a future Cursor Cloud session once secrets are available.

## Required environment variables

Ensure these are set in the session:

- `TEST_USERNAME`
- `TEST_PASSWORD`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_URL`
- `SUPABASE_SECRET_KEY`
- `DATABASE_URL`
- `VITE_SERVER_URL` (optional; empty is fine in dev)

Quick check:

- `for v in TEST_USERNAME TEST_PASSWORD VITE_SUPABASE_URL VITE_SUPABASE_PUBLISHABLE_KEY SUPABASE_URL SUPABASE_SECRET_KEY DATABASE_URL; do [ -n "${!v:-}" ] && echo "$v=SET" || echo "$v=MISSING"; done`

## Start services

1. Start API server:
   - `pnpm --filter @deck-monsters/server dev`
2. Start web app:
   - `pnpm --filter @deck-monsters/web dev -- --host 0.0.0.0 --port 5173`

## Manual verification goals

Validate the fixes on branch `cursor/room-console-boss-polish-5554`:

1. **No cross-room boss/ring bleed**
   - Open two different rooms in separate browser tabs.
   - Trigger/observe ring events in room A.
   - Confirm room B does not show mirrored boss/ring announcements.

2. **No duplicate console command echoes**
   - In Console, run `send <monster> to the ring`.
   - Confirm only one user command echo appears for that submit.

3. **Autocomplete refreshes without hard reload**
   - After a fight, verify `revive <monster>` suggestions include newly dead monsters.
   - After ring changes, verify `send <monster> to the ring` suggestions update.

4. **FTUX guidance appears for new users**
   - Sign in with a fresh user (or clear to fresh room/user state).
   - Confirm Console shows starter guidance chips before first actions.

5. **Boss pacing/scaling feels improved for beginner rooms**
   - In a room with only beginner monsters, observe boss spawn timing and relative strength.
   - Confirm bosses appear more frequently than before and are not over-leveled.

## Evidence to capture

- One short video covering at least items 1-3 above.
- At least one screenshot showing FTUX guidance.
- Optional server logs for boss spawn cadence samples.
