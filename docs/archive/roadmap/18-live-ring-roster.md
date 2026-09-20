# Live Ring Roster
> **Archived** — shipped; kept for the reasoning and constraints. Leftovers, if any, are tracked in [22 — Small Leftovers](../../roadmap/22-small-leftovers.md).

**Category**: Feature / Web UI
**Status**: ✅ Done

## Problem

Combat narration already reports HP and AC, but only as prose scattered through the feed
("Aqim was braced for a hit…", "*Aqim has 40HP.*", "His ac boost is now 0"). To answer
"who is winning?" a player had to scroll back through several screens of dice rolls and
reconstruct the board by hand. On a phone — where the feed shows roughly one card
resolution per screen — that is effectively impossible, and it gets worse as contestant
count grows (the ring holds 2–12, and boss gauntlets and team ring events push toward the
top of that range).

The engine has always had the data: `look at monsters in the ring` prints exactly these
stats. But it is a point-in-time text dump that lands *in* the same feed and is stale the
moment the next card resolves.

## Solution

A persistent roster panel between the ring pane header and the event feed, showing every
contestant with a live HP bar, `hp/maxHp`, AC, creature type, level, and boss/team tags.
The viewer's own monsters are highlighted; defeated monsters are struck through.

### Data path

The roster rides the **existing `ring.state` public broadcast** rather than a new query or
subscription. That event was already:

- `scope: 'public'`, published on the room's event bus (so room-scoping is inherent)
- skipped by `event-persister.ts` (ephemeral state-sync, never persisted)
- filtered out of the rendered feed by `RingPane`
- seeded into the `ringFeed` handshake payload

`Ring.contestantSnapshots()` builds the per-contestant array, and `publishState()` now
includes it. `ac` is read through the live getter so per-encounter boosts are reflected as
they change. `team` and `targetingStrategy` come off the **contestant**, not the monster,
because ring events set them per-encounter (see the `Contestant` docblock in
`ring/index.ts`).

### Publish points

`publishState()` is called from the existing ring-lifecycle sites plus four new ones:

| Site | Why |
|------|-----|
| Just before `playerTurnBegin` is emitted | Highlights whose turn it is before the card box lands |
| After each resolved `card.play` | Keeps HP/AC in step with the narration |
| `startEncounter()` | Shows the starting board before the first card lands |
| `endEncounter()` | Post-fight HP is what players check between rounds |

### Acting-contestant highlight (2026-09-19)

Each snapshot carries `acting: boolean`, true for the single contestant whose turn it
currently is. `Ring.activeContestant` is a plain instance field — ephemeral like
`inEncounter`/`encounter`, never `options`-backed, never serialized — set in `fight()`
immediately before the `playerTurnBegin` emit and cleared in both `startEncounter()` (fight
start) and `endEncounter()` (fight end, so a stale highlight can never survive between
fights). `contestantSnapshots()` derives `acting` as
`this.inEncounter && this.activeContestant?.monster === monster`, so it reads false outside
an encounter even if a stale reference lingered.

`RingRoster.tsx` renders this as a subtle terminal-style treatment on the expanded
roster row: a small inset accent bar (`box-shadow`), a `▶` marker before the name, and
brighter name text — no animation. A dead contestant is never shown as acting even if the
payload says so (a card that kills its own target mid-resolution could otherwise flash the
highlight on a corpse for one publish). The field is optional on the client-side
`RingContestantSnapshot` type so older polled-seed payloads that predate this field still
render.

One publish per resolved card matches the feed's own card-to-card pacing
(`veryShortDelay`, 2–4s), so this adds no meaningful traffic next to the announce lines
already going out for the same card.

### Client

`RingRoster.tsx` renders the panel. It prefers the pushed `ring.state` contestants and
falls back to the `game.ringState` query, so the roster is populated on mount instead of
staying blank until the first card of the next fight resolves. The handshake also carries
`contestants` for the same reason. Collapse state persists in `localStorage`
(`dm:ringRosterCollapsed`), wrapped in try/catch — blocked storage defaults to expanded.

