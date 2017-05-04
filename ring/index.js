const shuffle = require('lodash.shuffle');

const { EventEmitter, globalSemaphore } = require('../helpers/semaphore');

const FIGHT_DELAY = 1000;
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
		const ring = this;
		const contestants = this.contestants;

		this.emit('fight', {
			contestants,
			monsters: contestants.map(contestant => contestant.monster)
		});

		const doAction = ({ currentContestant, currentCard, emptyHanded }) => new Promise((resolve) => {
			const contestant = contestants[currentContestant];
			const monster = contestant.monster;
			const card = monster.cards[currentCard];

			let nextContestant = currentContestant + 1;
			if (nextContestant >= contestants.length) {
				nextContestant = 0;
			}

			let nextCard = currentCard + 1;

			const next = (nextEmptyHanded = false) => resolve(doAction({
				currentContestant: nextContestant,
				currentCard: nextCard,
				emptyHanded: nextEmptyHanded
			}));

			if (card) {
				const fightContinues = card.effect(monster, contestants[nextContestant].monster, ring);

				if (fightContinues) {
					setTimeout(() => next(), FIGHT_DELAY);
				} else {
					resolve(contestant);
				}
			} else {
				if (emptyHanded === nextContestant) nextCard = 0;
				next(emptyHanded === false ? currentContestant : emptyHanded);
			}
		});

		return doAction({ currentContestant: 0, currentCard: 0, emptyHanded: false })
			.then(contestant => this.fightConcludes(contestant));
	}

	fightConcludes (lastContestant) {
		const contestants = this.contestants;

		this.emit('fightConcludes', {
			contestants,
			lastContestant,
			monsters: contestants.map(contestant => contestant.monster)
		});

		// TO-DO: Do something to determine winners / losers here
		// Or should that be in response to events?
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
