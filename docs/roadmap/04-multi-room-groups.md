# Multi-Room / Groups Support

**Category**: Feature  
**Priority**: High (required for web, mobile, and multi-server Discord)

## Background

The original game had one game instance for one private Slack channel. The entire `Game` object is one room. To support multiple friend groups, Discord servers, or web game lobbies, each group needs its own isolated game instance.

## Design

### Room / Group Model

A **room** is a named, isolated game instance:

- Has a unique `room_id`
- Has an owner / admin
- Has an invite code or invite link for joining
- Stores its own serialized game state (see hosting issue)
- Has its own ring, character roster, shop inventory, etc.

### Multi-Room Engine Changes

The engine itself (`Game` class) already encapsulates a single room. The connector layer needs to:

1. Maintain a map of `room_id → Game instance`
2. Route each player's commands to their current room's `Game`
3. Handle room creation, joining, leaving

```
rooms/
  room-abc123  → Game instance A  (public channel → #deck-monsters-abc)
  room-def456  → Game instance B  (public channel → #deck-monsters-def)
```

### Room Management Commands

New commands needed (surfaced via each connector):

| Command | Description |
|---------|-------------|
| `/create-room [name]` | Create a new room, get invite code |
| `/join-room [code]` | Join a room by invite code |
| `/leave-room` | Leave your current room |
| `/room-info` | Show current room name, player count, active ring |
| `/list-rooms` | (Admin) List all rooms |

### Player ↔ Room Relationship

- A player can belong to multiple rooms (different friend groups)
- Characters are global to the player, not room-specific — you bring your monsters with you
- Or alternatively: characters are room-scoped (simpler, avoids stat inflation across groups) — **TBD**

## Tasks

- [ ] Design room schema: `{ room_id, name, owner_id, invite_code, created_at }`
- [ ] Implement `RoomManager` class that manages multiple `Game` instances
- [ ] Add room CRUD to the web app backend API
- [ ] Add room join/leave/create commands to Discord connector
- [ ] Add room management UI to web app
- [ ] Decide: global vs room-scoped characters (ADR needed)
- [ ] Handle room cleanup (idle rooms, owner leaves, etc.)
