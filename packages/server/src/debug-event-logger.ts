/**
 * Attaches a debug/trace logging subscriber to a room's event bus and ring.
 *
 * Only does any work when LOG_LEVEL=debug or LOG_LEVEL=trace — the function
 * returns immediately with a no-op cleanup otherwise, so it has zero overhead
 * in production at the default "info" level.
 *
 * Coverage:
 *  debug — ring lifecycle (monster add/remove, countdown, fight begin/end,
 *           outcomes, XP, card drops, boss spawns), combat turns (card.played),
 *           prompt flow (request/timeout/cancel)
 *  trace  — every announce text (very high volume; use LOG_LEVEL=trace)
 */
import type { RoomEventBus, GameEvent } from '@deck-monsters/engine';
import { createLogger, isDebugEnabled, isTraceEnabled } from './logger.js';

const log = createLogger('events');

// Duck-typed interface — matches metrics/collector.ts so we can share the same ring reference.
interface RingLike {
	on(event: string, listener: (...args: unknown[]) => void): unknown;
	off(event: string, listener: (...args: unknown[]) => void): unknown;
}

export function attachDebugEventLogger(
	eventBus: RoomEventBus,
	ring: RingLike,
	roomId: string,
): () => void {
	if (!isDebugEnabled && !isTraceEnabled) return () => {};

	// ── Event bus subscriber ────────────────────────────────────────────────

	const unsubscribeEventBus = eventBus.subscribe(`debug-logger:${roomId}`, {
		deliver(event: GameEvent) {
			switch (event.type) {

				// ── Combat ────────────────────────────────────────────────────

				case 'card.played': {
					const p = event.payload as { player?: { givenName?: string }; card?: { name?: string } };
					log.debug('card played', {
						roomId,
						player: p.player?.givenName,
						card: p.card?.name,
					});
					break;
				}

				// ── Ring lifecycle ────────────────────────────────────────────

				case 'ring.remove': {
					const p = event.payload as { contestant?: { monster?: { givenName?: string } } };
					log.debug('monster removed from ring', {
						roomId,
						monster: p.contestant?.monster?.givenName,
					});
					break;
				}

				case 'ring.countdown': {
					log.debug('fight countdown started', { roomId, text: event.text });
					break;
				}

				case 'ring.fight': {
					const p = event.payload as {
						eventName?: string;
						contestants?: unknown[];
						rounds?: number;
					};
					if (p.eventName === 'fightBegins') {
						log.debug('fight beginning', {
							roomId,
							contestantCount: Array.isArray(p.contestants) ? p.contestants.length : undefined,
						});
					} else if (p.eventName === 'fightConcludes') {
						log.debug('fight concluding', { roomId, rounds: p.rounds });
					}
					break;
				}

				case 'ring.fightResolved': {
					const p = event.payload as {
						outcome?: string;
						winnerMonsterName?: string;
						loserMonsterName?: string;
						rounds?: number;
						deaths?: number;
					};
					log.debug('fight resolved', {
						roomId,
						outcome: p.outcome,
						winner: p.winnerMonsterName,
						loser: p.loserMonsterName,
						rounds: p.rounds,
						deaths: p.deaths,
					});
					break;
				}

				// ── Fight outcomes (private, per-player) ──────────────────────

				case 'ring.win':
				case 'ring.loss':
				case 'ring.draw':
				case 'ring.fled':
				case 'ring.permaDeath': {
					const p = event.payload as {
						contestant?: { monster?: { givenName?: string } };
					};
					log.debug(`fight outcome: ${event.type.replace('ring.', '')}`, {
						roomId,
						monster: p.contestant?.monster?.givenName,
						userId: event.targetUserId,
					});
					break;
				}

				// ── XP & loot ─────────────────────────────────────────────────

				case 'ring.xp': {
					const p = event.payload as {
						xpGained?: number;
						coinsGained?: number;
						contestant?: {
							monster?: { givenName?: string };
							character?: { name?: string };
						};
					};
					log.debug('xp gained', {
						roomId,
						xp: p.xpGained,
						coins: p.coinsGained,
						monster: p.contestant?.monster?.givenName,
						owner: p.contestant?.character?.name,
					});
					break;
				}

				case 'ring.cardDrop': {
					const p = event.payload as { cardDropName?: string; contestantName?: string };
					log.debug('card dropped', {
						roomId,
						card: p.cardDropName,
						recipient: p.contestantName,
					});
					break;
				}

				// ── Prompts ───────────────────────────────────────────────────

				case 'prompt.request': {
					const p = event.payload as {
						requestId?: string;
						question?: string;
						choices?: unknown[];
					};
					log.debug('prompt sent to user', {
						roomId,
						userId: event.targetUserId,
						requestId: p.requestId,
						question: typeof p.question === 'string' ? p.question.slice(0, 120) : undefined,
						choiceCount: Array.isArray(p.choices) ? p.choices.length : 0,
					});
					break;
				}

				case 'prompt.timeout': {
					const p = event.payload as { requestId?: string };
					log.debug('prompt timed out', {
						roomId,
						userId: event.targetUserId,
						requestId: p.requestId,
					});
					break;
				}

				case 'prompt.cancel': {
					const p = event.payload as { requestId?: string };
					log.debug('prompt cancelled', {
						roomId,
						userId: event.targetUserId,
						requestId: p.requestId,
					});
					break;
				}

				// ── Announce (very high volume — trace only) ──────────────────

				case 'announce': {
					if (isTraceEnabled) {
						log.trace('announce', {
							roomId,
							scope: event.scope,
							userId: event.targetUserId,
							text: event.text.slice(0, 160),
						});
					}
					break;
				}

				// ring.state and handshake are ephemeral state-sync signals — skip
				default:
					break;
			}
		},
	});

	// ── Ring internal EventEmitter hooks ────────────────────────────────────
	// The ring emits 'add' via its internal EventEmitter (not the event bus)
	// for every monster that enters — including player monsters and boss spawns.
	// 'bossWillSpawn' fires 2 minutes before the boss appears.

	const onAdd = (...args: unknown[]) => {
		const data = args[0] as { contestant: { isBoss?: boolean; monster?: { givenName?: string }; character?: { name?: string }; userId?: string } };
		const { contestant } = data;
		log.debug(contestant.isBoss ? 'boss entered ring' : 'monster entered ring', {
			roomId,
			monster: contestant.monster?.givenName,
			owner: contestant.isBoss ? 'boss' : contestant.character?.name,
			userId: contestant.isBoss ? undefined : contestant.userId,
			isBoss: contestant.isBoss ?? false,
		});
	};

	const onBossWillSpawn = (...args: unknown[]) => {
		const data = args[0] as { delay?: number } | undefined;
		log.debug('boss will spawn soon', {
			roomId,
			inMs: data?.delay ?? 120000,
		});
	};

	ring.on('add', onAdd);
	ring.on('bossWillSpawn', onBossWillSpawn);

	return () => {
		unsubscribeEventBus();
		ring.off('add', onAdd);
		ring.off('bossWillSpawn', onBossWillSpawn);
	};
}
