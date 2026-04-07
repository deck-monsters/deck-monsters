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

export function initialize(game: any): () => void {
	const eb: RoomEventBus = game.eventBus;

	const wrap = (fn: (eb: RoomEventBus, ...args: any[]) => void) =>
		(...args: any[]) => fn(eb, ...args);

	const events: Array<{ event: string; listener: (...args: any[]) => void }> = [
		{ event: 'card.effect', listener: wrap(announceEffect) },
		{ event: 'card.miss', listener: wrap(announceMiss) },
		{ event: 'card.narration', listener: wrap(announceNarration) },
		{ event: 'card.played', listener: wrap(announceCardPlayed) },
		{ event: 'card.rolled', listener: wrap(announceRolled) },
		{ event: 'card.stay', listener: wrap(announceStay) },
		{ event: 'cardDrop', listener: wrap(announceCardDrop) },
		{ event: 'creature.die', listener: wrap(announceDeath) },
		{ event: 'creature.hit', listener: wrap(announceHit) },
		{ event: 'creature.leave', listener: wrap(announceLeave) },
		{ event: 'creature.modifier', listener: wrap(announceModifier) },
		{ event: 'creature.narration', listener: wrap(announceNarration) },
		{ event: 'gainedXP', listener: wrap(announceXPGain) },
		{ event: 'item.narration', listener: wrap(announceNarration) },
		{ event: 'item.used', listener: wrap(announceItemUsed) },
		{ event: 'potion.narration', listener: wrap(announceNarration) },
		{ event: 'potion.used', listener: wrap(announceItemUsed) },
		{ event: 'ring.add', listener: wrap(announceContestant) },
		{ event: 'ring.bossWillSpawn', listener: wrap(announceBossWillSpawn) },
		{ event: 'ring.endOfDeck', listener: wrap(announceEndOfDeck) },
		{ event: 'ring.fight', listener: wrap(announceFight) },
		{ event: 'ring.fightConcludes', listener: wrap(announceFightConcludes) },
		{ event: 'ring.gainedXP', listener: wrap(announceXPGain) },
		{
			event: 'creature.levelUp',
			listener: (_className: string, _instance: any, { monster, level }: { monster: any; level: number }) =>
				announceLevelUp(eb, monster, level),
		},
		{ event: 'ring.narration', listener: wrap(announceNarration) },
		{ event: 'ring.remove', listener: wrap(announceContestantLeave) },
		{ event: 'ring.roundComplete', listener: wrap(announceNextRound) },
		{ event: 'ring.startTurn', listener: wrap(announceNextTurn) },
		{ event: 'ring.playerTurnBegin', listener: wrap(announceTurnBegin) },
		{ event: 'scroll.narration', listener: wrap(announceNarration) },
		{ event: 'scroll.used', listener: wrap(announceItemUsed) },
	];

	// Collect bound listeners so they can be removed on dispose
	const registered: Array<{ event: string; bound: (...args: any[]) => void }> = [];

	events.forEach(({ event, listener }) => {
		const bound = game.on(event, listener);
		registered.push({ event, bound });
	});

	// heal is special: ring is passed as an extra argument before the standard args
	const healListener = (...args: any[]) => {
		(announceHeal as (...a: any[]) => void)(eb, game.ring, ...args);
	};
	const boundHeal = game.on('creature.heal', healListener);
	registered.push({ event: 'creature.heal', bound: boundHeal });

	return () => {
		registered.forEach(({ event, bound }) => game.off(event, bound));
	};
}
