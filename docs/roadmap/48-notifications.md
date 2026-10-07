---
type: Roadmap
title: Notifications from the web app
description: Notes for pinging a player whose page is closed — a direct message first, then a fight countdown only in the cases worth coming back for.
status: draft
audience: internal
tags: [roadmap, web, chat, notifications]
---
# 48 — Notifications

**Status:** Notes (2026-10-06). Not scheduled. The owner asked what a home-screen ping would take, and which events are worth one. This file is that write-up. Nothing here is built.

The product is a small ping from another person when the page is closed, so it shows on the phone's home screen. A fight is not that. The game already plays the fight by itself.

## What the owner wants

Said 2026-10-06, after a first pass that listed too many fight events:

- **A direct message, with the page closed.** Someone in the room can reach a player who has left the site. That is the reason to build this.
- **Not every boss arrival.** A boss walking into the ring is not, by itself, the ping.
- **The fight countdown, for a player who is already in the ring.** They may have sent a monster into an empty ring and left. Nothing counts down until a boss or another player joins: quorum is 2, and a lone monster only hears that the countdown will begin once one more joins. The ping is that later arming, 60 seconds before the fight, whether the one who completed the ring was a boss or another player. The entrance is what caused the countdown, not a separate notification. Corrected 2026-10-07; the earlier line ("only when a boss is already in the ring") had the audience backwards.
- **Optionally, in a smaller ring, the same countdown for someone who is not in yet,** so they can still come and join before the fight starts.

Room-wide chat (`msg`) stays on the Chat tab's unread badge. An in-app sound effect is a different, older idea (archived web plan) and is not this.

## Two ways a phone can be "away"

These are different mechanisms. Only the second one puts a banner on the home screen after the page is gone.

| The player | What can reach them | What it takes |
|---|---|---|
| Tab open and visible | Nothing extra. The Chat badge and the feed already show it. | — |
| Tab open, hidden, and still running (a desktop browser behind another window) | The page can call the browser Notification API itself, because `ringFeed` and chat frames are still arriving. | Permission, and a filter in the web app. No server. |
| Page closed, or the phone has locked and frozen the tab | Only **Web Push**. The site is not running, so it cannot notice a new event. A service worker, registered earlier, receives the push and shows the banner. | Server, a stored subscription per device, and the player has opted in once while the page was open. |

The second row is cheap and does not meet the request. The third row is the request.

On iPhone, Web Push is delivered only to a site the player has added to the Home Screen (Safari 16.4 and later). A normal Safari tab never buzzes, even with permission. The opt-in screen has to say that in a sentence, because this game is played mostly on phones. Desktop Chrome and Android Chrome can receive a push without an installed icon, once a service worker has been registered.

## What already exists

There is no service worker, no web app manifest, no Notification permission, and no push subscription anywhere in the repo.

Delivery today:

