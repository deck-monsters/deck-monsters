# Native Mobile App (iOS + Android)

**Category**: Feature / Connector  
**Priority**: Medium

## Overview

A native mobile app for iOS (and optionally Android) so players can check on their monsters, send commands, and watch fights from their phone — similar to how the game was originally used in Slack's mobile app.

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

The mobile app connects to the same backend API as the web app (REST + WebSocket). No game engine code runs on the device — it's a thin client.

- REST API for commands (spawn, ring, equip, buy, etc.)
- WebSocket for real-time ring feed
- Push notifications (APNs / FCM) for major events when app is in background

## Push Notifications

Notify players when:
- Their monster wins or loses a fight
- Their monster is knocked out
- A new fight is starting in their ring
- Exploration completes

## Graphics

Simple monster icons / sprites go a long way on mobile (see graphics issue). A small icon next to each monster name makes scanning the feed much easier.

## Tasks

- [ ] Set up React Native + Expo project
- [ ] Implement WebSocket client for ring feed
- [ ] Implement REST API client (typed, with error handling)
- [ ] Build ring feed screen with live updates
- [ ] Build my monsters screen
- [ ] Build monster detail + deck builder screens
- [ ] Build shop screen
- [ ] Build spawn screen
- [ ] Integrate auth (JWT storage via Expo SecureStore)
- [ ] Implement push notifications (Expo Notifications + backend integration)
- [ ] iOS: configure APNs, submit to App Store
- [ ] Android: configure FCM, submit to Google Play
- [ ] Add simple monster icons (see graphics issue)
