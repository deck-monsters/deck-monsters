# Report: Fix send-to-ring quick-action false failures

**Date:** 2026-08-03  
**Branch:** `cursor/fix-send-to-ring-quick-actions-42d2`  
**Plan:** [`2026-08-03-fix-send-to-ring-room.md`](./2026-08-03-fix-send-to-ring-room.md)

## Summary

Quick-action chips no longer suggest `send {name} to the ring` unless the monster has a full deck (`cards.length >= cardSlots`, default 9). Equip is offered for idle out-of-ring monsters when unequipped cards exist. Send/call-out-of-ring paths now use `user.id` instead of `user?.id`.

## RED (before fix)

Command:

```bash
pnpm --filter @deck-monsters/server exec mocha --config .mocharc.yml 'src/quick-actions.test.ts'
```

Result: **3 failing** (of 136 total in suite run)

```
1) does not suggest send when the monster has no cards equipped
   AssertionError: expected [ 'send Fluffy to the ring', …(2) ] to not include 'send Fluffy to the ring'

2) does not suggest send when the monster has fewer cards than slots
   AssertionError: expected [ 'send Fluffy to the ring', …(2) ] to not include 'send Fluffy to the ring'

3) suggests equip instead of send when idle monsters are not deck-ready but unequipped cards exist
   AssertionError: expected [ 'send Fluffy to the ring', …(3) ] to not include 'send Fluffy to the ring'
```

## GREEN (after fix)

Command:

```bash
pnpm --filter @deck-monsters/engine build
pnpm --filter @deck-monsters/server exec mocha --config .mocharc.yml 'src/quick-actions.test.ts'
```

Result: **136 passing** (2s)

Engine smoke:

```bash
node --input-type=module -e "import { Game } from './packages/engine/dist/index.js'; const g = new Game({}, console.log); console.log('Engine OK'); g.dispose();"
# → Engine OK
```

## Changes

| File | Change |
|------|--------|
| `packages/server/src/quick-actions.ts` | `isDeckReady()` helper; `readyToSend` gated on deck readiness; `idleOutOfRing` for equip targeting |
| `packages/server/src/quick-actions.test.ts` | New deck-readiness cases; flipped send-with-empty-deck expectations |
| `packages/engine/src/commands/monster.ts` | `user?.id` → `user.id` on send-to-ring and call-out-of-ring |

## Test coverage added

- No send when `cards: []` or insufficient cards vs default 9 slots
- Send when 9 cards or `cardSlots: 2` with 2 cards
- Equip (not Send) when living idle monster lacks deck but `character.deck` has cards
- Existing ring/other-player tests updated to use deck-ready monsters where Send is expected
