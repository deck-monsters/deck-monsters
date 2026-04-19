# Card Management System

**Category**: Feature / Engine + Web  
**Priority**: High  
**Status**: Done — card workshop shipped at `/workshop`  
**Related**: `06a-web-app.md` (two-pane terminal), `01-modernize-stack.md` (TypeScript engine)

---

## The Problem

Card management in Deck Monsters has five compounding pain points:

1. **No unified view.** `look at cards` only shows unequipped cards sitting in the character deck. Equipped cards require separate `look at monster <name>` commands for each monster — there is no single view of everything a player owns.
2. **Equipping is slow.** The interactive prompt loop presents one card at a time, waits for a selection, then loops. Equipping a full hand of nine cards takes nine round-trips.
3. **No unequip command.** Once a card is on a monster, the only way to remove it is to equip a different card into that slot (which implicitly returns the old one) or to dismiss the monster entirely.
4. **No direct monster-to-monster transfer.** Moving a card from Stonefang to Mirebell requires unequipping it back to the character deck and then equipping it onto Mirebell — two separate operations that don't exist cleanly today.
5. **No presets.** Re-equipping a known strategy (e.g., "tank build" or "aggro build") is fully manual every time.

These issues compound: a player who wants to re-spec two monsters before a fight faces dozens of sequential prompts across multiple commands. The system works, but it punishes the players who engage with it most.

---

## Design Principles

- **The existing interactive equip prompt is preserved.** Beginners still use it. Nothing breaks.
- **New commands are additive.** Experienced players gain power without new players needing to learn anything.
- **Text commands and web workshop share engine methods.** Every operation the web UI can perform, a text command can perform, and vice versa.
- **`load preset` is the speedrun flow.** One command to completely swap a monster's strategy before a fight.

---

## Text Interface Design

### Command Naming: Cards vs. Items

The game has both **cards** (equipped on monsters, used in combat) and **items** (potions, scrolls, held by character or monsters). The word "inventory" must not be ambiguous:

| Command | Scope |
|---------|-------|
| `look at inventory` | **Everything**: all cards (equipped on monsters + unequipped deck) AND all items (held by character or monsters). The true everything-view. |
| `look at card inventory` / `look at all cards` | Cards only: unified view showing equipped per monster + unequipped deck. Equivalent to the new `lookAtCardInventory()` method. |
| `look at items` | Existing command, unchanged. Items only. |

### New Commands

| Command | Description |
|---------|-------------|
| `look at inventory` | Full inventory: all cards (equipped + unequipped) AND all items |
| `look at card inventory` / `look at all cards` | Cards-only unified view: equipped per monster + unequipped deck |
| `unequip <card> from <monster>` | Removes one copy of the card, returns it to character deck |
| `unequip <N> <card> from <monster>` | Removes up to N copies (e.g., `unequip 2 Hit from Stonefang`) |
| `unequip all from <monster>` / `clear deck <monster>` | Strips the monster's entire hand |
| `move <card> from <monster A> to <monster B>` | Moves one copy directly between monsters (no deck roundtrip) |
| `move <N> <card> from <monster A> to <monster B>` | Moves up to N copies (e.g., `move 2 Hit from Stonefang to Mirebell`) |
| `equip <monster> with Hit, Heal, Berserk` | Single-command multi-equip (already partly supported via `cardSelection`; needs prominent docs + UX improvement) |
| `save preset <name> for <monster>` | Saves the monster's current hand as a named preset |
| `load preset <name> on <monster>` | Unequips all, re-equips from preset (skips missing cards, warns) |
| `look at presets for <monster>` | Lists all saved presets with their card lists |
| `delete preset <name> for <monster>` | Removes a preset |

### Handling Duplicate Cards

A monster can hold up to four copies of the same card type. When a player types `unequip Hit from Stonefang` and Stonefang has Hit ×3, the command removes **one copy** — the first match. To remove more, the player repeats the command or uses the count form: `unequip 3 Hit from Stonefang`. This is consistent with how most inventory systems handle stacked items and avoids requiring slot-position awareness from the player.

