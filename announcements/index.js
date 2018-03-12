const announceBossWillSpawn = require('./boss-will-spawn.js');
const announceCardDrop = require('./card-drop.js');
const announceCardPlayed = require('./card-played.js');
const announceContestant = require('./contestant.js');
const announceContestantLeave = require('./contestant-leave.js');
const announceDeath = require('./death.js');
const announceDiscoveryFound = require('./discovery-found.js');
const announceEffect = require('./effect.js');
const announceEndOfDeck = require('./end-of-deck.js');
const announceFight = require('./fight.js');
const announceFightConcludes = require('./fight-concludes.js');
const announceHeal = require('./heal.js');
const announceHit = require('./hit.js');
const announceItemUsed = require('./item-used.js');
const announceLeave = require('./leave.js');
const announceMiss = require('./miss.js');
const announceModifier = require('./modifier.js');
const announceNarration = require('./narration.js');
const announceNextRound = require('./next-round.js');
const announceNextTurn = require('./next-turn.js');
const announceRolled = require('./rolled.js');
const announceStay = require('./stay.js');
const announceTurnBegin = require('./player-turn-begin.js');
const announceXPGain = require('./xp-gain.js');

const initialize = (game) => {
	const events = [
		{ event: 'card.effect', listener: announceEffect },
		{ event: 'card.miss', listener: announceMiss },
		{ event: 'card.narration', listener: announceNarration },
		{ event: 'card.played', listener: announceCardPlayed },
		{ event: 'card.rolled', listener: announceRolled },
		{ event: 'card.stay', listener: announceStay },
		{ event: 'cardDrop', listener: announceCardDrop },
		{ event: 'creature.die', listener: announceDeath },
		{ event: 'creature.heal', listener: announceHeal },
		{ event: 'creature.hit', listener: announceHit },
		{ event: 'creature.leave', listener: announceLeave },
		{ event: 'creature.modifier', listener: announceModifier },
		{ event: 'creature.narration', listener: announceNarration },
		{ event: 'discovery.found', listener: announceDiscoveryFound },
		{ event: 'discovery.narration', listener: announceNarration },
		{ event: 'exploration.found', listener: announceDiscoveryFound },
		{ event: 'exploration.narration', listener: announceNarration },
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
		{ event: 'ring.narration', listener: announceNarration },
		{ event: 'ring.remove', listener: announceContestantLeave },
		{ event: 'ring.roundComplete', listener: announceNextRound },
		{ event: 'ring.startTurn', listener: announceNextTurn },
		{ event: 'ring.playerTurnBegin', listener: announceTurnBegin },
		{ event: 'scroll.narration', listener: announceNarration },
		{ event: 'scroll.used', listener: announceItemUsed }
	];

	events.map(event => game.on(event.event, (...args) => {
		event.listener(...args);
	}));
};

module.exports = {
	initialize
};