Health-bar colours come from **dedicated** `--color-hp-healthy` / `--color-hp-hurt` /
`--color-hp-critical` tokens, defined per theme. The first cut reused the semantic
`--color-success` / `--color-accent` / `--color-error`, which was wrong: those carry
unrelated meanings and are not ordered by brightness, so in phosphor (the default) and
street-fighter the "hurt" colour was actually *darker* than "critical" and the bar read
backwards. Each theme's ramp now falls monotonically in luminance with a visible step
between stages, so a draining bar reads as draining in greyscale and for a colour-blind
viewer rather than by hue alone. `apps/web/src/__tests__/theme-palettes.test.ts` enforces
this for every theme file, along with token completeness and WCAG contrast. The bar transition is disabled under
`prefers-reduced-motion`. The panel is capped at 40% pane height (32% on short viewports)
and scrolls internally, so a 12-monster boss gauntlet can never crowd out the feed.

## Hardening note

The handshake guards `typeof ring.contestantSnapshots === 'function'`. The handshake
bootstraps the entire `ringFeed` subscription, so a throw there takes down the feed for
that client. An empty roster — which the next `ring.state` repairs within one card — is a
far better failure mode than no connection.

**Client trust order (fixed 2026-09-19, #152).** `clearRing()` publishes the true final
board (all deaths, final HP) once a fight ends, then immediately publishes a second, empty
`ring.state` once contestants are cleared — both intentional. The client's derivation of
which contestant list to render used `timerState.contestants.length > 0` as a proxy for
"has a live push arrived yet," which meant that second, legitimately-empty push looked
identical to "no live push yet" and fell back to the polled `game.ringState` query — a
snapshot that could be minutes stale. `RingPane.tsx` now tracks whether *any* live push has
landed with a dedicated ref (`hasLiveTimerStateRef`) and, once true, trusts
`timerState.contestants` verbatim, including empty. The polled query is a cold-start seed
only, never a fallback once live data exists — an empty live roster must always win over a
non-empty stale one.

### Badge clipping under long names (2026-09-19)

`.roster-name` used to be a single inline span (icon + name text + BOSS/team tag spans)
with `white-space: nowrap; overflow: hidden; text-overflow: ellipsis`. Because the tags sit
at the *end* of that span, a long monster name (e.g. `Charri (charloat, To Listen)`) pushed
the BOSS tag past the ellipsis cutoff — the tag that most needs to stay visible disappeared
exactly when the name was long enough to need clipping.

Fixed by splitting the name text into its own child, `.roster-name-text`, which alone
carries the `overflow`/`ellipsis` treatment; `.roster-name` is now a flex row
(`min-width: 0`) so the icon, the clipped name text, and the tags lay out side by side with
the tags (`flex-shrink: 0`) always visible. The dead-row strikethrough moved with it, from
`.roster-row-dead .roster-name` to `.roster-row-dead .roster-name-text`, so it targets only
the name, not the tags.

## Tests

- `packages/engine/src/ring/index.test.ts` — snapshot contents, damage tracking, death
  flag, boss owner elision, acting-contestant flag (set and cleared), and `ring.state`
  payload
- `apps/web/src/__tests__/ringRoster.test.tsx` — `hpRatio` clamping (overkill damage,
  overheal, zero/NaN `maxHp`), band thresholds, standing count, defeated rendering,
  boss/team tags (including a long-name case asserting the BOSS tag stays outside the
  clipped `.roster-name-text`), own-monster highlight, acting-contestant highlight (and
  that a dead contestant is never marked acting), collapse, and the accessible meter

## Possible follow-ups

Not built, no demand yet:

- Per-contestant status effects (conditions like "braced", stat boosts) as inline chips
- Damage-taken flash on the bar when HP drops
- Sparkline of HP across the fight, in the fight log detail view

## Feed readability (September 2026)

The roster was the first half of making a live fight followable; the second half was the
feed itself. Two measured changes, both documented in
[`docs/engine-concurrency-and-timing.md`](../../engine-concurrency-and-timing.md):

- **Content-aware pacing.** Pauses now scale with the message just published, gaps no
  longer stack at beat boundaries, and no single gap exceeds 8s. Before: the pause after a
  4+ line block averaged 1.6s while a one-line result got 3.7s — exactly backwards.
- **Turn banner collapse (#97).** The banner reprinted the full monster stat card every
  turn, accounting for 47% of every line in the feed. A repeat turn is now one line
  carrying the values that change. Total feed text fell 45%.

Both were measured with `packages/harness`: run fights with the delay midpoints divided by
a constant, capture the public bus with timestamps, and multiply the gaps back up.
Ordering and relative sizing are unaffected and a whole fight completes in seconds. Worth
re-running that way before changing pacing again — the original inversion was invisible by
inspection and obvious in one table.