The `move` command works identically: `move Hit from Stonefang to Mirebell` moves one Hit card. `move 2 Hit from Stonefang to Mirebell` moves two.

The optional count is captured in the regex:

```
/(?:unequip|move) (?:(\d+) )?(.+?) from .../i
```

Group 1 is the optional count (defaults to 1), group 2 is the card name.

In the web workshop, this ambiguity does not exist: each card rendered in the grid is a distinct draggable instance, and drag-and-drop operates on that specific instance.

### Card Inventory View Format

Output of `look at card inventory` / `look at all cards`:

```
Your Card Inventory
===================

Stonefang [Basilisk, L4]  6/9 slots
  1) Hit
  2) Hit
  3) Hit Harder
  4) Berserk
  5) Battle Focus
  6) Thick Skin

Mirebell [Jinn, L2]  3/9 slots
  1) Blink
  2) Heal
  3) Flee

Unequipped (14 cards)
  Adrenaline Rush, Basic Shield, Blast x2,
  Brain Drain, Coil, Delayed Hit x2, Heal,
  Hit x3, Sandstorm
```

Equipped cards are shown per-monster with numbered slots. Unequipped cards are shown as a compact comma-separated list with stack counts. The full `look at inventory` command appends the items section below.

### Preset Storage

Presets are stored on `monster.options.presets: Record<string, string[]>` — arrays of card-type identifiers. They serialize into the existing gzip+base64 state blob with zero new database schema. Maximum 10 presets per monster. Scope is per-room; cross-room presets are a future feature.

---

## Web Interface: Deck Workshop

### Access

- Dedicated route at `/room/:roomId/workshop` — not an overlay or panel.
- "Workshop" link in the AppShell header nav, conditional on `roomId` (same pattern as "Fight log").
- Mobile: accessible from the hamburger drawer.
- Not constrained to monospace-only; uses the terminal aesthetic CSS custom properties but renders as a normal dark-mode web UI. The workshop is a tool, not a text adventure — it earns its own visual treatment.

### Layout

