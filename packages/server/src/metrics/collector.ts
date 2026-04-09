/**
 * Attaches a metrics subscriber to a room's event bus and ring.
 *
 * Call once per room when it becomes active (createRoom / _loadRoom).
 * Returns an unsubscribe function to be called when the room is unloaded.
 *
 * Uses the same pattern as attachEventPersister: pure side-effects, no
 * coupling to the room state beyond the two objects passed in.
 */
import type { RoomEventBus, GameEvent } from '@deck-monsters/engine';

import {
	battleDurationMs,
	battleRounds,
	battleParticipants,
	battleAvgMonsterLevel,
	battleMinMonsterLevel,
	battleMaxMonsterLevel,
	battleRoundDurationMs,
	battlesStarted,
	battlesCompleted,
	playerWins,
	playerLosses,
	playerDraws,
	playerFled,
	monsterPermDeaths,
	bossSpawns,
	monstersInRing,
	promptTimeouts,
} from './index.js';

// The ring countdown fires FIGHT_DELAY ms before combat starts.
// We record the countdown timestamp and add this offset to get the
// approximate encounter start time for duration calculation.
const FIGHT_DELAY_MS = 60_000;

// Duck-typed interface — only the EventEmitter methods we actually use.
interface RingLike {
	on(event: 'add', listener: (data: { contestant: { isBoss?: boolean } }) => void): unknown;
	off(event: 'add', listener: (data: { contestant: { isBoss?: boolean } }) => void): unknown;
}

type FightContestant = {
	monster?: { level?: number };
};

export function attachMetricsCollector(
	eventBus: RoomEventBus,
	ring: RingLike,
	roomId: string
): () => void {
	// Track the timestamp of the most recent countdown per room so we can
	// calculate combat duration when ring.fight fires.
	let countdownAt: number | undefined;

	const unsubscribeEventBus = eventBus.subscribe(`metrics:${roomId}`, {
		deliver(event: GameEvent) {
			switch (event.type) {
				case 'ring.countdown': {
					countdownAt = event.timestamp;
					battlesStarted.inc({ room_id: roomId });
					break;
				}

				case 'ring.fight': {
					battlesCompleted.inc({ room_id: roomId });

					const payload = event.payload as {
						contestants?: FightContestant[];
						rounds?: number;
					};

					const contestants = payload.contestants ?? [];
					const rounds = payload.rounds ?? 0;

					// Participant count
					battleParticipants.observe({ room_id: roomId }, contestants.length);

					// Rounds
					if (rounds > 0) {
						battleRounds.observe({ room_id: roomId }, rounds);
					}

					// Monster level stats
					const levels = contestants
						.map(c => c.monster?.level ?? 0)
						.filter(l => l >= 0);

					if (levels.length > 0) {
						const avg = levels.reduce((s, l) => s + l, 0) / levels.length;
						const min = Math.min(...levels);
						const max = Math.max(...levels);
						battleAvgMonsterLevel.observe({ room_id: roomId }, avg);
						battleMinMonsterLevel.observe({ room_id: roomId }, min);
						battleMaxMonsterLevel.observe({ room_id: roomId }, max);
					}

					// Duration (combat only — excludes the pre-fight countdown window)
					if (countdownAt !== undefined) {
						const encounterStartedAt = countdownAt + FIGHT_DELAY_MS;
						const duration = event.timestamp - encounterStartedAt;
						if (duration > 0) {
							battleDurationMs.observe({ room_id: roomId }, duration);
							if (rounds > 0) {
								battleRoundDurationMs.observe({ room_id: roomId }, duration / rounds);
							}
						}
						countdownAt = undefined;
					}
					break;
				}

				case 'ring.win':
					playerWins.inc({ room_id: roomId });
					break;

				case 'ring.loss':
					playerLosses.inc({ room_id: roomId });
					break;

				case 'ring.draw':
					playerDraws.inc({ room_id: roomId });
					break;

				case 'ring.fled':
					playerFled.inc({ room_id: roomId });
					break;

				case 'ring.permaDeath':
					monsterPermDeaths.inc({ room_id: roomId });
					break;

				case 'ring.state': {
					const monsterCount = (event.payload as { monsterCount?: number }).monsterCount ?? 0;
					monstersInRing.set({ room_id: roomId }, monsterCount);
					break;
				}

				case 'prompt.timeout':
					promptTimeouts.inc({ room_id: roomId });
					break;
			}
		},
	});

	// Boss spawns: detected via the ring's internal EventEmitter since bosses
	// don't have a separate external event. ring.emit('add', { contestant })
	// fires for every monster added including bosses.
	const onRingAdd = (data: { contestant: { isBoss?: boolean } }) => {
		if (data.contestant.isBoss) {
			bossSpawns.inc({ room_id: roomId });
		}
	};

	ring.on('add', onRingAdd);

	return () => {
		unsubscribeEventBus();
		ring.off('add', onRingAdd);
		// Reset the ring gauge to 0 when the room is unloaded so stale
		// values don't linger after a restart.
		monstersInRing.set({ room_id: roomId }, 0);
	};
}
