import { useCallback, useEffect, useRef, useState } from 'react';
import type { RingContestantSnapshot } from '../../components/RingRoster.js';
import { useRingFeedListener, type TrackedRingFeedEvent } from '../../hooks/useRingFeed.js';
import { clear, drawHpBar, drawSprite } from './renderer.js';
import { spriteFor } from './sprites.js';
import { EMPTY_FIGHT_SCENE, reduce, type FightScene } from './state.js';

const CANVAS_HEIGHT = 200;

function drawScene(canvas: HTMLCanvasElement, scene: FightScene, frameIndex: number, now: number): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const width = canvas.getBoundingClientRect().width || canvas.clientWidth || 640;
  const pixelRatio = Math.max(1, Math.round(window.devicePixelRatio || 1));
  const spriteScale = width < 480 ? 3 : 4;
  canvas.width = Math.round(width * pixelRatio);
  canvas.height = CANVAS_HEIGHT * pixelRatio;
  clear(ctx);

  const scale = spriteScale * pixelRatio;
  const fighterWidth = 16 * scale;
  const hpWidth = 16 * scale;
  const left = scene.fighters.filter((fighter) => fighter.side === 'left');
  const right = scene.fighters.filter((fighter) => fighter.side === 'right');

  for (const [index, fighter] of scene.fighters.entries()) {
    const indexOnSide = fighter.side === 'left'
      ? left.findIndex((candidate) => candidate.name === fighter.name)
      : right.findIndex((candidate) => candidate.name === fighter.name);
    const row = Math.floor(indexOnSide / 2);
    const offset = (indexOnSide % 2) * (fighterWidth + 12 * pixelRatio);
    const x = fighter.side === 'left'
      ? 20 * pixelRatio + offset
      : canvas.width - fighterWidth - 20 * pixelRatio - offset;
    const y = 18 * pixelRatio + row * (78 * pixelRatio);
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
    drawHpBar(ctx, x, y + fighterWidth + 4 * pixelRatio, hpWidth, fighter.hp, fighter.maxHp);
    // Keep the loop deterministic if a future layout makes entry positions stateful.
    void index;
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