```
┌─────────────────────────────────────────────────────────────────────────┐
│  DECK MONSTERS  / Tavern Basement                    [Workshop] ...     │
├─────────────────────────────────────────────────────────────────────────┤
│  DECK WORKSHOP                                [← Back to Ring]          │
│                                                                         │
│  ┌─────────────────────────────┐  ┌──────────────────────────────────┐  │
│  │ STONEFANG [Basilisk, L4]    │  │ MIREBELL [Jinn, L2]              │  │
│  │ ▓▓▓▓▓▓░░░ 6/9 slots        │  │ ▓▓▓░░░░░░ 3/9 slots             │  │
│  │                             │  │                                  │  │
│  │ ┌────┐ ┌────┐ ┌────┐       │  │ ┌────┐ ┌────┐ ┌────┐            │  │
│  │ │Hit │ │Hit │ │Hit+│       │  │ │Blnk│ │Heal│ │Flee│            │  │
│  │ └────┘ └────┘ └────┘       │  │ └────┘ └────┘ └────┘            │  │
│  │ ┌────┐ ┌────┐ ┌────┐       │  │ ┌────┐ ┌────┐ ┌────┐            │  │
│  │ │Bsrk│ │BFcs│ │ThkS│       │  │ │[+] │ │[+] │ │[+] │            │  │
│  │ └────┘ └────┘ └────┘       │  │ └────┘ └────┘ └────┘            │  │
│  │ ┌────┐ ┌────┐ ┌────┐       │  │                                  │  │
│  │ │[+] │ │[+] │ │[+] │       │  │ Presets: [aggro ▾] [Load]        │  │
│  │ └────┘ └────┘ └────┘       │  │          [Save as...]            │  │
│  │ Presets: [tank ▾] [Load]    │  └──────────────────────────────────┘  │
│  │          [Save as...]       │                                        │
│  └─────────────────────────────┘                                        │
│                                                                         │
│  YOUR INVENTORY  (14 unequipped cards)                                  │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐       │   │
│  │ │AdrR│ │BscS│ │Blst│ │Blst│ │BrDr│ │Coil│ │DlyH│ │DlyH│       │   │
│  │ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘ └────┘       │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

Monster panels live at the top, one per monster, in a responsive horizontal row that wraps on narrow screens. Each panel shows the monster's name, type, level, a slot-usage bar, and a 3×3 grid of card slots (reflecting the 9-slot maximum). Below the monster panels sits the unequipped inventory tray.

### Card Visual Design

- **Size**: ~72×90px compact card shapes, square corners (no `border-radius`), `var(--font-family)` throughout.
- **Card face**: emoji icon top-center, abbreviated name (via `abbreviateCardName()` utility), card class in dim text at bottom.
- **Color coding by class**: Melee = amber, Magic = blue/purple, Heal = green.
- **Empty slots**: dashed-border `[+]` drop targets.
- **Incompatible drop targets**: reddish tint + ✗ overlay while dragging an incompatible card.
- **Monsters in battle**: gold border + "In Battle" label. Slots locked for editing.
- **Warning banner** when monster `inRing`: *"Stonefang is currently fighting. Changes apply after they return."*

### Drag-and-Drop Operations

| Source | Target | Effect |
|--------|--------|--------|
| Inventory card | Monster empty slot | Equip |
| Inventory card | Monster filled slot | Swap (unequip existing → equip dragged) |
| Monster card | Different monster empty slot | Move (no deck roundtrip) |
| Monster card | Different monster filled slot | Swap between monsters |
| Monster card | Inventory area | Unequip |
| Monster card | Same monster different slot | Reorder (cosmetic only; no engine effect) |

Implementation:

- **HTML5 Drag and Drop API** (not a library) — lower bundle size, fewer dependencies.
- **Mobile fallback**: tap-to-select + tap-to-place (HTML5 DnD is not reliable on touch).
- **Optimistic UI updates**; error toast + snap-back on rejection.
- `game.myInventory` query polled every 30s or invalidated after each mutation.

### Preset Controls (Per Monster Panel)

- Dropdown (`<select>`) of saved presets.
- **Load** button → `game.loadPreset` mutation (returns skipped cards for a warning toast).
- **Save as...** → inline name input (no modal) → `game.savePreset`.
- Custom dropdown to allow per-item "×" delete button → `game.deletePreset`.

### State Routing

All workshop operations go through tRPC → `runSerializedEngineWork` → the same `character.*` engine methods that text commands use. A silent channel discards `announce` text but also publishes it as a private event on the ring feed — so the player's terminal console shows the result too (audit trail preserved).

---

## Engine Changes

### New Methods on Beastmaster

`packages/engine/src/characters/beastmaster.ts`:

| Method | Description |
|--------|-------------|
| `lookAtInventory(channel)` | Renders full inventory (cards + items) |
| `lookAtCardInventory(channel)` | Renders cards-only unified view |
| `unequipCard({ cardName, monsterName, count?, channel })` | Removes one (or N) copies of a card, returns to character deck |
| `unequipAll({ monsterName, channel })` | Clears the monster's entire hand |
| `moveCard({ cardName, fromMonsterName, toMonsterName, count?, channel })` | Direct monster-to-monster transfer |
| `moveCards({ cardNames, fromMonsterName, toMonsterName, channel })` | Batch transfer (multiple different cards) |
| `savePreset({ presetName, monsterName, channel })` | Snapshots current hand as a named preset |
| `loadPreset({ presetName, monsterName, channel })` | Unequips all, re-equips from preset. Returns `{ equipped, requested, skippedCards }` |
| `deletePreset({ presetName, monsterName, channel })` | Removes a preset |
| `getPresets(monsterName?)` | Read-only getter, returns preset map |

### New Command Handlers

- `UNEQUIP_CARD_REGEX` and `UNEQUIP_ALL_REGEX` → `packages/engine/src/commands/monster.ts`
- `MOVE_CARD_REGEX` → `packages/engine/src/commands/monster.ts`
- New file `packages/engine/src/commands/presets.ts` with `SAVE_PRESET_REGEX`, `LOAD_PRESET_REGEX`, `DELETE_PRESET_REGEX`, `LOOK_AT_PRESETS_REGEX`
- Updated `LOOK_AT_REGEX` in `look-at.ts` to include `inventory`, `card inventory`, `all cards` with new switch cases routing to the appropriate Beastmaster methods

### New Event Types

| Event | Scope | Payload |
|-------|-------|---------|
| `card.equipped` | private | Emitted after any equip/unequip/move. Payload includes the monster name and new card list. |
| `card.presetLoaded` | private | Preset operation summary: preset name, equipped count, skipped cards. |

### Constants

- `MAX_PRESETS = 10` — per-monster preset limit.

---

## tRPC Endpoints

`packages/server/src/trpc/router.ts`:

| Procedure | Type | Description |
|-----------|------|-------------|
| `game.myInventory` | query | Full inventory: monsters + equipped cards + presets + unequipped deck |
| `game.unequipCard` | mutation | Unequip one (or N) cards from a monster |
| `game.unequipAll` | mutation | Clear a monster's entire hand |
| `game.equipCards` | mutation | Equip one or more cards (supports `replaceAll` flag) |
| `game.moveCard` | mutation | Direct monster-to-monster transfer |
| `game.savePreset` | mutation | Save a named preset |
| `game.loadPreset` | mutation | Load preset → `{ equippedCount, requestedCount, skippedCards }` |
| `game.deletePreset` | mutation | Delete a named preset |

`game.myInventory` reads engine state directly (no engine lock, read-only). All mutations use `runSerializedEngineWork` and a silent channel that echoes text to the private event stream.

---

## Data Flow

```
Text command
  → game.handleCommand()
  → character.moveCard()
  → mutates engine state
  → game.scheduleSave()
  → state persisted

