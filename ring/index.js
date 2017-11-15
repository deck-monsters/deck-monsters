/* eslint-disable max-len */

const shuffle = require('lodash.shuffle');

const BaseClass = require('../baseClass');
const delayTimes = require('../helpers/delay-times');
const { monsterCard } = require('../helpers/card');

const MAX_MONSTERS = 2;
const MIN_MONSTERS = 2;
const FIGHT_DELAY = 30000;

class Ring extends BaseClass {
	constructor (channelManager, options) {
		super(options);

		this.channelManager = channelManager;
		this.battles = [];

		// Note that we're not saving / hydrating this as of now
		this.on('fightConcludes', (className, ring, results) => {
			ring.battles.push(results);
		});

		const ring = this;
		this.channelManager.on('win', (className, channel, { contestant }) => ring.handleWinner({ contestant }));
		this.channelManager.on('loss', (className, channel, { contestant }) => this.handleLoser({ contestant }));
		this.channelManager.on('draw', (className, channel, { contestant }) => this.handleTied({ contestant }));
	}

	get contestants () {
		return this.options.contestants || [];
	}

	getMonsters (targetCharacter) {
		let targetContestants = this.contestants;
		if (targetCharacter) {
			targetContestants = targetContestants.filter(contestant => contestant.character === targetCharacter);
		}

		return targetContestants.map(contestant => contestant.monster);
	}

	removeMonster ({
		monster, character, channel, channelName
	}) {
		return Promise
			.resolve()
			.then(() => {
				if (this.contestants.length <= 0) {
					return Promise.reject(channel({
						announce: 'No monsters currently in ring'
					}));
				}

				if (!monster || !monster.givenName) {
					return Promise.reject(channel({
						announce: 'No monster specified to remove from ring'
					}));
				}

				if (!this.monsterIsInRing(monster)) {
					return Promise.reject(channel({
						announce: 'Your monster is not currently in the ring'
					}));
				}

				return {
					monster, character, channel, channelName
				};
			})
			.then((contestant) => {
				const contestantIndex = this.options.contestants.indexOf(contestant);

				this.options.contestants.splice(contestantIndex, 1);

				if (this.contestants.length < 1) {
					this.clearRing();
				}

				this.emit('remove', {
					contestant
				});

				this.channelManager.queueMessage({
					announce: `${monster.givenName} has returned to nestle safely into your warm embrace.`,
					channel,
					channelName
				});

				this.channelManager.sendMessages()
					.then(() => this.startFightTimer({ channel, channelName }));
			});
	}

	addMonster ({
		monster, character, channel, channelName
	}) {
		if (this.contestants.length < MAX_MONSTERS) {
			const contestant = {
				monster,
				character,
				channel,
				channelName
			};

			this.options.contestants = shuffle([...this.contestants, contestant]);

			this.emit('add', {
				contestant
			});

			this.channelManager.queueMessage({
				announce: `${monster.givenName} has entered the ring. May the odds be ever in your favor.`,
				channel,
				channelName
			});

			if (this.contestants.length > MAX_MONSTERS) {
				this.clearRing();
			}

			this.channelManager.sendMessages()
				.then(() => this.startFightTimer({ channel, channelName }));
		} else {
			this.channelManager.queueMessage({
				announce: 'The ring is full! Wait until the current battle is over and try again.',
				channel,
				channelName
			});
		}
	}

	monsterIsInRing (monster) {
		return !!this.contestants.find(contestant => contestant.monster === monster);
	}

	look (channel) {
		const ringContentsDisplay = this.contestants.reduce((ringContents, contestant) => {
			const contestantDisplay = monsterCard(contestant.character, true);
			const monsterDisplay = monsterCard(contestant.monster, true);
			return `${ringContents} ${contestantDisplay} sent the following monster into the ring: ${monsterDisplay}`;
		}, '');

		if (ringContentsDisplay) {
			return Promise
				.resolve()
				.then(() => channel({
					announce: ringContentsDisplay
				}));
		}

		return Promise.reject(channel({
			announce: 'The ring is empty',
			delay: 'short'
		}));
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
		clearTimeout(this.fightTimer);
		this.setEncounterFlag(false);
		this.options.contestants = [];
		this.emit('clear');
	}

