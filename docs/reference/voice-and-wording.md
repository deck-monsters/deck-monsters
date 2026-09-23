---
type: Reference
title: Voice and wording
description: Player-facing wording rules for prompts, help, announcements, and labels.
status: stable
audience: internal
tags: [voice, wording, prompts]
---
# Voice and wording

Read before: adding any player-facing prompt, help text, announcement, button label,
Discord description, handbook copy, or README copy.

This is a contract: parser aliases
preserve familiar input, but the player sees one coherent name for each action.

## The world in three sentences

Players are Beastmasters, travelling with monster companions who answer their call rather
than property to be produced or handled. The house is 👑 The Editor: the Roman *editor
muneris* who stages the games and commands the bosses it sends through the gates. This
distinction comes from [`constants/lore.ts`](../../packages/engine/src/constants/lore.ts) and
the #101–#104 history in [`10b-bugs-fixed.md`](../roadmap/10b-bugs-fixed.md); the earlier
kennel/livestock framing was retired deliberately.

## Principles

### One word per concept

Use the canonical word anywhere a player can see it: workshop controls, console help,
Discord descriptions, first-time guidance, and the handbook. Keep compatibility aliases in
the parser, not the UI.

Why: a button that says “Train” must not teach a console command called “spawn.”

- Good: `train a monster` in a quick-action chip and command catalog.
- Bad: “Spawn a new monster” in help beside a “Train monster” workshop button.

### Companions, not property

Monsters answer a Beastmaster's call, are called back, are revived when fallen, and leave a
Beastmaster's side. Do not say they are owned, spawned, dropped, disposed of, or kept in a
pack in player-facing prose.

Why: companions make the player side willing and caring, while the house still commands
its bosses.

- Good: “A Basilisk answers your call.”
- Bad: “You're now the proud owner of a Basilisk.”

### The house is a patron; Beastmasters are players

The house speaks as the patron of the games; Beastmasters speak as companions to their
monsters. System and development vocabulary such as `spawn`, `respawn`, `encounter`, and
`dispose` belongs in identifiers, logs, and admin tooling, never narration.

Why: the distinction tells the story of consent on the player side and authority on the
house side.

- Good: “A boss enters the ring at the behest of 👑 The Editor.”
- Bad: `summon [monster] from the ring`—summoning means bringing something in, not out.

### Care and sensitivity

Ask for pronouns, not gender. Prefer “laid to rest” for a dead companion over gratuitous
violence outside the ring; `dead` remains appropriate in concise stat lines and fight
mechanics where the genre expects it. Avoid real-world slurs and ableist idioms.

Why: tabletop and MMO beast-tamer classes establish the genre's combat language, but this
world deliberately softens the player-companion relationship.

- Good: “Which pronouns should we use for your monster?”
- Bad: “What gender should your monster be?”

### Retro terminal register

Commands are short, concrete, and lower-case. Emoji from `node-emoji` are part of the
world's voice, not decorative modern UI icons.

Why: the terminal voice is a game surface, not a generic administration panel.

- Good: `call [monster] out of the ring`
- Bad: “Remove the selected combat entity.”

### Let code handle grammar

Pluralisation and articles belong in code; never write `monster(s)` in player-facing text.

Why: a sentence should read naturally for the quantity the player actually has.

- Good: `${count} ${count === 1 ? 'monster' : 'monsters'}`
- Bad: `monster(s)`

### Existing bad examples are migration targets

Some legacy text is intentionally called out so it does not return: “proud owner” becomes
“answers your call”; “Only an evil master would…” becomes “A beastmaster does not…”;
`summon … from the ring` becomes `call … out of the ring`; and compact level displays use
`Lvl 0`, never `L0`.

## Lexicon

| Concept | Canonical player-facing word | Accepted compatibility/input alias | Retired player-facing wording | Where it appears |
|---|---|---|---|---|
| Add a monster | **train** — `train a monster`, “Train monster” | `spawn (a) monster`; Discord `/spawn` | spawn; capture/capturing | commands, FTUX, workshop, Discord, handbook, README |
| Player | **beastmaster** in narration/greetings; **character** for the mechanical object | — | owner, master, trainer, “proud owner” | narration, greetings, character commands |
| Monster | **monster**; **contestant** only in ring narration | — | creature, beast, pack, kennel | player text and ring feed |
| Ring entry | **send [monster] to the ring** | `send … into battle` | — | commands and ring controls |
| Ring exit | **call [monster] out of the ring** | `remove`/`fetch`/`bring … from/out of the ring` | `summon … from the ring` | command catalog, help, handbook |
| House boss entry | **summon a boss** | — | — | player command; admin `spawn a boss` remains out-of-world |
| Fallen monster recovery | **revive** | — | resurrect, respawn | commands, controls, Discord |
| Fallen state | **fallen**, “has fallen”; `💀 dead` is valid in a stat line | — | knocked-out, KO | status, FTUX, Discord |
| Permanent departure | **dismiss**; “Part ways with a monster for good” | — | release, drop | commands and Discord |
| Dismissal farewell | “has been laid to rest” when dead; otherwise “leaves your side” | — | — | announcements |
| Location | **the ring** | — | arena | commands and player prose |
| One bout | **fight** | `battle` | encounter | tabs, logs, narration |
| Equipped cards | **deck**; cards are the units and capacity is **slots** | — | hand | workshop, commands, help |
| Unequipped cards | **your cards** / **unequipped cards** | — | calling the character pool “deck” where confusing | inventory prose |
| Currency | **coins** | — | — | all surfaces |
| Progression | **XP**, **level**; `Lvl 3` compact, `Level 3` full card, level zero is “Beginner” | — | `L3` badges | meters, stats, handbook |
| Purchase location | **the shop**; person is **the merchant** | `store` | store | commands, shop UI, handbook |
| Inspection | **look at …** | — | — | commands; “View”/“Show” may describe a result |
| Pronouns | “Which pronouns should we use for you/your monster?”; `he/him`, `she/her`, `they/them` | — | gender questions | console prompts and workshop forms |

Code keys remain `male`, `female`, and `androgynous`; they are persistence and API details,
not labels for players. Likewise, code identifiers, tRPC procedure names, DB columns, event
names, CSS classes, test names, logs, and admin/debug commands may retain technical words.

The current visible history label is **Fights**. Discord registers `/train` as the canonical
monster-training command and retains `/spawn` as a compatibility alias.

## How to add a new word

1. Check this lexicon first. If the concept is new, add a row in the same pull request.
2. Grep all five surfaces before choosing: engine help/catalog; announcements/prompts;
   quick actions; web; Discord; handbook/README.
3. Prefer the word already established by narration. Add input aliases to the parser only
   when compatibility needs them.
4. Update the relevant tests and generated documents. If a prompt has choices, also follow
   [the prompt/answer contract](prompt-answer-contract.md): labels are a connector contract.
