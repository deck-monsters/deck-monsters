# Bug Fixes and Code Quality

**Category**: Bug / Tech Debt  
**Priority**: High (fix before major new development)

## Known Bugs

### 1. "Barely blocked" message fires incorrectly (upstream #181)

The flavor text "barely blocked" should only appear when missing by less than 2. It currently fires even on a crit fail.

**Action**: Find the "barely blocked" threshold check and add a `< 2` guard.

### 2. Unused `curseOfLoki` variable in `cards/hit.js`

The variable `curseOfLoki` is declared but never used. May be dead code from an incomplete feature or a reference bug where the feature exists but the variable is never applied.

**Action**: Investigate. If Curse of Loki is a real mechanic, fix the bug so it applies. If not, remove the dead code.

### 3. `DMG.md` and `CARDS.md` are near-duplicates

Both files appear to be the same card catalog. The Dungeon Master Guide should contain different content (game master / advanced info) than the player-facing card reference.

**Action**: Audit both files. Differentiate them: `CARDS.md` for player reference, `DMG.md` for game balance, probability tables, and modifier math. (Also see upstream #265 — add how-to-run-the-game explanation to the DMG.)

### 4. Battle history not persisted

`ring.battles = []` — battle history is explicitly not saved or hydrated. Lost on every restart.

**Action**: Decide if battle history matters for the new version. If yes, serialize it (bounded to last N battles to keep state size manageable).

## Code Quality Issues

### 5. `creatures/base.js` is ~2000 lines

The base creature class handles attack resolution, defense, item effects, stat modifiers, healing, and more.

**Action**: Refactor into focused modules — `creatures/combat.js`, `creatures/stats.js`, `creatures/items.js`. Do this incrementally with test coverage to avoid regressions.

### 6. Hardcoded time constants

Healing rate (300s/hp) and resurrection time (600s/level) are magic numbers in the code rather than named constants.

**Action**: Move to `constants/` with clear names.

### 7. Hubot-specific AWS environment variable names

`HUBOT_DECK_MONSTERS_AWS_ACCESS_KEY_ID` and `HUBOT_DECK_MONSTERS_AWS_SECRET_ACCESS_KEY` are named for an old dependency.

**Action**: Rename to `DECK_MONSTERS_AWS_ACCESS_KEY_ID` etc., with a deprecation warning if old names are detected.

### 8. No CI configuration

There are 93 test files but no GitHub Actions config to run them automatically.

**Action**: Add `.github/workflows/test.yml`. Blocked by the `@salesforce-mc/devtest` replacement (see modernization issue).

### 9. Engine should process its own commands (upstream #259)

The original Jane connector called `game.handleCommand({ command })` to parse natural language commands, but this method is absent from the current engine source. The command vocabulary (what maps to what) belongs in the engine, not in each connector separately.

**Action**: Add a `handleCommand(command: string)` method to the engine that parses command strings and returns the appropriate action function. This is the primary enabler for chat-style connectors (Slack, Discord text commands).

## Small UX Fixes (Upstream)

These are small, self-contained improvements from the upstream issue tracker worth including in the initial revival:

### 10. Shop should show item ownership count (upstream #261)

When browsing the shop, show how many of each item the player already owns.

Example: `0) Blast (1) - 75 coins [own 4]`

### 11. `look at cards` should list cards with numbers (upstream #260)

Simplify the card listing display to show numbered entries — easier to reference when equipping.

### 12. Level-up should be celebrated publicly (upstream #86)

When a character or monster levels up, announce it in the public ring channel. Currently level-ups are silent.

### 13. Monster manual should show stat ranges (upstream #74)

The monster manual (`dm look at monster manual`) should show the possible stat ranges for each monster type, not just the flavor text.

### 14. Name and color fields should be editable (upstream #69)

After creation, players should be able to edit their character's name and color/appearance fields.

## Tasks

- [ ] Fix "barely blocked" threshold (upstream #181)
- [ ] Investigate and fix or remove `curseOfLoki` dead code in `cards/hit.js`
- [ ] Audit and differentiate `DMG.md` vs `CARDS.md`; add how-to-run section (upstream #265)
- [ ] Decide on battle history persistence; implement if desired
- [ ] Begin incremental refactor of `creatures/base.js`
- [ ] Extract hardcoded time constants to `constants/`
- [ ] Rename Hubot AWS env vars
- [ ] Add GitHub Actions CI workflow
- [ ] Add `handleCommand` to the engine (upstream #259)
- [ ] Shop: show item ownership count (upstream #261)
- [ ] `look at cards`: numbered list display (upstream #260)
- [ ] Level-up public announcement (upstream #86)
- [ ] Monster manual: show stat ranges (upstream #74)
- [ ] Editable name/color fields (upstream #69)
