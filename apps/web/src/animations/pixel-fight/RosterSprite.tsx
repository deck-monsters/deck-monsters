import { useEffect, useRef } from 'react';
import { clear, drawSprite } from './renderer.js';
import { SPRITE_ART, spriteFor } from './sprites.js';
import { paletteFor } from './appearance-palette.js';
import { subscribeToFrames } from './frame-ticker.js';
import type { FighterAnimation } from './state.js';

/**
 * Integer scale, because a pixel sprite drawn at a fractional scale gets uneven pixels.
 *
 * 1× (24px) is the box the roster's emoji icon already occupied, which is what makes the
 * emoji a free fallback when the animations are off — and, tested side by side, the small
 * silhouette simply read better than the 48px version this started at. The trade is that
 * the attack lean is now a twitch rather than a lunge: at this size the sprite is an
 * ambient tell for whose turn it is, not a cutscene.
 */
const SCALE = 1;
export const ROSTER_SPRITE_PX = SPRITE_ART * SCALE;

export default function RosterSprite({
  creatureType,
  appearance,
  name,
  anim,
  flash,
  startedAt,
  reducedMotion,
}: {
  creatureType: string;
  /** The Beastmaster's description, which colours the sprite — see `paletteFor`. */
  appearance?: string;
  /** Nudges the colour so two monsters described alike still differ. */
  name: string;
  anim: FighterAnimation;
  flash: boolean;
  /** Pose start, so a re-pose restarts the cycle instead of inheriting a stale phase. */
  startedAt: number;
  reducedMotion: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Held in a ref so the frame callback sees the current pose without being re-subscribed
  // on every prop change — re-subscribing per pose would restart the shared loop.
  const poseRef = useRef({ creatureType, appearance, name, anim, flash, startedAt });
  poseRef.current = { creatureType, appearance, name, anim, flash, startedAt };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pixelRatio = Math.max(1, window.devicePixelRatio || 1);
    canvas.width = Math.round(ROSTER_SPRITE_PX * pixelRatio);
    canvas.height = Math.round(ROSTER_SPRITE_PX * pixelRatio);
    ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    const draw = (frameIndex: number) => {
      const { creatureType: type, appearance: look, name: who, anim: pose, flash: flashing } = poseRef.current;
      const sprite = spriteFor(type);
      const palette = paletteFor(sprite.palette, look, who);
      // `flee` has no drawn pose of its own; it reads as a lunge away from the ring.
      const frames = sprite.frames[pose === 'flee' ? 'attack' : pose];
      const cycles = pose === 'idle' || pose === 'attack' || pose === 'flee';
      const frame = frames[cycles ? frameIndex % frames.length : 0]!;
      clear(ctx);
      drawSprite(ctx, frame, palette, 0, 0, SCALE, { mirror: false, flash: flashing });
    };

    draw(0);
    if (reducedMotion) return;
    return subscribeToFrames(draw);
  }, [reducedMotion]);

  // Redraw immediately on a pose change rather than waiting for the next tick, so a hit
  // flash lands on the beat and a static (reduced-motion) sprite still updates.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!ctx) return;
    const sprite = spriteFor(creatureType);
    const frames = sprite.frames[anim === 'flee' ? 'attack' : anim];
    clear(ctx);
    drawSprite(ctx, frames[0]!, paletteFor(sprite.palette, appearance, name), 0, 0, SCALE, {
      mirror: false,
      flash,
    });
  }, [creatureType, appearance, name, anim, flash, startedAt]);

  return (
    <canvas
      ref={canvasRef}
      className="roster-sprite"
      style={{ width: ROSTER_SPRITE_PX, height: ROSTER_SPRITE_PX }}
      aria-hidden="true"
    />
  );
}
