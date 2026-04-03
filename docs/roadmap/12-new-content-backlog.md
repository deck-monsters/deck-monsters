# New Content Backlog

**Category**: Content / Game Design  
**Priority**: Post-launch  
**Status**: Backlog — not started, not required for launch  
**Source**: Upstream issue tracker

This is a holding area for new cards, monsters, items, and larger features from the upstream issue tracker. None of this is required for the revival launch — it's a rich backlog to draw from once the core is stable and running.

---

## Deck Presets — Saveable Card Loadouts

Allow players to preconfigure multiple named "hands" (decks of 7 cards) from their full card pool. Before sending a monster into the ring, the player can quickly swap to a preset loadout tuned for the matchup — a defensive hand, an aggressive hand, a control hand, etc.

This is analogous to deck building in collectible card games: players earn cards over time, and the strategic depth comes from curating and switching between loadouts rather than running one static deck forever.

**Key design points:**
- Each monster stores N preset decks (3–5 feels right)
- Presets are named by the player ("Defensive", "Anti-Basilisk", etc.)
- Swapping to a preset is a single command / single click — the point is speed
- Works across all connectors: web UI shows a dropdown/radio selector, chat connectors use a `/preset <name>` command or similar, Discord could use a select menu
- Presets are persisted as part of monster state (included in `toJSON()` serialization)

**Action**: Requires engine-level support (preset storage on `BaseCreature`, preset swap command). UI surfaces in the web deck builder, Discord select menus, and chat commands.

---

## Data-Driven Card Definitions

An alternative (or complement) to pure-code card definitions: define cards as data specs (YAML, JSON, or TypeScript object literals) with optional hook file paths for custom behavior.

**How it would work:**
- Standard card properties (name, description, damage dice, energy cost, card class, flavor text) live in the spec
- The spec can reference lifecycle hooks (`preDraw`, `onHit`, `onMiss`, `onCritFail`, etc.) pointing to script files for non-standard behavior
- The card engine reads the spec and wires up the hooks at load time
- Cards without hooks are pure data — trivially fast to create and validate

**Trade-offs:**
- Pure code allows unique off-the-wall behaviors via function hooks in the callback loop — this is part of the game's charm
- A spec system would require an API contract: enums for card types, damage categories (scatter, single-target, AOE, etc.), and effect classifications
- Adding a new category (e.g., "scatter damage to random targets") means updating the spec schema, then potentially updating existing specs
- Modern tooling makes mass-updating specs straightforward
- The hybrid approach (spec + optional hook scripts) preserves flexibility while making the common case trivially easy

**Action**: Evaluate after launch. The current code-based card system works fine and is already fast to author. A spec system becomes more valuable as the card count grows and more contributors are authoring cards.

---

## AI-Assisted Card Authoring

The existing card framework is already straightforward to extend — writing a new card by hand was always fast. With AI agent skills, the process can be even faster and more reliable:

- **Agent skill for card creation**: a Cursor skill that explains where cards live, how the game loop works, how cards interact with the combat system, and how to write a good test. With this context, describing a card concept in natural language produces a complete, tested implementation in minutes.
- **Balance validation**: the agent can review proposed card logic against existing cards and flag potential issues — overpowered scaling, missing crit fail handlers, mechanics that break the game loop. This addresses historical issues where new cards inadvertently disrupted game balance.
- **Rapid iteration**: the combination of a well-documented card framework + AI authoring + the battle simulation harness (see balance and mechanics doc) enables a fast create → test → tune → ship cycle.

**Action**: Create a Cursor skill (`SKILL.md`) documenting the card creation workflow once the TypeScript migration and balance pass are complete. The skill should cover: file locations, base class API, test patterns, common pitfalls, and balance guidelines.

---

## Cards

### Card Pops — Upgrade on Natural 20 (upstream #11)

When a card produces a natural 20 (or Stroke of Luck), it **levels up to the next variant** mid-battle or post-battle.

Example progression:
- Hit → Hit Harder → Pound
- Heal → Revive

Open question: does the upgrade happen mid-battle (immediately) or post-battle? Mid-battle is more exciting but could disrupt energy calculations.

---

### Re-quip — Hand Clone with Mid-Fight Refresh (upstream #199)

At the start of each fight, clone each player's configured deck as their active hand. At round 5, re-clone (reset to configured hand). This avoids the round 10+ dead-draw problem and encourages strategic deck design.

---

### New Card Designs

| Issue | Card | Effect |
|-------|------|--------|
| #43 | Healing Balm I–III | Regen +2/+3 HP per turn for 2d4–8 turns |
| #78 | Enchanted Mirror | Temporarily copies opponent's stats; inherits their weaknesses |
| #100 | Bear Trap | Chance to prevent fleeing; deals damage (big rusty trap) |
| #179 | Shardblade | Hit for 1d8; lowers opponent DEX by 1 |
| #180 | Kata I | Hit random opponents; STR bonus to damage, -1 per hit; stop on 2 misses |
| #209 | Gini Coefficient | Hit for 1d6 + 1d4 bonus for each level the opponent exceeds you |
| #230 | Healing Wind | AOE heal: restore 1d6 to self and all monsters that haven't hit you |
| #158 | Shuffle I–II | Hand management / order manipulation |
| #158 | Delve I–III | Conditional card plays |
| #158 | Wild I–III | Random card selection from deck |
| #158 | Trade Hands I–III | Swap cards with opponent |
| — | Swarm (Bees) | Unleash ~10 hits of 1d4 damage each, randomly distributed across all monsters on the battlefield including the caster (~20% self-hit chance, remainder split among opponents). High risk/reward scatter damage. |

