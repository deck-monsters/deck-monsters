# Bug Fixes and Code Quality

**Category**: Bug / Tech Debt  
**Priority**: High (fix before major new development)

## Known Bugs

### 1. Unused `curseOfLoki` Variable in `cards/hit.js`

The variable `curseOfLoki` is declared but never used. This may be:
- Dead code from an incomplete feature
- A reference bug (the feature exists but the variable is never read/applied)

**Action**: Investigate whether Curse of Loki is a real mechanic. If so, fix the bug so it actually applies. If not, remove the dead code.

### 2. `DMG.md` and `CARDS.md` Are Near-Duplicates

Both files appear to be the same card catalog. The Dungeon Master Guide (`DMG.md`) should contain different content (game master / advanced info) than the player-facing `CARDS.md`.

**Action**: Audit both files. Differentiate them: `CARDS.md` for player reference, `DMG.md` for game balance, probability tables, and modifier math. Or simply remove one and update links.

### 3. Battle History Not Persisted

`ring.battles = []` — battle history is explicitly not saved or hydrated. Battle history is lost on every restart.

**Action**: Decide if battle history matters for the new version. If yes, serialize it (bounded to last N battles to keep state size manageable).

## Code Quality Issues

### 4. `creatures/base.js` is ~2000 Lines

The base creature class handles attack resolution, defense, item effects, stat modifiers, healing, and more. This makes it hard to understand and maintain.

**Action**: Refactor into focused modules:
- `creatures/combat.js` — attack/defense resolution
- `creatures/stats.js` — stat modifiers and buffs
- `creatures/items.js` — item application logic

Do this incrementally with test coverage to avoid regressions.

### 5. Hardcoded Time Constants

Healing rate (300s/hp) and resurrection time (600s/level) are magic numbers in the code rather than named constants.

**Action**: Move to `constants/` with clear names.

### 6. Hubot-Specific AWS Environment Variable Names

`HUBOT_DECK_MONSTERS_AWS_ACCESS_KEY_ID` and `HUBOT_DECK_MONSTERS_AWS_SECRET_ACCESS_KEY` are named for an old dependency.

**Action**: Rename to `DECK_MONSTERS_AWS_ACCESS_KEY_ID` etc., with a deprecation warning if old names are detected.

### 7. No CI Configuration

There are 93 test files but no GitHub Actions or other CI config to run them automatically.

**Action**: Add `.github/workflows/test.yml` to run tests on every push and PR. Blocked by the `@salesforce-mc/devtest` replacement (see modernization issue).

## Tasks

- [ ] Investigate and fix or remove `curseOfLoki` dead code in `cards/hit.js`
- [ ] Audit and differentiate `DMG.md` vs `CARDS.md`
- [ ] Decide on battle history persistence; implement if desired
- [ ] Begin incremental refactor of `creatures/base.js`
- [ ] Extract hardcoded time constants to `constants/`
- [ ] Rename Hubot AWS env vars
- [ ] Add GitHub Actions CI workflow
