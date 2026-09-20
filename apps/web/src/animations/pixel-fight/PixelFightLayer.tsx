import { useCallback, useEffect, useRef, useState } from 'react';
import type { RingContestantSnapshot } from '../../components/RingRoster.js';
import { useRingFeedListener, type TrackedRingFeedEvent } from '../../hooks/useRingFeed.js';
import { clear, drawHpBar, drawSprite } from './renderer.js';
import { SPRITE_ART, spriteFor } from './sprites.js';
import {
  EMPTY_FIGHT_SCENE,
  nextDeadline,
  reduce,
  settle,
  type FightFighter,
  type FightScene,
} from './state.js';

const canvasMetrics = new WeakMap<HTMLCanvasElement, { width: number; height: number; pixelRatio: number }>();

/** How long the stage flashes after a knockout. Matches the CSS pulse. */
const PULSE_MS = 700;

/** Space between the two fighters in the compact duel layout. */
const DUEL_GAP = 28;

/**
 * The stage is a docked band, so its height comes from CSS (and changes at breakpoints)
 * rather than a constant here. Below these thresholds there is no room for four sprites a
 * side, so the layout drops to a single duel — the feature stays alive on a phone instead
 * of being hidden outright, which is what the old `display: none` breakpoints did.
 */
export function stageLayout(width: number, height: number): { scale: number; perSide: number } {
  const compact = width < 520 || height < 150;
  return compact ? { scale: 2, perSide: 1 } : { scale: 3, perSide: 4 };
}

/**
 * Which fighters make it onto the stage. With room for everyone this is just the roster
 * order, so nobody hops between frames. When the band can only hold a duel, each side
 * fields whoever acted most recently: the pair trading blows right now, held steady until
 * a genuinely new exchange happens.
 */
export function visibleFighters(fighters: FightFighter[], perSide: number): FightFighter[] {
  const pick = (side: 'left' | 'right') => {
    const onSide = fighters.filter((fighter) => fighter.side === side);
    if (onSide.length <= perSide) return onSide;
    return [...onSide].sort((a, b) => b.lastActionAt - a.lastActionAt).slice(0, perSide);
  };
  return [...pick('left'), ...pick('right')];
}

function resizeCanvas(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  const pixelRatio = Math.max(1, window.devicePixelRatio || 1);
  const metrics = { width, height, pixelRatio };
  const previous = canvasMetrics.get(canvas);
  if (
    previous?.width === metrics.width
    && previous.height === metrics.height
    && previous.pixelRatio === metrics.pixelRatio
  ) return;

  // Assigning width or height clears the backing store, so only do it when an actual
  // CSS-size/DPR change requires a new coordinate system.
  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(height * pixelRatio);
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  canvasMetrics.set(canvas, metrics);
}

export function drawScene(canvas: HTMLCanvasElement, scene: FightScene, frameIndex: number, now: number): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const box = canvas.getBoundingClientRect();
  const width = box.width || canvas.clientWidth || 640;
  const height = box.height || canvas.clientHeight || 200;
  // A collapsing band measures zero mid-transition; drawing into a zero-size backing
  // store throws off the DPR transform for the next real frame.
  if (width < 1 || height < 1) return;
  resizeCanvas(canvas, ctx, width, height);
  clear(ctx);

  const { scale, perSide } = stageLayout(width, height);
  const fighterSize = SPRITE_ART * scale;
  const shown = visibleFighters(scene.fighters, perSide);
  const left = shown.filter((fighter) => fighter.side === 'left');
  const right = shown.filter((fighter) => fighter.side === 'right');
  const duel = perSide === 1;
  const perRow = duel ? 1 : 2;
  const rows = Math.max(1, Math.ceil(perSide / perRow));
  // Centre the block of rows vertically so the band looks deliberate at every height.
  const rowPitch = fighterSize + 16;
  const top = Math.max(4, (height - (rows * rowPitch - 16)) / 2);

  for (const fighter of shown) {
    const indexOnSide = (fighter.side === 'left' ? left : right)
      .findIndex((candidate) => candidate.name === fighter.name);
    const row = Math.floor(indexOnSide / perRow);
    const offset = (indexOnSide % perRow) * (fighterSize + 12);
    // A duel is drawn around the centre line rather than pinned to the edges: on a phone
    // band the two fighters are the whole picture, and pushing them into opposite corners
    // left a dead gap between them and read as two unrelated sprites, not a face-off.
    const x = duel
      ? (fighter.side === 'left'
          ? Math.max(4, width / 2 - DUEL_GAP / 2 - fighterSize)
          : Math.min(width - fighterSize - 4, width / 2 + DUEL_GAP / 2))
      : (fighter.side === 'left'
          ? 20 + offset
          : width - fighterSize - 20 - offset);
    const y = top + row * rowPitch;
    const sprite = spriteFor(fighter.creatureType);
    const animation = fighter.anim === 'flee'
      ? 'attack'
      : fighter.anim === 'enter'
        ? 'idle'
        : fighter.anim;
    const frames = sprite.frames[animation];
    const animated = fighter.anim === 'idle' || fighter.anim === 'attack' || fighter.anim === 'enter' || fighter.anim === 'flee';
    const frame = frames[animated ? frameIndex % frames.length : 0]!;
    const elapsed = now - fighter.animStartedAt;
    drawSprite(ctx, frame, sprite.palette, x, y, scale, {
      mirror: fighter.side === 'right',
      flash: fighter.anim === 'hit' && elapsed < 130,
    });
    drawHpBar(ctx, x, y + fighterSize + 4, fighterSize, fighter.hp, fighter.maxHp);
  }
}

