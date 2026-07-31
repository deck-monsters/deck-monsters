# Bug Fixes and Code Quality

**Category**: Bug / Tech Debt
**Priority**: Medium (one item is blocked on a design decision; the rest is UX polish and ongoing cleanup)
**Status**: Active. Everything already fixed has moved to [`10b-bugs-fixed.md`](10b-bugs-fixed.md) — read that doc for history and root causes. What's left here: #19 (batch-equip UX work), #26 (card shop singleton, needs a design decision before implementation), two ongoing cleanup items (#3 DMG/CARDS content differentiation, #5 `creatures/base.ts` decomposition), and a handful of smaller open observations.

## Open Bugs

### 19. Deck equip flaky with batches (workshop + console) — MEDIUM (UX / batch API work)

The engine-side root causes found during investigation (preset copy-limit bug, `equip.ts` name-matching mismatch) are fixed — see #19 in `10b-bugs-fixed.md`. What's still open:

**Symptoms reported**: Equipping one card at a time works; multi-card flows (workshop multi-select / drag batch, console `equip … with "A", "B"` or interactive multi-pick) fail more often.

**Still open:**

1. **Workshop batch + React Query** — `handleBatchMove` still runs **N mutations** for batch unequip / cross-monster move (`unequipCard` / `moveCard` in a loop). Each success **invalidates** `myInventory` / `myMonsters`, so the UI may **refetch between steps**. That usually causes **stale selection or flicker**, not wrong server state, unless the user acts again on outdated UI. `equipCards` and `loadPreset` are already single mutations (good). Mitigations: batch RPC for multi-unequip / multi-move, or `mutateAsync` + single `invalidate` after the loop (defer invalidation in `useDeckWorkshop`).

2. **`getArray` parsing** (`packages/engine/src/helpers/get-array.ts`) — For `equip M with …`, strings wrapped in **double quotes** split only on `"(?:[\s,]|or|and)+"` — a card name containing **`"`** inside the list breaks parsing. Single-quoted lists split on `'(?:[\s,]|or|and)+'` — names with **`'`** (apostrophe) as delimiter are unsafe. Unquoted fallback strips **all** quotes via `/([^"']+)/`, which can mangle names that include quotes. Prefer JSON array input for exotic names; worth a doc note in player-facing help.

3. **InlineChoices + `chooseItems`** — Multi-select answers are comma-separated **indices** parsed by `getArray`; typed free-text answers in the console could still misfire if they do not match expected patterns.

**Suggested next steps**: (a) Optional **batch `unequipMany` / `moveMany` tRPC** + deferred invalidation to reduce workshop flicker. (b) Harness / unit tests for `getArray` with apostrophe card names and for preset load with mixed-case duplicate keys. (c) Reproduce multi-tab same-room if issues persist.

**Status**: Open for UX / batch API work.

---

### 26. Card shop is a single process-wide singleton shared by every room — RECORDED, not fixed

`packages/engine/src/items/store/shop.ts`'s `getShop()` is a module-level `throttle()`-wrapped function with a single `currentShop` variable, regenerated once per 8 hours **for the entire process**, not per room. Every room on a multi-room server currently shares the exact same shop inventory, closing time, and prices — one room buying out an item affects every other room's shop simultaneously. This directly conflicts with `CLAUDE.md`'s "Critical Architecture Rule: Room-Level Scoping" ("All game state … must be scoped to a room … treat this as a hard constraint, not a guideline").

Likely a leftover from the original single-workspace Slack bot design, never revisited during the multi-room revival. Not fixed here — it needs a design decision (per-room shop keyed by `roomId`? shared shop but per-room purchase tracking? intentionally shared as a "world event"?) rather than a mechanical patch, and touches `buy.ts`/`sell.ts`'s call sites plus whatever surfaces the shop to connectors.

**Status**: Open — needs a design decision before implementation.

---

## Smaller Open Observations

- **`equip.ts` fire-and-forget announces**: in the typed-selection path (`cardSelection` reduce), rejection notices are sent via unawaited `channel({ announce })` calls, so their ordering relative to the surrounding flow messages is not guaranteed. Harmless today; worth awaiting if message order ever matters.
- **`Promise.reject(channel({ announce }))` idiom** (store buy, `game.ts` look-ups, equip preconditions): rejects with a *Promise* as the reason, which stringifies as `[object Promise]` in any error log. Prefer announcing first, then rejecting with a real `Error`. (Already fixed in `chooseItems` as part of #20 — see `10b-bugs-fixed.md`.)
- **`fight()` error path drops history**: see the #15 residual note in `10b-bugs-fixed.md` — if cancelled fights should appear in the fight log as `cancelled`, publish a terminal event from the `.catch` path.
- **`activeFlows` rejection message** can mislead: when a user's command is *queued* (not prompting), the "answer the current prompt first" message returns `pendingPrompt: null`. Consider a distinct "still processing your previous command" message when there is no pending prompt.
- **Test-tooling gotcha, not a product bug**: mixing a static top-level import and a dynamic `await import()` of the *same* module within one `tsx`-transformed mocha run can silently produce two separate module instances (confirmed for `helpers/semaphore.ts` — its module body evaluated twice, yielding two different `globalSemaphore` `EventEmitter`s). A test that relies on `someDynamicallyImportedInstance.emit(...)` reaching a statically-imported listener can fail with the event simply vanishing. Fix is to import consistently (prefer static imports for classes whose own `BaseClass.emit()` needs to reach engine-wide listeners in a test). Not reachable in the real compiled build — only ever an artifact of the test transform.

## Code Quality Issues

### 3. `DMG.md` and `CARDS.md` are near-duplicates — content pass still open

Both files still exist at the repository root. The Dungeon Master Guide should contain different content (game master / advanced info) than the player-facing card reference. The build script headers are already differentiated — see #3 in `10b-bugs-fixed.md`.

**Status**: Open. Regenerating the `.md` files requires running `node ./build` after further content differentiation.
**Action**: Fully differentiate DMG vs. CARDS content (not just headers). Consider adding a how-to-run-the-game section to DMG per upstream #265.

### 5. `creatures/base.ts` is still large (~977 lines)

Reduced from ~2000 lines during the TypeScript migration (see #5 in `10b-bugs-fixed.md`), but still handles attack resolution, defense, item effects, stat modifiers, healing, and more in a single file.

**Status**: Open.
**Action**: Continue incremental decomposition — extract focused modules like `creatures/combat.ts`, `creatures/stats.ts`, `creatures/items.ts`. Do this with test coverage to avoid regressions.

## Tasks

- [ ] Batch RPC (`unequipMany` / `moveMany`) + deferred invalidation to reduce workshop flicker (#19)
- [ ] Harness/unit tests for `getArray` with apostrophe card names and mixed-case preset duplicate keys (#19)
- [ ] Decide on and implement per-room (or intentionally shared) card shop scoping (#26)
- [ ] Audit and differentiate `DMG.md` vs `CARDS.md` full content; add how-to-run section (upstream #265) (#3)
- [ ] Continue incremental decomposition of `creatures/base.ts` (#5)
- [ ] Await `equip.ts`'s fire-and-forget rejection announces if message ordering ever becomes an issue
- [ ] Replace remaining `Promise.reject(channel({ announce }))` call sites (store buy, `game.ts` look-ups, equip preconditions) with announce-then-real-`Error`
- [ ] Publish a terminal `cancelled` event from `fight()`'s `.catch` path if cancelled fights should appear in the fight log
- [ ] Distinguish "still processing your previous command" from "answer the current prompt first" in `activeFlows` rejection messages
