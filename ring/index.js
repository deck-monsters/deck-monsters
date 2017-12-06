/* eslint-disable max-len */

const shuffle = require('lodash.shuffle');

const BaseClass = require('../baseClass');
const delayTimes = require('../helpers/delay-times');
const { monsterCard } = require('../helpers/card');
const pause = require('../helpers/pause');
const { ATTACK_PHASE, DEFENSE_PHASE, GLOBAL_PHASE } = require('../helpers/phases');
const { randomCharacter } = require('../characters');

const MAX_MONSTERS = 3;
const MIN_MONSTERS = 2;
const FIGHT_DELAY = 60000;

const bossChannel = () => Promise.resolve();
const bossChannelName = 'BOSS';

class Ring extends BaseClass {
	constructor (channelManager, { spawnBosses = true, ...options } = {}) {
		super(options);

		this.spawnBosses = spawnBosses;
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

		this.startBossTimer();
	}

	get contestants () {
		return this.options.contestants || [];
	}

	get encounterEffects () {
		return (this.encounter || {}).effects || [];
	}

	set encounterEffects (effects = []) {
		this.encounter = {
			...this.encounter,
			effects
		};
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
				if (this.inEncounter) {
					return Promise.reject(channel({
						announce: 'You cannot withdraw while an encounter is in progress'
					}));
				}

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

				const contestant = this.findContestant(character, monster);
				if (!contestant) {
					return Promise.reject(channel({
						announce: 'Your monster is not currently in the ring'
					}));
				}

				return contestant;
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
		if (this.contestants.length < MAX_MONSTERS && !this.inEncounter) {
			const contestant = {
				monster,
				character,
				channel,
				channelName
			};

			this.options.contestants = shuffle([...this.contestants, contestant]);

			if (this.contestants.length > MAX_MONSTERS) {
				this.clearRing();
			} else {
				this.emit('add', {
					contestant
				});

				this.channelManager.queueMessage({
					announce: `${monster.givenName} has entered the ring. May the odds be ever in your favor.`,
					channel,
					channelName
				});

				this.channelManager.sendMessages()
					.then(() => this.startFightTimer({ channel, channelName }));
			}
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

	findContestant (character, monster) {
		return this.contestants.find(contestant => (contestant.character === character && contestant.monster === monster));
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

	startEncounter () {
		if (this.inEncounter) return false;

		this.inEncounter = true;
		this.encounter = {};
		this.contestants.forEach(contestant => contestant.monster.startEncounter(this));

		return true;
	}

	endEncounter () {
		this.contestants.forEach(contestant => contestant.monster.endEncounter());
		this.inEncounter = false;
		delete this.encounter;
	}

	clearRing () {
		clearTimeout(this.fightTimer);
		this.endEncounter();
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

			this.fightTimer = pause.setTimeout(() => {
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
		if (!this.startEncounter()) return Promise.resolve();

		// Make a copy of the contestants array so that it won't be changed after we start using it
		// Note that the contestants objects and the characters / monsters are references to the originals, not copies
		const contestants = [...this.contestants];
		const getActiveContestants = () => contestants.filter(contestant => (!contestant.monster.dead && !contestant.monster.fled));

		// Emit an event when the fight begins
		this.emit('fight', {
			contestants
		});

		// And we're off. The round variable is only used for reporting at the end
		let round = 1;

		// This is the main loop that takes care of the "action" each character performs
		// It's a promise so it can be chained, async, delayed, etc
		// currentContestant is the numeric index of character whose turn we're on
		// cardIndex is the numeric index of card we'll play from that character's hand (if they have a card in that position)
		// emptyHanded is the numeric index of the first character to not have a card in the position specified, and gets reset to "false" whenever a card is successfully played
		const doAction = ({ currentContestant, cardIndex, emptyHanded }) => new Promise((resolve) => {
			// Find the monster at the current index
			const activeContestants = getActiveContestants();
			const contestant = activeContestants[currentContestant];
			const { monster } = contestant;

			// Find the card in that monster's hand at the current index if it exists
			let card = monster.cards[cardIndex];

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
			if (nextContestant >= activeContestants.length) {
				nextContestant = 0;
			}

			// We don't actually move to the next card until every character has played the current card
			let nextCardIndex = cardIndex;
			if (nextContestant === 0) {
				nextCardIndex += 1;
			}

			// When this is called (see below) we pass the next contestant and card back into the looping
			// If a card was played then emptyHanded will be reset to false, otherwise it will be the index of a character as described above
			const next = (nextEmptyHanded = false) => resolve(doAction({
				currentContestant: nextContestant,
				cardIndex: nextCardIndex,
				emptyHanded: nextEmptyHanded
			}));

			// Does the monster have a card at the current position?
			if (card) {
				const nextMonster = activeContestants[nextContestant].monster;

				// Now we're going to run through all of the possible effects
				// Each effect should either return a card (which will replace the card that was going to be played)
				// or do something in the background and then return nothing (in which case we'll keep the card we had)

				// Let's clone the card before we get started on this - that way any modifications won't be saved
				card = card.clone();

				// First, run through the effects from the current monster
				card = monster.encounterEffects.reduce((currentCard, effect) => {
					const modifiedCard = effect({
						activeContestants,
						card: currentCard,
						phase: ATTACK_PHASE,
						player: monster,
						ring,
						target: nextMonster
					});

					return modifiedCard || currentCard;
				}, card);

				// Second, run through the effects from the target monster
				card = nextMonster.encounterEffects.reduce((currentCard, effect) => {
					const modifiedCard = effect({
						activeContestants,
						card: currentCard,
						phase: DEFENSE_PHASE,
						player: monster,
						ring,
						target: nextMonster
					});

					return modifiedCard || currentCard;
				}, card);

				// Finally, run through any global effects
				card = ring.encounterEffects.reduce((currentCard, effect) => {
					const modifiedCard = effect({
						activeContestants,
						card: currentCard,
						phase: GLOBAL_PHASE,
						player: monster,
						ring,
						target: nextMonster
					});

					return modifiedCard || currentCard;
				}, card);

				// Play the card. If the fight should continue after the card it will return true, otherwise it will return false
				card
					// The current monster always attacks the next monster
					// This could be updated in future versions to take into account teams / alignment, and/or to randomize who is targeted
					.play(monster, nextMonster, ring, activeContestants)
					.then((fightContinues) => {
						if (getActiveContestants().length > 1) {
							if (!fightContinues) nextContestant = Math.max(nextContestant - 1, 0);

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
					nextCardIndex = 0;
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
				pause.setTimeout(() => next(emptyHanded === false ? currentContestant : emptyHanded), delayTimes.shortDelay());
			}
		});

		// Kick off the action loop with some initial values. Go to the conclusion method once it resolves
		return doAction({ currentContestant: 0, cardIndex: 0, emptyHanded: false })
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

	startBossTimer () {
		const ring = this;

		if (this.spawnBosses) {
			pause.setTimeout(() => {
				ring.emit('bossWillSpawn', { delay: 120000 });

				pause.setTimeout(() => {
					ring.spawnBoss();
					ring.startBossTimer(); // Do it again in an hour
				}, 120000);
			}, 3480000);
		}
	}

	spawnBoss () { // eslint-disable-line consistent-return
		// Only try to enter the ring if there's not a current fight in progress
		if (!this.inEncounter) {
			const character = randomCharacter();
			const monster = character.monsters[0];
			const contestant = {
				monster,
				character,
				channel: bossChannel,
				channelName: bossChannelName
			};

			this.addMonster(contestant);

			// Leave the ring after 10 minutes if no one joins the fight
			const ring = this;
			pause.setTimeout(() => {
				ring.removeBoss(contestant);
			}, 600000);

			return contestant;
		}
	}

	removeBoss (contestant) {
		if (!this.inEncounter && this.contestants.length === 1) {
			return this.removeMonster(contestant);
		}

		return Promise.resolve();
	}
}

Ring.eventPrefix = 'ring';

module.exports = Ring;
