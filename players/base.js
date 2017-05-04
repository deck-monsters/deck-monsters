const BaseCreature = require('../creatures/base');
const { getInitialDeck } = require('../cards');
const { spawn } = require('../monsters');

const DEFAULT_MONSTER_SLOTS = 2;

class BasePlayer extends BaseCreature {
	// constructor (options) {
	// 	super(options);
	// }

	get deck () {
		if (this.options.deck === undefined) this.deck = getInitialDeck();

		return this.options.deck || [];
	}

	set deck (deck) {
		this.options = {
			deck
		};
	}

	get monsters () {
		return this.options.monsters || [];
	}

	set monsters (monsters) {
		this.options = {
			monsters
		};
	}

	get monsterSlots () {
		if (this.options.monsterSlots === undefined) this.monsterSlots = DEFAULT_MONSTER_SLOTS;

		return this.options.monsterSlots || 0;
	}

	set monsterSlots (monsterSlots) {
		this.options = {
			monsterSlots
		};
	}

	addCard (card) {
		this.cards = [...this.cards, card];
	}

	addMonster (monster) {
		this.monsters = [...this.monsters, monster];
	}

	spawnMonster (callback) {
		const remainingSlots = Math.max(this.monsterSlots - this.monsters.length, 0);

		if (remainingSlots > 0) {
			return Promise
				.resolve()
				.then(() => callback({
					announce: `You have ${remainingSlots} of ${this.monsterSlots} monsters left to train.`
				}))
				.then(() => spawn(callback))
				.then((monster) => {
					this.addMonster(monster);

					return callback({
						announce: `You're now the proud owner of ${monster.givenName}. Before you is ${monster.individualDescription}'`
					});
				});
		}

		return Promise.reject(() => callback({
			announce: "You're all out space for new monsters!"
		}));
	}
}

module.exports = BasePlayer;
