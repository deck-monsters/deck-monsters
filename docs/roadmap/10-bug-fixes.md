# Bug Fixes and Code Quality

**Category**: Bug / Tech Debt
**Priority**: Low — the only remaining item is a content-writing task, not an engineering one.
**Status**: Active, but nearly empty. Everything else has moved to [`10b-bugs-fixed.md`](10b-bugs-fixed.md) — read that doc for history and root causes. What's left here: #3 (DMG/CARDS content differentiation).

## Code Quality Issues

### 3. `DMG.md` and `CARDS.md` are near-duplicates — content pass still open

Both files still exist at the repository root. The Dungeon Master Guide should contain different content (game master / advanced info) than the player-facing card reference. The build script headers are already differentiated — see #3 in `10b-bugs-fixed.md`.

**Status**: Open. Regenerating the `.md` files requires running `node ./build` after further content differentiation.
**Action**: Fully differentiate DMG vs. CARDS content (not just headers). Consider adding a how-to-run-the-game section to DMG per upstream #265.

## Tasks

- [ ] Audit and differentiate `DMG.md` vs `CARDS.md` full content; add how-to-run section (upstream #265) (#3)
