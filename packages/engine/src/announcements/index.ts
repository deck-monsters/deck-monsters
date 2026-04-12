export { announceBossWillSpawn } from './bossWillSpawn.js';
export { announceCard } from './card-played.js';
export { announceCardDrop } from './cardDrop.js';
export { announceContestant } from './contestant.js';
export { announceContestantLeave } from './contestantLeave.js';
export { announceDeath } from './death.js';
export { announceEffect } from './effect.js';
export { announceEndOfDeck } from './endOfDeck.js';
export { announceFight } from './fight.js';
export { announceFightConcludes } from './fightConcludes.js';
export { announceHeal } from './heal.js';
export { announceHit } from './hit.js';
export { announceItem } from './item-used.js';
export { announceLeave } from './leave.js';
export { announceMiss } from './miss.js';
export { announceModifier } from './modifier.js';
export { announceNarration } from './narration.js';
export { announceNextRound } from './nextRound.js';
export { announceNextTurn } from './nextTurn.js';
export { announceTurnBegin } from './playerTurnBegin.js';
export { announceRolled } from './rolled.js';
export { announceStay } from './stay.js';
export { announceXPGain } from './xpGain.js';
export { announceLevelUp } from './level-up.js';

import { announceBossWillSpawn } from './bossWillSpawn.js';
import { announceCard as announceCardPlayed } from './card-played.js';
import { announceCardDrop } from './cardDrop.js';
import { announceContestant } from './contestant.js';
import { announceContestantLeave } from './contestantLeave.js';
import { announceDeath } from './death.js';
import { announceEffect } from './effect.js';
import { announceEndOfDeck } from './endOfDeck.js';
import { announceFight } from './fight.js';
import { announceFightConcludes } from './fightConcludes.js';
import { announceHeal } from './heal.js';
import { announceHit } from './hit.js';
import { announceItem as announceItemUsed } from './item-used.js';
import { announceLeave } from './leave.js';
import { announceMiss } from './miss.js';
import { announceModifier } from './modifier.js';
import { announceNarration } from './narration.js';
import { announceNextRound } from './nextRound.js';
import { announceNextTurn } from './nextTurn.js';
import { announceTurnBegin } from './playerTurnBegin.js';
import { announceRolled } from './rolled.js';
import { announceStay } from './stay.js';
import { announceXPGain } from './xpGain.js';
import { announceLevelUp } from './level-up.js';
import type { RoomEventBus } from '../events/index.js';

function createRoomScopedEventGuard(game: any): (...args: any[]) => boolean {
	const ownsDirectly = (value: unknown): boolean => {
		if (!value || typeof value !== 'object') return false;
		if (value === game || value === game.ring || value === game.exploration) return true;

		const characters = Object.values((game.characters ?? {}) as Record<string, any>);
		for (const character of characters) {
			if (value === character) return true;

			const monsters = Array.isArray(character?.monsters) ? character.monsters : [];
			if (monsters.includes(value)) return true;

			const charItems = Array.isArray(character?.items) ? character.items : [];
			if (charItems.includes(value)) return true;

			const deck = Array.isArray(character?.deck) ? character.deck : [];
			if (deck.includes(value)) return true;

			for (const monster of monsters) {
				const cards = Array.isArray(monster?.cards) ? monster.cards : [];
				if (cards.includes(value)) return true;

				const items = Array.isArray(monster?.items) ? monster.items : [];
				if (items.includes(value)) return true;
			}
		}

		return false;
	};

	return (...args: any[]): boolean => {
		const visited = new WeakSet<object>();

		const walk = (value: unknown, depth: number): boolean => {
			if (ownsDirectly(value)) return true;
			if (depth >= 3 || !value || typeof value !== 'object') return false;

			if (visited.has(value)) return false;
			visited.add(value);

			if (Array.isArray(value)) {
				return value.some((entry) => walk(entry, depth + 1));
			}

			for (const nestedValue of Object.values(value as Record<string, unknown>)) {
				if (walk(nestedValue, depth + 1)) return true;
			}

			return false;
		};

		return args.some((arg) => walk(arg, 0));
	};
}

