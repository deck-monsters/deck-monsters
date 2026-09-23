# Ring roster and pixel monsters

Status: Current
Read before: changing `ring.state`, contestant snapshots, Ring roster row order or layout,
pixel sprites, appearance palettes, known-monster storage, or narration portraits.

## Authority and trust

`Ring.contestantSnapshots()` maps the engine's contestant array and `publishState()` sends
that array in the public, ephemeral `ring.state` event. The same snapshot is seeded in the
reconnect handshake and returned by the membership-checked `game.ringState` query for cold
mounts.

The client may use the query as a cold-start seed. Once any live `ring.state` has arrived,
it trusts that payload verbatim, including an empty contestant list. Falling back from an
empty live list to an older query resurrects a cleared roster.

Per-encounter `team` and targeting overrides come from the contestant, never the persisted
monster. AC is read live. `acting` is ephemeral and is valid only while the encounter is
active. Appearance text and optional generated-boss hex colour are additive sprite inputs.

## The hard order rule

**Roster row order is the order of play. Never sort or group it.**

The fight loop consumes contestants in array order, and snapshots map that same array.
Nothing else on screen communicates who moves next. Teams are shown in place with a colour
pip and label. Grid flow stays row-major so reading across then down preserves array order.

The client marks only the authoritative `acting` contestant. It does not predict the next
actor: `ring.state` does not carry every skip condition, such as fled or exhausted
contestants. If an up-next cue is needed, publish it from the engine.

## Row field priority

Rows are designed to lose the least important information first:

1. monster name;
2. current actor (`▶` and row tint);
3. HP/fallen state, with exact numbers and bar;
4. Beastmaster, or `👑 The Editor` for a boss;
5. relevant team and boss status;
6. level;
7. AC.

Species remains in the accessible label and is represented visually by the icon/sprite.
The bar and figures both stay: the bar communicates shape while the numbers communicate
scale. Long names may ellipse, but the boss badge and HP rail remain visible.

Teams render only when at least two distinct teams are still standing. Colour is never the
only channel; labels and a legend name the teams in play.

## Responsive tiers

`.terminal-slot` is the roster's inline-size container:

| Pane width | Columns |
|---|---|
| under `46rem` | 1 |
| `46rem` and up | 2 |
| `70rem` and up | 3 |

These are explicit container tiers, not `auto-fit`; a wide screen must not create columns
too narrow for a useful row. Above eight contestants, a density class compresses only the
single-column tier. At two or three columns, a large fight gets columns instead of reduced
content. The roster caps its own height and scrolls so it cannot displace the feed.

One DOM shape serves every width and density. CSS presentation changes; markup order does
not.

## Acting and faint state

The acting snapshot drives the turn marker, accent, and attack pose. A dead contestant is
never rendered as acting even if a stale payload says otherwise.

Faint is not retained as a transient animation pose. The snapshot's `dead` flag is
authoritative and outlives a frame; this prevents a revived monster from keeping stale
fallen art.

## Pixel-monster preference and palette

Pixel monsters are web-only, enabled by default on every theme, and controlled by
`usePixelMonsters`. The existing storage key remains
`deck-monsters-pixel-fight-stage`; absent means on and explicit `'0'` means off. The flag
uses a shared external store so roster and narration consumers update together. An opted-out
viewer sees the monster's emoji and does not need the lazy roster-sprite chunk.

Each species has one hand-drawn 24×24 map. Poses transform that map on a padded grid rather
than translating an unchanged drawing. The palette starts from the monster's persisted
appearance text; the first recognized colour word sets chroma while the species'
hand-spaced lightness ramp preserves readable shading. Generated bosses prefer
`appearanceHex`, because names from the colour library are often not parseable colour
words. A stable name-derived adjustment separates same-species, same-colour monsters
without making colour depend on the current roster.

The roster sprite occupies the same 24px box as the emoji. It is decorative, hidden from
assistive technology, and never delays or replaces game state.

## Room-known monsters and narration portraits

Ring, Console, and Fight Log all render narration through the same formatter. A small
external store records monsters seen in `ring.state`; fight history also records its
participant rows so a direct Fight Log route works without the Ring mounted.

The store:

- is keyed by `roomId`;
- accumulates sightings after the ring clears;
- keys a monster by the name available in narration;
- also remembers Beastmaster names to avoid replacing an ambiguous character identity.

Narration replacement is conservative. It replaces only a known monster's identity emoji,
never card/item/effect emoji, Beastmaster emoji, or fenced card art. Hit/miss icon clusters
have a specific matcher; unmatched or ambiguous text keeps the original emoji. The failure
mode is no enhancement, never a guessed monster.

Feed portraits are static 16px images. Rendering established that this preserves line
height and wrapping better than forcing an integer art scale. Do not add `Suspense` around
the virtualized feed: inline sprite code loads in an effect and visible rows rerender in
place, preserving scroll position.

## Visual verification rubric

Unit tests can prove payload shape and sprite-map invariants; they cannot prove layout or
silhouette quality. Before shipping a visual change:

- render every species and pose; verify silhouettes differ and transformed frames do not
  clip opaque pixels;
- render appearance variations, including multiple same-species monsters with the same
  colour word, light/gold/yellow/black appearances, and generated boss hex colours;
- inspect every theme at 1×, 2×, and 3× device scale;
- inspect real roster data at one, two, and three column tiers, with long names, teams,
  bosses, fallen and acting rows, and 12 contestants;
- verify row reading order still equals engine order;
- compare feed line height and wrapping with emoji versus 16px portraits;
- verify opt-out avoids sprite rendering and restores emoji;
- check reduced motion, phone width, tablet/desktop pane widths, divider extremes, and a
  real WebKit/iPhone where possible.

Use [the pixel-art reference](../reference/pixel-art.md) for crisp rendering and sprite
construction techniques.

## Change checklist

- [ ] Engine snapshots remain the authority; clients do not derive combat truth.
- [ ] Live empty state wins over stale seeds.
- [ ] Rows are never sorted or grouped.
- [ ] Container tiers measure the pane, not the viewport.
- [ ] Faint follows `dead`; acting follows the snapshot and excludes dead contestants.
- [ ] Preference storage retains absent=on and `'0'`=off.
- [ ] Known monsters and portraits remain keyed by room.
- [ ] Replacement is identity-only, matched, and harmless when uncertain.
- [ ] Visual claims are checked by rendering, not jsdom alone.
