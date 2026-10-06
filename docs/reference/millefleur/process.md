---
type: Reference
title: Millefleur, process and learnings
description: How the Millefleur theme was designed over four rounds of owner review, and the lessons worth keeping for the next design.
status: stable
audience: internal
tags: [design, theme, millefleur, process, learnings]
---
# Millefleur: process and learnings

Designed 2026-10-05 to 2026-10-06, by Claude with the owner, over four rounds of rendered screens
on a shared design canvas. Every round is in [the archive](../../archive/studies/millefleur-theme/README.md).

## How it went

**The ask.** "A new theme that goes with the new unicorn monster... 90s trapper keeper, rounded
edges and gradients and pastels and beautiful water colors and textures, more of a departure
from the terminal aesthetic than any other theme... macOS 6 or 7 rather than dos/cli, Lisa
Frank, 'the last unicorn'... really beautiful and more feminine."

**The written proposal.** A research agent wrote roadmap 46: the inspirations with links and
licensing notes, three directions (Holo Folder, Gloaming Wash, Dream Desktop) with checked
palettes, a blended recommendation, and the engineering blockers a light theme hits. A second
reviewer, forwarded by the owner, reorganised the concept (each inspiration gets one job: the
garden, the binder, System 7's grammar, holo for rewards) and found the tapestries' dyes, madder,
weld and woad, which became the palette. That text is
[archived](../../archive/studies/millefleur-theme/first-proposal.md).

**v1, "the binder and the garden".** Four screens plus the three directions. Owner: "great but
too kitchen sink. Needs more consistency, more softness, fading... texture and gradient,
possibly simpler text, more watercolor." Holo Folder: "fantastic." Gloaming: "not my favorite."
Dream Desktop: "cool", but its own theme, not this one.

**v2, softer.** One typeface, no ink outlines, holo as a fade, frosted panels on blurred
watercolour blooms. Owner: liked the level-up screen; the highlighted tab "a little modern";
wanted folder tabs back but gentle, fading at the bottom, with colour only on the selected
tab; more texture (pointing at an earlier handbook whose watercolour "really nailed" it); the
ruled chat paper back, but faded.

**v3, texture.** The handbook's technique (filtered shapes with little blur, layered thin) on
linen paper with grain, and faded ruled chat. Owner: "much more polished... closer to a final
design", but the backgrounds were "blob like" ("too round and concentric"; think Rothko,
brush strokes, Japanese watercolours), and the tabs read as "Mac OS 8 early 2000s bubble iMac".
And the question: "have you been rendering and reviewing visually as you go?"

**v4, rendered.** The answer was no, and that changed the process. From here every change was
rendered in Chromium at phone size, looked at, fixed and rendered again. Three paint studies and
two tab studies were compared before anything went on the canvas. Owner: "Perfection", with one
fault: chat text crossed the ruled lines. Fixed, then the contrast check below.

## Learnings

### Render and look, every time

Rounds v1 to v3 went out unseen: the canvas tool's guidance says not to verify unless asked, and
nobody asked. Every round had faults only visible in pixels: round blobs, bubbly tabs, a heading
floating between tabs and page, chat text off its lines, a clipped tab, a gap in the Ring.
Rendering found all of them in minutes. **For visual work, render and look before showing, even
when no one asks.** [tools/render.mjs](tools/render.mjs) does it; zoom in (scale 3–4 on a clip)
for alignment.

### Study before you commit

The breakthroughs came from side-by-side studies, not from editing a screen: four paint
techniques on one sheet (granulated wash, dry brush, colour fields, wet edge), then two more
rounds narrowing to one; four tab shapes, then three refinements in context. Seeing the options
together made the choice obvious. The studies are archived.

### What makes paint read as paint

- **Shape, not blur.** Heavy blur gives airbrush. Watercolour has a defined but irregular edge,
  slightly darker where it dried, and uneven pigment inside.
- **No circles.** Ellipses read as blobs however they are filtered. Large irregular shapes that
  bleed in from an edge read as paint.
- **Glaze.** Multiply blending at about half strength, so overlaps deepen.
- **Edges warp at two scales:** a slow warp for the shape, a fine one for the wet edge. With only
  the fine one, edges look like torn paper.
- **Grain is for the paper, not the paint.** Grain inside the wash looked like sandpaper; fibre
  stronger than about 5% looked like brushed metal.

### What makes a tab read as a folder

The slope of the shoulder. Rounded rectangles with a gradient read as Aqua whatever their
colour. A sloped shoulder, a flat fill, thin lines, a slight overlap, and the selected tab joined
to the page with no line under it read as a folder, and as System 7.

### Small things that broke

- An unsized `repeating-linear-gradient` covers the whole box from the top, so ruled lines
  drifted from bottom-anchored text. Size the tile (`100% 28px`) and anchor it with the text.
- Translucent tabs showed their neighbours' shoulder lines crossing. Make them nearly opaque and
  stack each behind its left neighbour.
- The look-and-feel pass used muted text at 3.5–4.2:1. A contrast check after the owner's
  approval caught it; the fix (`#695c8c`, and a stronger control edge) is barely visible. **Check
  contrast before showing, not after approval.**
- Chromium in the cloud sandbox could not load Google Fonts, so early renders used fallback
  fonts and looked wrong. Download the woff2 files once and point the page at them.

### Review findings against design decisions

In the build, a code review flagged that the XP bar's filled part barely differed from its
track. The fix (saturated stops and a plum outline) went in without anyone checking that the
design had already decided the bar was decorative, because the figures beside it carry the
information. The owner caught the drift. A reviewer checks rules; it does not know which rules
the design deliberately chose not to apply. **Before passing on a contrast or legibility finding,
check whether the surface is information or decoration, and whether the design system already
decided.** Apply the 3:1 and 4.5:1 rules to controls and information, and leave decoration soft.

### Working with the owner

- Show options side by side, with the previous round still visible, and name what changed.
- Their words are the brief. "Kitchen sink", "blob like", "bubble iMac" each pointed at one
  specific fault; fix that fault, not the whole design.
- Keep what they love unchanged (the level-up sheet from v2 on), and carry it forward exactly.
- Ideas that do not fit the brief get their own home (Dream Desktop became roadmap 47; card
  trading, prompted by a chat line in a mockup, went to the content backlog).
