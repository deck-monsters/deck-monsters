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

interface EventListener {
	event: string;
	listener: (...args: any[]) => void;
}

export function initialize(game: any): void {
	const events: EventListener[] = [
		{ event: 'card.effect', listener: announceEffect },
		{ event: 'card.miss', listener: announceMiss },
		{ event: 'card.narration', listener: announceNarration },
		{ event: 'card.played', listener: announceCardPlayed },
		{ event: 'card.rolled', listener: announceRolled },
		{ event: 'card.stay', listener: announceStay },
		{ event: 'cardDrop', listener: announceCardDrop },
		{ event: 'creature.die', listener: announceDeath },
		{ event: 'creature.hit', listener: announceHit },
		{ event: 'creature.leave', listener: announceLeave },
		{ event: 'creature.modifier', listener: announceModifier },
		{ event: 'creature.narration', listener: announceNarration },
		{ event: 'gainedXP', listener: announceXPGain },
		{ event: 'item.narration', listener: announceNarration },
		{ event: 'item.used', listener: announceItemUsed },
		{ event: 'potion.narration', listener: announceNarration },
		{ event: 'potion.used', listener: announceItemUsed },
		{ event: 'ring.add', listener: announceContestant },
		{ event: 'ring.bossWillSpawn', listener: announceBossWillSpawn },
		{ event: 'ring.endOfDeck', listener: announceEndOfDeck },
		{ event: 'ring.fight', listener: announceFight },
		{ event: 'ring.fightConcludes', listener: announceFightConcludes },
		{ event: 'ring.gainedXP', listener: announceXPGain },
		{ event: 'creature.levelUp', listener: (_className: string, _instance: any, { monster, level }: { monster: any; level: number }) =>
			announceLevelUp(game.publicChannel, monster, level) },
		{ event: 'ring.narration', listener: announceNarration },
		{ event: 'ring.remove', listener: announceContestantLeave },
		{ event: 'ring.roundComplete', listener: announceNextRound },
		{ event: 'ring.startTurn', listener: announceNextTurn },
		{ event: 'ring.playerTurnBegin', listener: announceTurnBegin },
		{ event: 'scroll.narration', listener: announceNarration },
		{ event: 'scroll.used', listener: announceItemUsed },
	];

	events.forEach(event =>
		game.on(event.event, (...args: any[]) => {
			event.listener(game.publicChannel, game.channelManager, ...args);
		}),
	);

	// heal is special: it receives ring as an extra argument before the standard args
	game.on('creature.heal', (...args: any[]) => {
		(announceHeal as (...a: any[]) => void)(game.publicChannel, game.channelManager, game.ring, ...args);
	});
}
