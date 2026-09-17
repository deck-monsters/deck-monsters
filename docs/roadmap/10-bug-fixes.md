# Bug Fixes and Code Quality

**Category**: Bug / Tech Debt
**Priority**: Medium
**Status**: Active — three open items from the September 2026 live-play pass. The
September 16 2026 mobile UI pass is fully resolved (#98–#111), as is the September 17
post-merge passes (#112–#127). See [`10b-bugs-fixed.md`](10b-bugs-fixed.md) for the full
archive (#3, #51–#58, #59–#73, #74–#85, #86–#97, #98–#111, #112–#127).

## Active Items

Found during the September 2026 live-play review. None is player-blocking; each is
recorded with a root cause so it can be picked up without re-deriving the analysis.

### 1. `profiles.display_name` still defaults to the user's email (follow-up to #95)

`handle_new_user` seeds `display_name` with
`coalesce(display_name, full_name, new.email, '')`
(`supabase/migrations/20260403000000_fix_profile_trigger.sql`). A web signup that never
sets a display name therefore still gets their email address stored as their profile
name.

`publicDisplayName` now masks it on every read path, so it is no longer *shown* to other
players, and `Game.getCharacter` heals character names already saved with an address. But
the underlying column keeps storing real email addresses as display names, which is the
wrong thing to persist and one missed call site away from leaking again.

**Fix**: a migration changing the trigger's fallback to something non-identifying (a
generated handle, or the email local part), plus a one-off `update` for existing rows
where `display_name` matches an email pattern. Deliberately left out of #95 because it is
a data migration against live auth rows and deserves its own change.

Related: rows already written to `room_player_stats.display_name` keep their old value
until the next fight updates them.

**Correction (Sept 17 2026).** This section previously said those rows were "masked on read
too, so this is cosmetic history rather than an active leak". That was **wrong**, and the
claim is why the leak survived: `analytics-queries.ts` read `profiles.display_name` raw for
all four leaderboards, and a live board was showing a full plus-addressed email to the whole
room. Fixed as #112. The trigger migration below is still outstanding — masking on read is a
guard, not a reason to keep storing addresses as display names.

### 2. Some cards emit two roll blocks in the same tick

Measured in the pacing pass: a few cards publish two roll announcements with a 0.0s gap
between them, so both land at once. Seen with the pin / break-free flow —

```
5.9s  M00 rolled _13 +4 on 1d20_ to see if it pins M01.
0.0s  M00 rolled _13 -1 on 1d20_ vs M01's dex (6) to determine if the hit was a success.
```

and again with `is currently ⑂ pinned by` followed immediately by the break-free roll.
These are card-level `emit` calls with no `subEventDelay` between them, so the
content-aware pacing added in #89's follow-up never gets a chance to space them.

Much smaller than the turn-banner problem (#97) — two three-line blocks rather than forty
lines — so it was left alone rather than touching every card individually. The general
fix is a minimum gap enforced centrally, which means making publication async and is a
real change to `RoomEventBus`; worth doing only if more cards show the pattern.

### 3. The fight feed opens with a burst

The first three messages of a fight (fight banner, separator, first turn banner) publish
in the same tick before any pacing applies. Minor, and far less visible since #97 cut the
turn banner down, but it is the one place the feed still starts as a wall.



## Investigated — not bugs (left for the record)

- **Discord `registerUser` subscriber “leak”** — `RoomEventBus.subscribe` uses a `Map.set` by id; re-register replaces the previous subscriber.
- **`fight-stats-subscriber` `log.error`** — the module-level `createLogger` is used inside handlers; the `(err) => void` parameter only shadows inside `attachFightStatsSubscriber` for `.catch(log)`.
- **`activeFlows` check-then-set race** — no `await` between `has` and `set` on the Node event loop, so concurrent HTTP handlers cannot interleave there.
- **`hydrateDeck` alphabetical sort (#65)** — intentional for character inventory UX (mirrors live `addCard`); equipped monster card order is already preserved by `monsters/helpers/hydrate.ts`. See `10b-bugs-fixed.md`.
- **Lucky Strike / Rehit / Horn Swipe discarded-roll crits (#69)** — intentional: Stroke of Luck / Curse of Loki apply only to the selected roll. Documented in player/DM materials. See `10b-bugs-fixed.md`.

## Tasks

- [x] Audit and differentiate `DMG.md` vs `CARDS.md` full content; add how-to-run section (upstream #265) (#3)
- [x] Discord free-text prompt support (#59)
- [x] Discord serialization / `activeFlows` parity (#60)
- [x] Unify web `ringFeed` subscription / cursor (#63)

---

## September 16 2026 mobile UI pass — all resolved

Eight iPhone screenshots of a live Game Night room produced eleven findings (#98–#108),
plus #109 and #110 found while working them. All are resolved — see
[`10b-bugs-fixed.md`](10b-bugs-fixed.md) for each root cause, including the two rejected
designs worth not re-proposing: a timestamp-gap feed divider (the 20–35 min boss spawn
window makes a long pause the feed's normal resting state) and reusing "dismissed" for a
ring exit (it is an existing command, permanent and legal only on dead monsters).

Screenshots: [`assets/ui-bugs-2026-09/`](assets/ui-bugs-2026-09/).

### Observed and deliberately not filed

- **`↓ Latest` sits over feed text** (`05-ring-sammael-card.png`). It is
  `position: absolute` with `opacity: 0.9` and no backdrop, so the card box shows
  through. Arguably intended; listed in case it is not.
- **Roster eats 40% of a phone screen** (`01-ring-roster-boss.png`). Two contestants
  plus the header leave a small feed window. `max-height: 40%` / 32% under
  `max-height: 600px` is working as specified — flagging the *specification*, not a
  defect.
- **`boss in ~17m` vs a feed line reading `A boss will enter the ring in 2 minutes`**
  (`06-ring-summon-sequence.png`). The feed line is historical text from an earlier
  timer; the header is live. Not a mismatch.

---

## September 17 2026 live-play batch (reported, not yet fixed)

Reported from a phone session after #371 deployed. Recorded verbatim-ish with what is
known so far; several are intermittent and need reproduction before a cause is claimed.
Numbering continues in `10b-bugs-fixed.md` as each is resolved.

### A. Ring feed sometimes lacks the "↓ Latest" jump button

Intermittent. The button is present in some screenshots and absent in others with the feed
scrolled up. Suspect the `atBottom` state the button keys off is not re-evaluated when
content grows while the user is already scrolled up — Virtuoso reports `atBottom` from the
last scroll event, and an append that happens with no scroll may leave it stale.

### B. Console refuses to scroll up at all, sometimes

Reported as "at least sometimes". If the feed is pinned to the bottom by a `followOutput`
that re-fires on every append, a user scrolling up during an active fight would be dragged
back down on the next event and read as "will not scroll". The ring pane does not show
this, which is itself a clue — the two panes configure Virtuoso differently.

### C. The boss's turn banner still names a generated beastmaster — FIXED (#124)

**Confirmed from a screenshot**: with `Zhizzi [BOSS]` in the ring, the feed reads
`It's Hopewing's turn.` — and in a fight-log entry, `It's Santi Brainer's turn.` #102 fixed
boss *arrival and departure* to credit the house (`👑 The Editor`), but the turn banner is a
separate announcement and still reads the generated owner's `givenName`.

The reporter's larger suggestion, which is the better fix: **change the generated
character's name itself** so every downstream announcement inherits it, rather than patching
each site that prints an owner name. That would make #102's call-site fix redundant rather
than adding a third special case. Worth doing as the real fix.

### D. "reconnecting" appears with no disconnect, and no reconnect line follows — FIXED (#127)

**Confirmed from a screenshot**: `-- reconnecting --` at the foot of a console that is
otherwise live and up to date.

**Two separate defects, both confirmed in code** — the report describes the pair of them:

1. *Why it tripped.* A locked phone or a switched-away tab has its timers throttled or
   frozen, and a `setTimeout` that came due while suspended fires the moment the page is
   shown again. The watchdog therefore reported a dead connection purely because time had
   passed in the background — which is not evidence of anything, since no frames can arrive
   while the page is suspended whether the socket is healthy or not.
2. *Why it never cleared.* Resuming was `setSubLastEventId(latestTrackedEventIdRef.current)`
   alone. In a quiet room the cursor has not moved since the last subscribe, so that sets
   the value it already had; React bails out, the subscription input is unchanged, tRPC
   never re-subscribes, and the handshake that clears `reconnecting` is never requested.
   The banner sticks forever on a working connection.

**Fixed as #127**: the watchdog is re-armed with a fresh interval when the page becomes
visible rather than acting on a timer that expired in the background, and a resume bumps a
`resumeAttempt` counter so the input always differs and the retry cannot be deduplicated.

### E. Delayed-hit cards are confusing when they trigger

A card whose effect lands on a later turn produces its hit with no line tying it back to the
card that caused it, so the damage appears to come from nowhere. Wants a contextual
announcement naming the originating card at trigger time.

### F. Odd spacing in some messages

Extra blank lines, and indentation that does not line up, in certain feed messages. Needs
specific examples captured before chasing — the card-display block and the turn banner are
the likeliest suspects given their history (#97, #101).

### G. Ordered-list markers clipped in the fight-log event history — FIXED (#125), unconfirmed on device

**Confirmed from a screenshot**: the numbers in a fight's "Events during this fight" list
render as `l.`, `?.`, `3.`, `4.` — the left half of each marker is sliced off.

**Correction.** This section first stated the cause as settled: `.fight-log-detail ol` has
`padding-left: 1.5rem` *and* `overflow: auto`, so the scroll container clips markers painted
in its padding box. That explanation is probably right about the *mechanism* but was written
without reproducing it, and **Chromium does not reproduce it at all** — the real component
with the real stylesheets at 393px renders `1. 2. 3. 4.` correctly, with
`padding-left: 24px` and no horizontal overflow, including with the wide pre-#101 dice-glyph
text the screenshot contains.

The reporter is on iOS Safari. WebKit is known to clip `list-style-position: outside`
markers when the list is itself a scroll container; Blink does not. That difference is the
likeliest explanation, and it is one this environment cannot demonstrate either way.

**Fixed as #125** by moving the scroll container to a wrapper (`.fight-log-events`) so the
`<ol>` is never a scrollport — this removes the precondition rather than relying on either
engine's behaviour, and is correct regardless of which was at fault. **Still needs
confirmation on a real iPhone**: it has not been observed failing, or passing, here.

**Standing limitation this exposed.** Every visual verification in this repo is done by
rendering in headless Chromium, because there is no live app in the agent environment. The
players are on iOS Safari. Rendering-engine-specific bugs are therefore invisible to that
method by construction, and a clean Chromium render is not evidence that a reported visual
bug does not exist. Where a WebKit-specific cause is suspected, prefer a fix that removes
the precondition over one that depends on layout behaviour, and say plainly that it is
unconfirmed.

### H. The handbook's monster-manual button lands on an empty pane — FIXED (#126)

**Reported**: from the help view, the monster-manual button navigates to where the console
used to be, but with the tabbed layout the console may not be in a slot, and the button does
not select it.

**Confirmed in code.** `insertCommand` was `insertFnRef.current?.(command)` — an optional
chain on a ref that only `ConsolePane` sets on mount. Two failure modes followed, and the
report describes both: with the console in no slot the click did nothing at all and the
panel just closed; with the console mounted but not the active tab the command ran where
nobody could see it. Before the slots work the console was always on screen, so the ref was
always set and the assumption held.

**Fixed as #126**: the host (`Terminal`) registers how to reveal a surface, and
`insertCommand` asks for the console before inserting. Revealing is not instant, so a
command with no console yet is held and flushed by the next `registerInsertFn` rather than
dropped. Generalised to `revealSurface(surfaceId)` rather than a console special case, since
this is the shape every future deep link needs.
