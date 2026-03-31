# Simple Graphics for Web and Mobile

**Category**: Enhancement / UX  
**Priority**: Low (nice to have)

## Philosophy

The original game's charm was in the text. Emoji were the "graphics." Don't replace that — augment it. The goal is small, tasteful visual additions that make the experience more scannable on mobile and web, not a full visual overhaul.

## What to Add

### Monster Icons / Sprites

- Small pixel-art or icon-style images for each of the 5 monster types
- Basilisk, Gladiator, Jinn, Minotaur, Weeping Angel
- Used in: monster list views, ring feed (next to monster names), battle results
- Size: 64×64 or 128×128 — small enough to feel like flavor, not the focus

### Card Art Thumbnails

- Simple iconic images for card categories (melee, healing, control, boost, utility)
- Used in: deck builder UI
- Not needed for every individual card — just card class icons

### HP / Status Bars

- Simple colored bar for current HP in monster status views
- Green → yellow → red as HP drops
- Web and mobile only — not in the text feed

### Ring Feed Visual Markers

- Emoji (already supported by the engine) + small inline icons for major events
- Win 🏆, loss 💀, flee 🏃, card drop ✨
- The engine already uses emoji — just make them render nicely

## What NOT to Add

- Animations (keep it simple)
- Full battle scenes or cutscenes
- Custom fonts or heavy visual themes
- Anything that requires significantly more data (the text feed should stay fast)

## Asset Strategy

Options (pick one):

1. **Commission pixel art** — hire an artist on Fiverr/Upwork for 5 monster sprites + card class icons (~$50-200)
2. **Use free assets** — find CC0 pixel art monster sprites (OpenGameArt.org, itch.io free section)
3. **Generate with AI** — use a consistent style prompt to generate all sprites with Midjourney/DALL-E; adjust until consistent

## Tasks

- [ ] Decide on asset strategy and style (pixel art recommended)
- [ ] Create/source 5 monster type sprites
- [ ] Create/source card class icons (5 classes)
- [ ] Integrate monster sprites into web app monster list and ring feed
- [ ] Integrate monster sprites into mobile app monster list
- [ ] Add HP bars to monster detail views (web + mobile)
- [ ] Add card class icons to deck builder (web + mobile)