export default function PixelFightLayer({
  contestants,
  viewerUserId,
  inEncounter,
}: {
  contestants: RingContestantSnapshot[];
  viewerUserId: string | null;
  inEncounter?: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const frameIndexRef = useRef(0);
  const [scene, setScene] = useState<FightScene>(EMPTY_FIGHT_SCENE);
  const [pulsing, setPulsing] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(() =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReducedMotion(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    setScene((previous) => reduce(previous, {
      type: 'ring.state',
      contestants,
      viewerUserId,
      inEncounter,
    }, performance.now()));
  }, [contestants, viewerUserId, inEncounter]);

  const onRingEvent = useCallback((event: TrackedRingFeedEvent) => {
    setScene((previous) => reduce(previous, event, performance.now()));
  }, []);
  useRingFeedListener(onRingEvent);

  // Flash once per knockout. Keyed on the timestamp so back-to-back KOs each land.
  const pulseAt = scene.pulseAt;
  useEffect(() => {
    if (pulseAt === undefined || reducedMotion) return;
    setPulsing(true);
    const timer = window.setTimeout(() => setPulsing(false), PULSE_MS);
    return () => {
      window.clearTimeout(timer);
      setPulsing(false);
    };
  }, [pulseAt, reducedMotion]);

  useEffect(() => {
    const deadline = nextDeadline(scene);
    if (deadline === undefined) return;
    // Timers are clamped to whole milliseconds while performance.now() is not, so a
    // timeout can wake a fraction early. Settling then changes nothing, React skips the
    // re-render, this effect never re-runs, and the fight stayed "active" on screen until
    // the next unrelated feed event (seen live: ~90 s). Re-arm until the deadline has
    // genuinely passed.
    let timer: number | undefined;
    const arm = () => {
      timer = window.setTimeout(() => {
        const now = performance.now();
        if (now < deadline) {
          arm();
          return;
        }
        setScene((previous) => settle(previous, now));
      }, Math.max(0, Math.ceil(deadline - performance.now())));
    };
    arm();
    return () => window.clearTimeout(timer);
  }, [scene]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext('2d');
    if (!scene.active) {
      if (context) clear(context);
      return;
    }

    let lastTimestamp: number | null = null;
    let accumulator = 0;
    const draw = (timestamp: number) => drawScene(canvas, scene, frameIndexRef.current, timestamp);
    draw(performance.now());
    if (reducedMotion) return;

    const tick = (timestamp: number) => {
      if (lastTimestamp !== null) {
        accumulator += timestamp - lastTimestamp;
        const hasAttack = scene.fighters.some((fighter) => fighter.anim === 'attack');
        const frameDuration = 1_000 / (hasAttack ? 12 : 8);
        while (accumulator >= frameDuration) {
          frameIndexRef.current += 1;
          accumulator -= frameDuration;
        }
      }
      lastTimestamp = timestamp;
      draw(timestamp);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [reducedMotion, scene]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || typeof ResizeObserver === 'undefined') return;
    // The band animates its own height open and closed, so this fires throughout the
    // transition as well as on viewport changes — which is what keeps the sprite scale
    // and the duel/full layout correct without a resize listener.
    const observer = new ResizeObserver(() => {
      drawScene(canvas, scene, frameIndexRef.current, performance.now());
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [scene]);

  useEffect(
    () => () => {
      const context = canvasRef.current?.getContext('2d');
      if (context) clear(context);
    },
    [],
  );

  return (
    <div
      className={`pixel-fight-stage${scene.active ? ' active' : ''}${pulsing ? ' pulse' : ''}`}
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="pixel-fight-layer" />
    </div>
  );
}
