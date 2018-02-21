/* eslint-disable max-len */

const Promise = require('bluebird');
const random = require('lodash.random');
const shuffle = require('lodash.shuffle');

const { actionCard, monsterCard } = require('../helpers/card');
const { calculateXP } = require('../helpers/experience');
const { getTarget } = require('../helpers/targeting-strategies');
const { randomContestant } = require('../helpers/bosses');
const { sortCardsAlphabetically } = require('../cards/helpers/sort');
const BaseClass = require('../shared/baseClass');
const delayTimes = require('../helpers/delay-times');
const getUniqueCards = require('../cards/helpers/unique-cards');
const pause = require('../helpers/pause');

const MAX_BOSSES = 5;
const MAX_MONSTERS = 12;
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
					.then(() => this.startFightTimer());
			});
	}

	addMonster ({
		monster, character, channel, channelName, isBoss
	}) {
		if (this.contestants.length < MAX_MONSTERS && !this.inEncounter) {
			const contestant = {
				monster,
				character,
				channel,
				channelName,
				isBoss
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
					.then(() => this.startFightTimer());
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

	look (channel, showCharacters = true) {
		const { length } = this.contestants;

		if (length < 1) {
			return Promise.reject(channel({
				announce: 'The ring is empty.',
				delay: 'short'
			}));
		}

		const { channelManager, channelName } = channel;
		return Promise.resolve()
			.then(() => channelManager.queueMessage({
				announce:
`###########################################
There ${length === 1 ? 'is one contestant' : `are ${length} contestants`} in the ring.
###########################################`,
				channel,
				channelName
			}))
			.then(() => Promise.each(this.contestants, (contestant) => {
				let characterDisplay = '';
				if (showCharacters) {
					characterDisplay = `${monsterCard(contestant.character, true)}
Sent the following monster into the ring:

`;
				}

				const monsterDisplay = monsterCard(contestant.monster, !showCharacters);

				return channelManager.queueMessage({
					announce:
`${characterDisplay}${monsterDisplay}###########################################`,
					channel,
					channelName
				});
			}))
			.then(() => {
				const summary = this.contestants.map(({ monster }) => (
					`${monster.identity} - ${monster.creatureType} (${monster.level})`
				));

				return channelManager.queueMessage({
					announce:
`Ring summary:
${summary.join('\n')}
###########################################`,
					channel,
					channelName
				});
			})
			.then(() => channelManager.sendMessages());
	}

	lookAtCards (channel) {
		const { length } = this.contestants;

		if (length < 1) {
			return Promise.reject(channel({
				announce: 'The ring is empty.',
				delay: 'short'
			}));
		}

		if (!this.inEncounter) {
			return Promise.reject(channel({
				announce: 'Wait until the encounter has started.',
				delay: 'short'
			}));
		}

		const { channelManager, channelName } = channel;
		return Promise.resolve()
			.then(() => channelManager.queueMessage({
				announce:
`###########################################
The following cards are in play:
`,
				channel,
				channelName
			}))
			.then(() => {
				const cards = sortCardsAlphabetically(getUniqueCards(this.contestants.reduce((allCards, { monster }) => {
					allCards.push(...monster.cards);

					return allCards;
				}, [])));

				return Promise.each(cards, (card) => {
					const cardDisplay = actionCard(card, true);

					return channelManager.queueMessage({
						announce: cardDisplay,
						channel,
						channelName
					});
				});
			})
			.then(() => channelManager.queueMessage({
				announce: '###########################################',
				channel,
				channelName
			}))
			.then(() => channelManager.sendMessages());
	}

	startEncounter () {
		if (this.inEncounter) return false;

		this.inEncounter = true;
		this.encounter = {};
		this.contestants.forEach(({ channel, channelName, monster }) => {
			monster.startEncounter(this);

			this.channelManager.queueMessage({
				announce: 'The fight has begun! You may now type `look at monsters in the ring` to see all participants with their current stats, and `look at cards in the ring` to see the detailed stats of every card that will be in play.',
				channel,
				channelName
			});
		});

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

	startFightTimer () {
		clearTimeout(this.fightTimer);

		const getPlayerContestants = () => {
			let hasBoss = false;
			const playerContestants = this.contestants.filter((contestant) => {
				if (contestant.isBoss) {
					hasBoss = true;
					return false;
				}

				return true;
			});

			return {
				contestants: playerContestants,
				numberOfMonstersInRing: playerContestants.length + (hasBoss ? 1 : 0)
			};
		};

		const { contestants, numberOfMonstersInRing } = getPlayerContestants();

		if (numberOfMonstersInRing >= MIN_MONSTERS) {
			contestants.forEach(({ channel, channelName }) => this.channelManager.queueMessage({
				announce: `Fight will begin in ${Math.floor(FIGHT_DELAY / 1000)} seconds.`,
				channel,
				channelName
			}));

			this.fightTimer = pause.setTimeout(() => {
				const { numberOfMonstersInRing: numberOfMonstersStillInRing } = getPlayerContestants();

				if (numberOfMonstersStillInRing >= MIN_MONSTERS) {
					this.channelManager.sendMessages()
						.then(() => this.fight());
				}
			}, FIGHT_DELAY);
		} else if (numberOfMonstersInRing <= 0) {
			this.emit('narration', {
				narration: 'The ring is quiet save for the faint sound of footsteps fleeing into the distance.'
			});
		} else {
			const needed = MIN_MONSTERS - numberOfMonstersInRing;
			const monster = needed > 1 ? 'monsters' : 'monster';
			const join = needed > 1 ? 'join' : 'joins';

			contestants.forEach(({ channel, channelName }) => this.channelManager.queueMessage({
				announce: `Fight countdown will begin once ${needed} more ${monster} ${join} the ring.`,
				channel,
				channelName
			}));
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
		let turn;

		// This is the main loop that takes care of the "action" each character performs
		// It's a promise so it can be chained, async, delayed, etc
		// currentContestants is the current set of contestants we're working with
		// cardIndex is the numeric index of card we'll play from that character's hand (if they have a card in that position)
		const doAction = ({ currentContestants = contestants, cardIndex = 0 } = {}) => new Promise((resolve, reject) => {
			// Let's get all of the contestants that are still active in the fight
			let activeContestants = getActiveContestants(currentContestants);

			// By default, the next card anyone plays should be the one at the same position as the one currently being played
			let nextCardIndex = cardIndex;

			// When this is called (see below) we pass the next contestant and card back into the looping
			// If a card was played then emptyHanded will be reset to false, otherwise it will be the index of a character as described above
			const next = () => resolve(doAction({
				currentContestants: activeContestants,
				cardIndex: nextCardIndex
			}));

			// But if we don't have any more contestants in this fight it's time to reset our list of contestants
			// and it's going to be time to move on to the next card
			if (activeContestants.length <= 1) {
				nextCardIndex += 1;

				if (activeContestants.length === 1) {
					activeContestants = [...activeContestants, ...getAllActiveContestants()];
				} else {
					activeContestants = getAllActiveContestants();

					next();
					return;
				}
			}

			// Let's get the current contestant and their monster
			const playerContestant = activeContestants.shift();
			const { monster: player } = playerContestant;

			// Find the card in the current player's hand at the current index
			const card = player.cards[cardIndex];

			// Does the monster have a card at the current position?
			if (card) {
				// Emit an event at the start of each turn
				if (turn !== cardIndex) {
					turn = cardIndex;

					this.emit('startTurn', {
						turn,
						contestants: getAllActiveContestants(),
						round
					});
				}

				// Emit an event when a character's turn begins
				// Note that as written currently this will emit _only if they have a card to play_
				this.emit('playerTurnBegin', {
					contestant: playerContestant,
					round
				});

				// Next, let's find our target
				const targetContestant = getTarget({
					contestants: getAllActiveContestants(),
					playerContestant,
					strategy: playerContestant.monster.targetingStrategy
				});
				const { monster: proposedTarget } = targetContestant;

				playerContestant.round = round;

				// Track the fight log
				fightLog.push(`${player.givenName}: ${card.name} target ${proposedTarget.givenName}`);

				// Play the card
				card
					// The current monster always attacks the next monster
					// This could be updated in future versions to take into account teams / alignment, and/or to randomize who is targeted
					.play(player, proposedTarget, ring, getAllActiveContestants())
					.then(() => {
						// Is there more than one monster left alive in the ring?
						if (getAllActiveContestants().length > 1) {
							return this.channelManager.sendMessages()
								.then(() => next());
						}

						// The fight is over, let's end this promise chain
						// Also return the contestant we ended on for bookkeeping purposes
						return this.channelManager.sendMessages()
							.then(() => resolve(playerContestant));
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
					// Emit an event when the round ends
					this.emit('roundComplete', {
						contestants,
						round
					});

					// Limit to 10 rounds (anyone left alive at that point will be a winner)
					if (round === 10) {
						resolve();
						return;
					}

					// Increment the round counter
					round += 1;

					// Reset the value of `emptyHanded`
					allActiveContestants.forEach(({ monster }) => {
						monster.emptyHanded = false;
						monster.round = round;
					});

					// The round is over so we'll go back to the first card in everyone's hand
					nextCardIndex = 0;

					// We also want to restart to the first contestant since the round is ending now
					// In a game where everyone has the same size hand this would happen anyway, but we reset for unbalanced games
					activeContestants = allActiveContestants;
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

		const deadContestants = [];
		contestants.forEach((contestant) => {
			if (contestant.monster.dead) {
				deadContestants.push(contestant);
			}

			contestant.killed = contestant.monster.killed;
			contestant.killedBy = contestant.monster.killedBy;
			contestant.fled = contestant.monster.fled;
			contestant.rounds = contestant.monster.round;
			contestant.encounter = contestant.monster.endEncounter();
		});
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

			this.awardMonsterXP(contestant, contestants);

			if (deaths > 0) {
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
							announce: `${contestant.monster.givenName} has died in battle. You may now \`revive\` or \`dismiss\` ${contestant.monster.pronouns.him}.`,
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

	awardMonsterXP (contestant, contestants) {
		const { monster, killed } = contestant;
		const { gainedXP, reasons } = calculateXP(contestant, contestants);

		if (gainedXP > 0) {
			monster.xp += gainedXP;

			this.emit('gainedXP', {
				contestant,
				creature: monster,
				killed,
				xpGained: gainedXP,
				reasons
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
				const numberOfBossesInRing = ring.contestants.reduce((total, contestant) => total + (contestant.isBoss ? 1 : 0), 0);
				if (!ring.inEncounter && numberOfBossesInRing < MAX_BOSSES) {
					ring.emit('bossWillSpawn', { delay: 120000 });
				}

				pause.setTimeout(() => {
					ring.spawnBoss();
					ring.startBossTimer(); // Do it again in about an hour
				}, 120000);
			}, random(2100000, 3480000));
		}
	}

	spawnBoss () { // eslint-disable-line consistent-return
		const numberOfBossesInRing = this.contestants.reduce((total, contestant) => total + (contestant.isBoss ? 1 : 0), 0);

		// Only try to enter the ring if there's not a current fight in progress
		if (!this.inEncounter && numberOfBossesInRing < MAX_BOSSES) {
			const contestant = randomContestant();

			this.addMonster(contestant);

			// What should we do after 10 minutes?
			// 50/50 chance we'll stick around
			if (random(1)) {
				// Otherwise, leave the ring if no one joins the fight
				const ring = this;
				pause.setTimeout(() => {
					ring.removeBoss(contestant);
				}, 600000);
			}

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
