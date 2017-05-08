const BaseCreature = require('../creatures/base');
const { getInitialDeck } = require('../cards');
const { spawn, equip } = require('../monsters');
const { getMonsterChoices } = require('../helpers/choices');

const DEFAULT_MONSTER_SLOTS = 2;

class BasePlayer extends BaseCreature {
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
		this.deck = [...this.deck, card];

		this.emit('cardAdded', { card });
	}

	addMonster (monster) {
		this.monsters = [...this.monsters, monster];

		this.emit('monsterAdded', { monster });
	}

	spawnMonster (channel, options) {
		const remainingSlots = Math.max(this.monsterSlots - this.monsters.length, 0);

		if (remainingSlots > 0) {
			return Promise
				.resolve()
				.then(() => channel({
					announce: `You have ${remainingSlots} of ${this.monsterSlots} monsters left to train.`
				}))
				.then(() => spawn(channel, options))
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

		return Promise.reject(channel({
			announce: "You're all out space for new monsters!"
		}));
	}

	equipMonster (channel) {
		const monsters = this.monsters.filter(monster => !monster.dead);

		return Promise
			.resolve(monsters.length)
			.then((numberOfMonsters) => {
				if (numberOfMonsters <= 0) {
					return Promise.reject(channel({
						announce: "You don't have any monsters to equip. Spawn one first!"
					}));
				} else if (numberOfMonsters === 1) {
					return monsters[0];
				}

				return Promise
					.resolve()
					.then(() => channel({
						question:
`You have ${numberOfMonsters} monsters:

${getMonsterChoices(monsters)}
Which monster would you like to equip?`,
						choices: Object.keys(monsters)
					}))
					.then(answer => monsters[answer]);
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

	sendMonsterToTheRing (ring, channel) {
		const monsters = this.monsters.filter(monster => !monster.dead);
		const player = this;

		return Promise
			.resolve(monsters.length)
			.then((numberOfMonsters) => {
				if (numberOfMonsters <= 0) {
					return Promise.reject(channel({
						announce: "You don't have any monsters to send into battle. Spawn one first!"
					}));
				} else if (numberOfMonsters === 1) {
					return monsters[0];
				}

				return Promise
					.resolve()
					.then(() => channel({
						question:
`You have ${numberOfMonsters} monsters:

${getMonsterChoices(monsters)}
Which monster would you like to send into battle?`,
						choices: Object.keys(monsters)
					}))
					.then(answer => monsters[answer]);
			})
			.then((monster) => {
				if (monster.cards.length <= 0) {
					return Promise.reject(channel({
						announce: 'Only an evil master would send their monster into battle without any cards.'
					}));
				}

				return ring.addMonster(monster, player, channel);
			});
	}
}

module.exports = BasePlayer;
