/* eslint-disable max-len */

const BaseCard = require('./base');

const random = require('lodash.random');

const { CLERIC } = require('../helpers/classes');
const { EPIC } = require('../helpers/probabilities');
const { EXPENSIVE } = require('../helpers/costs');

class BlastCard extends BaseCard {
	// Set defaults for these values that can be overridden by the options passed in
	constructor ({
		icon = '旦'
	} = {}) {
		super({ icon });
	}

	get damage (player, target) {
		const damage = 0;

		if (target === player) {
			if (random(1, 1000) === 13) {
				damage = target.hp;
			}
		} else {
			if (random(1, 100) === 13) {
				damage = target.hp;
			}
		}

		return damage;
	}

	get levelDamage () {
		return this.options.levelDamage;
	}

	get stats () {
		return `Blast: ${this.damage} base damage +${this.levelDamage} per level of the caster`;
	}

	getTargets (player, proposedTarget, ring, activeContestants) { // eslint-disable-line class-methods-use-this
		return activeContestants;
	}

	effect (player, target) {
		const damage = this.damage(player, target);
		let narration = `
　　∧,,,∧
　 （ ・ω・） ${target.givenName} likes milkshake!
　　( つ旦O
　　と＿)_)

　　∧,,,∧
　 （ ・◎・） slrrrp
　　(　ﾞノ ヾ
　　と＿)_)

`


		if (damage > 0) {
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
`
		} else {
			narration += `

　　∧,,,∧
　 （ ・ω・） tastes delicious!
　　( つ旦O
　　と＿)_)
`
		}

		this.emit('narration', {
			narration
		});

		if (damage > 0) {
			return target.hit(damage, player, this);
		}

		return true;
	}
}

BlastCard.cardType = '( ˃ ヮ˂) : 1993-09-7202 18:58';
BlastCard.permittedClassesAndTypes = [CLERIC];
BlastCard.probability = EPIC.probability;
BlastCard.description = 'Buy a questionable round of milkshakes for everyone.';
BlastCard.level = 2;
BlastCard.cost = EXPENSIVE.cost;
BlastCard.isAreaOfEffect = true;

BlastCard.flavors = {
	hits: [
		['gives prion disease to', 80],
		['poisons', 70],
		['invokes an ancient ascii art joke against', 5]
	]
};

module.exports = BlastCard;
