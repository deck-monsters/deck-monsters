# Multi-Room / Groups Support

**Category**: Feature  
**Priority**: High (required for web and multi-server Discord)  
**Status**: Done — server code, web UI (room lobby, room settings, invite codes), and Discord room commands (`/create-room`, `/join-room`) all shipped. Slack deferred indefinitely.

## Background

The original game had one game instance for one private Slack channel. The entire `Game` object is one room. To support multiple friend groups, Discord servers, or web game lobbies, each group needs its own isolated game instance.

## Design

### Room / Group Model

A **room** is a named, isolated game instance:

- Has a unique `room_id`
- Has an owner / admin
- Has an invite code or invite link for joining
- Stores its own serialized game state (see backend hosting doc)
- Has its own ring, character roster, shop inventory, etc.
- Is connector-agnostic — any connector can attach to any room

### RoomManager

The `RoomManager` is the central orchestrator that sits between connectors and game instances:

```typescript
class RoomManager {
  private rooms: Map<string, { game: Game; eventBus: RoomEventBus }>;

  getGame(roomId: string): Game { ... }
  getEventBus(roomId: string): RoomEventBus { ... }

  createRoom(ownerId: string, name: string): Promise<Room> { ... }
  loadRoom(roomId: string): Promise<void> { ... }  // restore from DB
  unloadRoom(roomId: string): Promise<void> { ... } // save + remove from memory

  listRoomsForUser(userId: string): Promise<Room[]> { ... }
}
```

Connectors don't interact with `Game` directly — they go through `RoomManager` to get the game instance and event bus for a specific room. This is the integration point where auth (`userId`), room membership, and the event bus all come together.

### Room Lifecycle

1. User creates a room → `RoomManager.createRoom()` → new `Game` instance + `RoomEventBus` + DB row
2. Connector subscribes to the room's event bus to receive game events
3. Game state is periodically snapshotted to DB (throttled, not on every mutation — see backend hosting doc)
4. Idle rooms (no activity for N hours) can be unloaded from memory; reloaded on next interaction
5. Room deletion: owner-only, with confirmation; removes DB row and all associated events

### Lazy Loading

Not all rooms need to be in memory at all times. On startup, load only rooms with recent activity. When a command targets a room that isn't loaded, restore it from the DB snapshot on demand. This keeps memory usage proportional to active rooms, not total rooms.

### Multi-Room Engine Changes

The engine itself (`Game` class) already encapsulates a single room. No changes to the engine are needed for multi-room — it's a concern of the server layer:

1. `RoomManager` maintains a map of `room_id → { Game, RoomEventBus }`
2. Routes each command to the correct room's `Game`
3. Handles room creation, joining, leaving, and lifecycle

### Room Management Commands

New commands surfaced via each connector:

| Command | Description |
|---------|-------------|
| `/create-room [name]` | Create a new room, get invite code |
| `/join-room [code]` | Join a room by invite code |
| `/leave-room` | Leave your current room |
| `/room-info` | Show current room name, player count, active ring |
| `/list-rooms` | List rooms you belong to |

### External ID Mapping

Connectors map their platform-specific identifiers to room IDs:

- **Discord**: a guild ID maps to a default room; sub-rooms can be created per channel
- **Slack**: a workspace+channel pair maps to a room
- **Web/mobile**: rooms are managed directly through the UI

This mapping lives in the connector, not the database schema — a room is just a room, agnostic of which connector created it.

### Player ↔ Room Relationship

- A player can belong to multiple rooms (different friend groups)
- Characters are room-scoped (simpler, avoids stat inflation across groups, prevents "grinding in one room to dominate another")
- The `room_members` table tracks membership: `{ room_id, user_id, joined_at, role }`

## Tasks

- [x] Design and implement `RoomManager` class (lazy loading, state restore, event bus wiring)
- [x] Add room CRUD to the tRPC API (create, join, leave, list, info, delete)
- [x] Implement lazy loading / unloading of rooms (`_getOrLoad`, `unloadRoom`, `sweepIdleRooms`)
- [x] ~~Add room management UI to web app~~ (room lobby, room settings, invite code copy — live at deck-monsters.com)
- [x] ~~Add room join/leave/create commands to Discord connector~~ (`/create-room` and `/join-room` slash commands implemented)
- [ ] Add room management to Slack connector _(deferred → roadmap 08)_
- [x] Implement invite code generation and redemption
- [x] Handle room cleanup (idle rooms: `sweepIdleRooms` with 10-minute sweep interval; owner leaves: FORBIDDEN guard in `leaveRoom`; owner deletes: `deleteRoom`)
- [x] Decide and document room-scoped vs global characters — **decided: characters are room-scoped** (simpler, prevents stat inflation across groups, prevents grinding in one room to dominate another; enforced implicitly by each `Game` instance being isolated to its room)
