# Bug Fixes and Code Quality

**Category**: Bug / Tech Debt  
**Priority**: High (fix before major new development)  
**Status**: Mostly complete — 12 of 14 items resolved (PR [#286](https://github.com/deck-monsters/deck-monsters/pull/286) and TypeScript migration). Two remaining items are low-priority cleanup.

## Known Bugs

### 1. "Barely blocked" message fires incorrectly (upstream #181)

In `announcements/miss.ts`, the "barely blocked" flavor text fires when `attackResult > 5`. This means any miss with a roll above 5 says "barely blocked" — even when the attack wasn't close to hitting. The check should compare how close the roll was to the target's AC, not the raw roll value.

**Status**: Deferred — already resolved in the clean-room regeneration. The guard is correctly ordered; behavior matches original intent.  

### 2. curseOfLoki in cards/hit.ts — not dead code

The original doc flagged `curseOfLoki` as an unused variable. Investigation shows it is a real game mechanic (natural 1 / crit fail), used extensively across many cards: `hit.ts`, `heal.ts`, `berserk.ts`, `horn-gore.ts`, `lucky-strike.ts`, `cloak-of-invisibility.ts`, `immobilize.ts`, `rehit.ts`, and others. The `curseOfLoki` flag is computed in `helpers/chance.ts` and propagated through hit checks.

**Status**: Not a bug. This is a working mechanic.  
**Action**: Remove from the bug list. Document the Curse of Loki mechanic in the player handbook or DMG.

### 3. `DMG.md` and `CARDS.md` are near-duplicates

Both files still exist at the repository root. The Dungeon Master Guide should contain different content (game master / advanced info) than the player-facing card reference.

**Status**: Partially addressed. `build/card-catalogue.js` now generates a player-facing reference ("Player Reference: Cards available in the game — name, description, cost, and rarity"), while `build/dungeon-master-guide.js` generates a game master reference ("Full card stats, modifier math, damage-per-turn tables"). The headers differentiate the purpose. Regenerating the `.md` files requires running `node ./build` after further content differentiation.  
**Action**: Consider further: add a how-to-run-the-game section to DMG per upstream #265.

### 4. Battle history not persisted

`ring.battles = []` — battle history is reset on every `Ring` construction. Lost on every restart.

**Status**: Fixed. Battle history now stored via `setOptions({ battles })` and capped at the last 20 fights. Because it lives in `options`, it is automatically included in `BaseClass.toJSON()` and restored when `restoreGame()` is called. A `get battles()` accessor provides read access. A future event bus (`room_events`) could supplement this with a full persistent log.

## Code Quality Issues

### 5. `creatures/base.ts` is still large (~977 lines)

Reduced from ~2000 lines during the TypeScript migration, but still handles attack resolution, defense, item effects, stat modifiers, healing, and more in a single file.

**Status**: Partially addressed. Down from ~2000 to ~977 lines.  
**Action**: Continue incremental decomposition — extract focused modules like `creatures/combat.ts`, `creatures/stats.ts`, `creatures/items.ts`. Do this with test coverage to avoid regressions.

### 6. Hardcoded time constants — Done

Healing rate and resurrection time were magic numbers.

**Status**: Fixed. Extracted to `constants/timing.ts` as `TIME_TO_HEAL_MS` (300000) and `TIME_TO_RESURRECT_MS` (600000).

### 7. Hubot-specific AWS environment variable names — Done

**Status**: Fixed. `helpers/aws.ts` now reads `DECK_MONSTERS_AWS_ACCESS_KEY_ID` and `DECK_MONSTERS_AWS_SECRET_ACCESS_KEY`, with backward-compat fallback and deprecation warning for the old `HUBOT_` prefix.

### 8. CI configuration — Done

**Status**: Fixed. `.github/workflows/ci.yml` runs three parallel jobs: TypeScript type-check, lint, and tests. Triggers on push to `main` and all PRs.

## Small UX Fixes (Upstream)

These are small, self-contained improvements from the upstream issue tracker worth including in the initial revival:

### 9. Shop should show item ownership count (upstream #261) — Done

When browsing the shop, show how many of each item the player already owns.

**Status**: Fixed. `items/store/buy.ts` now appends `[own N]` to each line in the item selection question when the player already owns one or more of that item type.

### 10. `look at cards` should list cards with numbers (upstream #260) — Done

Simplify the card listing display to show numbered entries — easier to reference when equipping.

**Status**: Fixed. Both `monsters/base.ts` (monster card listing) and `characters/base.ts` (character deck listing) now prepend `1) `, `2) `, etc. to each entry.

### 11. Level-up should be celebrated publicly (upstream #86) — Done

When a character or monster levels up, announce it in the public ring channel. Currently level-ups are silent.

**Status**: Fixed. The `xp` setter on `BaseCreature` now detects level changes and emits a `levelUp` event. The `announcements/` module wires this to a public `announceLevelUp` broadcast.

### 12. Monster manual should show stat ranges (upstream #74) — Done

The monster manual (`dm look at monster manual`) should show the possible stat ranges for each monster type, not just the flavor text.

**Status**: Fixed. `src/build/monster-manual.ts` now shows HP, AC, STR, DEX, INT base values and variance ranges for each monster type, along with class bonuses.

### 13. Name and color fields should be editable (upstream #69) — Done

After creation, players should be able to edit their character's name and color/appearance fields.

**Status**: Fixed. Added `editSelf()` method to `BaseCreature` (restricted to `givenName` and `icon` fields) and wired to a new `edit my character` command in `commands/character.ts`. The existing admin `edit character <name>` command is unchanged.

### 14. Missing draw announcement at round 10 — Done

When a fight reaches round 10 without a winner, the draw/stalemate announcement was not firing.

**Status**: Fixed in PR #286.

## Tasks

- [ ] Audit and differentiate `DMG.md` vs `CARDS.md`; add how-to-run section (upstream #265) — build headers differentiated, full content pass still todo
- [ ] Continue incremental decomposition of `creatures/base.ts`
- [x] ~~Fix "barely blocked" threshold~~ (already correct in TS migration)
- [x] ~~Battle history lost on restart~~ (done — stored in `options.battles`, capped at 20)
- [x] ~~Extract hardcoded time constants to `constants/`~~ (done — `constants/timing.ts`)
- [x] ~~Rename Hubot AWS env vars~~ (done — `helpers/aws.ts` with backward-compat)
- [x] ~~Add GitHub Actions CI workflow~~ (done — `.github/workflows/ci.yml`)
- [x] ~~Investigate curseOfLoki~~ (working mechanic, not a bug)
- [x] ~~Shop: show item ownership count~~ (done — `[own N]` appended in buy.ts)
- [x] ~~`look at cards`: numbered list display~~ (done — monsters/base.ts and characters/base.ts)
- [x] ~~Level-up public announcement~~ (done — `creature.levelUp` event + `announceLevelUp`)
- [x] ~~Monster manual: show stat ranges~~ (done — `src/build/monster-manual.ts`)
- [x] ~~Editable name/color fields~~ (done — `editSelf()` + `edit my character` command)
- [x] ~~Draw announcement at round 10~~ (done — PR #286)
