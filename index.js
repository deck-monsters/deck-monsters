const { globalSemaphore } = require('./helpers/semaphore');
const Ring = require('./ring');
const { draw } = require('./cards');
const { Player } = require('./players');

class Game {
	constructor (publicChannel) {
		this.ring = new Ring();
		this.semaphore = globalSemaphore;
		this.publicChannel = publicChannel;
		this.players = {};

		this.emit('initialized');
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
