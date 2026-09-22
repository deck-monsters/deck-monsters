# The Ring roster row — design record

**Status**: Current. This is the reasoning behind the roster row's shape, kept because
almost every decision in it was reached by getting it wrong first, and the wrong versions
all looked defensible.

Read this before changing `RingRoster.tsx`, `roster-model.ts`, the `.roster-*` rules in
`terminal.css`, or the pixel sprites in the rows. The panel's history is in
[`docs/roadmap/23-pixel-fight-stage.md`](roadmap/23-pixel-fight-stage.md) and bugs
#164–#169 of [`10b-bugs-fixed.md`](roadmap/10b-bugs-fixed.md).

## The one hard rule

**Row order is the order of play. Never sort or group the roster.**

`Ring.doAction` plays contestants by `activeContestants.shift()` over `this.contestants`,
and `Ring.contestantSnapshots()` maps that same array, so a contestant's position in the
list is its position in the round. Nothing else on screen carries that.

This is the rule that cost the most to learn. A design that grouped rows under team
headings tested well against every stated requirement — it removed the panel's worst
layout pressure and answered "how is each side doing" — and it silently destroyed turn
order. The person who caught it described the information as "so natural and idiomatic I
almost glossed over that it was missing".

Teams are therefore shown by **colour pip plus name, in place**, never by reordering.

## Field priority

Straight from how the panel is actually read mid-fight. The order is load-bearing: the
meta line renders in it and ellipses from the right, so the least important field is
always the first to disappear.

| # | Field | Where | Notes |
|---|---|---|---|
| 1 | Monster name | Name line | Gets all the slack. It is how the narration names monsters |
| 2 | Acting | Turn gutter `▶` + row tint | The fight's pulse |
| 3 | HP / fallen | Right rail | Figure with its bar directly beneath, same width |
| 4 | Beastmaster | Meta line, first | A room full of friends; whose monster it is matters |
| 5 | Team / boss | Meta pip + name; `BOSS` badge on the name line | |
| 6 | Level | Meta line | |
| 7 | AC | Meta line, last | The narration quotes it on every roll anyway |
| — | Species | **Nowhere visible** | The row icon says it. Kept in the accessible label |

## Decisions, and what they replaced

### The bar and the numbers both stay

They restate one another, which looks like duplication and is not: the bar gives the
shape at a glance, the numbers give the scale (a monster at 21/41 and one at 21/240 are
not in the same trouble). Rather than dropping either, the bar is the **quieter** of the
two — 4px, directly under the figure it restates, at the same width, so they read as one
object rather than two facts.

### Teams appear only when they discriminate

`teamsAreRelevant` requires **two or more distinct teams still standing**. In Common Cause
every player joins `The Alliance`, so a team column on a player-only roster repeats one
word down the whole list. A wiped-out team stops counting — it is no longer a side you are
tracking.

Team names are a **closed set**: `The Alliance`, the four houses (`Gryffindor`,
`Hufflepuff`, `Ravenclaw`, `Slytherin`) from `constants/teams.ts`, and `Boss`. Longest is
12 characters. That is what makes a stable colour per team safe, and it is why abbreviating
(`The Alliance` → `Alliance`) is available but unnecessary. Colour is never the only
channel: the name sits beside the pip, and the legend under the list names every colour in
play.

### One column, not two

