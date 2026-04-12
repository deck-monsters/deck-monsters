# Local testing guidelines (env-driven sessions)

This guide captures repeatable local-testing principles for sessions where required env vars are already set externally.

## Core principles

- Keep secrets out of docs, logs, commits, and screenshots. Only document variable names.
- Verify env var presence early, then fail fast if required values are missing.
- Run `pnpm build` before tests/manual flows on fresh checkouts so downstream packages see fresh `@deck-monsters/engine` `dist/` output.
- Start API and web servers in separate long-lived terminal/tmux sessions so logs remain available while testing.
- Prefer minimal, high-signal checks first (`/health`, auth flow, room list) before long manual scenarios.
- Record evidence during successful runs only (video/screenshot/log snippets from passing behavior).

## Environment setup checklist (no secret values)

- Required vars should be injected by the shell/session manager, not hardcoded in files.
- Quick presence check:
  - `for v in TEST_USERNAME TEST_PASSWORD VITE_SUPABASE_URL VITE_SUPABASE_PUBLISHABLE_KEY SUPABASE_URL SUPABASE_SECRET_KEY DATABASE_URL; do [ -n "${!v:-}" ] && echo "$v=SET" || echo "$v=MISSING"; done`
- Keep URL-style vars normalized when needed by issuer checks (`no trailing slash`), for example:
  - `SUPABASE_URL="${SUPABASE_URL%/}"`

## Service startup pattern

1. Build once:
   - `pnpm build`
2. Start API server:
   - `pnpm --filter @deck-monsters/server dev`
3. Start web server:
   - `pnpm --filter @deck-monsters/web dev -- --host 0.0.0.0 --port 5173`
4. Confirm API readiness:
   - `curl -sS http://localhost:3000/health`

## Manual testing heuristics

- Validate auth + room load before gameplay checks.
- For command parsing checks, use exact supported command strings (for example, `spawn a monster`).
- For cross-room checks, keep two room tabs open simultaneously and switch frequently while watching both console histories.
- For autocomplete checks:
  - Trigger with at least two characters.
  - Verify context-aware substitutions (e.g., concrete monster names in `send [monster] to the ring` suggestions).
  - Re-check after state-changing actions (send/revive/fight outcomes) without reloading.
- For boss pacing/scaling checks:
  - Use beginner-level monsters in a fresh or low-progress room.
  - Observe multiple encounter cycles before concluding.
  - Capture timing/strength notes from ring feed, not memory.

## Reusable rooms from this session

These rooms were created during local manual testing and can be reused in future sessions.

- `Test Room A`
  - `roomId`: `70cb10d2-4faa-4300-9c20-8befe121a3d1`
  - `inviteCode`: `717305BE`
- `Test Room B`
  - `roomId`: `227ba78e-bca5-4bd4-a59c-9793fac508bd`
  - `inviteCode`: `328F58D2`

If either room becomes noisy or drifts too far from beginner state, create a fresh room for pacing/scaling verification and add its metadata here.
