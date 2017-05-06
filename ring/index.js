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

		const doAction = ({ currentContestant, emptyHanded }) => new Promise((resolve) => {
			const contestant = contestants[currentContestant];
			const monster = contestant.monster;
			monster.currentCard = monster.currentCard || 0;
			const card = monster.cards[monster.currentCard];
			monster.currentCard += 1;
			console.log(`round ${round} ${monster.icon}  card ${monster.currentCard}`);

			let nextContestant = currentContestant + 1;
			if (nextContestant >= contestants.length) {
				nextContestant = 0;
			}

			const next = (nextEmptyHanded = false) => resolve(doAction({
				currentContestant: nextContestant,
				emptyHanded: nextEmptyHanded
			}));

			if (card) {
				this.emit('cardDrawn', { monster, card });
				const fightContinues = card.effect(monster, contestants[nextContestant].monster, ring);

				if (fightContinues) {
					setTimeout(() => next(), FIGHT_DELAY);
				} else {
					resolve(contestant);
				}
			} else {
				// How in the world does this ever resolve to true??? emptyHanded is a boolean, nextContestant is an int
				if (emptyHanded === nextContestant) {
					// TODO: set both monster's cards to 0
					// Do it here, because if one monster has 6 cards, and the other has 3, the first monster needs to
					// play all 6 before the second monster can re-play its 3

					this.emit('roundComplete', {
						contestants,
						round
					});

					round += 1;
				}

				next(emptyHanded === false ? currentContestant : emptyHanded);
			}
		});

		return doAction({ currentContestant: 0, emptyHanded: false })
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
