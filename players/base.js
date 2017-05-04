const BaseCreature = require('../creatures/base');
const { getInitialDeck } = require('../cards');
const { spawn, equip } = require('../monsters');

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
		this.setOptions({
			deck
		});
	}

	get monsters () {
		return this.options.monsters || [];
	}

	set monsters (monsters) {
		this.setOptions({
			monsters
		});
	}

	get monsterSlots () {
		if (this.options.monsterSlots === undefined) this.monsterSlots = DEFAULT_MONSTER_SLOTS;

		return this.options.monsterSlots || 0;
	}

	set monsterSlots (monsterSlots) {
		this.setOptions({
			monsterSlots
		});
	}

	addCard (card) {
		this.cards = [...this.cards, card];
	}

	addMonster (monster) {
		this.monsters = [...this.monsters, monster];
	}

	spawnMonster (channel) {
		const remainingSlots = Math.max(this.monsterSlots - this.monsters.length, 0);

		if (remainingSlots > 0) {
			return Promise
				.resolve()
				.then(() => channel({
					announce: `You have ${remainingSlots} of ${this.monsterSlots} monsters left to train.`
				}))
				.then(() => spawn(channel))
				.then((monster) => {
					this.addMonster(monster);

					return Promise
						.resolve()
						.then(() => channel({
							announce: `You're now the proud owner of ${monster.givenName}. Before you is ${monster.individualDescription}'`
						}))
						.then(() => monster);
				});
		}

		return Promise.reject(() => channel({
			announce: "You're all out space for new monsters!"
		}));
	}

	equipMonster (channel) {
		const formatMonsters = monsters => monsters
			.map((monster, index) => `${index}) ${monster.givenName}: ${monster.individualDescription}` + '\n'); // eslint-disable-line no-useless-concat

		return Promise
			.resolve(this.monsters.length)
			.then((numberOfMonsters) => {
				if (numberOfMonsters <= 0) {
					channel({
						announce: "You don't have an monsters to equip. Spawn one first!"
					});

					return Promise.reject();
				} else if (numberOfMonsters === 1) {
					return this.monsters[0];
				}

				return Promise
					.resolve()
					.then(() => channel({
						question:
`You have ${numberOfMonsters} monsters:
${formatMonsters(this.monsters)}
Which monster would you like to equip?`,
						choices: Object.keys(this.monsters)
					}))
					.then(answer => this.monsters[answer]);
			})
			.then(monster => equip(this.deck, monster, channel)
				.then((cards) => {
					monster.cards = cards;
					return monster;
				}))
			.then((monster) => {
				channel({
					announce: `${monster.givenName} is good to go!`
				});

				return monster;
			});
	}
}

module.exports = BasePlayer;
