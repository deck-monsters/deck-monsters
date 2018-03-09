const CurseCard = require('./curse');

const { BARBARIAN } = require('../constants/creature-classes');

const { ACOUSTIC, PSYCHIC } = require('../constants/card-classes');

const { VERY_RARE } = require('../helpers/probabilities');
const { PRICEY } = require('../helpers/costs');

class Woke extends CurseCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		curseAmount,
		icon = '🤬',
		cursedProp,
		hasChanceToHit,
		...rest
	} = {}) {
		super({ icon, ...rest });
	}

	get boosts () {
		return this.constructor.boosts;
	}

	get stats () {
		const wokeStats = this.boosts.map(boost => `Boost player: ${boost.prop} +${boost.amount}`);
		wokeStats.push(`Curses all players: ${this.cursedProp} ${this.curseAmount}`);
		return wokeStats.join('\r');
	}

	getTargets (player) { // eslint-disable-line class-methods-use-this
		return [player];
	}

	getCurseNarrative (player, target) { // eslint-disable-line class-methods-use-this
		const targetName = target.givenName === player.givenName ? `${player.pronouns.him}self` : target.givenName;
		return `${player.givenName} skillfully fires off a flury of tweets targetting ${targetName}. They both get dumber.`;
	}

	getCurseOverflowNarrative (player, target) {
		const playerName = target.givenName === player.givenName ? player.pronouns.his : `${player.givenName}'s`;
		return `${target.givenName}'s ${this.cursedProp} penalties have been maxed out.
${playerName} switches tactics...`;
	}

	effect (player, target, ring, activeContestants) {
		this.boosts.forEach(boost => target.setModifier(boost.prop, boost.amount));
		activeContestants.forEach((contestant) => {
			super.effect(player, contestant.monster, ring);
		});

		return !player.dead;
	}
}

Woke.cardClass = [ACOUSTIC, PSYCHIC];
Woke.probability = VERY_RARE.probability;
Woke.cardType = 'Woke';
Woke.permittedClassesAndTypes = [BARBARIAN];
Woke.description = 'POTUS tweets and everyone gets dumber. But in you, it brings about a certain rage... A certain WOKENESS most people don\'t actually want. It\'s what you live for. It\'s how you know you exist. You embrace it a welcome the rush.'; // eslint-disable-line max-len
Woke.cost = PRICEY.cost;
Woke.noBosses = true;
Woke.notForSale = true;
Woke.boosts = [
	{ prop: 'str', amount: 1 },
	{ prop: 'ac', amount: 1 }
];

Woke.defaults = {
	...CurseCard.defaults,
	curseAmount: -1,
	cursedProp: 'int',
	hasChanceToHit: false
};

Woke.flavors = {
	hits: [
		['reacts poorly to a truly very extremely idiotic tweet, cowardly holding down the button of their air-horn towards', 80], // eslint-disable-line max-len
		['riles up the crowd into a mob-like frenzy until they pelt the entire battlefield with poorly aimed stones, which end up hitting', 70], // eslint-disable-line max-len
		['becomes internet-outraged and screams through a bull-horn at', 80],
		['gets a large group of people to loudly scream nonsense to prohibit any discussion at', 50],
		['turns their tactic of screaming at any "fascist" who disagrees with them until the person face-palms them-self so hard it hurts in the direction of', 10], // eslint-disable-line max-len
		['manifests a predilection towards contradictory incomprehensible paradoxic sophist lexicomanarianism all in under 240 characters, erudition of which induces mental anguish in', 5], // eslint-disable-line max-len
		['pulls out a wine-skin and squeezes it just right to project a fine-mist-jet-stream of stinging-pepper-water in the direction of', 5], // eslint-disable-line max-len
		['puts a pair of cat-ears on their head, and screams non-sense through a bull-horn at', 5],
		['puts on, head-to-toe, red (for no obvious reason) and for the time being devotes their entire life to screaming insults at', 5], // eslint-disable-line max-len
		['dons all black, holds an incomprehensible sign, twirls a noise-maker, stomps their feet, and beats on windows and doors while mindlessly repeating whatever someone else is yelling through a bullhorn for them to say in an effort to silence', 5] // eslint-disable-line max-len
	]
};

module.exports = Woke;
