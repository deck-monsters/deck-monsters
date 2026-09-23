import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { RingContestantSnapshot } from '../../components/RingRoster.js';
import { RosterSpriteContext, type RosterSpriteApi } from '../../components/roster-sprite-context.js';
import { useRingFeedListener, type TrackedRingFeedEvent } from '../../hooks/useRingFeed.js';
import RosterSprite from './RosterSprite.js';
import {
  NO_ANIMATIONS,
  nextDeadline,
  poseFor,
  pruneToRoster,
  reduce,
  settle,
  type FightAnimations,
} from './state.js';

/**
 * Supplies animated sprites to the Ring roster.
 *
 * This replaced a separate canvas band above the feed. The band re-drew state the roster
 * already showed — the same monsters with a second set of HP bars — and spent 96px of a
 * phone viewport (200px on a tablet) doing it, pushing the narration, which is the game,
 * into a strip. Sprites in the roster rows cost no extra height at all: they sit in the
 * 24px box the emoji icon already had. See
 * docs/architecture/ring-roster-and-pixel-monsters.md.
 */
export default function PixelSprites({
  contestants,
  children,
}: {
  contestants: RingContestantSnapshot[];
  children: ReactNode;
}) {
  const [animations, setAnimations] = useState<FightAnimations>(NO_ANIMATIONS);
  const [reducedMotion, setReducedMotion] = useState(() =>
    window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReducedMotion(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const onRingEvent = useCallback((event: TrackedRingFeedEvent) => {
    setAnimations((previous) => reduce(previous, event, performance.now()));
  }, []);
  useRingFeedListener(onRingEvent);

  // Monsters that left the ring keep no pose; without this the map grows for the life of
  // the room.
  useEffect(() => {
    setAnimations((previous) => pruneToRoster(previous, contestants));
  }, [contestants]);

  useEffect(() => {
    const deadline = nextDeadline(animations);
    if (deadline === undefined) return;
    // A timeout is clamped to whole milliseconds while performance.now() is not, so it
    // can wake a fraction early; settling would then change nothing, React would skip the
    // re-render, and this effect would never re-run — leaving the pose stuck until the
    // next feed event. The same trap as #162. Re-arm until the deadline has truly passed.
    let timer: number | undefined;
    const arm = () => {
      timer = window.setTimeout(() => {
        const now = performance.now();
        if (now < deadline) {
          arm();
          return;
        }
        setAnimations((previous) => settle(previous, now));
      }, Math.max(0, Math.ceil(deadline - performance.now())));
    };
    arm();
    return () => window.clearTimeout(timer);
  }, [animations]);

  const api = useMemo<RosterSpriteApi>(() => ({
    render(contestant) {
      const now = performance.now();
      const { anim, flash } = poseFor(animations, contestant, now);
      const startedAt = animations[contestant.name]?.startedAt ?? 0;
      return (
        <RosterSprite
          creatureType={contestant.creatureType}
          appearance={contestant.appearance}
          appearanceHex={contestant.appearanceHex}
          name={contestant.name}
          anim={anim}
          flash={flash}
          startedAt={startedAt}
          reducedMotion={reducedMotion}
        />
      );
    },
  }), [animations, reducedMotion]);

  return <RosterSpriteContext.Provider value={api}>{children}</RosterSpriteContext.Provider>;
}
