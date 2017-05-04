const shuffle = require('lodash.shuffle');

const { EventEmitter, globalSemaphore } = require('../helpers/semaphore');

const MAX_MONSTERS = 2;

class Ring {
	constructor (options) {
		this.semaphore = new EventEmitter();
		this.setOptions(options);

		this.emit('initialized');
	}

	get name () {
		return this.constructor.name;
	}

	get options () {
		return this.optionsStore || {};
	}

	setOptions (options) {
		this.optionsStore = Object.assign({}, this.options, options);

		this.emit('updated');
	}

	get contestants () {
		return this.options.contestants || [];
	}

	addMonster (monster, player, channel) {
		if (this.contestants.length < MAX_MONSTERS) {
			const contestant = {
				monster,
				player
			};

			this.options.contestants = shuffle([...this.contestants, contestant]);

			this.emit('add', contestant);

			channel({
				announce: `${monster.givenName} has entered the ring. May the odds be ever in your favor.`
			});

			if (this.contestants.length > MAX_MONSTERS) {
				this.clearRing();
			} else if (this.contestants.length === MAX_MONSTERS) {
				this.fight();
			}
		} else {
			channel({
				announce: 'The ring is full! Wait until the current battle is over and try again.'
			});
		}
	}

	clearRing () {
		this.options.monsters = [];
		this.emit('clear');
	}

	fight () {
		const game = this; // TO-DO: This is actually the ring, so we might want to think about it
		const contestants = this.contestants;

		this.emit('fight', {
			contestants,
			monsters: contestants.map(contestant => contestant.monster)
		});

		let fightContinues;
		let currentContestant = 0;
		let currentCard = 0;
		let emptyHanded = false;

		// TO-DO: Make this async so that we can add a little delay between each step (for more interesting results)
		do {
			const contestant = contestants[currentContestant];
			const monster = contestant.monster;
			const card = monster.cards[currentCard];

			let nextContestant = currentContestant + 1;
			if (nextContestant >= contestants.length) {
				nextContestant = 0;
			}

			if (card) {
				emptyHanded = false;
				fightContinues = card.effect(monster, contestants[nextContestant].monster, game);
			} else if (emptyHanded === false) {
				emptyHanded = currentContestant;
			}

			if (emptyHanded === nextContestant) {
				currentCard = 0;
			} else {
				currentCard += 1;
			}

			currentContestant = nextContestant;
		} while (fightContinues === true);
	}

	emit (event, ...args) {
		this.semaphore.emit(event, this.name, this, ...args);
		globalSemaphore.emit(`card.${event}`, this.name, this, ...args);
	}

	on (...args) {
		this.semaphore.on(...args);
	}

	toJSON () {
		return {
			name: this.name,
			options: this.options
		};
	}

	toString () {
		return JSON.stringify(this);
	}
}

module.exports = Ring;
