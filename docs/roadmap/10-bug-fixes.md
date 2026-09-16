# Bug Fixes and Code Quality

**Category**: Bug / Tech Debt
**Priority**: Medium
**Status**: Active — three open items from the September 2026 live-play pass, plus nine
open items (#98–#106) from the September 16 2026 mobile UI pass triaged at the bottom of
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

Nine findings from eight iPhone screenshots of deck-monsters.com, saved alongside this doc in
[`assets/ui-bugs-2026-09/`](assets/ui-bugs-2026-09/). This section is the analysis
only — **no code was changed**. #98–#101 are layout/rendering; #102–#106 are the *content* of the messages themselves —
what they say, whether it is true, and whether one event produces one message.
Numbering continues from #97; move each item to
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

### 101. Turn-banner glyphs render as tofu boxes — VERIFIED (codepoint identified)

`08-fightlog-trace-tofu.png` shows a row of missing-glyph boxes before `round 1, turn 1`.

**Root cause**: the banner divider is 21 dice characters —

```
\n⚀ ⚁ ⚂ ⚃ ⚄ ⚅ ⚀ ⚁ ⚂ ⚃ ⚄ ⚅ ⚀ ⚁ ⚂ ⚃ ⚄ ⚅ ⚀ ⚁ ⚂\n
```

`announcements/nextTurn.ts:18` and `announcements/nextRound.ts:12`. These are
U+2680–U+2685 (DIE FACE-1 … DIE FACE-6), which **JetBrains Mono does not ship**. The
browser falls back per-glyph and draws tofu. The count matches the screenshot exactly.

**Two decisions, not one.** The rendering fix is a font fallback or a character the font
has. But the *content* question is whether a 21-glyph divider earns its place at all: it
wraps to two full lines on a phone, on **every turn**, immediately after #97 cut turn
banners by 45% for exactly this reason. Deleting it is probably the better fix, and is
the one that needs a human call — it is a deliberate piece of the game's voice.

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

### 102. Every boss arrival credits a beastmaster who does not exist — VERIFIED

`06-ring-summon-sequence.png`: `A ferocious Weeping Angel has entered the ring at the
behest of 🎡 Gorgeous Protector.` There is no player called Gorgeous Protector. The same
screen shows `02-ring-clipped-prose.png`'s `at the behest of 🎎 Incredible Swan`.

**Root cause**: `announcements/contestant.ts:16` is the single join announcement for
*every* contestant, and it renders `${character.icon} ${character.givenName}` — the
monster's owner. Bosses are given a **randomly generated owner** by
`characters/helpers/random.ts` (`randomCharacter`) under `userId: 'boss'`
(`docs/boss-encounters.md` §1). So the join line invents a plausible-looking player name
and attributes the boss to them.

This is worst for a **timer-spawned** boss, where no player was involved at all: the feed
states that a named beastmaster sent it in. `06-ring-summon-sequence.png` is exactly that
case — `A boss will enter the ring in 2 minutes` immediately precedes it, so it is the
20–35 min spawn timer, not a summon.

**Fix**: branch in `announceContestant` on `contestant.isBoss` and use boss-appropriate
wording with no owner clause at all (the ring already knows it is a boss — the roster
renders a `BOSS` tag from the same data).

### 103. A player-summoned boss is announced twice, out of order, under two names — VERIFIED

`02-ring-clipped-prose.png` and `01-ring-roster-boss.png` are consecutive views of one
event (countdowns `fight in 24s` then `fight in 19s`). Read together, the feed says:

```
An enraged Minotaur has entered the ring at the behest of 🎎 Incredible Swan.
[ Seeskane Orcbane stat card ]
Tweettypography has summoned a boss into the ring!
```

`03-console-clipped-level.png` confirms the viewer, Tweettypography, ran `summon a boss`
and got Seeskane Orcbane. So one action produces two public messages naming **two
different beastmasters**, only one of whom is real (#102 explains the other).

**Root cause**: `commands/monster.ts` calls `ring.spawnBoss(...)` at line 339, which runs
`addMonster` → `announceContestant` and publishes the arrival plus the full stat card.
Only afterwards, at line 361, does it publish
`${character.givenName} has summoned a boss into the ring!`. The line that *explains* the
event therefore lands after the event and after a ~15-line card, which is why it reads as
a second, unrelated summon.

**Fix**: publish the summon line before `spawnBoss`, and fold the attribution into the
arrival (#102) so one action produces one message. Note `ring.spawnBoss` is also called
by the timer (`ring/index.ts:1548`) and by ring events (`:1479`), so the summoner clause
belongs at the call site, not inside `spawnBoss`.

### 104. "was summoned from the ring" says the opposite of what happened — VERIFIED

`06-ring-summon-sequence.png`: `Dalfi (dalfe, Cow/beef) was summoned from the ring by
⛄ Thunder Smasher.` Summoning is what you do *into* a ring. The monster left.

**Root cause**: `announcements/contestantLeave.ts:14`. Wording only — the event itself
(`ring.remove`) is correct. `withdrew from the ring` / `was withdrawn from the ring` reads
right and keeps the beastmaster's agency.

Two further asymmetries with the join line worth fixing in the same pass, since the two
messages are a matched pair a reader tries to connect:

- **Joining names the species, leaving names the individual.** Join says
  `An enraged Minotaur`, leave says `Dalfi`. Nothing in the feed links the two, so on a
  busy ring you cannot tell which arrival a departure cancels. One of them should carry
  both, and it should be the same one each time.
- **Two spellings of the same value.** Leave uses `character.identity`; join builds
  `${character.icon} ${character.givenName}` by hand. They should agree.

### 105. The boss warning is the only ring line with no full stop — VERIFIED

`announcements/bossWillSpawn.ts:13`:
`A boss will enter the ring ${formatRelative(add(Date.now(), delay))}` — no terminal
period, where every line around it in `06-ring-summon-sequence.png` has one. One
character.

### 106. A three-monster fight's summary silently drops a contestant — VERIFIED

`07-fightlog-trace-raw-markup.png`: `#8 Everest vs Ford vs Death Blood` is summarised
`Everest fled from Ford`. Death Blood is in the title and absent from the outcome.

**Root cause**: `utils/fight-display.ts` `fightSubtitle`, the `fled` branch, builds its
sentence from only two participant outcomes — `fled` and `win`. A third monster that
finished with `loss` matches neither filter and vanishes. `permaDeath` (`win` + `permaDeath`)
and `win` (`win` + `loss`) have the same shape, so any outcome combination the branch does
not enumerate drops those monsters from the line.

**Fix**: build the sentence from all participants, or append a remainder clause, so the
subtitle always accounts for everyone named in the title.
