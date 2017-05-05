const shuffle = require('lodash.shuffle');

const BaseClass = require('../baseClass');

const FIGHT_DELAY = 1000;
const MAX_MONSTERS = 2;

class Ring extends BaseClass {
	constructor (options) {
		super(options);

		this.battles = [];

		// Note that we're not saving / hydrating this as of now
		this.on('fightConcludes', (className, ring, results) => {
			ring.battles.push(results);
		});
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
		const contestants = [...this.contestants];

		this.emit('fight', {
			contestants
		});

		let round = 1;

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
				if (emptyHanded === nextContestant) {
					nextCard = 0;
					round += 1;
				}

				next(emptyHanded === false ? currentContestant : emptyHanded);
			}
		});

		return doAction({ currentContestant: 0, currentCard: 0, emptyHanded: false })
			.then(contestant => this.fightConcludes(contestant, round));
	}

	fightConcludes (lastContestant, rounds) {
		const contestants = this.contestants;

		const deadContestants = contestants.filter(contestant => !!contestant.monster.dead);
		const deaths = deadContestants.length;

		if (deaths > 0) {
			contestants.forEach((contestant) => {
				if (contestant.monster.dead) {
					contestant.player.addLoss();
					contestant.monster.addLoss();
					contestant.monster.emit('loss', { contestant });
				} else {
					contestant.player.addWin();
					contestant.monster.addWin();
					contestant.monster.emit('win', { contestant });
				}

				contestant.monster.dead = false;
			});
		} else {
			contestants.forEach((contestant) => {
				contestant.player.addDraw();
				contestant.monster.addDraw();
				contestant.monster.emit('draw', { contestant });
			});
		}

		this.emit('fightConcludes', {
			contestants,
			deadContestants,
			deaths,
			isDraw: deaths <= 0,
			lastContestant,
			rounds
		});
	}
}

Ring.eventPrefix = 'ring';

module.exports = Ring;
