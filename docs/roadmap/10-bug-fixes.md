---
type: Roadmap
title: Bug Fixes and Code Quality
description: Open bug investigations that still need a fix or a confirmed root cause.
status: draft
audience: internal
tags: [bugs, roadmap, open]
---
# Bug Fixes and Code Quality

**Status:** Active — nine open items. Fixed work and its root causes live only in
[`10b-bugs-fixed.md`](10b-bugs-fixed.md).

## Open items

### J. Fight rewards may never be credited

**Owner:** Engine event ownership and rewards. A player reported 2 wins and 9 losses with
zero coins, although the ring records outcomes separately from reward listeners. Coin and XP
awards share room-scoped `creature.*` listeners, so a rejected ownership check could lose both
without changing the win/loss record.

- [x] Reproduce a complete real fight, including after room restore, and assert coin and XP
  balances. Done in pass 25: `packages/engine/src/reward-crediting.test.ts` drives a real
  `ring.fight()` through `Game.getCharacter` and `sendMonsterToTheRing`, fresh, after
  `restoreGame`, and against a boss. Every case credits coins and XP. The same check against
  the compiled `dist/` engine under plain Node, the production runtime, also credits coins
  after a restore. The in-process reward path is sound.
- [ ] Find the production-only cause. The remaining hypotheses: a save lost to the ~30 s
  persistence debounce around a restart; connector identity drift (a Discord relink or a stale
  active-room mapping, so `contestant.character` is not the reporter's character); or an
  ownership-guard gap for a character or monster shape the tests do not build. Each needs
  production data: the reporter's room state blob and `room_events` for their fights.
- [ ] Fix the demonstrated failure and record its root cause in the fixed-bug ledger.

Test-runner note: under mocha + tsx, a module reached by static import and by dynamic
`import()` can load as two instances, each with its own `globalSemaphore`. A test that
restores a game must import consistently (see the comment in `reward-crediting.test.ts` and
`game.test.ts`). Plain Node on `dist/` does not split modules, so this is not the production bug.

Read [rooms and identity](../architecture/rooms-and-identity.md) and
[analytics and history](../architecture/analytics-and-history.md) before changing the
listeners or reward projections.

### A. Intermittent missing `↓ Latest` jump button

**Owner:** Web feeds. `isAtBottom` is edge-driven, so a path that moves the reader away from
the bottom without a callback can hide the recovery control. The trigger is not reproduced:
capture whether roster collapse, replay, reconnect, or animation causes it before selecting
a fix.

Read [events, prompts, and replay](../architecture/events-prompts-and-replay.md).

### F. Odd spacing in some feed messages

**Owner:** Web feeds. Players reported extra blank lines and misaligned indentation in some
feed messages. The one confirmed instance, Delayed Hit narration that opened with a literal
`\n`, is fixed (#130), and a sweep of `cards/` found no other. No further example has been
captured. Get a screenshot of a specific message before changing the card-display block or
the turn banner, the likeliest suspects given #97 and #101.

Read [events, prompts, and replay](../architecture/events-prompts-and-replay.md).

### K. Card-box right border drifts on rows with an emoji

**Owner:** Web feeds. Found by a browser check on PR #394 (September 2026). Card boxes are
counted as a 34-column frame in the engine and wrap correctly as stored text. In the web
feed, the right border steps in and out on rows whose title carries an emoji (`🦄`, and the
Gladiator's `💪` and `🗡`). The feed renders them with `white-space: pre-wrap` in a monospace
font where an emoji is wider than one column, so the frame's column count no longer matches.
Not specific to any card. Likely fixes: measure emoji as two columns when the engine pads
the frame, or render the frame's border in CSS rather than as characters. Capture a
screenshot in both themes and at phone width before choosing.

Read [pixel art](../reference/pixel-art.md) and [web workspace](../architecture/web-workspace.md).

### L. A short equip eats the next command, then says the monster is ready

**Owner:** Engine equip prompts. Found in a browser sweep on 2026-09-26. A Minotaur was
equipped in one shot with a deck that included Blast, which only a Cleric can hold. The
console announced that the monster could not hold Blast and left the "which card next"
prompt open. The following commands (`send Brass to the ring`, later `clear deck Brass`)
were answered as card picks: "Skipped an invalid selection: …". The flow then finished
the partial hand ("You've equiped the following cards") and announced "Brass is good to
go!" with slots still empty. `summon a boss` correctly refused, because the send had
never run.

**Root cause:** `equip` keeps prompting while slots and legal cards remain
(`packages/engine/src/monsters/helpers/equip.ts`). A console line is that prompt's
answer. `choose.ts` skips tokens that are not card names and, with nothing selected,
the continuation treats an empty pick as "finish with what you have".
`Beastmaster.equipMonster` then always announces "is good to go!", with no check that
the hand fills `cardSlots`. The same finish lines spell it "equiped".

- [ ] Do not treat an ordinary command as an equip answer, or reject it without closing
  the hand.
- [ ] Announce a partial deck as partial. "Good to go" is the full-hand line.
- [ ] Spell the finish lines "equipped".

Read [events, prompts, and replay](../architecture/events-prompts-and-replay.md) and
[workshop and items](../architecture/workshop-and-items.md).

### M. `unequip all from [monster]` looks for a card named "all"

**Owner:** Engine command dispatch. The catalogue lists `unequip all from [monster]`
("Clear a monster's full deck"). Typed for Brass, the console answered "Brass is not
holding all." `clear deck Brass` did clear the hand and is the working alternative.

**Root cause:** `UNEQUIP_CARD_REGEX` (`unequip (?:(\d+) )?(.+?) from …`) is registered
before `UNEQUIP_ALL_REGEX` in `packages/engine/src/commands/monster.ts`, and dispatch
keeps the first match (`commands/index.ts`). The card pattern's `.+?` takes "all", so
the all-command handler never runs.

- [ ] Match `unequip all from` before the single-card pattern, and cover it with a
  dispatch test (a test of the all-regex alone will not catch this).

Read [events, prompts, and replay](../architecture/events-prompts-and-replay.md).

### N. First-run workshop shows "Applying changes…" and `game.shop` 404s

**Owner:** Web workshop. On Test Room B (no character) the workshop banner read
"Applying changes…" while nothing was being changed. The network log for that room,
and for a scratch room before its character existed, was `game.shop` 404.

**Root cause:** `game.shop` throws `NOT_FOUND` / "Character not found" when the member
has no character (`packages/server/src/trpc/router.ts`). The workshop enables that
query for every room (`useDeckWorkshop`). `busy` includes `shopQuery.isFetching` and
`inventoryQuery.isFetching`, and both refetch on a 30s interval. The Train button is
`disabled` while `busy`, and the banner is `busy && !consoleFlowActive`. A background
fetch is presented as a mutation, and a first-run room refetches a query that cannot
succeed.

- [ ] Leave `game.shop` disabled until `hasCharacter`, or return an empty shop instead
  of 404.
- [ ] Drive the banner and the disabled buttons from in-flight mutations, not from
  query fetches.

Read [workshop and items](../architecture/workshop-and-items.md).

### O. A skipped-delay fight log expands to no events

**Owner:** Fight history. A scratch Minotaur beat a summoned boss; the ring feed has
the full narration and the summary row is Brass win / boss loss. Expanding the fight
shows the "Events during this fight" heading and an empty list. `game.fight` returned
`events: []`.

**Root cause:** `loadFightEventsForSummary` keeps `room_events` whose `created_at` is
inside the summary's `started_at`–`ended_at`
(`packages/server/src/analytics-queries.ts`). Those summary bounds are the engine
event timestamps (`fight-summary-writer.ts`). `created_at` is the insert time
(`event-persister.ts` does not write the engine timestamp). This bout's window was
50ms (`14:22:47.237`–`.287`) because `DECK_MONSTERS_SKIP_DELAYS` zeroes card pacing.
Every combat row was inserted at `.299` or later, so the window contained nothing.
Test Room A's older fights (75s, 6 min, 113s) still return 29, 293, and 49 events, so
this is the fast-fight case, not an empty history table.

- [ ] Select events by the engine timestamp, or widen the window to cover rows inserted
  after `ended_at`. Add a test where the insert time is later than the resolve
  timestamp.

Read [analytics and history](../architecture/analytics-and-history.md).

### P. Three-word card names abbreviate to an unreadable label

**Owner:** Web workshop. Test Room A's deck shows Fight or Flight as "Fig or Fli"
under a utility diamond. The slot's title attribute is the full name; the visible
label is not.

**Root cause:** `abbreviateCardName` keeps three letters of each of the first three
words (`apps/web/src/utils/cards.ts`). "Fight or Flight" becomes "Fig or Fli". Hover
works on a desktop; a phone has the label only.

- [ ] Abbreviate so the card is still recognizable, and cover Fight or Flight (and any
  other three-word name in the catalogue) in `cards-utils.test.ts`.

Read [web workspace](../architecture/web-workspace.md).

## Historical detail

The removed September incident diary was resolved work and duplicated
[`10b-bugs-fixed.md`](10b-bugs-fixed.md). Keep new investigations here only while they are
actionable; move a fixed item to the ledger with its root cause and test evidence.
