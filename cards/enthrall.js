/* eslint-disable max-len */
const Promise = require('bluebird');

const ImmobilizeCard = require('./immobilize');

const { PSYCHIC } = require('../constants/card-classes');
const { UNCOMMON } = require('../helpers/probabilities');
const { REASONABLE } = require('../helpers/costs');
const { TARGET_ALL_CONTESTANTS, getTarget } = require('../helpers/targeting-strategies');

const {
	BASILISK,
	GLADIATOR,
	JINN,
	MINOTAUR,
	WEEPING_ANGEL
} = require('../constants/creature-types');

class EnthrallCard extends ImmobilizeCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		freedomSavingThrowTargetAttr,
		targetProp,
		icon = '🎇',
		...rest
	} = {}) {
		super({ freedomSavingThrowTargetAttr, icon, targetProp, ...rest });
	}

	get mechanics () { // eslint-disable-line class-methods-use-this
		return 'Immobilize all opponents.';
	}

	get stats () {
		return `${this.mechanics}

${super.stats}`;
	}

	getTargets (player) { // eslint-disable-line class-methods-use-this
		return [player];
	}

	effect (player, target, ring, activeContestants) {
		if (player === target) {
			this.emit('narration', {
				narration: `${player.givenName} prepares ${player.pronouns.him}self to ${this.actions.IMMOBILIZE} ${player.pronouns.his} targets.`
			});
		} else {
			this.emit('narration', {
				narration: `${player.givenName} is confused and uses ${player.pronouns.his} power to help ${target.givenName} ${this.actions.IMMOBILIZE} ${target.pronouns.his} targets.`
			});
		}

		const targets = getTarget({
			contestants: activeContestants,
			playerMonster: target,
			strategy: TARGET_ALL_CONTESTANTS
		}).map(({ monster }) => monster);

		return Promise.mapSeries(targets, newTarget => super.effect(target, newTarget, ring, activeContestants))
			.then(results => results.reduce((result, val) => result && val, true));
	}
}

EnthrallCard.cardClass = [PSYCHIC];
EnthrallCard.cardType = 'Enthrall';
EnthrallCard.actions = { IMMOBILIZE: 'enthrall', IMMOBILIZES: 'enthralls', IMMOBILIZED: 'enthralled' };
EnthrallCard.permittedClassesAndTypes = [WEEPING_ANGEL];
EnthrallCard.strongAgainstCreatureTypes = [BASILISK, GLADIATOR];
EnthrallCard.weakAgainstCreatureTypes = [MINOTAUR, WEEPING_ANGEL];
EnthrallCard.uselessAgainstCreatureTypes = [JINN];
EnthrallCard.probability = UNCOMMON.probability;
EnthrallCard.description = `You strut and preen. Your beauty ${EnthrallCard.actions.IMMOBILIZES} everyone, except yourself.`;
EnthrallCard.level = 2;
EnthrallCard.cost = REASONABLE.cost;

EnthrallCard.defaults = {
	...ImmobilizeCard.defaults,
	freedomSavingThrowTargetAttr: 'int',
	targetProp: 'int'
};

EnthrallCard.flavors = {
	hits: [
		['stuns', 80],
		['uses their natural beauty to incapacitate', 30],
		['burns even Narcissus himself with their beauty... Which leaves no hope for', 5]
	]
};

module.exports = EnthrallCard;
