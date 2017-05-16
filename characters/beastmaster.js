const BaseCharacter = require('./base');
const { spawn, equip } = require('../monsters');
const { getMonsterChoices } = require('../helpers/choices');

const { monsterCard } = require('../helpers/card');

const DEFAULT_MONSTER_SLOTS = 2;

class Beastmaster extends BaseCharacter {
	constructor (options) {
		const defaultOptions = {
			monsterSlots: DEFAULT_MONSTER_SLOTS
		};

		super(Object.assign(defaultOptions, options));
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

	addMonster (monster) {
		this.monsters = [...this.monsters, monster];

		this.emit('monsterAdded', { monster });
	}

	dropMonster (monsterToBeDropped) {
		this.monsters = this.monsters.filter(monster => monster !== monsterToBeDropped);

		this.emit('monsterDropped', { monsterToBeDropped });
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
							announce: `You're now the proud owner of a ${monster.name}. Before you is ${monsterCard(monster)}`
						}))
						.then(() => monster);
				});
		}

		return Promise.reject(channel({
			announce: "You're all out space for new monsters!"
		}));
	}

	chooseMonster ({ channel, monsters = this.monsters, monsterName, action = 'pick' }) {
		return Promise
			.resolve(monsters.length)
			.then((numberOfMonsters) => {
				if (numberOfMonsters <= 0) {
					return Promise.reject(channel({
						announce: `You don't have any monsters to ${action}.`
					}));
				} else if (monsterName) {
					const monster = monsters.find(
						potentialMonster => potentialMonster.givenName.toLowerCase() === monsterName.toLowerCase()
					);

					if (monster) {
						return monster;
					}

					return Promise.reject(channel({
						announce: `You don't have a living monster named ${monsterName}.`
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
Which monster would you like to ${action}?`,
						choices: Object.keys(monsters)
					}))
					.then(answer => monsters[answer]);
			});
	}

	equipMonster ({ monsterName, channel }) {
		const monsters = this.monsters.filter(monster => !monster.dead);

		return Promise
			.resolve(monsters.length)
			.then((numberOfMonsters) => {
				if (numberOfMonsters <= 0) {
					return Promise.reject(channel({
						announce: "You don't have any living monsters to equip. Spawn one first, or wait for your dead monsters to revive." // eslint-disable-line max-len
					}));
				}

				return this.chooseMonster({ channel, monsters, monsterName, action: 'equip' });
			})
			.then(monster => equip(this.deck, monster, channel)
				.then((cards) => {
					monster.cards = cards;
					return monster;
				}))
			.then(monster => channel({
				announce: `${monster.givenName} is good to go!`
			})
				.then(() => monster));
	}

	callMonsterOutOfTheRing ({ monsterName, ring, channel, channelName }) {
		const character = this;
		let monster = monsterName;
		// If monster is an empty object or string, it means they didn't pass anything through
		if (!monster || Object.keys(monster).length === 0) {
			monster = ring.contestants.find(contestant => contestant.character.name === character.name).monster;
		}
		const monsterInRing = ring.contestants.filter(contestant => contestant.monster.name === monster.name);

		return Promise
			.resolve()
			.then(() => {
				if (monsterInRing && monsterInRing.length > 0) {
					return ring.removeMonster(monster, character, channel, channelName);
				}

				return Promise.reject(channel({
					announce: "You don't have any monsters in the ring."
				}));
			});
	}

	sendMonsterToTheRing ({ monsterName, ring, channel, channelName }) {
		const character = this;
		const alreadyInRing = ring.contestants.filter(contestant => contestant.character === character);
		const monsters = this.monsters.filter(monster => !monster.dead);

		return Promise
			.resolve(monsters.length)
			.then((numberOfMonsters) => {
				// For now, each beastmaster can only have one monster in the ring at a time
				if (alreadyInRing && alreadyInRing.length > 0) {
					return Promise.reject(channel({
						announce: 'You already have a monster in the ring!'
					}));
				} else if (numberOfMonsters <= 0) {
					return Promise.reject(channel({
						announce: "You don't have any living monsters to send into battle. Spawn one first, or wait for your dead monsters to revive." // eslint-disable-line max-len
					}));
				}

				return this.chooseMonster({ channel, monsters, monsterName, action: 'send into battle' });
			})
			.then((monster) => {
				if (monster.cards.length <= 0) {
					return Promise.reject(channel({
						announce: 'Only an evil master would send their monster into battle without any cards.'
					}));
				}

				return ring.addMonster(monster, character, channel, channelName);
			});
	}

	dismissMonster ({ monsterName, channel }) {
		const monsters = this.monsters.filter(monster => monster.dead);

		return Promise
			.resolve(monsters.length)
			.then((numberOfMonsters) => {
				if (numberOfMonsters <= 0) {
					return Promise.reject(channel({
						announce: "You don't have any monsters eligible for dismissal." // eslint-disable-line max-len
					}));
				}

				return this.chooseMonster({ channel, monsters, monsterName, action: 'dismiss' });
			})
			.then((monster) => {
				this.dropMonster(monster);

				return monster;
			})
			.then(monster => channel({
				announce: `${monster.givenName} has been dismissed from your pack.`
			})
				.then(() => monster));
	}

	reviveMonster ({ monsterName, channel }) {
		const monsters = this.monsters.filter(monster => monster.dead);

		return Promise
			.resolve(monsters.length)
			.then((numberOfMonsters) => {
				if (numberOfMonsters <= 0) {
					return Promise.reject(channel({
						announce: "You don't have any monsters to revive." // eslint-disable-line max-len
					}));
				}

				return this.chooseMonster({ channel, monsters, monsterName, action: 'revive' });
			})
			.then((monster) => {
				monster.respawn();

				return monster;
			})
			.then(monster => channel({
				announce: `${monster.givenName} has begun to revive.`
			})
				.then(() => monster));
	}
}

Beastmaster.creatureType = 'Beastmaster';

module.exports = Beastmaster;