---

### Immobilize Enhancement (upstream #256)

Re-applying the Immobilize card while a target is already immobilized should **strengthen the hold** (increase duration or severity) rather than reset it.

---

## Monster Types

### Time Lord (upstream #89)

- **Class**: Wizard  
- **Stats**: +2 hit, +0 damage  
- **Special cards**: Fast-Forward (skip opponent turns), Magic Screwdriver (healing), Tardis (combo), Replay  

### Bureaucrat (upstream #174)

- **Class**: Cleric  
- **Thematic cards**:
  - Pot-bellied Dictator — threatens opponents at low HP; kills at a threshold
  - Socialism — redistributes HP among all ring monsters
  - Capitalism — gains based on coin holdings
  - Flat Taxes / Progressive Taxes — damage scaled to level difference
  - Death Sentence — multi-stage arrest system
  - Police Brutality — paradoxical self-damage mechanic  

---

## Items / Equipment

### Equipment Slots (upstream #14)

Add slotted equipment (helms, rings, capes) that provide stat bonuses/penalties. Examples:

| Item | Effect |
|------|--------|
| Shield | +2 AC |
| Ring of Undying | 25% chance to recover at 0 HP |
| Boots of Flight | Flee chance when next hit would be fatal |
| Lucky Charms | Re-roll natural 1s |
| Poison Tip | 10% chance to poison on hit |
| Helm of Wisdom | +1 energy |
| Bag of Holding | +1 card slot, -1 hit bonus |

---

## Creatures / NPCs

### Graveyard Character (upstream #79)

Dead dismissed monsters don't get deleted — they go to a **graveyard character**. An undead boss NPC occasionally spawns these dead monsters into the ring. Monsters gain stats from their victories in the graveyard.

### NPCs (upstream #10)

Three categories:
- **Friendly/Passive**: card/item buyers, sellers, traders; flavor characters (e.g., Ritchie — a named NPC)
- **Hostile ring**: NPC monsters that fight alongside or against players
- **Hostile environmental**: ring hazards with NPC flavor

---

## Larger Features

### Adventures / Job Board (upstream #25)

An "Inn" with a **job request board**. Players take jobs and receive encounter briefings, then build specialized adventure decks and send monsters on structured multi-fight quests. Similar in spirit to the archived exploration system but more structured — closer to a dungeon run with a series of fights and flavor text.

*This could be the evolution of the archived exploration feature.*

### Tournaments (upstream #32)

An endgame system: **daily/weekly or player-initiated tournaments** with multiple rounds, NPC opponents, prizes, titles, and awards. Provides a goal structure beyond just grinding ring XP.

With the event bus, tournament brackets and results naturally become `GameEvent` objects, viewable in real time across all connectors.

### Team Battles + Better XP (upstream #257)

XP formula adjustments for team combat (multiple players' monsters vs. a single powerful opponent or NPC boss). Currently XP doesn't scale well for team scenarios.

### The King's Sentence (upstream #275)

End-of-battle mechanic for large group encounters (4+ players defeating a boss whose combined level exceeds theirs):

- King rolls **d20** after the battle
- **Natural 20**: each player gets a rare "back room" card
- **15–19**: all players get a card
- **8–14**: players earn bonus coins equal to the roll
- **2–7**: battle continues (the king isn't done)
- **Natural 1**: king summons a random champion (level = strongest player + 1–3), or creates a new one
  - If the champion falls: all players get a back room card + bonus coins; the killing blow player's character and deck are **cloned into the king's champion pool** (their monster can be summoned in future fights)

---

## Currency Symbol (upstream #262)

Replace the word "coins" with a symbol. Upstream suggests ㊥ or similar. Worth deciding on a consistent symbol to use across all connectors and the `GameEvent.text` output.

---

## Notes

When picking from this backlog:
- **Deck presets** are high-impact and cross-cutting — they deepen strategy without adding new cards, and work across all connectors
- Card pops (#11) and equipment slots (#14) would have the highest per-feature gameplay impact
- The **data-driven card spec** system becomes more valuable as the card count grows and more contributors author cards — evaluate post-launch
- The **AI-assisted card authoring** workflow (agent skill + battle simulation harness) should be set up early — it accelerates everything else in this backlog
- The Time Lord and Bureaucrat monsters add flavor variety
- Adventures (#25) is the natural evolution of the archived exploration system — consider it for the second major release
- Tournaments (#32) are the "endgame" — important for long-term retention, lower launch priority