export function initialize(game: any): () => void {
	const eb: RoomEventBus = game.eventBus;
	const isRoomScopedEvent = createRoomScopedEventGuard(game);

	// game.on(...) listeners are wired to the process-wide semaphore, so we must
	// explicitly gate events to entities owned by this specific room/game.
	const wrapGameEvent = (fn: (eb: RoomEventBus, ...args: any[]) => void) =>
		(...args: any[]) => {
			if (!isRoomScopedEvent(...args)) return;
			fn(eb, ...args);
		};

	// ring.on(...) listeners are already instance-scoped and do not need guarding.
	const wrapRingEvent = (fn: (eb: RoomEventBus, ...args: any[]) => void) =>
		(...args: any[]) => fn(eb, ...args);

	const gameEvents: Array<{ event: string; listener: (...args: any[]) => void }> = [
		{ event: 'card.effect', listener: wrapGameEvent(announceEffect) },
		{ event: 'card.miss', listener: wrapGameEvent(announceMiss) },
		{ event: 'card.narration', listener: wrapGameEvent(announceNarration) },
		{ event: 'card.played', listener: wrapGameEvent(announceCardPlayed) },
		{ event: 'card.rolled', listener: wrapGameEvent(announceRolled) },
		{ event: 'card.stay', listener: wrapGameEvent(announceStay) },
		{ event: 'cardDrop', listener: wrapGameEvent(announceCardDrop) },
		{ event: 'creature.die', listener: wrapGameEvent(announceDeath) },
		{ event: 'creature.hit', listener: wrapGameEvent(announceHit) },
		{ event: 'creature.leave', listener: wrapGameEvent(announceLeave) },
		{ event: 'creature.modifier', listener: wrapGameEvent(announceModifier) },
		{ event: 'creature.narration', listener: wrapGameEvent(announceNarration) },
		{ event: 'gainedXP', listener: wrapGameEvent(announceXPGain) },
		{ event: 'item.narration', listener: wrapGameEvent(announceNarration) },
		{ event: 'item.used', listener: wrapGameEvent(announceItemUsed) },
		{ event: 'potion.narration', listener: wrapGameEvent(announceNarration) },
		{ event: 'potion.used', listener: wrapGameEvent(announceItemUsed) },
		{
			event: 'creature.levelUp',
			listener: (_className: string, _instance: any, { monster, level }: { monster: any; level: number }) =>
				announceLevelUp(eb, monster, level),
		},
		{ event: 'scroll.narration', listener: wrapGameEvent(announceNarration) },
		{ event: 'scroll.used', listener: wrapGameEvent(announceItemUsed) },
	];

	// Ring events must be bound to this room's ring instance (not game/global),
	// otherwise the global emitter path can mirror ring announcements across rooms.
	const ringEvents: Array<{ event: string; listener: (...args: any[]) => void }> = [
		{ event: 'add', listener: wrapRingEvent(announceContestant) },
		{ event: 'bossWillSpawn', listener: wrapRingEvent(announceBossWillSpawn) },
		{ event: 'endOfDeck', listener: wrapRingEvent(announceEndOfDeck) },
		{ event: 'fight', listener: wrapRingEvent(announceFight) },
		{ event: 'fightConcludes', listener: wrapRingEvent(announceFightConcludes) },
		{ event: 'gainedXP', listener: wrapRingEvent(announceXPGain) },
		{ event: 'narration', listener: wrapRingEvent(announceNarration) },
		{ event: 'remove', listener: wrapRingEvent(announceContestantLeave) },
		{ event: 'roundComplete', listener: wrapRingEvent(announceNextRound) },
		{ event: 'startTurn', listener: wrapRingEvent(announceNextTurn) },
		{ event: 'playerTurnBegin', listener: wrapRingEvent(announceTurnBegin) },
	];

	// Collect bound listeners so they can be removed on dispose
	const registered: Array<{ event: string; bound: (...args: any[]) => void }> = [];

	gameEvents.forEach(({ event, listener }) => {
		const bound = game.on(event, listener);
		registered.push({ event, bound });
	});

	ringEvents.forEach(({ event, listener }) => {
		const bound = game.ring.on(event, listener);
		registered.push({ event: `ring.${event}`, bound });
	});

	// heal is special: ring is passed as an extra argument before the standard args
	const healListener = (...args: any[]) => {
		if (!isRoomScopedEvent(...args)) return;
		(announceHeal as (...a: any[]) => void)(eb, game.ring, ...args);
	};
	const boundHeal = game.on('creature.heal', healListener);
	registered.push({ event: 'creature.heal', bound: boundHeal });

	return () => {
		registered.forEach(({ event, bound }) => {
			if (event.startsWith('ring.')) {
				game.ring.off(event.replace(/^ring\./, ''), bound);
				return;
			}
			game.off(event, bound);
		});
	};
}
