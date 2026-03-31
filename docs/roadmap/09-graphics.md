# Graphics and Visual Design

**Category**: Enhancement / UX  
**Priority**: Low (nice to have)

## The Original Aesthetic

The game was played in a Slack channel. All output was plain text with emoji, formatted using monospace code blocks. This created a distinctive ASCII-card aesthetic that was part of the charm — keep it.

From screenshots of the original game in action:

**Card display** (rendered as a Slack code block):
```
================================
====
🚬  Lucky Strike  ◇
--------------------------------
----

 A man in a jester's hat smiles
 at you from the crowd. You
 feel... Lucky for some reason.
 Or perhaps feel the unluckiness
 of your opponent...

================================
====
```

**Monster stat card** (same format):
```
================================
====
🐍  Tlexaktil
--------------------------------
----

 A stocky, mule fawn,
 forest-dwelling basilisk with a
 nasty disposition and the
 ability to turn creatures to
 stone with its gaze...

================================
====
```

**Combat narration** (plain text, outside the code block):
```
Robin Williams lays down the following card:
[card block]
Robin Williams rolled 19 +4 on 1d20 vs laoel's ac (10) to determine if the hit was a success.
🎲 23 v 10
(6) Robin Williams was sure he was going to miss laoel.
```

Note the flavor text is based on the raw die roll (6), not the total (23) — this creates an interesting moment where the text says "sure he was going to miss" but the hit lands anyway due to modifiers. This is a feature, not a bug.

## Design Principles for the Revival

- **Don't break the text feed.** The ring channel is a scrolling log of battle narration. That stays as text.
- **The `===` separator cards are the UI.** On web/mobile, render them in a monospace font inside a styled container. Don't convert them to a different format.
- **Emoji carry a lot of weight.** Each monster and player has an emoji. The card catalog uses emoji icons. Keep this — it's low-overhead personality.
- **Jane's identity.** Jane (the bot) had a distinctive folk-art avatar. The bot's identity should be consistent across all connectors — same name, same avatar.

## What to Add (Optional Enhancements)

The following are *additions* that enhance without replacing the text-first experience:

### For the Web App

- Render the `=====` card blocks in a proper monospace styled box (already looks great if the font is right — `JetBrains Mono`, `Fira Code`, or `Courier New`)
- Small monster emoji/icon next to monster names in the sidebar list
- HP bar in the monster detail view (visual representation of current HP vs max)
- Dark theme by default — the ASCII aesthetic suits it

### For the Mobile App

- Same monospace card rendering (React Native supports custom fonts)
- Monster list: emoji icon + name + level, tappable for detail
- HP bar on monster cards
- Push notification icon could use Jane's avatar

### Monster Sprites (Optional)

If ever adding small sprite images (not required for launch):
- 64×128px pixel art, one per monster type (5 total)
- Used in monster detail view and deck builder only — not in the ring feed
- Consistent style: pixel art or simple flat illustration
- Commission or source from CC0 assets (OpenGameArt.org, itch.io free)

### Card Class Icons (Optional)

Small icons for each card class (melee, healing, control, boost, utility) for the deck builder UI. Not in the ring feed.

## What NOT to Do

- Don't add animations to the ring feed
- Don't replace the text cards with custom visual components — the monospace format is the identity
- Don't add a heavy visual theme that competes with the text
- Don't add graphics at the expense of launch speed — ship without sprites first, add later

## The Mobile Wrapping Problem

As seen in the screenshots, on narrow mobile screens the `===` separator lines wrap awkwardly because Slack's code block doesn't scroll horizontally. On the native mobile app, use a horizontally-scrollable code block container or clamp the separator line width to the device width. Either way is fine — the wrapping was a known quirk of the Slack version and players were used to it.
