# Native Mobile App (iOS + Android)

**Category**: Feature / Connector  
**Priority**: Deferred indefinitely  
**Status**: Not started — see roadmap README for rationale

## Overview

A native mobile app for iOS and Android so players can check on their monsters, send commands, and watch fights from their phone — similar to how the game was originally used in Slack's mobile app.

The mobile app is deferred until the Discord connector and web app are stable and the backend infrastructure (Supabase + Railway, event bus, tRPC API) is proven in production. The web app is responsive and works in mobile browsers, providing a reasonable mobile experience in the interim.

## Design Philosophy

The original Slack experience was largely reading a text feed on mobile, with occasional commands typed in chat. The mobile app should be purpose-built for that use case: glanceable, quick to act, easy to check in on. Not a complex game UI — a lightweight companion app.

## Approach: Cross-Platform First

Given the small team, build once for both iOS and Android using:

- **React Native** (most familiar if the web app uses React)
- **Expo** (managed workflow for faster iteration, easy OTA updates)

Native-only Swift/Kotlin is an option if specific platform features are needed, but cross-platform is more practical to maintain.

## Screens

| Screen | Description |
|--------|-------------|
| Ring Feed | Live battle log — push notifications for major events (wins/losses) |
| My Monsters | Monster list with quick-action buttons (ring, explore, use item) |
| Monster Detail | Full stats, current deck, items, XP progress |
| Deck Builder | Card selection — drag to reorder, tap to add/remove |
| Shop | Buy/sell items with current balance |
| Spawn | Create a new monster |
| Room | Current room info, members, invite friends |
| Profile | Player account, stats, coin balance |

## Backend Integration

The mobile app connects to the same tRPC API and event bus as the web app. No game engine code runs on the device — it's a thin client.

- **tRPC mutations** for commands (spawn, ring, equip, buy, etc.) via `@trpc/react-query`
- **tRPC WebSocket subscription** for real-time ring feed (`GameEvent` stream)
- **Reconnection with catch-up**: on reconnect, send `lastEventId` to replay missed events (same pattern as web — see backend hosting doc)
- **Push notifications** (APNs / FCM) for events when the app is in background

The mobile and web apps share the same server package (`packages/server`) and the same tRPC router. The only difference is the client-side rendering.

## Push Notifications

Notify players when:
- Their monster wins or loses a fight
- Their monster is knocked out / permadeath
- A new fight is starting in their ring
- Exploration completes

Push notifications are driven by `GameEvent` types on the server side. The server checks if the target user has an active WebSocket connection; if not, it sends a push notification instead.

## Ring Feed Rendering

Same approach as the web app: render `GameEvent.text` in a monospace font. React Native supports custom fonts (`JetBrains Mono`, `Fira Code`). For richer rendering (HP bars, monster icons), use `GameEvent.type` and `GameEvent.payload` — but start with text-only.

## Graphics

Simple monster icons / sprites go a long way on mobile (see graphics doc). A small icon next to each monster name makes scanning the feed much easier.

## Tasks

- [ ] Create `apps/mobile` — React Native + Expo project
- [ ] Set up tRPC client with `@trpc/react-query` (shared types with web app)
- [ ] Implement WebSocket subscription for ring feed with reconnection
- [ ] Build ring feed screen with live updates (monospace text rendering)
- [ ] Build my monsters screen
- [ ] Build monster detail + deck builder screens
- [ ] Build shop screen
- [ ] Build spawn screen
- [ ] Build room management screen (create, join, invite)
- [ ] Integrate Supabase Auth (JWT storage via Expo SecureStore, OAuth via `@supabase/supabase-js`)
- [ ] Implement push notifications (Expo Notifications + server-side event routing)
- [ ] iOS: configure APNs, submit to App Store
- [ ] Android: configure FCM, submit to Google Play
- [ ] Add simple monster icons (see graphics doc)