	startFightTimer ({ channel, channelName }) {
		clearTimeout(this.fightTimer);

		if (this.contestants.length >= MIN_MONSTERS) {
			this.channelManager.queueMessage({
				announce: `Fight will begin in ${Math.floor(FIGHT_DELAY / 1000)} seconds.`,
				channel,
				channelName
			});

			this.fightTimer = setTimeout(() => {
				if (this.contestants.length >= 2) {
					this.channelManager.sendMessages()
						.then(() => this.fight());
				}
			}, FIGHT_DELAY);
		} else {
			const needed = MIN_MONSTERS - this.contestants.length;
			const monster = needed > 1 ? 'monsters' : 'monster';
			this.channelManager.queueMessage({
				announce: `Fight countdown will begin once ${needed} more ${monster} join the ring.`,
				channel,
				channelName
			});
		}
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
			const { monster } = contestant;

			// Find the card in that monster's hand at the current index if it exists
			const card = monster.cards[currentCard];

			// Emit an event when a character's turn begins
			// Note that as written currently this will emit _only if they have a card to play_
			if (card) {
				this.emit('turnBegin', {
					contestant,
					round
				});
			}

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
							this.channelManager.sendMessages()
								.then(() => next());
						} else {
							// The fight is over, let's end this promise chain
							// Also return the contestant we ended on for bookkeeping purposes
							this.channelManager.sendMessages()
								.then(() => resolve(contestant));
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
			.then(lastContestant => this.fightConcludes({ lastContestant, rounds: round }));
	}

	fightConcludes ({ lastContestant, rounds }) {
		const { contestants } = this;

		const deadContestants = contestants.filter(contestant => !!contestant.monster.dead);
		const deaths = deadContestants.length;

		this.channelManager.queueMessage({
			event: {
				name: 'fightConcludes',
				properties: {
					contestants,
					deadContestants,
					deaths,
					lastContestant,
					rounds
				}
			}
		});

		if (deaths > 0) {
			contestants.forEach((contestant) => {
				const { channel, channelName } = contestant;

				if (contestant.monster.dead) {
					contestant.lost = true;
					this.channelManager.queueMessage({
						announce: `${contestant.monster.givenName} has died in battle. You may now \`revive\` or \`dismiss\` ${contestant.monster.pronouns[1]}.`,
						channel,
						channelName,
						event: { name: 'loss', properties: { contestant } }
					});
				} else {
					contestant.won = true;
					this.channelManager.queueMessage({
						announce: `${contestant.monster.givenName} hath soundly beaten ${contestant.monster.pronouns[2]} opponents!`,
						channel,
						channelName,
						event: { name: 'win', properties: { contestant } }
					});
				}
			});
		} else {
			contestants.forEach((contestant) => {
				const { channel, channelName } = contestant;

				this.channelManager.queueMessage({
					announce: 'The fight ended in a draw.',
					channel,
					channelName,
					event: { name: 'draw', properties: { contestant } }
				});
			});
		}

		this.channelManager.sendMessages()
			.then(() => {
				this.emit('fightConcludes', {
					contestants,
					deadContestants,
					deaths,
					isDraw: deaths <= 0,
					lastContestant,
					rounds
				});

				this.clearRing();
			});
	}

	handleWinner ({ contestant }) {
		contestant.character.addWin();
		contestant.monster.addWin();
		this.emit('win', { contestant });
		contestant.monster.emit('win', { contestant });
	}

	handleLoser ({ contestant }) {
		contestant.character.addLoss();
		contestant.monster.addLoss();
		this.emit('loss', { contestant });
		contestant.monster.emit('loss', { contestant });
	}

	handleTied ({ contestant }) {
		contestant.character.addDraw();
		contestant.monster.addDraw();
		this.emit('draw', { contestant });
		contestant.monster.emit('draw', { contestant });
	}
}

Ring.eventPrefix = 'ring';

module.exports = Ring;
