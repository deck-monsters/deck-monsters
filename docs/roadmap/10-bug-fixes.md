# Bug Fixes and Code Quality

**Category**: Bug / Tech Debt
**Priority**: Medium
**Status**: Active — three open items from the September 2026 live-play pass, plus two
open judgement calls (#101, #104) from the September 16 2026 mobile UI pass at the bottom
of this doc. Everything earlier is resolved; see [`10b-bugs-fixed.md`](10b-bugs-fixed.md)
for the full archive (#3, #51–#58, #59–#73, #74–#85, #86–#97, #98–#108).

## Active Items

Found during the September 2026 live-play review. None is player-blocking; each is
recorded with a root cause so it can be picked up without re-deriving the analysis.

### 1. `profiles.display_name` still defaults to the user's email (follow-up to #95)

`handle_new_user` seeds `display_name` with
`coalesce(display_name, full_name, new.email, '')`
(`supabase/migrations/20260403000000_fix_profile_trigger.sql`). A web signup that never
sets a display name therefore still gets their email address stored as their profile
name.

`publicDisplayName` now masks it on every read path, so it is no longer *shown* to other
players, and `Game.getCharacter` heals character names already saved with an address. But
the underlying column keeps storing real email addresses as display names, which is the
wrong thing to persist and one missed call site away from leaking again.

**Fix**: a migration changing the trigger's fallback to something non-identifying (a
generated handle, or the email local part), plus a one-off `update` for existing rows
where `display_name` matches an email pattern. Deliberately left out of #95 because it is
a data migration against live auth rows and deserves its own change.

Related: rows already written to `room_player_stats.display_name` keep their old value
until the next fight updates them. Those are masked on read too, so this is cosmetic
history rather than an active leak.

### 2. Some cards emit two roll blocks in the same tick

Measured in the pacing pass: a few cards publish two roll announcements with a 0.0s gap
between them, so both land at once. Seen with the pin / break-free flow —

```
5.9s  M00 rolled _13 +4 on 1d20_ to see if it pins M01.
0.0s  M00 rolled _13 -1 on 1d20_ vs M01's dex (6) to determine if the hit was a success.
```

and again with `is currently ⑂ pinned by` followed immediately by the break-free roll.
These are card-level `emit` calls with no `subEventDelay` between them, so the
content-aware pacing added in #89's follow-up never gets a chance to space them.

Much smaller than the turn-banner problem (#97) — two three-line blocks rather than forty
lines — so it was left alone rather than touching every card individually. The general
fix is a minimum gap enforced centrally, which means making publication async and is a
real change to `RoomEventBus`; worth doing only if more cards show the pattern.

### 3. The fight feed opens with a burst

The first three messages of a fight (fight banner, separator, first turn banner) publish
in the same tick before any pacing applies. Minor, and far less visible since #97 cut the
turn banner down, but it is the one place the feed still starts as a wall.



## Investigated — not bugs (left for the record)

- **Discord `registerUser` subscriber “leak”** — `RoomEventBus.subscribe` uses a `Map.set` by id; re-register replaces the previous subscriber.
- **`fight-stats-subscriber` `log.error`** — the module-level `createLogger` is used inside handlers; the `(err) => void` parameter only shadows inside `attachFightStatsSubscriber` for `.catch(log)`.
- **`activeFlows` check-then-set race** — no `await` between `has` and `set` on the Node event loop, so concurrent HTTP handlers cannot interleave there.
- **`hydrateDeck` alphabetical sort (#65)** — intentional for character inventory UX (mirrors live `addCard`); equipped monster card order is already preserved by `monsters/helpers/hydrate.ts`. See `10b-bugs-fixed.md`.
- **Lucky Strike / Rehit / Horn Swipe discarded-roll crits (#69)** — intentional: Stroke of Luck / Curse of Loki apply only to the selected roll. Documented in player/DM materials. See `10b-bugs-fixed.md`.

## Tasks

- [x] Audit and differentiate `DMG.md` vs `CARDS.md` full content; add how-to-run section (upstream #265) (#3)
- [x] Discord free-text prompt support (#59)
- [x] Discord serialization / `activeFlows` parity (#60)
- [x] Unify web `ringFeed` subscription / cursor (#63)

---

## September 16 2026 mobile UI pass — two open judgement calls

Eight iPhone screenshots of a live Game Night room produced eleven findings
(#98–#108). Nine are fixed — see [`10b-bugs-fixed.md`](10b-bugs-fixed.md) for each root
cause. The two below are **not defects**; both are decisions about the game's voice that
need an owner, and the research is recorded so neither has to be re-derived.

Screenshots: [`assets/ui-bugs-2026-09/`](assets/ui-bugs-2026-09/).

### 101. Turn-banner glyphs render as tofu boxes — VERIFIED (codepoint identified)

`08-fightlog-trace-tofu.png` shows a row of missing-glyph boxes before `round 1, turn 1`.

**Root cause**: the banner divider is 21 dice characters —

```
\n⚀ ⚁ ⚂ ⚃ ⚄ ⚅ ⚀ ⚁ ⚂ ⚃ ⚄ ⚅ ⚀ ⚁ ⚂ ⚃ ⚄ ⚅ ⚀ ⚁ ⚂\n
```

`announcements/nextTurn.ts:18` and `announcements/nextRound.ts:12`. These are
U+2680–U+2685 (DIE FACE-1 … DIE FACE-6), which **JetBrains Mono does not ship**. The
browser falls back per-glyph and draws tofu. The count matches the screenshot exactly.

**Two decisions, not one.** The rendering fix is a font fallback or a character the font
has. But the *content* question is whether a 21-glyph divider earns its place at all: it
wraps to two full lines on a phone, on **every turn**, immediately after #97 cut turn
banners by 45% for exactly this reason. Deleting it is probably the better fix, and is
the one that needs a human call — it is a deliberate piece of the game's voice.

### 104. The ring-exit line does not match the command that causes it — WORDING, OWNER DECIDED THE CONSTRAINTS

`06-ring-summon-sequence.png`: `Dalfi (dalfe, Cow/beef) was summoned from the ring by
⛄ Thunder Smasher.`

**Not the bug it first looked like.** "Summon" is defensible here — you summon someone
*out* to where you are, and `summon` is one of the verbs the command itself accepts. The
problem is narrower: `summoned from the ring` is the awkward phrasing of that idea, and it
collides head-on with the boss `summon a boss` vocabulary in the same feed.

**"Dismissed" is ruled out**, and not merely on taste. `dismiss` is an existing command
(`DISMISS_REGEX`, `commands/monster.ts:72`) and `beastmaster.ts:1101` shows it is
**permanent and only legal on dead monsters** — it calls `dropMonster` and announces
`has been dismissed from your pack.` Reusing the word for a live monster stepping out of
the ring would make a reversible move read as a permanent roster deletion.

**The vocabulary already exists.** The command is
`CALL_MONSTER_OUT_OF_THE_RING_REGEX` (`commands/monster.ts:47`) —
`/(?:remove|call|fetch|bring|summon) (.+?) (?:from|out of) (?:the )?(?:ring|battle)/` —
and the method is `callMonsterOutOfTheRing`. Its opposite is
`send (.+?) (?:to|into) (?:the )?(?:ring|battle)`. So the canonical player phrasings are
**"send X to the ring"** and **"call X out of the ring"**, and the feed should use them.

Two candidates, each optimising a different thing:

1. `Dalfi was called out of the ring by ⛄ Thunder Smasher.` — mirrors the command the
   player types, so the feed teaches the command. Keeps the "called out to where you are"
   sense the owner wanted. **Recommended.**
2. `Dalfi left the ring at the behest of ⛄ Thunder Smasher.` — mirrors the join line
   (`has entered the ring at the behest of …`) word for word, which is the strongest fix
   for the matched-pair problem below.

**Still open regardless of which is chosen**: joining names the species
(`An enraged Minotaur`) and leaving names the individual (`Dalfi`), so nothing links a
departure to the arrival it cancels. Cheapest fix is to let the leave line carry both
(`Dalfi, a Minotaur, was called out of the ring by …`). And the two lines spell the
beastmaster differently — leave uses `character.identity`, join builds
`${character.icon} ${character.givenName}` by hand.

**Unrelated, needs an owner answer**: the name renders as `Dalfi (dalfe, Cow/beef)`. If
that etymology is baked into `givenName` it will follow the monster into every message,
the roster and the leaderboard. Worth confirming it is intended.

### Observed and deliberately not filed

- **`↓ Latest` sits over feed text** (`05-ring-sammael-card.png`). It is
  `position: absolute` with `opacity: 0.9` and no backdrop, so the card box shows
  through. Arguably intended; listed in case it is not.
- **Roster eats 40% of a phone screen** (`01-ring-roster-boss.png`). Two contestants
  plus the header leave a small feed window. `max-height: 40%` / 32% under
  `max-height: 600px` is working as specified — flagging the *specification*, not a
  defect.
- **`boss in ~17m` vs a feed line reading `A boss will enter the ring in 2 minutes`**
  (`06-ring-summon-sequence.png`). The feed line is historical text from an earlier
  timer; the header is live. Not a mismatch.