- **A DM** is a row in `room_messages` with `recipient_user_id` set. `ChatService.subscribe` hands it to that player's live `ringFeed` as an untracked `chat` frame. It is not a `GameEvent`, and it is not posted to Discord. The Chat tab already counts it as unread. See [room chat](../architecture/room-chat.md).
- **The fight countdown** is a private `ring.countdown` per player who already has a monster in the ring: "Fight will begin in 60 seconds." (`startFightTimer` in `packages/engine/src/ring/index.ts`, `FIGHT_DELAY` = 60000). The payload is empty. It is published only once quorum is met (`MIN_MONSTERS` = 2). A boss counts as one toward that, and so does another player's monster. Players who are members but not in the ring do not get that event.
- **Below quorum there is no countdown.** One monster standing alone gets a private `announce`: "Fight countdown will begin once 1 more monster joins the ring." That is the waiting state. It is not `ring.countdown`, and it is not a push.
- **Whether a boss is in the ring** is on the roster, not on the countdown event. `contestantSnapshots()` sets `isBoss`, and nulls a boss's `userId` (the house owner is the sentinel `'boss'`). `ring.state` carries `nextFightAt`, `inEncounter`, and those snapshots, and it is not persisted. The waiting-player ping does not need `isBoss`. The countdown event's own targets are the audience.
- **Joining during the countdown is allowed.** `addMonster` refuses only when the ring is full (`MAX_MONSTERS` = 12) or a fight is already underway (`inEncounter`). The 60 seconds are a real window to `send` a monster. Once the fight starts, the ring answers "The ring is full! Wait until the current fight is over and try again." A join ping that arrives after that is a lie.
- **A boss counts as one contestant** toward the quorum of 2, however many bosses are standing there. One player, one monster in the ring.
- **Withdrawal** is refused only while a fight is in progress, not during the countdown.
- **Background tabs** freeze timers. `useRingFeed` resets its heartbeat watchdog on `visibilitychange` for that reason (10b #127). A locked phone often still looks connected on the server until the socket actually dies. "No WebSocket, so push" — the rule in the archived mobile sketch — misses that case, and the opposite rule ("any socket, so don't push") misses it too. See Presence below.
- **An idle room unloads after two hours** (`sweepIdleRooms`). A fight in progress is kept. Revival is a `setTimeout` on the creature and does not fire while the room is unloaded; the heal is applied from the wall clock the next time the room loads. There is no "your monster is back" event.
- **Discord** already receives public ring lines in the guild channel, and private lines (including prompts) as a DM to the linked user. Web chat does not. A web push on top of a Discord DM would buzz a hybrid player twice for the same game event. A web-chat DM does not, because Discord never sees it.

The engine stays out of this. It has no HTTP. A notifier belongs next to `ChatService` and the fight-stats subscriber: the server, scoped to a room, checking membership again at send time.

## The ping, and when to send it

One device subscription covers every room the player belongs to. The banner names the room. Tapping it opens that room. Chat already has a route: `/room/:roomId/chat`.

### Direct message — build this

Send when a DM arrives and this player is not looking at that room.

- Audience: `recipient_user_id` only. Never the sender. Never the rest of the room.
- Not for `msg`. The unread badge is enough, and a busy room would train people to turn the ping off.
- The Chat tab's existing unread count is unchanged. This is an extra channel for someone who is gone.
- Several DMs in a short stretch should update one banner ("Ada sent you a message", then "Ada sent 3 messages"), not stack. Chat already refuses a 6th message inside 10 seconds, which caps a burst but does not make five banners pleasant.
- Lock screen: the banner is visible to anyone holding the phone. These rooms are small and the players know each other, so a short preview of the text matches "a ping from another person." The alternative is the name only ("Ada sent you a message") and the words only after they open the app. Decide before the first build; the default proposed here is a short preview, because a name-only banner does not say enough to walk back to the phone for.

### Fight countdown, for whoever is already in the ring

Send when `startFightTimer` arms the 60 second countdown, to each player who already has a monster in. That is the player who sent one into an empty ring and left, and it is also anyone else already standing there when a boss or another player completes the quorum. Do not send on `ring.add`, on `boss-soon`, or on a boss's temperament line. Do not send the below-quorum "once 1 more monster joins" line. A boss joining and another player joining are the same moment: both arm the countdown, and the countdown is the ping.

- Audience: the private `ring.countdown` targets. No `isBoss` filter. A fight between two players is the same ping as a fight against a boss.
- One banner per arming, not one per private event. `startFightTimer` publishes a separate `ring.countdown` for every player already in the ring. The arming is the `nextFightAt` that `publishState` sets immediately after that loop. Key the push by `roomId` and `nextFightAt`, and send each recipient at most one banner for that value.
- Copy says the fight starts in a minute. "A boss entered" is the ping we are not building.
- The same hold test as the join ping, below. A countdown the hold will cancel is a false promise whether or not a boss is in the ring.

A mega boss is a different clock (announced 30 minutes ahead, reminded at 10 and 2, and the ordinary countdown is held in the last stretch). Do not wire this rule to those reminders. If a mega boss is ever worth a ping, it is its own decision.

### Countdown in a smaller ring, so someone who is not in yet can join — optional

Send when the countdown arms and the ring is small enough that a fight starting is news. The point is the join window: a member who is not in the ring can still `send` a monster until the fight actually starts, and only if a slot is free (the ring holds 12). A boss is not required. The players already in the ring are covered above, boss or not.

- Audience: members of the room who do **not** already have a monster in the ring. A second ping to someone already in would be noise.
- Do not send when the ring is already full. There is nothing to join.
- Do not send when this countdown will not become a fight. `holdForMegaBoss` refuses at arm time only once the mega boss is already inside `MEGA_BOSS_HOLD_MS` (2 minutes), so a countdown armed while it is between 2 and 3 minutes away still publishes `ring.countdown`. The 2-minute reminder then calls `startFightTimer` again and clears the timer (`mega-boss.ts`), and the countdown callback refuses the fight once the hold has begun. Suppress when `nextMegaBossAt` is set and `nextMegaBossAt - now <= MEGA_BOSS_HOLD_MS + FIGHT_DELAY`. Watching the event is not that test.

**What "smaller" means is open.** Two readings, and they should not be mixed up:

1. **A small ring** — few contestants. The word in the game is the ring. A countdown at the quorum of 2 is "two monsters are about to fight, and there is room." A ring of 8 is already a brawl; nobody needs a tap to come watch it. A first cut could be "countdown armed, contestants at or under N, ring not full," with N left to pick (2 is the only number the code already treats as special).
2. **A small room** — few players. A quiet room where a fight is rare, as opposed to a room that fights all evening. That is a count of members, or of members seen lately (`room_members.last_seen_at`), not a count of contestants.

The owner's sentence was "smaller rings," and the reason was "so you can go join," which fits reading 1. Reading 2 is the case where the ping stays rare. Both can be true later (a small room, and a ring that still has a free slot). Do not guess N in the implementation until it is picked.

This one stays off until that pick is made. It is the easy way to make notifications feel like the feed.

### Recorded, not requested

Kept so the next pass does not rediscover them, and so they are not built on the back of the DM work.

| Event | Already on the wire | Why it was considered | Why it waits |
|---|---|---|---|
| Your monster's fight result | Private `ring.win`, `ring.loss`, `ring.draw`, `ring.fled`, `ring.permaDeath`, each with `targetUserId` | The fight ended and the next move is the player's. Permadeath is the one that hurts to miss. A card drop (`ring.cardDrop`, private and public) and a public level-up (`announce` with a `level-up` line) belong in the same banner, not three. | The owner did not ask. The fight plays itself. Easy to add later on the same push path, because these events are already addressed to one user. |
| Revival | Not an event. `respawn()` arms a timer and emits an in-process `respawn`. `myInventory` projects `revivesAt`. Wait is 10 minutes per level. | "Toyota is back" is a real reason to return, and it can be hours later. | The room may be unloaded, so a bus subscriber never sees it. It needs a `fire_at` row written when the monster falls, swept beside the idle sweep, and cancelled if an item revives them or they are dismissed. A separate piece of work. |
| An open Console question | Private `prompt.request`, 120 second timeout | They backgrounded the tab mid-question and the flow is about to die. | Rare on the web, where Workshop actions are prompt-free. A hidden tab can notify locally; a closed page often cannot answer in time anyway. Discord already delivers the prompt to a linked user. |

Leave these alone even then:

- Card plays, hits, misses, rounds, public narration.
- A boss arriving, `boss-soon`, a boss's temperament.
- Shop rotation.
- `ring.state`, heartbeats, handshakes, `system.gap`.
- Anything whose target is `userId: 'boss'`.

## Presence, so a closed page is pinged and an open one is not

The server pushes when it has not heard, recently, that this user is **looking at this room**. Visible and gone are the only two states that matter.

- While the room is on screen, the client says so, and repeats it on a short heartbeat (on the order of 15–30 seconds). The server skips the push.
- A hidden desktop tab stops saying "visible." The server pushes. The page must not also raise its own Notification, or the player gets two banners. One path: the server is the only sender, including for a hidden tab.
- A locked phone often freezes before it can say "hidden," and the last report may still say "visible." The heartbeat going stale is what makes the push happen. A DM in the first heartbeat-interval after the lock can be missed. That interval wants to be short for that reason, and no shorter than the client can honestly keep up on a phone.
- A closed page has no heartbeat. The push is the whole feature.
- A zombie socket (the server still thinks the tab is subscribed, the phone is frozen) must not count as "looking." Subscription liveness is the wrong bit. The visible-heartbeat is the bit.

`useRingFeed` already treats a frame as proof the connection is alive, and resets that watchdog when the tab becomes visible again. Presence for notifications is the other direction, and it is per room: a player with two rooms open is looking at one of them.

## How a push would be sent

Not a design to implement blindly. The constraints under it are the part that has already been wrong in older notes.

1. **Opt in, from a control with words.** Default off. Ask the browser for permission only after the player turns it on. A phone never shows a tooltip, so the control is a label, not an icon. Room Settings is the invite code, the member list, and owner actions; this switch is the player's, not the room's. Say, on that screen, that an iPhone only receives the ping after the site is added to the Home Screen.
2. **Register a service worker and store the subscription.** One row per device: the user, the endpoint, the keys, when it was created. Not a `room_id` on the subscription. The endpoint is unique. A payload always carries `roomId` and the room's name. A countdown payload also carries `nextFightAt`. Before send, check that this user is still a member of that room. Stale endpoints (the browser returns 404 or 410) get deleted.
3. **Keys.** A VAPID key pair is a server secret, the same kind of thing as the other server secrets. The public key is what the page uses to subscribe. Proposed names, not chosen: `WEB_PUSH_VAPID_PUBLIC_KEY` and `WEB_PUSH_VAPID_PRIVATE_KEY`.
4. **DM path.** `ChatService` already notifies listeners on send. The push sender is another listener, beside `ringFeed`. It does not write a `GameEvent` and does not go through the engine, so Discord and fight pacing never see it.
5. **Countdown path.** A server subscriber on the room bus, the fight-stats shape. The waiting-player ping goes to the `ring.countdown` targets, who are already in the ring. It does not read `isBoss`. It sends once per `roomId` + `nextFightAt`. One private `ring.countdown` per player is not one countdown: fanning the small-ring audience out from each of those events would ping every outsider once per contestant. The below-quorum `announce` is not this path. Skip the arming when `nextMegaBossAt - now <= MEGA_BOSS_HOLD_MS + FIGHT_DELAY`, as above. Set the Web Push TTL to the seconds left until `nextFightAt`, and have the service worker drop the banner if that time has passed. A phone that was offline must not be told the fight is about to start after it already has. A DM has no such deadline. The push does not persist a new event. `ring.countdown` is already stored; this is not a second copy in `room_events`.
6. **Click.** The service worker opens `/room/:roomId/chat` for a DM, and the ring (`/room/:roomId`) for a countdown that has not expired. If that room is already open, focus it.
7. **Discord.** Do not push a game event that the connector is already delivering to that user in this room. A web DM is not such an event. The countdown is: a linked Discord user already gets the private "Fight will begin in 60 seconds." Skip them for that one, or they get it twice. Skipping requires knowing the connector is actually delivering, not merely that a Discord account is linked somewhere.

Preferences, once there is more than the DM:

- DMs, on when notifications are on. This is the feature.
- Countdown while you are already in the ring, its own switch. The audience is settled: the private `ring.countdown` targets, boss or another player. A player who only wanted DMs can leave it off.
- Small-ring join countdown, off until "smaller" is defined.

## What not to build into the first cut

- Revival scheduling and fight-result banners. Same push pipe later, separate work, and revival cannot be a bus listener.
- An in-game sound.
- Notifying on boss entrance, ring events, or the mega-boss reminders.
- A Discord bridge for chat. That stays on [roadmap 41](41-room-chat.md), and it has its own collision with Discord's `dm` prefix.
- Treating "the socket dropped" as the presence signal.

## Open decisions

- Lock-screen preview of a DM's text, or the sender's name only. Proposed: a short preview.
- Whether the in-ring countdown defaults on alongside DMs. Who it is for is settled.
- The number for "smaller ring," and whether that is contestants, members, or both. Off until then.
- The visible-heartbeat interval. Short enough that locking the phone still gets the next DM; long enough that a phone can keep up.
- VAPID env names, when deployment is touched.
