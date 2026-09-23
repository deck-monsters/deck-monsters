# Local testing guidelines (env-driven sessions)

Status: Current
Read before: manual end-to-end testing, using shared remote test rooms, staging fights, or
capturing browser evidence.
Verified: 2026-09-23 against current startup commands and reusable-room records.

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

## Staging a fight quickly

The interactive `equip <monster>` flow is a multi-prompt loop and easy to strand a browser
agent in. To get a fight going from the console in a few commands:

- `equip <monster> with "Hit", "Hit", "Heal", …` equips in one shot. Card names go in double
  quotes, comma-separated; unavailable names are reported and skipped, and any slots left
  over reopen the interactive prompt (answer with **Done equipping**).
- `equip` **rebuilds the hand from scratch** (`monster.cards = cards`), returning the old hand
  to your deck. Equipping one card onto a monster that held eight leaves it holding one.
- A monster may only enter the ring with a **full** deck (`cards.length === cardSlots`,
  usually 9) — "A beastmaster does not send a companion into the ring without a full
  deck." A starting deck holds about 20 cards, enough for two full decks.
- `send <monster> to the ring` then `summon a boss` (3 per day) gives two contestants and a
  60s countdown without needing a second player.
- Fights end with `clearRing()`; the roster empties and the pane header goes back to
  `boss in ~Nm`. Revive and healing checks: `TIME_TO_HEAL_MS` is 30s per hp, so a monster
  revived at 1 hp should read `6/30` or so after three minutes.

If a browser-driving agent has already saturated its screenshot budget, a headed Chrome
launched by `playwright-core` on `DISPLAY=:1` with `--remote-debugging-port` can be driven
from short Node scripts (attach with `connectOverCDP`) while the screen recorder captures it.
Playwright's `page.screenshot` does **not** include browser chrome — dismiss Chrome's
"Save password?" bubble (it covers the roster) before recording.

Recording that window with `ffmpeg -f x11grab` captures a *screen region*, not a window, and
Cursor Cloud usually has two Chrome windows open (the `computerUse` one and the CDP test
window). Find the test window with `DISPLAY=:1 xdotool search --onlyvisible --class chrome`
+ `getwindowgeometry`, run `DISPLAY=:1 xdotool windowraise <id>` immediately before starting
the capture, and sample frames afterwards (`ffmpeg -ss <t> -i out.mp4 -frames:v 1 f.png`) and
look at them — the first two recordings of the pixel-fight layer silently captured the other
window. Once the boss summons are spent (`summons 3/3` in the ring header), the timed ring
boss (`boss in ~Nm`) is a free second contestant.

## Reusable rooms (remote test account)

These rooms are owned by the `TEST_USERNAME` account on the remote Supabase project (Path A in
`AGENTS.md`). Reuse them instead of creating new ones, and **update this section in the same
commit** whenever you change what is in them — the next agent plans its test from this list.

| Room | `roomId` | Invite | Purpose | State (2026-09-20) |
|------|----------|--------|---------|--------------------|
| `Test Room A` | `70cb10d2-4faa-4300-9c20-8befe121a3d1` | `717305BE` | Existing character with trained monsters; fights, workshop, items, feeds | Character present; `Fang` (Basilisk, Lvl 0, 9/9 cards) and `Chuvvo` (Gladiator, Lvl 0, 9/9 cards); 20 unequipped cards; ring empty |
| `Test Room B` | `227ba78e-bca5-4bd4-a59c-9793fac508bd` | `328F58D2` | **First-run fixture** — the test account has *no character* here | Reserved. Do not create a character or monster in it; if a first-run test must actually create one, use a throwaway room instead, or delete and recreate Room B and update this row |

The test account is also a *member* (not owner) of `Game Night`. That is a real room: never
spawn, fight, rename, or run anything there.

### Throwaway rooms

When a test will trash a room (boss floods, deletion paths, breaking state, first-run flows
that create a character), create one named `Scratch <purpose> <YYYY-MM-DD>` so it is obvious
whose it is, and **delete it before you finish the task** — every leftover room is a row the
next agent has to explain. `room.delete` is owner-only and also evicts the room from server
memory, so prefer it over SQL. With the dev server on `:3000` and the Path A env sourced:

```bash
node -e '
(async () => {
  const auth = await (await fetch(`${process.env.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: process.env.SUPABASE_PUBLISHABLE_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ email: process.env.TEST_USERNAME, password: process.env.TEST_PASSWORD }) })).json();
  const H = { Authorization: `Bearer ${auth.access_token}`, "Content-Type": "application/json" };
  const rooms = (await (await fetch("http://localhost:3000/trpc/room.list", { headers: H })).json()).result.data;
  console.table(rooms.map(r => ({ id: r.id, name: r.name })));           // 1. look
  for (const r of rooms.filter(r => r.name.startsWith("Scratch ")))       // 2. delete only your scratch rooms
    console.log(r.name, (await fetch("http://localhost:3000/trpc/room.delete", { method: "POST", headers: H, body: JSON.stringify({ roomId: r.id }) })).status);
})()'
```

Run the listing step alone first; never delete `Test Room A`, `Test Room B`, or a room you do
not own. If a task leaves scratch monsters in `Test Room A` that later tests would trip over,
`dismiss <monster>` them from the console and update the table above.
