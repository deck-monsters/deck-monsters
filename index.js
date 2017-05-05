const { globalSemaphore } = require('./helpers/semaphore');
const Ring = require('./ring');
const { draw } = require('./cards');
const { Player } = require('./players');

const { getFlavor } = require('./helpers/flavor');

const announceHit = ({ assailant, channel, damage, hp, monster }) => {
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
};

const announceMiss = ({ attackResult, channel, curseOfLoki, player, target }) => {
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
};

const announceHeal = ({ amount, channel, monster }) => {
	/* eslint-disable max-len */
	channel({
		announce: `${monster.icon} 💊       ${monster.givenName} heals ${amount} hp`
	});
	/* eslint-enable max-len */
};

class Game {
	constructor (publicChannel) {
		this.ring = new Ring();
		this.semaphore = globalSemaphore;
		this.publicChannel = publicChannel;
		this.players = {};

		this.emit('initialized');
	}

	initializeMessaging () {
		const channel = this.publicChannel;

		this.on('card.miss', (Card, card, { attackResult, curseOfLoki, player, target }) => announceMiss({
			attackResult,
			channel,
			curseOfLoki,
			player,
			target
		}));

		this.on('creature.hit', (Monster, monster, { attackResult, curseOfLoki, player, target }) => announceHit({
			attackResult,
			channel,
			curseOfLoki,
			monster,
			player,
			target
		}));

		this.on('creature.heal', (Monster, monster, { amount }) => announceHeal({
			amount,
			channel,
			monster
		}));
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
