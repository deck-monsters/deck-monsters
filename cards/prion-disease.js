/* eslint-disable max-len, no-irregular-whitespace */

const BaseCard = require('./base');

const random = require('lodash.random');

const { EPIC } = require('../helpers/probabilities');
const { EXPENSIVE } = require('../helpers/costs');
const { TARGET_ALL_CONTESTANTS, getTarget } = require('../helpers/targeting-strategies');

class PrionDiseaseCard extends BaseCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		icon = '旦'
	} = {}) {
		super({ icon });
	}

	getHPModifier (player, target) { // eslint-disable-line class-methods-use-this
		let modification = random(0, 3);

		if (target === player) {
			if (random(1, 100) === 13) {
				modification = -target.hp;
			} else {
				modification++;
			}
		} else if (random(1, 50) === 13) {
			modification = -target.hp;
		}

		return modification;
	}

	get levelDamage () {
		return this.options.levelDamage;
	}

	get stats () { // eslint-disable-line class-methods-use-this
		return `Serve everyone a nice round of milkshakes!
Usually restores between 0-3hp to each opponent, and 1-4hp for the player.
1:50 chance to kill each opponent.
1:100 chance to kill yourself.`;
	}

	getTargets (player, proposedTarget, ring, activeContestants) { // eslint-disable-line class-methods-use-this
		return getTarget({
			contestants: activeContestants,
			ignoreSelf: false,
			playerMonster: player,
			strategy: TARGET_ALL_CONTESTANTS,
			team: false
		}).map(({ monster }) => monster);
	}

	effect (player, target) {
		const hpChange = this.getHPModifier(player, target);
		let narration = `
　　∧,,,∧
　 （ ・ω・） ${target.givenName} likes milkshake!
　　( つ旦O
　　と＿)_)

　　∧,,,∧
　 （ ・◎・） slrrrp
　　(　ﾞノ ヾ
　　と＿)_)

`;


		if (hpChange < 0) {
			narration += `
　　∧,,,∧
　 （ ・ω・） Hmm, tastes like prion disease...
　　( つ旦O
　　と＿)_)

　　∧,,,∧
　 （ ・ω・）
　　( つ　O. __
　　と＿)_) （__(）､;.o：。
　　　　　　　　　　ﾟ*･:.｡
　 　　　 _ _　 ξ
　　　 (´ 　 ｀ヽ、　　 　 __
　　⊂,_と（　 　 ）⊃　 （__(）､;.o：。
　　　　　　Ｖ　Ｖ　　　　　　 　 　 ﾟ*･:.｡
`;
		} else {
			let hearts = '';
			for (let i = 0; i < hpChange; i++) {
				hearts += '♥︎';
			}
			narration += `
　　∧,,,∧
　 （ ・ω・） tastes delicious!
　　( つ旦O   ${hearts}
　　と＿)_)
`;
		}

		this.emit('narration', {
			narration
		});

		if (hpChange < 0) {
			return target.hit(-hpChange, player, this);
		} else if (hpChange > 0) {
			return target.heal(hpChange, player, this);
		}

		return true;
	}
}

PrionDiseaseCard.cardType = '1993-09-7202 18:58';
PrionDiseaseCard.probability = EPIC.probability;
PrionDiseaseCard.description = 'Buy a questionable round of milkshakes for everyone.';
PrionDiseaseCard.level = 2;
PrionDiseaseCard.cost = EXPENSIVE.cost;
PrionDiseaseCard.isAreaOfEffect = true;
PrionDiseaseCard.notForSale = true;

PrionDiseaseCard.flavors = {
	hits: [
		['gives prion disease to', 80],
		['poisons', 70],
		['calls user ( ˃ ヮ˂) to give a history lesson to', 5],
		['invokes an ancient ascii art joke against', 5]
	]
};

module.exports = PrionDiseaseCard;
