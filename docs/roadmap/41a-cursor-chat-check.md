---
type: Roadmap
title: Room chat live check
description: Cursor's live browser checklist for roadmap 41's room chat — msg and dm in the Console, the DM preview and suggestions, the Chat tab, unread and dividers — with the exact text each item must show.
status: draft
audience: internal
tags: [roadmap, chat, web, cursor]
---
# 41a — Room chat live check (Cursor)

**Status:** Ready to run (2026-10-01) on `claude/unicorn-monster-cards-cigpmw`. Claude built
[room chat](41-room-chat.md). Cursor drives a real browser, so it checks chat live and fixes
small failures. Claude reviews the branch and writes any new player-facing text.

## Rules

- **Branch:** work on `cursor/chat-check-41a`, created from `claude/unicorn-monster-cards-cigpmw`.
  Commit in small steps, push only your own branch, and do not open a pull request.
- **Player-facing text:** every string below is exact. Never reword one. If you need a line
  that is not here, write a placeholder marked `// DRAFT(41)` and list it under "Strings for
  Claude".
- **Fix only what is small** (a layout, a control that does nothing, a missing disabled state).
  Use one commit per fix, and run the gate before your last push: `pnpm build`, `pnpm lint`,
  `pnpm test`, `pnpm --filter @deck-monsters/web test`, `pnpm run build:docs`,
  `pnpm docs:check`.
- **Read first:** `CLAUDE.md`, [room chat](../architecture/room-chat.md), and
  [local testing](../operations/local-testing.md).
- **Use the local Supabase path** in [cloud development](../operations/cloud-development.md).
  Chat needs this branch's new migration, which the remote (production) database does not have
  until the branch deploys. **Never run migrations against the remote database.**
  - The local path seeds `localtester@example.com`. Sign up a second local user, for example
    `localtester2@example.com`, in another browser profile or incognito window.
  - Create a local room and have the second user join it with the invite code. Give each a
    character: train a monster with each one.
  - If Docker isn't available, stop and report it. The check will run on production after the
    deploy instead.
- **For the DM-routing items,** you need three players named **Anthony**, **Bourdain** and
  **Anthony Bourdain**. Rename characters with `edit my character`, and sign up a third local
  user if you need one.
- **Widths:** 390 × 844 and 1440 × 900, with a screenshot for each item.

## The checklist

Record each item as **pass** or **fail**, with a screenshot, in
`docs/reference/chat-check.md`. Give it front matter like the other `docs/reference` files,
link it from `docs/README.md`, and make sure `pnpm docs:check` passes.

### A. The Chat tab

1. Six tabs fit at 390 px with no sideways scroll: The Ring, Console, Chat, Workshop, Fights,
   Leaders. The Chat tab's tooltip is
   `Talk with everyone in this room, or send a message to one player.`, and the panel shows the
   same line under its heading.
2. With no messages, the panel reads `No messages yet. Say hello, or cheer on a fight.`
3. User 1 sends `hello` with **To** set to `Everyone`:
   - it appears for user 1 as `You: hello`, and for user 2 live as `{name}: hello`, with no reload;
   - a time divider shows above the first message (`Today, …`).
4. User 2 is on another tab when it arrives:
   - the Chat tab shows an unread badge (`1`) at its corner, without covering the label;
   - opening Chat shows `New since you were last here` above the new message;
   - the badge clears once the list is at the bottom.
5. Pick user 2 in **To**:
   - the picker shows their name highlighted;
   - the placeholder reads `Message {name}…`.

   Send a DM. User 2 sees `✉️ {name} to you: …` and user 1 sees `✉️ You to {name}: …`. A third
   user, if you have one, sees nothing.
6. Start a fight and send a message during it. A `During fight #{n}` divider appears above it.
7. Send six messages quickly. The sixth is refused with
   `Easy there. Wait a few seconds before the next message.`, and the typed text stays in the box.
8. Desktop side by side, with Chat not in either pane: the pane picker lists `Chat · {n} unread`.
   The ☰ menu has a Chat entry.

### B. The Console

9. `msg hi all` sends to the room. In the Console it shows as `💬 You: hi all`, and user 2's
   Console shows `💬 {name}: hi all`. `m hey` and `message hey` work too.
10. An empty `msg` gets `Say something after msg, like: msg nice hit, Fang!`
11. Open the Console with unread chat: it shows `💬 {n} new messages in Chat.` (or
    `1 new message`).
12. Start an `equip` question and leave it open:
    - `msg still here` goes to chat, and the question stays open;
    - `m Jones` is taken as an answer, not chat.

### C. Who a DM goes to (Anthony, Bourdain, Anthony Bourdain)

13. Type `dm Anthony Bourdain is too powerful` without sending. The line above the input reads
    `To: Anthony Bourdain. Anthony is in this room too. Pick a name from the list to be sure.`,
    with **Anthony Bourdain** highlighted.
14. Type `dm `. The suggestion list orders players this way:
    - the player you last sent a DM to;
    - the player who last sent you one, if different;
    - players with a monster in the ring;
    - everyone else, alphabetically.

    Pick **Anthony** and type `Bourdain is too powerful`, then send. Anthony receives
    `Bourdain is too powerful`, and Anthony Bourdain receives nothing.
15. Each of these typed lines gets its own response:
    - `dm "Anthony" Bourdain is too powerful` goes to Anthony;
    - `dm` alone gets `Type dm, a player's name, and your message, like: dm Ada good luck.`;
    - `dm Zed hi` gets `No player here by that name yet.` in the preview, and on sending,
      `Nobody in this room goes by that name. Use the name as it shows in Chat, like: dm Ada good luck.`;
    - `dm {your own name} hi` gets `That's you. Pick someone else.`
16. Rename a second player to exactly the same name as another. Typing `dm {that name} hi` shows
    `Two players here go by {that name}. Pick one from the list.`, and sending is refused. Picking
    either player from the list still works.

### D. Help

17. Help and guides → How to play has a **Talking to Other Players** section listing `msg` and
    `dm`. `help msg` and `help dm` in the Console show those commands with their examples.

## Report

Add these sections to the end of `docs/reference/chat-check.md`:

- **Fixed on the way:** each fix, with its SHA.
- **Strings for Claude:** every placeholder you added.
- **Not reached:** each item you couldn't reach, and why.
- **Anything else confusing:** anything that confused you, with a screenshot.

## Prompt (paste whole into Cursor)

```text
Read docs/roadmap/41a-cursor-chat-check.md in the deck-monsters repo. Fetch and check out
branch claude/unicorn-monster-cards-cigpmw, then create your own branch cursor/chat-check-41a
from it. Follow the Rules section (use the local Supabase path — never migrate the remote
database), then check every numbered item in "The checklist" in a real browser at 390 x 844
and 1440 x 900 with two signed-in users, recording pass or fail with a screenshot in
docs/reference/chat-check.md. Commit to your branch only, never push to
claude/unicorn-monster-cards-cigpmw, and do not open a pull request. Push your branch when you
finish.
```
