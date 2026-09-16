# Bug Fixes and Code Quality

**Category**: Bug / Tech Debt
**Priority**: Medium
**Status**: Active — three open items from the September 2026 live-play pass, plus four
open items (#98–#101) from the September 16 2026 mobile UI pass triaged at the bottom of
this doc. Everything earlier is resolved; see [`10b-bugs-fixed.md`](10b-bugs-fixed.md) for
the full archive (#3, #51–#58, #59–#73, #74–#85, #86–#97).

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
until the next fight updates them. Those are masked on read too, so this is cosmetic
history rather than an active leak.

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

## September 16 2026 mobile UI pass — triage (OPEN, none fixed yet)

Eight iPhone screenshots of deck-monsters.com, saved alongside this doc in
[`assets/ui-bugs-2026-09/`](assets/ui-bugs-2026-09/). This section is the analysis
only — **no code was changed**. Numbering continues from #97; move each item to
`10b-bugs-fixed.md` with its root cause as it is fixed.

Verification status is stated per item. There is no live app in the dev container
(`pnpm setup:local` needs Docker/Supabase), so "verified" below means *read against
source*, never *observed in a running browser*.

### 98. Feed text is clipped off the right edge of both panes — HIGH CONFIDENCE

Visible in `02-ring-clipped-prose.png` ("…has entered the ring at the" — the trailing
word is sliced by the screen edge) and `03-console-clipped-level.png`, where
`You summoned 🐗 Seeskane Orcbane — a level Minotaur!` is missing its level number:
the `6` is clipped, and `Minotaur!` wraps to the next line. The roster on the same
screen reads `lvl 6`, so the number *is* in the payload. Note the asymmetry in every
screenshot — there is clear padding on the left, and none on the right.

**Root cause (verified against `react-virtuoso@4.18.4` source, not guessed).**
`.event-feed` (`terminal.css:95`) is the class we hand to `<Virtuoso>`, so it lands on
the library's **scroller** element, and it carries `padding: var(--pane-padding)`
(0.75rem). Virtuoso's scroller style (`dist/index.mjs:2503`, `lr`) adds
`position: relative`, and the viewport it nests inside it
(`dist/index.mjs:2613`, style factory `Jt`) is:

```js
{ height: "100%", position: "absolute", top: 0, width: "100%" }
```

For an absolutely positioned box the containing block is the nearest positioned
ancestor's **padding box**, so `width: 100%` resolves to *content width + left padding
+ right padding*. With `left` unspecified the viewport starts at its static position
(inside the left padding, which is why the left gutter looks right) and then runs
`2 × 0.75rem` too wide, off the right-hand side, where `overflow-x: hidden` on the
scroller silently cuts it. At a 16px root that is 24px — comfortably a short word or a
digit on a phone. `height: 100%` has the same defect vertically; it is just less
visible because that axis scrolls.

**Proposed fix**: never put padding on a Virtuoso scroller. Drop the padding from
`.event-feed` and move it onto the in-flow `<ol>` (`FeedList`, defined in both
`RingPane.tsx` and `ConsolePane.tsx`) — a normal-flow child measures against the
content box and is immune to this. Check the `EmptyPlaceholder` `<li>` in both panes
still looks inset afterwards. This affects **both feeds**, since both pass
`className="event-feed"`.

**Not yet done**: confirming the rendered box widths. Worth a `renderToStaticMarkup`
+ real-CSS harness test, or simply a regression test asserting `.event-feed` carries
no horizontal padding, with a comment pointing at this entry.

### 99. Fight-log event trace renders raw engine markup — VERIFIED

`07-fightlog-trace-raw-markup.png` shows the expanded trace printing
`*It's Santi Brainer's turn.*` with literal asterisks, and
``plays the following monster: ``` `` with a literal fence.

**Root cause**: `FightLogView.tsx:127` renders `{ev.text.slice(0, 200)}` directly as a
text node. Every other surface routes engine text through
`utils/format-event-text.tsx`, which strips the ``` fences into `.event-card-block`
panels. The fight log was never wired to it.

Two sub-problems worth fixing together:
- The 200-char `slice` cuts mid-word and mid-fence (`A powerful, gold, deser…`), so a
  truncated trace can end inside a code block.
- `format-event-text.tsx` only handles ``` fences — it does **not** handle `*bold*` or
  `_italic_`, despite those being all over engine output (`*It's X's turn.*`, and the
  `_13 +4 on 1d20_` roll blocks quoted in open item 2 above). So routing the fight log
  through it fixes the fences but leaves the asterisks. Extending the formatter is a
  change to the main feeds too, and should be done deliberately with tests.

### 100. Round count is not pluralized — VERIFIED

`07-fightlog-trace-raw-markup.png`: `Dragon Blood won vs Stary in 1 rounds`.

**Root cause**: `utils/fight-display.ts:64` and `:71` interpolate
`in ${f.roundCount} rounds` with no singular branch. Both call sites need it; the
same string feeds the ring pane's last-fight footer via `fightTitleOneLine`.

### 101. Turn-banner glyphs render as tofu boxes — NEEDS VERIFICATION

`08-fightlog-trace-tofu.png` shows the round/turn banner as a row of missing-glyph
boxes (`□ ⊠ ⊞ …`) before `round 1, turn 1`. The engine emits some decorative
character the bundled JetBrains Mono has no glyph for; the browser falls back and
draws tofu.

**Not verified**: which codepoint. Next step is to find the banner string in
`packages/engine/src/announcements/` and check it against the font's coverage, rather
than assume. Fix is either a glyph the font actually ships or an explicit emoji
fallback in `--font-family`. Note this is the *collapsed* banner from #97, so the
character survives into current output.

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
