/* eslint-disable max-len */

const random = require('lodash.random');
const shuffle = require('lodash.shuffle');

const { ATTACK_PHASE, DEFENSE_PHASE, GLOBAL_PHASE } = require('../helpers/phases');
const { calculateXP } = require('../helpers/experience');
const { monsterCard } = require('../helpers/card');
const { randomContestant } = require('../helpers/bosses');
const BaseClass = require('../baseClass');
const delayTimes = require('../helpers/delay-times');
const pause = require('../helpers/pause');

const MAX_MONSTERS = 5;
const MIN_MONSTERS = 2;
const FIGHT_DELAY = 60000;

class Ring extends BaseClass {
	constructor (channelManager, { spawnBosses = true, ...options } = {}, log) {
		super(options);

		this.log = log;
		this.spawnBosses = spawnBosses;
		this.channelManager = channelManager;
		this.battles = [];

		// Note that we're not saving / hydrating this as of now
		this.on('fightConcludes', (className, ring, results) => {
			ring.battles.push(results);
		});

		this.channelManager.on('win', (className, channel, { contestant }) => this.handleWinner({ contestant }));
		this.channelManager.on('loss', (className, channel, { contestant }) => this.handleLoser({ contestant }));
		this.channelManager.on('permaDeath', (className, channel, { contestant }) => this.handlePermaDeath({ contestant }));
		this.channelManager.on('draw', (className, channel, { contestant }) => this.handleTied({ contestant }));
		this.channelManager.on('fled', (className, channel, { contestant }) => this.handleFled({ contestant }));

		this.startBossTimer();
	}

	get contestants () {
		return this.options.contestants || [];
	}