Web workshop drag
  → tRPC mutation
  → runSerializedEngineWork
  → same character.moveCard()
  → silentChannel echoes text to private event stream
  → terminal console shows result (audit trail)
  → game.scheduleSave()
  → state persisted
  → card.equipped event emitted
  → workshop invalidates myInventory cache
```

Both paths converge on the same Beastmaster methods. The web workshop is not a parallel system — it is a different input device for the same engine operations.

---

## Non-Goals

- **Cross-room presets** — future feature requiring a dedicated DB table. For now presets live in the monster's serialized state within a single room.
- **Card filtering/search in workshop inventory** — post-launch enhancement.
- **Number-indexed equip from inventory** (`equip 1,3,5`) — stateful and tricky in text protocol where the list order can shift between commands.
- **Card reordering within a monster hand** — not semantically meaningful in the engine; deck order is the play order and is already sequential.
- **Undo for drag operations** — mutations are fast and cheap; snap-back on error is sufficient.

---

## Critical Files to Modify

### Engine (`packages/engine`)

| File | Changes |
|------|---------|
| `src/characters/beastmaster.ts` | New methods: `lookAtInventory`, `lookAtCardInventory`, `unequipCard`, `unequipAll`, `moveCard`, `moveCards`, `savePreset`, `loadPreset`, `deletePreset`, `getPresets` |
| `src/monsters/helpers/equip.ts` | Reference for existing equip pattern; may need refactoring to expose a lower-level `removeCard` helper |
| `src/commands/monster.ts` | Add `UNEQUIP_CARD_REGEX`, `UNEQUIP_ALL_REGEX`, `MOVE_CARD_REGEX` handlers |
| `src/commands/look-at.ts` | Add `inventory`, `card inventory`, `all cards` cases to `LOOK_AT_REGEX` |
| `src/commands/presets.ts` | **New file.** `SAVE_PRESET_REGEX`, `LOAD_PRESET_REGEX`, `DELETE_PRESET_REGEX`, `LOOK_AT_PRESETS_REGEX` |
| `src/commands/index.ts` | Register preset handlers |

### Server (`packages/server`)

| File | Changes |
|------|---------|
| `src/trpc/router.ts` | Add `game.myInventory`, `game.unequipCard`, `game.unequipAll`, `game.equipCards`, `game.moveCard`, `game.savePreset`, `game.loadPreset`, `game.deletePreset` procedures |

### Web (`apps/web`)

| File | Changes |
|------|---------|
| `src/App.tsx` | Add `/room/:roomId/workshop` route |
| `src/views/WorkshopView.tsx` | **New file.** Top-level workshop view: fetches `myInventory`, composes monster panels + inventory tray |
| `src/components/MonsterWorkshopPanel.tsx` | **New file.** Monster card grid with slot-usage bar, drag targets, in-ring lock state |
| `src/components/CardSlot.tsx` | **New file.** Draggable card face / empty-slot drop target |
| `src/components/InventoryPanel.tsx` | **New file.** Unequipped card grid |
| `src/components/PresetControl.tsx` | **New file.** Preset dropdown + save/load/delete controls |

### Shared Utilities

| Utility | Location | Purpose |
|---------|----------|---------|
| `abbreviateCardName()` | `apps/web/src/utils/cards.ts` | Shorten card names to fit ~72px card faces (e.g., "Adrenaline Rush" → "AdrR") |
| `useDeckWorkshop()` | `apps/web/src/hooks/useDeckWorkshop.ts` | tRPC queries + mutations + optimistic cache updates for the workshop view |

---

## Tasks

### Engine

- [x] ~~`lookAtInventory` and `lookAtCardInventory` methods on Beastmaster~~
- [x] ~~`unequipCard` (single + count form) and `unequipAll` methods~~
- [x] ~~`moveCard` and `moveCards` methods~~
- [x] ~~`savePreset`, `loadPreset`, `deletePreset`, `getPresets` methods~~
- [x] ~~`MAX_PRESETS` constant~~
- [x] ~~`card.equipped` and `card.presetLoaded` event types~~
- [x] ~~`UNEQUIP_CARD_REGEX`, `UNEQUIP_ALL_REGEX`, `MOVE_CARD_REGEX` command regexes in `monster.ts`~~
- [x] ~~New `presets.ts` command file with save/load/delete/look-at handlers~~
- [x] ~~`LOOK_AT_REGEX` update in `look-at.ts` for inventory / card inventory / all cards~~
- [x] ~~`COMMAND_CATALOG` additions for help text~~
- [x] ~~Tests for all new Beastmaster methods~~
- [x] ~~Tests for all new command regexes~~

### Server

- [x] ~~`game.myInventory` query procedure~~
- [x] ~~`game.unequipCard` mutation procedure~~
- [x] ~~`game.unequipAll` mutation procedure~~
- [x] ~~`game.equipCards` mutation procedure (with `replaceAll` flag)~~
- [x] ~~`game.moveCard` mutation procedure~~
- [x] ~~`game.savePreset` mutation procedure~~
- [x] ~~`game.loadPreset` mutation procedure~~
- [x] ~~`game.deletePreset` mutation procedure~~
- [x] ~~Tests for all new tRPC procedures~~

### Web

- [x] ~~`WorkshopView` route + AppShell nav link~~
- [x] ~~`MonsterWorkshopPanel` component~~
- [x] ~~`CardSlot` component (draggable card + empty slot variant)~~
- [x] ~~`InventoryPanel` component~~
- [x] ~~`PresetControl` component~~
- [x] ~~`useDeckWorkshop` hook (tRPC integration + optimistic updates)~~
- [x] ~~`abbreviateCardName` utility~~
- [x] ~~HTML5 Drag and Drop + mobile tap-to-select fallback~~
- [x] ~~`inRing` warning banner + slot locking~~
- [x] ~~Optimistic UI updates + error toast + snap-back~~
- [x] ~~CSS: card color coding by class, drop-valid animation, incompatible-target overlay~~
