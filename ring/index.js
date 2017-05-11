const shuffle = require('lodash.shuffle');

const BaseClass = require('../baseClass');
const delayTimes = require('../helpers/delay-times.js');

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

	addMonster (monster, character, channel) {
		if (this.contestants.length < MAX_MONSTERS) {
			const contestant = {
				monster,
				character
			};

			this.options.contestants = shuffle([...this.contestants, contestant]);

			this.emit('add', {
				contestant
			});

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

	monsterIsInRing (monster) {
		const contestants = this.contestants;
		return !!contestants.find(contestant => contestant.monster === monster);
	}

	// TO-DO: This should probably be an encounter start / end method we call on the creature
	setEncounterFlag (value) {
		this.contestants.forEach((contestant) => {
			contestant.monster.inEncounter = value;
			if (value) {
				contestant.savedConditions = Object.assign({}, contestant.monster.conditions);
			} else {
				contestant.monster.conditions = Object.assign({}, contestant.savedConditions);
			}
		});
	}

	clearRing () {
		this.setEncounterFlag(false);
		this.options.contestants = [];
		this.emit('clear');
	}

	fight () {
		// Save the instance of the ring we are fighting in
		const ring = this;

		// Set a flag on the contestants that are in the encounter
		this.setEncounterFlag(true);

		// Make a copy of the contestants array so that it won't be changed after we start using it
		// Note that the contestants objects and the characters / monsters are references to the originals, not copies
		const contestants = [...this.contestants];

		// Emit an event when the fight begins
		this.emit('fight', {
			contestants
		});

		// And we're off. The round variable is only used for reporting at the end
		let round = 1;

		// This is the main loop that takes care of the "action" each character performs
		// It's a promise so it can be chained, async, delayed, etc
		// currentContestant is the numeric index of character whose turn we're on
		// currentCard is the numeric index of card we'll play from that character's hand (if they have a card in that position)
		// emptyHanded is the numeric index of the first character to not have a card in the position specified, and gets reset to "false" whenever a card is successfully played
		const doAction = ({ currentContestant, currentCard, emptyHanded }) => new Promise((resolve) => {
			// Find the monster at the current index
			const contestant = contestants[currentContestant];
			const monster = contestant.monster;

			// Find the card in that monster's hand at the current index if it exists
			const card = monster.cards[currentCard];

			// Emit an event when a character's turn begins
			// Note that as written currently this will emit _even if they don't have a card to play_
			this.emit('turnBegin', {
				contestant,
				round
			});

			// Get the index of the next contestant, looping at the end of the array
			let nextContestant = currentContestant + 1;
			if (nextContestant >= contestants.length) {
				nextContestant = 0;
			}

			// We don't actually move to the next card until every character has played the current card
			let nextCard = currentCard;
			if (nextContestant === 0) {
				nextCard += 1;
			}

			// When this is called (see below) we pass the next contestant and card back into the looping
			// If a card was played then emptyHanded will be reset to false, otherwise it will be the index of a character as described above
			const next = (nextEmptyHanded = false) => resolve(doAction({
				currentContestant: nextContestant,
				currentCard: nextCard,
				emptyHanded: nextEmptyHanded
			}));

			// Does the monster have a card at the current position?
			if (card) {
				// Play the card. If the fight should continue after the card it will return true, otherwise it will return false
				card
					// The current monster always attacks the next monster
					// This could be updated in future versions to take into account teams / alignment, and/or to randomize who is targeted
					.play(monster, contestants[nextContestant].monster, ring)
					.then((fightContinues) => {
						if (fightContinues) {
							// Delay the next turn slighty for more realistic gameplay
							// Notice that no value is passed in for emptyHanded so it will reset to false (because we played a card)
							setTimeout(() => next(), delayTimes.longDelay());
						} else {
							// The fight is over, let's end this promise chain
							// Also return the contestant we ended on for bookkeeping purposes
							resolve(contestant);
						}
					});
			} else {
				this.emit('endOfDeck', {
					contestant,
					round
				});

				// We didn't have a card, so we can't play
				// If we've gone an entire round with no plays then the value of emptyHanded is going to equal the index of the nextContestant
				if (emptyHanded === nextContestant) {
					// The round is over so we'll go back to the first card in everyone's hand
					nextCard = 0;
					// We also want to restart to the first contestant since the round is ending now
					// In a game where everyone has the same size hand this would happen anyway, but we reset for unbalanced games
					nextContestant = 0;

					// Emit an event when the round ends
					this.emit('roundComplete', {
						contestants,
						round
					});

					// Increment the round counter
					round += 1;
				}

				// If we haven't gone an entire round yet we just pass play along to the next character
				// If we're the first ones to have an empty hand then we'll set the value to our index, otherwise we'll just pass along the existing value (so that we can know when a full round has passed with no plays)
				setTimeout(() => next(emptyHanded === false ? currentContestant : emptyHanded), delayTimes.shortDelay());
			}
		});

		// Kick off the action loop with some initial values. Go to the conclusion method once it resolves
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
					contestant.lost = true;
					contestant.character.addLoss();
					contestant.monster.addLoss();
					contestant.monster.emit('loss', { contestant });
				} else {
					contestant.won = true;
					contestant.character.addWin();
					contestant.monster.addWin();
					contestant.monster.emit('win', { contestant });
				}
			});
		} else {
			contestants.forEach((contestant) => {
				contestant.character.addDraw();
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
