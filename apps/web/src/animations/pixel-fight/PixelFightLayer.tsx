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
  type FightScene,
} from './state.js';

const CANVAS_HEIGHT = 200;
const canvasMetrics = new WeakMap<HTMLCanvasElement, { width: number; height: number; pixelRatio: number }>();

function resizeCanvas(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D, width: number): void {
  const pixelRatio = Math.max(1, window.devicePixelRatio || 1);
  const metrics = { width, height: CANVAS_HEIGHT, pixelRatio };
  const previous = canvasMetrics.get(canvas);
  if (
    previous?.width === metrics.width
    && previous.height === metrics.height
    && previous.pixelRatio === metrics.pixelRatio
  ) return;

  // Assigning width or height clears the backing store, so only do it when an actual
  // CSS-size/DPR change requires a new coordinate system.
  canvas.width = Math.round(width * pixelRatio);
  canvas.height = Math.round(CANVAS_HEIGHT * pixelRatio);
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
  canvasMetrics.set(canvas, metrics);
}

export function drawScene(canvas: HTMLCanvasElement, scene: FightScene, frameIndex: number, now: number): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = canvas.getBoundingClientRect().width || canvas.clientWidth || 640;
  resizeCanvas(canvas, ctx, width);
  // 24px sprites: 3x is 72px tall, so two rows plus HP bars still clear CANVAS_HEIGHT.
  const spriteScale = width < 480 ? 2 : 3;
  clear(ctx);

  const scale = spriteScale;
  // Sprites are square, so these are all SPRITE_ART * scale — named apart because the HP
  // bar sits below the art and used to be offset by the *width*, which only worked by
  // coincidence and would have broken the moment a sprite stopped being square.
  const fighterWidth = SPRITE_ART * scale;
  const fighterHeight = SPRITE_ART * scale;
  const hpWidth = fighterWidth;
  const left = scene.fighters.filter((fighter) => fighter.side === 'left');
  const right = scene.fighters.filter((fighter) => fighter.side === 'right');

  for (const fighter of scene.fighters) {
    const indexOnSide = fighter.side === 'left'
      ? left.findIndex((candidate) => candidate.name === fighter.name)
      : right.findIndex((candidate) => candidate.name === fighter.name);
    const row = Math.floor(indexOnSide / 2);
    const offset = (indexOnSide % 2) * (fighterWidth + 12);
    const x = fighter.side === 'left'
      ? 20 + offset
      : width - fighterWidth - 20 - offset;
    const y = 14 + row * (fighterHeight + 16);
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
    drawHpBar(ctx, x, y + fighterHeight + 4, hpWidth, fighter.hp, fighter.maxHp);
  }
}

export default function PixelFightLayer({
  contestants,
  viewerUserId,
}: {
  contestants: RingContestantSnapshot[];
  viewerUserId: string | null;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | null>(null);
  const frameIndexRef = useRef(0);
  const [scene, setScene] = useState<FightScene>(EMPTY_FIGHT_SCENE);
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
    }, performance.now()));
  }, [contestants, viewerUserId]);

  const onRingEvent = useCallback((event: TrackedRingFeedEvent) => {
    setScene((previous) => reduce(previous, event, performance.now()));
  }, []);
  useRingFeedListener(onRingEvent);

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
    <canvas
      ref={canvasRef}
      className={`pixel-fight-layer${scene.active ? ' active' : ''}`}
      aria-hidden="true"
    />
  );
}