`.roster-list` was `repeat(auto-fit, minmax(13rem, 1fr))`. Every crowding bug in this
panel traced back to it. A 208px column had to hold the name, a rigid team tag, HP, AC and
(once sprites landed) an icon gutter; the name was the only element that could give, so it
collapsed to `G..` (#168). Widening the minimum to 21rem patched the symptom; restructuring
the row removed the cause. A full-width row means the name can never be starved.

### Density tiers instead of narrow columns

Above `DENSE_ABOVE` (8) contestants the rows go to one line each — name and beastmaster
share the slack, level and AC drop. The roster is capped at 40% of the pane height and
scrolls inside that, so a big fight could never push the feed off screen, but it could
bury everyone below the fold. Dense rows roughly halve row height so a twelve-contestant
brawl stays readable.

Eight is a judgement call: the largest count that still fits the cap comfortably on a
phone. Keying off pane height instead of count would be steadier but harder to predict.

### The icon is 24px, and that is deliberate

It started at 48px, sized to match a roster row's natural height. Tested side by side the
small silhouette simply read better — and 24px is the box the emoji icon already occupied,
so **the emoji is a free fallback** when a player has the animations off (which is the
default; see #166). The trade: the sprite's attack lean is a twitch rather than a lunge. At
this size it is an ambient tell for whose turn it is, not a cutscene.

### Order of play, made visible

Row order alone carried it, which is exactly why it was invisible until it went missing.
The gutter now marks `▶` acting and `›` up next, skipping the fallen the way the engine's
own active-contestant filter does, and wrapping to the top of the round. It costs 14px and
nothing else on screen tells you who moves next.

## Wording

Three of these were **lexicon drift** — `docs/voice-and-wording.md` is a contract and the
roster was off it.

| Was | Is | Why |
|---|---|---|
| `defeated` | `fallen` | Lexicon. "defeated" appears nowhere in it |
| `lvl 2` | `Lvl 2` | Lexicon: "`Lvl 3` compact, `Level 3` full card" |
| `beginner` | `Beginner` | Lexicon: "level zero is Beginner" |
| `ac 9` | `AC 9` | An initialism |
| *(blank for bosses)* | `👑 The Editor` | A boss has no beastmaster; the house stages it |
| `THE ALLIANCE` tag | `The Alliance` in the meta line | Uppercase + letter-spacing made it the widest rigid thing on the name line |
| `5/5 standing` | `5 standing · 1 fallen` | A fraction cannot say how a fight is going |

`The House` was tried as a group label and rejected: bosses read better with the `BOSS`
badge they always had, plus The Editor as their byline — the badge answers *what is it*,
the byline answers *whose is it*.

## Alternatives considered and rejected

Five directions were rendered at real widths and reviewed against real play. The full
mock-ups were throwaway; the conclusions are here.

| Direction | What it was | Why not |
|---|---|---|
| **Quiet Line** | Tags demoted to the meta line, everything else unchanged | Closest to what shipped, and effectively what R1 became. Superseded rather than rejected |
| **Stat Rail** | Numbers in a fixed right column | Adopted — this is the right rail. Rejected only as a *whole* answer, since it left the name line and density untouched |
| **Team Muster** | Rows grouped under team headings | **Destroyed turn order.** The most attractive option on paper and the only unacceptable one |
| **Ticker** | One line per monster, meta dropped entirely | Lost beastmaster, level and HP detail — "in practice it was nice to know things like who a monster belonged to". Survives as the dense tier, with beastmaster and HP put back |
| **Duel Card** | Bounded card per contestant | Most visual weight of the five and tallest at twelve contestants, for no information gain |

Two smaller rejects worth recording:

- **A 48px sprite in a wide left gutter.** Shipped briefly (#167). Read worse than the
  small icon and made the emoji fallback awkward.
- **A canvas band above the feed.** The original form of the animations (#164, #165). It
  re-drew state the roster already showed — the same monsters with a second set of HP bars
  — and spent 96–200px of viewport doing it (#167).

## What no test can tell you

Every real defect in this panel was found by looking at it on a real device, never by a
test: six identical sprite blobs, a serpent that read as a coiled snake in ASCII and a
duck in the browser, a band a phone user could never trigger, a band duplicating the
roster, names collapsed to `G..`, and grouping that ate the turn order.

The tests were not wrong. They answered "is the markup well formed" while the question was
"does this help someone playing the game". **jsdom does no layout**, so no unit test in
this repo can tell you whether a column breaks at the right width. Render it, open it on
the phone and the tablet, and look.
