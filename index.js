const reduce = require('lodash.reduce');

const { globalSemaphore } = require('./helpers/semaphore');
const Ring = require('./ring');
const { draw } = require('./cards');
const { all } = require('./monsters');
const { Player } = require('./players');

const { getFlavor } = require('./helpers/flavor');

class Game {
	constructor (publicChannel) {
		this.ring = new Ring();
		this.semaphore = globalSemaphore;
		this.publicChannel = publicChannel;
		this.players = {};
		this.initializeEvents();

		publicChannel({
			announce: 'init'
		});

		this.emit('initialized');
	}

	initializeEvents () {
		// Initialize Messaging
		// TO-DO: Add messaging for rolls, fleeing, bonus cards, etc
		this.on('card.miss', this.announceMiss);
		this.on('creature.hit', this.announceHit);
		this.on('creature.heal', this.announceHeal);
		this.on('ring.fight', this.announceFight);
		this.on('ring.fightConcludes', this.announceFightConcludes);

		// Manage Fights
		this.on('creature.win', this.handleWinner);
		this.on('creature.loss', this.handleLoser);
		this.on('ring.fightConcludes', this.clearRing);
	}

	announceHit (clasName, monster, { assailant, damage }) {
		const channel = this.publicChannel;

		let icon = '🤜';
		if (damage >= 10) {
			icon = '🔥';
		} else if (damage >= 5) {
			icon = '🔪';
		} else if (damage === 1) {
			icon = '🏓';
		}

		/* eslint-disable max-len */
		channel({
			announce: `${assailant.icon}  ${icon} ${monster.icon}    ${assailant.givenName} ${getFlavor('hits')} ${monster.givenName} for ${damage} damage`
		});
		/* eslint-enable max-len */
	}

	announceHeal (clasName, monster, { amount }) {
		const channel = this.publicChannel;

		/* eslint-disable max-len */
		channel({
			announce: `${monster.icon} 💊       ${monster.givenName} heals ${amount} hp`
		});
		/* eslint-enable max-len */
	}

	announceMiss (clasName, card, { attackResult, curseOfLoki, player, target }) {
		const channel = this.publicChannel;

		let action = 'is blocked by';
		let flavor = '';
		let icon = '🛡';

		if (curseOfLoki) {
			action = 'misses';
			flavor = 'horribly';
			icon = '💨';
		} else if (attackResult > 5) {
			action = 'is barely blocked by';
			icon = '⚔️';
		}

		/* eslint-disable max-len */
		channel({
			announce: `${player.icon} ${icon}  ${target.icon}    ${player.givenName} ${action} ${target.givenName} ${flavor}`
		});
		/* eslint-enable max-len */
	}

	announceFight (clasName, ring, { contestants, rounds }) {
		const channel = this.publicChannel;
		const monsterA = contestants[0].monster;
		const monsterB = contestants[1].monster;

		channel({
			announce: `${monsterA.icon}  vs  ${monsterB.icon}`
		});
	}

	announceFightConcludes (clasName, game, { contestants, deadContestants, deaths, isDraw, rounds }) {
		const channel = this.publicChannel;
		const monsterA = contestants[0].monster;
		const monsterB = contestants[1].monster;

		channel({
			announce: `${monsterA.icon}  vs  ${monsterB.icon}    fight concludes`
		});
	}

	handleWinner (clasName, monster, { contestant }) {
		// Award XP draw a card, maybe kick off more events (that could be messaged)
	}

	handleLoser (clasName, monster, { contestant }) {
		// Award XP draw a card, maybe kick off more events (that could be messaged)
	}

	clearRing () {
		this.ring.clearRing();
	}

	getPlayer ({ id, name }) {
		const ring = this.ring;
		let player = this.players[id];

		if (!player) {
			player = new Player({
				name
			});

			this.players[id] = player;

			this.emit('playerCreated', { player });
		}

		return {
			spawnMonster (channel, options) {
				return player.spawnMonster(channel, options || {});
			},
			equipMonster (channel, options) {
				return player.equipMonster(channel, options || {});
			},
			sendMonsterToTheRing (channel, options) {
				return player.sendMonsterToTheRing(ring, channel, options || {});
			}
		};
	}

	static getMonsterTypes () {
		return all.reduce((obj, Monster) => {
			obj[Monster.monsterType] = Monster;
			return obj;
		}, {});
	}

	getAllMonsters () {
		return reduce(this.players, (obj, player) => {
			player.monsters.forEach((monster) => {
				obj[monster.givenName] = monster;
			});

			return obj;
		}, {});
	}

	drawCard (options) {
		const card = draw(options);

		this.emit('cardDrawn', { card });

		return card;
	}

	emit (event, ...args) {
		this.semaphore.emit(`game.${event}`, this.name, this, ...args);
	}

	on (event, func) {
		this.semaphore.on(event, func.bind(this));
	}
}

module.exports = Game;
