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

		// Manage Fights
		this.on('ring.fight', this.announceFight);
		this.on('ring.fightConcludes', this.declareVictor);
	}

	announceHit (Monster, monster, { assailant, damage }) {
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

	announceHeal (Monster, monster, { amount }) {
		const channel = this.publicChannel;

		/* eslint-disable max-len */
		channel({
			announce: `${monster.icon} 💊       ${monster.givenName} heals ${amount} hp`
		});
		/* eslint-enable max-len */
	}

	announceMiss (Card, card, { attackResult, curseOfLoki, player, target }) {
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

	announceFight (Ring, ring, { contestants, rounds }) {
		const channel = this.publicChannel;
		const contestantA = contestants[0];
		const contestantB = contestants[1];

		channel({
			announce: `${contestantA.icon}  vs  ${contestantB.icon}`
		});
	}

	declareVictor (Ring, ring, { contestants, rounds }) {
		const channel = this.publicChannel;
		// TO-DO: Figure out the victor, award XP, kick off more events (that could be messaged), save results

		channel({
			announce: `${contestantA.icon}  vs  ${contestantB.icon}    fight concludes`
		});
	}

	getPlayer ({ id, name }) {
		let player = this.players[id];

		if (!player) {
			player = new Player({
				name
			});

			this.players[id] = player;

			this.emit('playerCreated', { player });
		}

		return {
			spawnMonster (channel) {
				return player.spawnMonster(channel);
			},
			equipMonster (channel) {
				return player.equipMonster(channel);
			},
			sendMonsterToTheRing (channel) {
				return player.spawnMonster(this.ring, channel);
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

	on (...args) {
		this.semaphore.on(...args);
	}
}

module.exports = Game;