	set contestants (contestants) {
		return this.setOptions({
			contestants
		});
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
				const contestantIndex = this.contestants.indexOf(contestant);

				this.contestants.splice(contestantIndex, 1);

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

			this.contestants = shuffle([...this.contestants, contestant]);

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
		this.contestants = [];
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

		// Keep a running log of everything that happens
		const fightLog = [];

		// Set a flag on the contestants that are in the encounter
		if (!this.startEncounter()) return Promise.resolve();

		// Make a copy of the contestants array so that it won't be changed after we start using it
		// Note that the contestants objects and the characters / monsters are references to the originals, not copies
		const contestants = [...this.contestants];
		const isActiveContestant = contestant => (contestant && !contestant.monster.dead && !contestant.monster.fled);
		const getActiveContestants = currentContestants => currentContestants.filter(isActiveContestant);
		const getAllActiveContestants = () => getActiveContestants(contestants);
		const getContestantsWithCardsLeft = currentContestants => currentContestants.filter(contestant => contestant && !contestant.monster.emptyHanded);
		const anyContestantsHaveCardsLeft = currentContestants => getContestantsWithCardsLeft(currentContestants).length > 0;

		// Emit an event when the fight begins
		this.emit('fight', {
			contestants
		});

		// And we're off. The round variable is only used for reporting at the end
		let round = 1;

		// This is the main loop that takes care of the "action" each character performs
		// It's a promise so it can be chained, async, delayed, etc
		// currentContestants is the current set of contestants we're working with
		// cardIndex is the numeric index of card we'll play from that character's hand (if they have a card in that position)
		const doAction = ({ currentContestants = contestants, cardIndex = 0 } = {}) => new Promise((resolve, reject) => {
			// Let's get all of the contestants that are still active in the fight
			let activeContestants = getActiveContestants(currentContestants);

			// By default, the next card anyone plays should be the one at the same position as the one currently being played
			let nextCardIndex = cardIndex;

			// But if we don't have any more contestants in this fight it's time to reset our list of contestants
			// and it's going to be time to move on to the next card
			if (activeContestants.length <= 1) {
				activeContestants = [...activeContestants, ...getActiveContestants(contestants)];
				nextCardIndex += 1;
			}

			// Let's get the current contestant and their monster
			const playerContestant = activeContestants.shift();
			const { monster: player } = playerContestant;

			// Let's find our target
			// This where we could do some fancy targetting logic if we wanted to
			const targetContestant = activeContestants[0];
			const { monster: target } = targetContestant;

			// Find the card in the current player's hand at the current index
			let card = player.cards[cardIndex];

			// When this is called (see below) we pass the next contestant and card back into the looping
			// If a card was played then emptyHanded will be reset to false, otherwise it will be the index of a character as described above
			const next = () => resolve(doAction({
				currentContestants: activeContestants,
				cardIndex: nextCardIndex
			}));

			// Does the monster have a card at the current position?
			if (card) {
				// Emit an event when a character's turn begins
				// Note that as written currently this will emit _only if they have a card to play_
				this.emit('turnBegin', {
					contestant: playerContestant,
					round
				});

				// Now we're going to run through all of the possible effects
				// Each effect should either return a card (which will replace the card that was going to be played)
				// or do something in the background and then return nothing (in which case we'll keep the card we had)

				// Let's clone the card before we get started on this - that way any modifications won't be saved
				card = card.clone();

				// First, run through the effects from the current monster
				card = player.encounterEffects.reduce((currentCard, effect) => {
					const modifiedCard = effect({
						activeContestants: getAllActiveContestants(),
						card: currentCard,
						phase: ATTACK_PHASE,
						player,
						ring,
						target
					});

					return modifiedCard || currentCard;
				}, card);

				// Second, run through the effects from the target monster
				card = target.encounterEffects.reduce((currentCard, effect) => {
					const modifiedCard = effect({
						activeContestants: getAllActiveContestants(),
						card: currentCard,
						phase: DEFENSE_PHASE,
						player,
						ring,
						target
					});

					return modifiedCard || currentCard;
				}, card);

				// Finally, run through any global effects
				card = ring.encounterEffects.reduce((currentCard, effect) => {
					const modifiedCard = effect({
						activeContestants: getAllActiveContestants(),
						card: currentCard,
						phase: GLOBAL_PHASE,
						player,
						ring,
						target
					});

					return modifiedCard || currentCard;
				}, card);

				// Track the fight log
				fightLog.push(`${player.givenName}: ${card.name} target ${target.givenName}`);

				// Play the card
				card
					// The current monster always attacks the next monster
					// This could be updated in future versions to take into account teams / alignment, and/or to randomize who is targeted
					.play(player, target, ring, getAllActiveContestants())
					.then(() => {
						// Is there more than one monster left alive in the ring?
						if (getAllActiveContestants().length > 1) {
							this.channelManager.sendMessages()
								.then(() => next());
						} else {
							// The fight is over, let's end this promise chain
							// Also return the contestant we ended on for bookkeeping purposes
							this.channelManager.sendMessages()
								.then(() => resolve(playerContestant));
						}
					})
					.catch((ex) => {
						this.log(ex);
						reject(ex);
					});
			} else {
				this.emit('endOfDeck', {
					contestant: playerContestant,
					round
				});

				player.emptyHanded = true;

				// If nobody who's still active has any cards left it's time to reset
				const allActiveContestants = getAllActiveContestants();
				if (!anyContestantsHaveCardsLeft(allActiveContestants)) {
					// Reset the value of `emptyHanded`
					allActiveContestants.forEach(({ monster }) => {
						monster.emptyHanded = false;
					});

					// The round is over so we'll go back to the first card in everyone's hand
					nextCardIndex = 0;

					// We also want to restart to the first contestant since the round is ending now
					// In a game where everyone has the same size hand this would happen anyway, but we reset for unbalanced games
					activeContestants = allActiveContestants;

					// Emit an event when the round ends
					this.emit('roundComplete', {
						contestants,
						round
					});

					// Increment the round counter
					round += 1;
				}

				pause.setTimeout(() => next(), delayTimes.shortDelay());
			}
		});

		// Kick off the action loop with some initial values. Go to the conclusion method once it resolves
		return doAction()
			.then(lastContestant => this.fightConcludes({ fightLog, lastContestant, rounds: round }))
			.catch(() => {
				this.clearRing();
			});
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

		contestants.forEach((contestant) => {
			const { channel, channelName } = contestant;
			contestant.killed = contestant.monster.killed;
			contestant.fled = contestant.monster.fled;
			contestant.encounter = contestant.monster.endEncounter();

			if (deaths > 0) {
				this.awardMonsterXP(contestant);

				if (contestant.monster.dead) {
					contestant.lost = true;

					if (contestant.monster.destroyed) {
						this.channelManager.queueMessage({
							announce: `${contestant.monster.givenName} was too badly injured to be revived.`,
							channel,
							channelName,
							event: { name: 'permaDeath', properties: { contestant } }
						});
					} else {
						this.channelManager.queueMessage({
							announce: `${contestant.monster.givenName} has died in battle. You may now \`revive\` or \`dismiss\` ${contestant.monster.pronouns[1]}.`,
							channel,
							channelName,
							event: { name: 'loss', properties: { contestant } }
						});
					}
				} else if (contestant.fled) {
					this.channelManager.queueMessage({
						announce: `${contestant.monster.givenName} lived to fight another day!`,
						channel,
						channelName,
						event: { name: 'fled', properties: { contestant } }
					});
				} else {
					contestant.won = true;

					this.channelManager.queueMessage({
						announce: `${contestant.monster.identity} is victorious!`,
						channel,
						channelName,
						event: { name: 'win', properties: { contestant } }
					});
				}
			} else {
				this.channelManager.queueMessage({
					announce: 'The fight ended in a draw.',
					channel,
					channelName,
					event: { name: 'draw', properties: { contestant } }
				});
			}
		});

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

	awardMonsterXP (contestant) {
		const { monster, killed } = contestant;
		const monsterXP = calculateXP(monster, killed);

		if (monsterXP > 0) {
			monster.xp += monsterXP;

			this.emit('gainedXP', {
				contestant,
				creature: monster,
				killed: killed,
				xpGained: monsterXP
			});
		}
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

	handlePermaDeath ({ contestant }) {
		contestant.character.dropMonster(contestant.monster);
		contestant.character.addLoss();
		this.emit('permaDeath', { contestant });
	}

	handleTied ({ contestant }) {
		contestant.character.addDraw();
		contestant.monster.addDraw();
		this.emit('draw', { contestant });
		contestant.monster.emit('draw', { contestant });
	}

	handleFled ({ contestant }) {
		contestant.character.addDraw();
		contestant.monster.addDraw();
		this.emit('fled', { contestant });
		contestant.monster.emit('fled', { contestant });
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
			}, random(2400000, 3480000));
		}
	}

	spawnBoss () { // eslint-disable-line consistent-return
		// Only try to enter the ring if there's not a current fight in progress
		if (!this.inEncounter) {
			const contestant = randomContestant();

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
