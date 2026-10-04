---
type: Reference
title: New-player help inventory
description: What a new player can see or do in the web app, what they guess it does, and what explains it, from a phone and desktop walk on 2026-09-30.
status: stable
audience: internal
tags: [help, onboarding, web, wording, ux]
---

# New-player help inventory

Walked on 2026-09-30 as a player who had not seen Deck Monsters. Two throwaway rooms,
`Scratch help-walk phone 2026-09-30` at 390×844 and `Scratch help-walk desk 2026-09-30`
at 1440×900. The phone path trained from the Console. The desktop path trained from the
Workshop form. Both paths equipped a monster, sent it to the ring, and summoned a boss.
A second monster, Nip, received one card while the first monster was still fighting.
Game Night was left alone. Test Room A and Test Room B were left alone.

"What explains it" means something on the screen: the label, a tooltip (`title`), a line
of help, a Console help entry, or the handbook. Closed command-reference text that is
slid off-screen still sits in the page; it is listed only when a sighted player can open
it.

The fights were still going when the walk stopped (Pip at 9 hp, Moth at 20/30). Revival,
death, a finished fight log, holds, and ambushes were not on screen. See
[What this walk did not see](#what-this-walk-did-not-see).

## Rooms

| Where | Guess | What it did | What explains it | Confusion |
|---|---|---|---|---|
| Rooms > Room name, placeholder `The Editor's Ring` | The field already had a name | Empty. Typing a name and **Create room** made the room | Label `Room name` | The placeholder looks filled in, and it uses the same name that later speaks during a boss turn |
| Rooms > Invite code, placeholder `ABC12345` | A sample code was already entered | Empty until a real code is typed. **Join room** was not used | Label `Invite code` | Same filled-in look as the room name |
| Rooms > **Create room** | Makes a room and opens it | Created the scratch room and opened its terminal | Label only | Clear |
| Rooms > **Enter** on Test Room A, Test Room B, Game Night | Opens that room | Opens that room. Aria label is `Enter` plus the room name | Label, plus `OWNER` or `MEMBER` under the name | `OWNER` and `MEMBER` are never defined |
| Room header, long name on a phone | The name sits beside the logo | `Scratch help-walk phone 2026-09-30` wraps into the logo | The name itself | The logo and the name collide. See [phone-ring-empty.png](help-inventory/phone-ring-empty.png) |

## Header and menu

At 390px the header is the logo, the room name, a gear, and a hamburger (`Open menu`).
At 1440px the same destinations are text links: **Terminal**, **?**, **Rooms**,
**Leaderboard**, **Workshop**, **Fight log**, **Account**, a green circle, **Sign out**.

| Where | Guess | What it did | What explains it | Confusion |
|---|---|---|---|---|
| Gear | Settings for the account | Room settings: invite, members, reset, delete | `title` and aria `Room settings` | The icon has no word. The page itself is clear: invite help, member list, and a Danger zone that says reset erases monsters, characters, and ring progress and keeps the room |
| Phone menu **Rooms**, **Terminal**, **Leaderboard**, **Workshop**, **Fight log**, **Account** | Each opens that page | Each opens that page | The words | Three pairs name the same place twice: Terminal / The Ring, Fight log / Fights, Leaderboard / Leaders |
| **Help / Commands** (phone) and **?** (desktop) | A how-to-play page | Slides in the command reference: Handbook, Monster Manual, Card List, then commands with one-line descriptions | The menu words. The panel title is `COMMAND REFERENCE` | The best list in the game is behind this control. One equip example says to use a JSON array: `["Card"]`. `help` in the Console prints the same list |
| **Theme: phosphor** (phone menu) and the green circle (desktop) | Changes the colour | Cycles the terminal theme | Phone: the words `Theme: phosphor`. Desktop: the circle alone | The desktop control has no word |
| **Sign out** | Signs out | Not used | Label only | Clear |
| Closed command reference | Nothing, once it is closed | The panel is off to the right (`translateX(100%)`) and stays in the page, so its full text is still part of the document | A test records that the closed panel is kept in the DOM | A screen reader can meet the whole command list on every screen |

## The Ring

| Where | Guess | What it did | What explains it | Confusion |
|---|---|---|---|---|
| Tab **The Ring** | The play area | An empty feed: `Waiting for fight events…` | The tab name and the heading `THE RING` | An empty room looks broken. See [phone-ring-empty.png](help-inventory/phone-ring-empty.png) and [desk-first-look.png](help-inventory/desk-first-look.png) |
| `boss in ~20m`, later `boss in ~14m` during a fight | A boss arrives in that many minutes, and the timer should pause or vanish once a fight starts | The countdown kept running on an empty ring and during the live fight | Tooltip: `Time until next ring event` | The tooltip does not say the timer keeps going while monsters are already fighting. A phone tap does not show the tooltip |
| `summons 3/3` on an empty ring, then `summons 2/3` after one summon | 3/3 means all three summons are already used | 3/3 was the full allowance. Summoning a boss moved it to 2/3 | Tooltip: `Boss summons you have left today — type summon a boss to use one` | 3/3 reads as "used up". The tooltip is the only explanation, and it is easy to miss |
| Roster row, boss name | The full name | `Niruth Champion Of The Bla…` with a BOSS tag, hp `6/33`, and the line `The Editor · Beginner · AC 10` | The feed uses the full name `Niruth Champion Of The Black` | The roster cuts the name off. `The Editor` is unexplained, and it matches the create-room placeholder. See [phone-ring-during.png](help-inventory/phone-ring-during.png) |
| `IN THE RING — 2 STANDING` | Who is fighting | Listed the boss and Pip with hp bars | The heading and the bars | Clear once a fight exists |
| `Use an item (0 ready)` | A button that spends an item | Shown during the fight with a count of 0. Not pressed | The label | `ready` is undefined, and there is no pointer to the shop |
| `YOU JOINED HERE` | A bookmark of when this player arrived | A marker in the feed, above later hits | The words | It sits in the middle of combat lines |
| Pane menu on desktop (`The Ring`, `Console`, …) | Picks what that half of the screen shows | Replaces that pane. Choosing Workshop on the right removed the command box | Aria `Surface shown in the left/right pane` | The only place to type a command disappears with the Console pane |

## Console and prompts

| Where | Guess | What it did | What explains it | Confusion |
|---|---|---|---|---|
| `Type a command below to start. Try: look at monsters` | The box takes game commands | It does, until a prompt is open | That line, and the placeholder `Type a command…` | Clear before the first prompt |
| Guide: `Welcome, Beastmaster. Train your first monster to begin your journey.` plus chip `train a monster` | A tutorial that steps out of the way | The chip runs `train a monster`. `Need help first? Try look at player handbook.` is under it. A later stage said `Outfit Pip with cards, then send them to the ring.` and `Once equipped, run send Pip to the ring.` | Those lines. Dismiss control title: `Dismiss guide` | On a phone the guide, the chips, and a banner cover the question. See [phone-name-covered.png](help-inventory/phone-name-covered.png) |
| Banner: `A command is waiting for your answer. Command suggestions are paused.` and **Cancel action** | The chips would hide | The chips stayed on screen (`Train a monster`, `Look at the ring`, later `Equip Pip`, `Look at my monsters`, `Visit the shop`) | The banner | The banner says suggestions are paused while the suggestion chips are still there, and the banner covers the question |
| `Which pronouns should we use for you?` then `Finally, choose an avatar:` | Naming the player, then picking a picture | Pronouns `he/him`, `she/her`, `they/them`, then a grid of emoji. The Console path never asked for a name | The questions | The player's name on the ring was a generated Beastmaster label. The emoji have no captions |
| `You have 10 of 10 monsters left to train.` | A full roster, or a warning | It appeared before the type question, on a player with no monster yet | That sentence | "10 of 10 left" reads as "none left" and as "all 10 are still free" |
| `Which type of monster would you like to train?` | Short descriptions of Basilisk, Gladiator, Jinn, Minotaur, Weeping Angel, Unicorn, Dragon | Seven buttons, names only | The names | No picture, no line on what each one does |
| `Which pronouns should we use for your monster?` | The same question as before, repeated by mistake | A second pronoun choice, for the monster | The word `monster` in the question | Easy to answer as if it were still about the player |
| `What would you like to name them? zo'anutzac? corac? Something else?` | The two odd names are buttons | They are words in the question. The answer is typed. Pip was accepted | The question. `120s remaining` and **Cancel** | The suggestions look like choices and are not. The question itself was under the guide |
| `What should their skin look like? (eg: gold and black diamond patterned)` | A colour that shows on the monster | `moss green` was accepted and later appeared inside Pip's stat card (`A powerful, moss green, cave-dwelling basilisk…`) | The example in the question | The roster row did not point back at that choice |
| `You have 9 of 9 slots remaining… Which card(s) would you like to equip next?` | Pick cards, then confirm | A numbered list and the same cards again as checkboxes. A typed command was rejected: `"send Pip to the ring" isn't one of the cards. Pick cards by name or number.` | The question, the list, and that error | The list is printed twice. The command box still looks like the command box, so `send` is a natural thing to type. See [phone-equip-rejected.png](help-inventory/phone-equip-rejected.png) |
| `look at player handbook` | Opens the rules | Printed the handbook into the Console | The guide line and the command reference | It is a wall of text in the same scrolling log as the fight |

## Workshop

| Where | Guess | What it did | What explains it | Confusion |
|---|---|---|---|---|
| Subtitle `Manage equipped and unequipped cards in one view.` | A card editor | Also trains monsters, shows items, and holds the shop | That subtitle | The subtitle describes the cards and not the rest of the page |
| Empty state | Training starts in the Console | `You don't have a character in this room yet. Train your first monster and we'll create one for you.` and `Train one here to start building its deck. The console command is train a monster.` **Train monster** opened a form | Those two lines | Two ways to train, with no hint that the Console path skips the name field the form shows |
| Form **About you**: Your name, pronouns, avatar, Shuffle; then Type, Pronouns, Name, Appearance, **Train** | Creates the player and the monster | Desktop training created Moth. The empty-state lines stayed on the page under the form | Field labels. Appearance placeholder `gold and black` | The empty-state copy is still visible while the form is open. Avatar emoji are unexplained. Pronouns are asked twice, matching the Console |
| `0 coins` beside **Train monster** | The price of training, or of the monster below | Training was free. The same `0 coins` appears again in the Shop | The words `0 coins` | It sits in the header like a cost. See [phone-workshop-fighting.png](help-inventory/phone-workshop-fighting.png) |
| **Sync** | Reloads the workshop | No tooltip, no aria beyond the word, and no visible change from the label | The word `Sync` | Nothing says what is out of date |
| `Basilisk · Lvl 0`, `HP 33/33`, `XP 0/28`, `Deck 0/9 · needs 9 more to enter the ring`, `0W 0L` | Level, health, a deck-size gate, a record | The deck line updated as cards were added (`Deck 9/9`, and Nip's `Deck 1/9 · needs 8 more`). HP on Pip fell to `9/33` during the fight | Those lines. `needs 9 more to enter the ring` is the clearest gate in the game | `Lvl 0` here and `Level: beginner` in the feed. `XP 0/28` and `0W 0L` have no key |
| **Send to ring** | Sends the monster | Present on the card. The Console `send` path was the one used | The button | A full deck is required first; the deck line says so, the button does not |
| Slots `[+]`, then named cards | Tap a card, then a slot | Selecting Blink showed `1 selected: Blink. Tap destination slot or inventory drop zone.` and `Cannot use selected inventory card.` Selecting Hit and an empty slot on Nip showed `Equipped Nip (1/1).` | Those two result lines, after the tap | Blink's refusal has no reason. Nip's success does not say what 1/1 counts. See [desk-card-moved.png](help-inventory/desk-card-moved.png) |
| `Pip is currently fighting. Changes apply after they return.` | A change can be queued | The slots stayed drawn and looked tappable. Coil's slot was disabled for the whole fight | That sentence | "Changes apply after they return" reads as "you can set them now". The disabled slots do not take a queue. See [phone-workshop-fighting.png](help-inventory/phone-workshop-fighting.png) |
| **PRESETS**: Select preset, Load, Delete, Store, `Store as…` | Saved decks | Not used. Load and Delete sit next to an empty `Select preset` | The word `PRESETS` | No line says what a preset saves |
| **Your Inventory** / **Your Items** `0 usable now (0 items).` / `Drop here to unequip from monster` | Drag cards down to take them off | Inventory listed 20 cards with tags `MAGIC`, `MELEE`, `HEAL`, `UTILITY`. Items were empty | The headings and the drop line | Drag is named; the path that worked was tap, then tap a slot |
| **The Shop**, `The Eager Kobold waits behind a hidden door.` `Stock rotates at 5:00 PM. This room has its own merchant.` | A store | Item rows with a use line, a price, and rules such as `Hit: 1d20 vs ac`. **Back room (5)** and **Sell to the shop** were collapsed sections. `Nothing to sell.` under items. Cards listed `Hit ×2` with a bare quantity `1` and `Sell for 7 coins` | The shop lines and the prices | `Back room` is unexplained. The quantity next to `Hit ×2` has no label. Card rules use `ac` and dice with no glossary. The Sorting Hat row is a long paragraph. See [desk-shop.png](help-inventory/desk-shop.png) |
| Expand icon | Full screen | Aria `Open Workshop as a full page` (same pattern on Fights and Leaders) | The tooltip | The icon is a corner arrow with no word |

## Fights

| Where | Guess | What it did | What explains it | Confusion |
|---|---|---|---|---|
| Tab **Fights**, heading **Fight log** | A list of fights | Before any fight, and again while Pip was in a live fight: `No fights yet — send two monsters to the ring and the first one starts on its own.` | That sentence | The sentence disagrees with itself, and it stayed up during the fight that was on The Ring. See [phone-fights-during.png](help-inventory/phone-fights-during.png) and [desk-fights-empty.png](help-inventory/desk-fights-empty.png) |
| Header **Fight log** vs tab **Fights** | Two different pages | The same page | Both words | The menu, the tab, and the heading use different names |

## Chat

Added by roadmap 41 (M3), after the walk above; checked in Chromium at 390 and 1440 against a mocked chat state.

| Where | Guess | What it does | What explains it | Confusion |
|---|---|---|---|---|
| Tab **Chat**, with a count badge | Messages from other players | Opens the room's chat. The badge, in the tab's top-right corner clear of the label, is the number of unread messages from others (`99+` past 99, hidden at 0); the tab's accessible name is `Chat, {n} unread`. Side by side there is no tab bar, so the pane selector's option reads `Chat · {n} unread` instead. The ☰ menu and the desktop nav also list **Chat** | The tab `title`: `Talk with everyone in this room, or send a message to one player.` (also the panel subtitle and the menu links' title) | Unread is easy to miss while a different pane is on screen and the selector is closed; M2's Console line (`{n} new messages in Chat`) helps |
| Empty list | Nothing has been said | `No messages yet. Say hello, or cheer on a fight.` | That sentence | None known |
| Divider `Today, 6:42 PM` / `Yesterday, ...` / a dated line | When the next messages were sent | Appears when 30 minutes or more pass, the day changes, and before the first message | The divider itself | The format follows the viewer's locale |
| Divider `During fight #{n}` | Which fight was on | Appears when the fight number a message was sent during changes | The divider itself | None known |
| Marker `New since you were last here` | Where the unread messages start | Sits before the first message from someone else after the read position when the tab was opened, and the list opens scrolled to it; it does not move as you read | The marker itself | Not shown when nothing has been read yet |
| `✉️ Ben to you: …` / `✉️ You to Ben: …` rows | A private message | The Console's wording; the text is italic. Only its two players see it | The row's wording | None known |
| **To** picker (`Everyone`, then each player) | Who gets the message | A chosen player turns the picker bold with an accent border and the placeholder reads `Message {name}…` | The highlight and the placeholder | A player who left the room is refused with the server's text, not hidden from the list at once |
| **Send** (title `Send this message`), Enter | Sends | Clears the box at once; on a refusal shows the reason under the input and gives the text back (unless something newer was typed); editing clears the reason | The refusal text, which comes from the server | None known |
| **↓ New messages** (title `Jump to the newest messages`) | Scrolls down | Shows when messages are below the view, including unread ones below the marker on opening; opening shows the marker, and messages count as read only once you reach the bottom | The button | None known |

## Leaders

| Where | Guess | What it did | What explains it | Confusion |
|---|---|---|---|---|
| Tab **Leaders**, heading **Leaderboard** | Rankings | `This room` / `Global`, `Players` / `Monsters`, `Sort by` XP, Wins, Win rate, Coins. Empty line: `No ranked fights in this room yet — rankings fill in once monsters start fighting.` Columns `# Name XP W L D Win %` | The empty line. `Win %` tooltip: `Wins ÷ (wins + losses). Draws excluded.` | The empty line was still there while a fight was underway. `W L D` are not spelled out. At 390px the tab is a clipped `L` until the tab bar is scrolled, and the table cuts off after `L`. See [phone-leaders.png](help-inventory/phone-leaders.png) and [phone-menu.png](help-inventory/phone-menu.png) |

The tab bar is `overflow-x: auto` with a thin scrollbar. At 390px, **Leaders** did not fit when this
was walked. Roadmap 39 B4 fixed that for five tabs, and roadmap 41 M3 kept all six tabs on one line
(75, 67, 46, 75, 60 and 67 px wide, 44 px tall, no scrolling).

## Account and settings

Account was opened on the desktop. This inventory does not repeat the signed-in email or
the generated display name.

| Where | Guess | What it did | What explains it | Confusion |
|---|---|---|---|---|
| Account > **Display name** and **Save** | The name other players see | The help under the field says it is shown on leaderboards and in room member lists, that new characters start with this name, and that a character renamed with `edit my character` keeps its own name | That paragraph | This is the place the Console training path never offered. It is easy to miss because training does not point here |
| **Show key event times in the Ring** | Timestamps on the feed | The paragraph under it says join, leave, fight start, and fight end show a label and "time ago", that it is off by default on a narrow screen, and that hover still shows the exact time | That paragraph | The clearest help in the app, on a page a new player may never open. The ring still showed clock times during the fight |
| **Show pixel monsters** | Pictures of monsters | The paragraph says each monster is a sprite coloured by the appearance its Beastmaster gave it, and that turning it off shows the emoji | That paragraph | Appearance was asked at training and this is the first time the game says the colours are that answer |
| **Terminal theme** | The same control as the header circle | Lists the themes | Label `Terminal theme` | Clear |
| Room settings > invite, **Copy Code**, **Copy Link** | Share the room | The page says the code or the link invites players, and the link opens the join page | That sentence | Clear. The code is not repeated here |
| Danger zone > **Reset game state**, **Delete room** | Destructive, and the page should say so | Reset copy says monsters, characters, and ring progress are erased and the room and members stay | That paragraph | Clear |

## Fight mechanics

Seen in the phone feed against `Niruth Champion Of The Black`, and on Moth's desktop
fight. Nothing in the first-run guide defined these.

| What showed up | What the game said | Explained? |
|---|---|---|
| Fight start | `2 contestants stand tall under the laudations and hissing jeers of a roaring crowd.` and `Let the games begin!` | The tone is clear. Why a boss counts as the second monster is not |
| Rounds | `round 1, turn 1` then `round 1, turn 2`, with both names and hp | The words `round` and `turn` are not defined |
| Whose turn | `It's The Editor's turn.` then the boss name, hp, `ac`, and `beginner` | `The Editor` is never introduced |
| A card | A frame for Hit, Delayed Hit, or Heal, plus a flavour line (`A basic attack, the staple of all good monsters.` / `Patience. Patience is key…` / `A well-timed healing…`) | Flavour is clear. What the card does to the numbers comes only from the roll lines after it |
| To-hit | `rolled 17 -1 on 1d20 vs Niruth Champion Of The Black's ac (10)` then `16 v 10` and `Hit!` | `ac`, `1d20`, and the `-1` are unexplained |
| Damage | `rolled 2 +2 on 1d6 for damage` then `Pip slices Niruth Champion Of The Black for 4 damage. Niruth Champion Of The Black has 29HP.` | The sentence is readable. `1d6` and the `+2` are unexplained |
| A roll of 1 | `rolled a 1. Unfortunately, while trying to attack, Pip flings his attack back against him.` | The outcome is in the sentence. The name of the rule is not |
| Bloodied | `Pip is now bloodied. Pip has only 11HP.` | "Bloodied" is not defined. The hp number is |
| Delayed Hit answering Delayed Hit | `Niruth Champion Of The Black's fourth Delayed Hit finds this moment too: he answers the same Delayed Hit from Pip.` | A player can follow the sentence. Nothing earlier said a Delayed Hit waits |
| Stat block | `Class: Barbarian`, `Level: beginner`, `XP: 0`, `ac`, `hp`, `dex`, `str`, `int`, and lines like `-1 dex penalty` `+2 str bonus` | No glossary. Workshop had already said `Lvl 0` and `XP 0/28` for the same monster |
| Strategy | `Strategy: Target whichever opponent currently has the highest hp.` The boss card also showed `Fights: 102 · Won: 45` | The strategy line is the only targeting help. A boss in a brand-new room already had 102 fights. *Pass 43 (2026-10-04): the label reads `{name}'s orders:`, and a boss card leaves out its record.* |
| Teams | The command reference says `leave team` and mentions a Sorting Hat. The shop hat's paragraph talks about teammates | No team was joined, so the ring never showed one |
| Items, holds, ambushes, revival, death | Not on screen | The shop and the command list name items and `revive`. The fight never reached them |

## Most confusing first

1. **The fight log says there is no fight while a fight is on screen.** `No fights yet — send two monsters to the ring and the first one starts on its own.` The sentence disagrees with itself, and it was still the whole Fights tab while Pip and the boss were in the ring. [phone-fights-during.png](help-inventory/phone-fights-during.png)
2. **The phone covers the question.** The name prompt and the equip prompt sat under the getting-started guide, the suggestion chips, and `A command is waiting for your answer. Command suggestions are paused.` The chips stayed visible. Suggested names `zo'anutzac` and `corac` are words, not buttons. Typing `send Pip to the ring` into the equip prompt produced `"send Pip to the ring" isn't one of the cards.` [phone-name-covered.png](help-inventory/phone-name-covered.png) [phone-equip-rejected.png](help-inventory/phone-equip-rejected.png)
3. **"Changes apply after they return" while the slots do nothing.** The Workshop says that, and the card slots stay drawn. Coil was disabled for the whole fight. The sentence reads as a queue. [phone-workshop-fighting.png](help-inventory/phone-workshop-fighting.png)
4. **`boss in ~14m` and `summons 3/3` during and before the fight.** The countdown kept running after the fight had started. `3/3` on an empty ring looks used up; it was the full allowance, and it became `2/3` after one summon. Both have tooltips a phone tap does not show. [phone-ring-during.png](help-inventory/phone-ring-during.png) [phone-ring-empty.png](help-inventory/phone-ring-empty.png)
5. **No glossary for the numbers the fight is made of.** `ac`, `hp`, `dex`, `str`, `int`, `1d20`, `1d6`, `XP`, class, and `bloodied` arrive mid-fight. The same monster is `Lvl 0` in the Workshop and `beginner` in the feed. A roll of 1 flings the attack back with no name for the rule. Strategy is one line, and it is the only targeting help.
6. **`0 coins` sits beside Train monster.** It reads as the price of the button or the monster. Sync has no tooltip and no visible result. [phone-workshop-fighting.png](help-inventory/phone-workshop-fighting.png)
7. **The boss is a stranger with a cut-off name.** The roster shows `Niruth Champion Of The Bla…`. The turn line says `It's The Editor's turn.` The create-room placeholder is `The Editor's Ring`. The boss arrived with `Fights: 102 · Won: 45` in a room that had never fought. [phone-ring-during.png](help-inventory/phone-ring-during.png)
8. **The same places have two names, and the last phone tab is cut off.** Terminal / The Ring, Fight log / Fights, Leaderboard / Leaders. At 390px the tab bar clips **Leaders** to a sliver. The command list that would sort this out is behind **?** or **Help / Commands**, and one equip example tells the player to type a JSON array. [phone-menu.png](help-inventory/phone-menu.png) [phone-leaders.png](help-inventory/phone-leaders.png)
9. **Training explains none of the choices.** Seven monster types with no descriptions. Pronouns twice. An emoji avatar with no captions. `You have 10 of 10 monsters left to train.` The Console path never asks the player's name, and the ring shows a generated Beastmaster label. The Workshop form has a **Your name** field the Console path skips.
10. **A refused card and a successful card use different, thin messages.** Blink: `Cannot use selected inventory card.` Hit onto Nip: `Equipped Nip (1/1).` Presets, `Drop here to unequip`, and the difference between drag and tap are unexplained until a selection hint appears. [desk-card-moved.png](help-inventory/desk-card-moved.png)

## What was clear

**Enter**, **Create room**, and the room-settings Danger zone say what they do. The
Account checkboxes are the best help in the product: each one has a paragraph. `Deck 0/9
· needs 9 more to enter the ring` is the one gate that explains itself. Damage lines name
the attacker, the card's result, and the hp left. `IN THE RING` plus the hp bar is
enough to see who is fighting. Card flavour lines are readable. The shop prices and
`Sell for N coins` are readable once `ac` is ignored.

## Fixed on the way

None. Everything above needs new wording or a design choice. No `// DRAFT(39):` lines
were added.

## Strings for Claude

None.

## Screenshots

| File | Width | What was confusing |
|---|---|---|
| [phone-ring-empty.png](help-inventory/phone-ring-empty.png) | 390 | Empty ring, `boss in ~20m`, `summons 3/3`, room name wrapped into the logo, **Leaders** clipped |
| [phone-ring-during.png](help-inventory/phone-ring-during.png) | 390 | Same countdown at `~14m` and `summons 2/3` during the fight; boss name cut off; `The Editor` |
| [phone-name-covered.png](help-inventory/phone-name-covered.png) | 390 | Name question under the guide, the chips, and the "suggestions are paused" banner |
| [phone-equip-rejected.png](help-inventory/phone-equip-rejected.png) | 390 | `send Pip to the ring` rejected as a card, with the guide still covering the prompt |
| [phone-workshop-fighting.png](help-inventory/phone-workshop-fighting.png) | 390 | `0 coins` beside **Train monster**; fighting copy above slots that do not take a change |
| [phone-fights-during.png](help-inventory/phone-fights-during.png) | 390 | Fight log still says no fights yet, during the fight |
| [phone-leaders.png](help-inventory/phone-leaders.png) | 390 | Leaderboard empty during the fight; `W` and `L` cut off; tab label clipped |
| [phone-menu.png](help-inventory/phone-menu.png) | 390 | Menu names vs tab names; **Leaders** only a sliver behind the menu |
| [desk-first-look.png](help-inventory/desk-first-look.png) | 1440 | First desktop view: empty ring, countdown, Console guide |
| [desk-fights-empty.png](help-inventory/desk-fights-empty.png) | 1440 | The contradictory empty fight-log sentence before any fight |
| [desk-card-moved.png](help-inventory/desk-card-moved.png) | 1440 | `Equipped Nip (1/1)` next to a fighting Moth whose slots are locked; leaderboard still empty |
| [desk-shop.png](help-inventory/desk-shop.png) | 1440 | Shop rules, **Back room (5)**, unlabeled quantity on `Hit ×2` |

The ring crop leaves out the player-name line under Pip. Account, room-settings, and
any frame that showed the signed-in email or the generated id are not in this folder.

## What this walk did not see

- A fight ending, a winner, XP gain, death, or revival.
- The fight log after a finished fight. It may fill in then; during the fight it did not.
- An item used, a hold, an ambush, or a team in the ring.
- `summon a boss` once the allowance is gone.
- The Console sentence for unequip during a fight. The Workshop path was the one on screen, and it disabled the slot.
- A demo recording. The walk is the screenshots above.
