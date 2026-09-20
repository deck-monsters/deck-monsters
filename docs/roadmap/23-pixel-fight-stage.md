# 23 — Pixel Fight Stage: What to Do With It

**Category**: Product / UI
**Status**: Parked. The feature ships behind an opt-in that defaults off (#166); nothing is
broken, and nothing more should be built until the questions below are answered.

The pixel-art fight animations work, are reachable, and are readable — and are still not
good enough to be on by default. This doc records why, with the evidence, so the next pass
does not restart from the same wrong premise.

## How we got here

| Ref | What changed |
|---|---|
| [archived plan 17](../archive/roadmap/17-pixel-art-fight-animations.md) | Original build: theme-gated canvas layer over the Ring feed |
| [#164](10b-bugs-fixed.md) | Sprites redrawn 16×16 → 24×24; poses shear instead of translating |
| [#165](10b-bugs-fixed.md) | Overlay → docked band; `inEncounter` adoption so you can join a fight; compact duel on phones |
| [#166](10b-bugs-fixed.md) | Opt-in setting, **off by default** — this doc's starting point |

## The evidence

![The stage running on a tablet in landscape](assets/pixel-fight-2026-09/stage-on-tablet-landscape.jpg)

A real session: iPad, landscape, Terminal view with the Ring and Console panes side by side.
A four-contestant fight with two bosses. This single photo says more than the unit tests do,
and it is the reason this doc exists.

Read it carefully and four things jump out:

1. **The roster and the stage show the same four monsters, stacked.** `IN THE RING — 4/4
   STANDING` lists Chaeddorko, Freya, Aster and Heyus, each with an HP bar and exact
   numbers, level, class, owner and a `BOSS` tag. Directly beneath, the stage draws the
   same four with the same HP bars and none of the labels. It is the same state twice, and
   the roster's version is strictly more informative.
2. **The horizontal space is mostly empty.** Aster (the viewer's Basilisk) sits alone at
   far left; the other three cluster at far right; the middle two-thirds is dead pixels.
3. **The narration is the smallest thing on screen.** Roster + item row + ~200px stage
   leaves the feed about six lines in landscape — and the feed is the game. Everything the
   fight actually *means* ("Aster pulls on the hair of Heyus for 5 damage") is in the part
   we squeezed.
4. **The art itself is fine.** At 3× the Basilisk reads as a snake, the Angel's wings read,
   the Gladiator's crest reads. The drawings are not the problem any more.

## Opinion: the left-vs-right metaphor is the root error

Everything above traces back to one borrowed assumption. The stage was built as a Street
Fighter bout — my monster on the left, yours on the right, facing off. Deck Monsters ring
fights are not duels. They are 2–12 contestant melees with bosses, teams and targeting
strategies, where a card can hit anyone. There is no left side and no right side.

Forcing an N-way melee into a two-sided layout is what produces the dead middle, the
lopsided 1-vs-3 clustering, and the need for a big band to hold two rows per side. The
compact duel view added in #165 is the same mistake at a smaller size: it invents a
one-on-one that is not happening.

So I do not think the band should be tuned. I think it should be replaced.

## Recommendation: put the sprites *in* the roster

The roster is already the persistent, authoritative list of who is in the ring. It already
has a row per contestant, with the name, level, HP bar and boss tag. It already scales to
twelve. Give each row a small sprite instead of the current emoji-ish icon, and animate
**that** sprite on the contestant's turn.

Why this is the right shape:

- **It removes the duplication** instead of arranging it more nicely. One surface, one HP
  bar, one row per monster.
- **It costs almost no extra vertical space.** A 24px sprite at 1–2× fits a roster row.
  The feed keeps its lines.
- **It scales honestly to the real game.** Twelve contestants is a long roster, not an
  impossible stage.
- **The data already exists.** `RingContestantSnapshot.acting` is set by the engine
  (`Ring.contestantSnapshots()`, `this.inEncounter && this.activeContestant?.monster ===
  monster`) precisely so a client can show whose turn it is. Today the pixel layer ignores
  it and infers action from combat DTOs. An in-roster animation is what that flag was for.
- **It matches the original instinct** better than the band did — the "maybe even in-line?"
  from the conversation that started #165. Inline in the *roster* sidesteps the virtualized
  feed entirely, which is where the inline-in-feed option got dangerous.

The cost is honesty about scale: a 24px sprite at 1× is small, and the attack lean (±4px)
will read as a twitch rather than a lunge. That may be exactly right for an ambient
turn indicator — or it may be too subtle to bother with, which is a real possible answer.

## If a dedicated stage survives anyway

Should the in-roster idea not appeal, the band needs at minimum:

- **No HP bars.** Pure duplication of the roster directly above it (see the photo).
- **Only the current exchange** — the acting monster and its target, two sprites, ~72px
  tall, appearing for the beat and retracting. Not a persistent four-a-side board.
- **No left/right semantics.** Attacker and target, in that order, is a relationship the
  game actually has.

## Also worth deciding

- **Should this be a room setting rather than a per-device one?** #166 stores the opt-in in
  `localStorage`, so it does not follow a player between their phone and their tablet. That
  was the cheap choice for a stopgap and may not be the right one.
- **Where does the setting live?** It is in Account, next to the key-timestamps toggle.
  Fine for now; a "Ring display" group would be better once there are three of these.
- **`useRingKeyTimestamps` has a latent bug** worth folding into any pass here: it uses a
  plain `useState`, so if the toggle and a consumer are mounted at once (the workspace
  layout allows it) the consumer keeps the old value until a reload. `usePixelFightStage`
  and `useTheme` both use `useSyncExternalStore` and do not have this problem.

## What to keep

None of the underlying work is wasted, whichever direction wins:

- The 24×24 sprites and their six-key palette ramp (#164) — they render at any size.
- `state.ts`'s reducer, including `inEncounter` adoption and `lastActionAt` (#165).
- `renderer.ts`'s `drawSprite`/`drawHpBar` — the boundary between scene state and pixels
  is unchanged by any of the options above.
- The opt-in gate (#166), which is what buys the time to decide.

## Process note

The three bugs in #164 and the two in #165 were all found by *looking at the thing*, never
by a test: six identical blobs, a serpent that read as a duck in the browser after reading
as a snake in ASCII, and a stage that a phone user could never trigger. This doc's central
finding — that the roster and the stage duplicate each other — came from a photo of a real
session on a real device, after all of it had shipped and passed CI twice.

Keep rendering it and looking at it. See "Common Pitfalls" in
[`docs/pixel-art-animations-in-js.md`](../pixel-art-animations-in-js.md).
