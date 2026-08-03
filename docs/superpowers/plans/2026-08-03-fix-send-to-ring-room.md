# Fix: send-to-ring fails after working in other rooms

## Context

User: `"send monster to the ring" failed in one of my rooms too even after completing in two other rooms`.

Characters are room-scoped — each room needs its own spawn/equip. Investigation also found a real suggestion bug that produces false failures.

## Root causes (ranked)

1. **Quick actions suggest Send without a full deck** (`packages/server/src/quick-actions.ts`)
   - `readyToSend` only checks living + not already in ring
   - Engine refuses with: `Only an evil master would send their monster into battle without enough cards.`
   - Existing tests encode the bad behavior (send suggested with `deck: []` and no cards on monster)
   - Chip order can put Send above Equip

2. **Expected room-local state** (not a code bug): no monsters / incomplete equip / already in ring / mid-fight in that room only

3. **`user?.id` optional** on send path — if ever undefined, private countdown/full-ring announces become public and the Console tab drops them (echo only)

## Fix scope

1. `buildQuickActions`: only offer Send when `monster.cards.length >= cardSlots` (default 9)
2. Prefer Equip over Send when living monsters exist but none are deck-ready and unequipped cards exist
3. Update unit tests (TDD)
4. Harden send / call-out paths to `user.id` like the look-at-ring fix

## Out of scope

- Changing room-scoped character design
- Console showing public `ring.add` events
