---
type: Roadmap
title: Small Leftovers
description: Bounded leftover decisions and verification gates with named owners.
status: draft
audience: internal
tags: [leftovers, roadmap, verification]
---
# Small Leftovers

**Status:** Backlog — bounded decisions and verification gates that do not justify a
standalone plan. Each item names its current owner and contract; archive history is not an
execution queue.

## Web and display

- [ ] **Owner: Web Workspace.** Complete real iPhone/WebKit checks for the workspace at
  full-page, pane, phone, and 200% zoom widths, including the inline sprites. Include the
  two fixes that could not be reproduced off-device: dragging the console up during a fight
  (#129, #132) and the fight-log list markers (#125). Record only observed defects. Read [web workspace](../architecture/web-workspace.md) and
  [ring roster and pixel monsters](../architecture/ring-roster-and-pixel-monsters.md).
- [ ] **Owner: Web/identity.** Decide whether display preferences (pixel monsters, key
  timestamps, pane slots, and similar controls) remain device-local or become
  account-synced, including migration and privacy implications. Read
  [rooms and identity](../architecture/rooms-and-identity.md) and
  [ring roster and pixel monsters](../architecture/ring-roster-and-pixel-monsters.md).
- [ ] **Owner: Web feeds.** Profile long-running rooms before deciding whether virtualized
  scrolling needs another performance change. Read
  [events, prompts, and replay](../architecture/events-prompts-and-replay.md).
- [ ] **Owner: Ring roster.** Decide whether status-effect chips, damage flashes, or an
  HP sparkline improve fight readability without obscuring order of play. Read
  [ring roster and pixel monsters](../architecture/ring-roster-and-pixel-monsters.md).
- [ ] **Owner: Ring roster.** Use real-device evidence to decide whether only the acting
  sprite should move and whether the eight-contestant density threshold remains legible.
  Read [ring roster and pixel monsters](../architecture/ring-roster-and-pixel-monsters.md).
- [ ] **Owner: Web prompts.** Show which step a multi-step flow is on (spawn, equip, shop),
  for example "Step 2 of 4 — Choose a name". Prompt timeout, cancel, and first-run
  character creation already exist. Read
  [events, prompts, and replay](../architecture/events-prompts-and-replay.md).
- [ ] **Owner: Web prompts.** Label which flow a prompt belongs to, so "Spawning your
  monster" and "Character setup" are distinguishable when a prompt appears. Read
  [events, prompts, and replay](../architecture/events-prompts-and-replay.md).

## Workshop

- [ ] **Owner: Workshop.** Loading a preset should be able to take a card another monster
  is holding, after a confirmation, so a monster can be equipped on the fly (owner request,
  September 2026). Today `Beastmaster.loadPreset` only draws from the unequipped deck, and a
  card held by another of your monsters is listed as "Skipped". Notes for the design:
  - **Confirm first, and name what moves.** "Hit ×2 and Blast are on Brass. Take them from
    Brass for Stonefang?" A decline keeps today's behaviour: load what the deck has and skip
    the rest.
  - **The confirmation lives in the client, not an engine prompt.** Workshop mutations are
    awaited and must stay prompt-free on the per-room workshop lane
    ([engine concurrency and timing](../architecture/engine-concurrency-and-timing.md)).
    So the Workshop works out what is missing (it already has every monster's cards and the
    preset), asks in the UI, then calls `loadPreset` with an explicit list of cards to take
    and from whom. The console command (`load preset … on …`) can use an ordinary prompt,
    and must follow rule 4 of the
    [prompt/answer contract](../reference/prompt-answer-contract.md).
  - **Take only what is needed, deck first.** Use unequipped copies before touching another
    monster's hand, and never take from a monster that is in the ring or fighting (the same
    rule `moveCard` and equip already enforce).
  - **Say what the donor is left with.** A monster that gives up cards drops below a full
    hand and cannot enter the ring until it is refilled, so the result should say so
    ("Brass now holds 7 of 9 cards").
  - **One atomic change.** Moving cards between monsters and loading the preset happen in
    the same mutation, so a failure leaves both hands as they were. Reuse the move path's
    deck accounting (`reconcileDeckAfterEquip`, 10b #91) rather than a new one.
  - **Tests**: a preset that needs a card only another monster holds, with confirm and
    decline; a donor in the ring is refused; the copy limit still applies; the console path.

## Items and monster identity

Prompt transport, web selling, and outcome feedback are owned in
[item follow-ups](item-followups.md).

- [ ] **Owner: Analytics/content.** Define per-monster records, dead-monster memorials, and
  earned titles from durable data before exposing or inventing a new projection. Read
  [analytics and history](../architecture/analytics-and-history.md).

## Analytics, identity, and platform decisions

- [ ] **Owner: Analytics.** Choose and implement raw-event and fight-summary retention; do
  not call 24-hour/7-day reads a deletion policy. Also decide whether interrupted fights
  need an explicit player signal. Read
  [analytics and history](../architecture/analytics-and-history.md).
- [ ] **Owner: Analytics.** Decide whether to populate `fight_summaries.notable_cards`.
  `FightSummaryWriter` still writes null because it does not track turning-point
  `card.played` events. Read
  [analytics and history](../architecture/analytics-and-history.md).
- [ ] **Owner: Analytics/identity.** Decide global-leaderboard visibility, and whether a room
  reset should also clear `room_events`. Pass 25 verified that `RoomManager.resetRoomState()`
  clears player and monster stats and fight summaries, zeroes the fight counter, and keeps the
  raw event log, so pre-reset narration stays in history. Read
  [analytics and history](../architecture/analytics-and-history.md).
- [ ] **Owner: Events/connectors.** Decide prompt delivery when one player is active on
  multiple connectors, and whether future client rendering needs finer event granularity.
  Read [events, prompts, and replay](../architecture/events-prompts-and-replay.md).
- [ ] **Owner: Platform.** Decide whether the engine test suites remain on Mocha or migrate
  to Vitest; scope a migration only after that decision. Read
  [working in this repo](../agents/working-in-this-repo.md).
- [ ] **Owner: Identity/deployment.** Decide whether to enable Apple OAuth and explicitly
  test account linking for providers sharing an email. Read
  [rooms and identity](../architecture/rooms-and-identity.md) and
  [deployment](../operations/deployment.md).
- [ ] **Owner: Discord/identity.** Decide whether Discord should seed room characters from
  `profiles.display_name` instead of `interaction.user.username`, before promising the
  same character name on every connector. Read
  [rooms and identity](../architecture/rooms-and-identity.md).
- [ ] **Owner: Identity/deployment.** Before running more than one API instance, serialize
  display-name updates with a database lock or an optimistic version check. The current
  queue in `packages/server/src/trpc/profile.ts` is in-process only. Read
  [rooms and identity](../architecture/rooms-and-identity.md) and
  [deployment](../operations/deployment.md).
- [ ] **Owner: Product.** Reconsider native mobile, Slack, and exploration only with clear
  player demand and a product brief; the responsive web, Discord, and ring loop remain the
  supported product. Start with [the documentation map](../README.md).

## Vocabulary and compatibility

- [ ] **Owner: Product/voice.** Decide whether the visible history surface remains
  **Fights** or becomes **Battles**. Read
  [voice and wording](../reference/voice-and-wording.md).
- [ ] **Owner: Discord.** Decide when the `/spawn` compatibility alias can retire; `/train`
  remains canonical until then. Read [voice and wording](../reference/voice-and-wording.md).
