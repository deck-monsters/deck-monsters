const reduce = require('lodash.reduce');
const zlib = require('zlib');

const { all: cardTypes, draw } = require('./cards');
const { all: monsterTypes } = require('./monsters');
const { COINS_PER_VICTORY, COINS_PER_DEFEAT } = require('./helpers/coins');
const { create: createCharacter } = require('./characters');
const { globalSemaphore } = require('./helpers/semaphore');
const { XP_PER_VICTORY, XP_PER_DEFEAT } = require('./helpers/experience');
const aws = require('./helpers/aws');
const BaseClass = require('./baseClass');
const cardProbabilities = require('./card-probabilities.json');
const ChannelManager = require('./channel');
const PlayerHandbook = require('./player-handbook');
const Ring = require('./ring');
const Exploration = require('./exploration');

const announceBossWillSpawn = require('./announcements/bossWillSpawn.js');
const announceCard = require('./announcements/card.js');
const announceCardDrop = require('./announcements/cardDrop.js');
const announceContestant = require('./announcements/contestant.js');
const announceContestantLeave = require('./announcements/contestantLeave.js');
const announceDeath = require('./announcements/death.js');
const announceEffect = require('./announcements/effect.js');
const announceEndOfDeck = require('./announcements/endOfDeck.js');
const announceFight = require('./announcements/fight.js');
const announceFightConcludes = require('./announcements/fightConcludes.js');
const announceHeal = require('./announcements/heal.js');
const announceHit = require('./announcements/hit.js');
const announceLeave = require('./announcements/leave.js');
const announceMiss = require('./announcements/miss.js');
const announceModifier = require('./announcements/modifier.js');
const announceNarration = require('./announcements/narration.js');
const announceNextRound = require('./announcements/nextRound.js');
const announceRolled = require('./announcements/rolled.js');
const announceRolling = require('./announcements/rolling.js');
const announceStay = require('./announcements/stay.js');
const announceTurnBegin = require('./announcements/turnBegin.js');
const announceXPGain = require('./announcements/xpGain.js');

const PUBLIC_CHANNEL = 'PUBLIC_CHANNEL';

class Game extends BaseClass {
	constructor (publicChannel, options, log = () => {}) {
		super(options, globalSemaphore);

		this.log = log;
		this.key = `DeckMonsters.Backup.${Date.now()}`;
		this.channelManager = new ChannelManager({}, this.log);
		this.channelManager.addChannel({ channel: publicChannel, channelName: PUBLIC_CHANNEL });
		this.publicChannel = ({ announce }) => this.channelManager.queueMessage({ announce, channelName: PUBLIC_CHANNEL });
		this.ring = new Ring(this.channelManager, { spawnBosses: this.options.spawnBosses }, this.log);
		this.exploration = new Exploration(this.log);

		this.initializeEvents();

		this.on('stateChange', () => this.saveState());

		this.emit('initialized');
	}

	reset (options) {
		this.optionsStore = {};
		this.setOptions(options);
	}

	get characters () {
		if (this.options.characters === undefined) this.characters = {};

		return this.options.characters || {};
	}

	set characters (characters) {
		this.setOptions({
			characters
		});
	}

	get saveState () {
		return () => {
			const buffer = zlib.gzipSync(JSON.stringify(this));

			if (this.stateSaveFunc) {
				const string = buffer.toString('base64');
				setImmediate(this.stateSaveFunc, string);
			}

			setImmediate(aws.save, this.key, buffer, this.log);
		};
	}

	set saveState (stateSaveFunc) {
		if (stateSaveFunc) {
			this.stateSaveFunc = stateSaveFunc;
		} else {
			delete this.stateSaveFunc;
		}
	}

	initializeEvents () {
		const events = [
			{ event: 'ring.bossWillSpawn', listener: announceBossWillSpawn },
			{ event: 'card.played', listener: announceCard },
			{ event: 'cardDrop', listener: announceCardDrop },
			{ event: 'ring.add', listener: announceContestant },
			{ event: 'ring.remove', listener: announceContestantLeave },
			{ event: 'creature.die', listener: announceDeath },
			{ event: 'card.effect', listener: announceEffect },
			{ event: 'ring.endOfDeck', listener: announceEndOfDeck },
			{ event: 'ring.fight', listener: announceFight },
			{ event: 'ring.fightConcludes', listener: announceFightConcludes },
			{ event: 'creature.hit', listener: announceHit },
			{ event: 'creature.leave', listener: announceLeave },
			{ event: 'card.miss', listener: announceMiss },
			{ event: 'creature.modifier', listener: announceModifier },
			{ event: 'card.narration', listener: announceNarration },
			{ event: 'ring.roundComplete', listener: announceNextRound },
			{ event: 'card.rolled', listener: announceRolled },
			{ event: 'card.rolling', listener: announceRolling },
			{ event: 'card.stay', listener: announceStay },
			{ event: 'ring.turnBegin', listener: announceTurnBegin },
			{ event: 'ring.gainedXP', listener: announceXPGain },
			{ event: 'gainedXP', listener: announceXPGain }
		];

		events.map(event => this.on(event.event, (...args) => {
			event.listener(this.publicChannel, this.channelManager, ...args);
		}));

		// this one needs ring, the others don't (or have it already).
		this.on('creature.heal', (...args) => {
			announceHeal(this.publicChannel, this.channelManager, this.ring, ...args);
		});

		this.on('creature.win', this.handleWinner);
		this.on('creature.loss', this.handleLoser);
		this.on('creature.permaDeath', this.handlePermaDeath);
		this.on('creature.fled', this.handleFled);
	}

	handleWinner (className, monster, { contestant }) {
		// Draw a card, maybe kick off more events (that could be messaged)

		// Add XP to the character in the case of victory
		contestant.character.xp += XP_PER_VICTORY;

		// Also give coins to the victor
		contestant.character.coins += COINS_PER_VICTORY;

		// Also draw a new card for the player
		const card = this.drawCard({}, monster);
		contestant.character.addCard(card);

		this.emit('cardDrop', {
			contestant,
			card
		});

		this.emit('gainedXP', {
			contestant,
			creature: contestant.character,
			xpGained: XP_PER_VICTORY,
			coinsGained: COINS_PER_VICTORY
		});
	}

	handlePermaDeath (className, monster, { contestant }) {
		// Award XP, maybe kick off more events (that could be messaged)

		// The character still earns a small bit of XP and coins in the case of defeat
		contestant.character.xp += XP_PER_DEFEAT * 2;
		contestant.character.coins += COINS_PER_DEFEAT * 2;

		this.emit('gainedXP', {
			contestant,
			creature: contestant.character,
			xpGained: XP_PER_DEFEAT * 2,
			coinsGained: COINS_PER_DEFEAT * 2
		});
	}

	handleLoser (className, monster, { contestant }) { // eslint-disable-line class-methods-use-this
		// Award XP, maybe kick off more events (that could be messaged)

		// The character still earns a small bit of XP and coins in the case of defeat
		contestant.character.xp += XP_PER_DEFEAT;
		contestant.character.coins += COINS_PER_DEFEAT;

		this.emit('gainedXP', {
			contestant,
			creature: contestant.character,
			xpGained: XP_PER_DEFEAT,
			coinsGained: COINS_PER_DEFEAT
		});
	}

	handleFled (className, monster, { contestant }) {
		// The character and monster still earn a small bit of XP and coins when he/she/it flees.
		monster.xp += XP_PER_DEFEAT;
		contestant.character.xp += XP_PER_DEFEAT;
		contestant.character.coins += COINS_PER_DEFEAT;

		this.emit('gainedXP', {
			contestant,
			creature: contestant.character,
			xpGained: XP_PER_DEFEAT,
			coinsGained: COINS_PER_DEFEAT
		});

		this.emit('gainedXP', {
			contestant,
			creature: monster,
			xpGained: XP_PER_DEFEAT
		});
	}

	clearRing () {
		this.ring.clearRing();
	}

	getCharacter (channel, channelName, {
		id, name, type, gender, icon
	}) {
		const game = this;
		const { log, ring } = game;

		return Promise
			.resolve(this.characters[id])
			.then((existingCharacter) => {
				if (!existingCharacter) {
					return createCharacter(channel, {
						name, type, gender, icon
					})
						.then((character) => {
							game.characters[id] = character;

							game.emit('characterCreated', { character });

							return character;
						});
				}

				return existingCharacter;
			})
			.then(character => ({
				character,
				spawnMonster (options) {
					return character.spawnMonster(channel, Object.assign({}, options, { game }))
						.catch(err => log(err));
				},
				equipMonster ({ monsterName, cardSelection } = {}) {
					let selectedCards = [];
					if (cardSelection) {
						if (cardSelection.includes(', ')) {
							selectedCards = cardSelection.split(', ');
						} else {
							selectedCards = cardSelection.split(' ');
						}
					}

					return character.equipMonster({ monsterName, cardSelection: selectedCards, channel })
						.catch(err => log(err));
				},
				callMonsterOutOfTheRing ({ monsterName } = '') {
					return character.callMonsterOutOfTheRing({
						monsterName, ring, channel, channelName
					})
						.catch(err => log(err));
				},
				sendMonsterExploring ({ monsterName } = {}) {
					return character.sendMonsterExploring({
						monsterName, exploration, channel, channelName
					})
						.catch(err => log(err));
				},
				sendMonsterToTheRing ({ monsterName } = {}) {
					return character.sendMonsterToTheRing({
						monsterName, ring, channel, channelName
					})
						.catch(err => log(err));
				},
				dismissMonster ({ monsterName } = {}) {
					return character.dismissMonster({ monsterName, channel })
						.catch(err => log(err));
				},
				reviveMonster ({ monsterName } = {}) {
					return character.reviveMonster({ monsterName, channel })
						.catch(err => log(err));
				},
				lookAtMonster ({ monsterName } = {}) {
					return game.lookAtMonster(channel, monsterName, character)
						.catch(err => log(err));
				},
				lookAtCard ({ cardName } = {}) {
					return game.lookAtCard(channel, cardName)
						.catch(err => log(err));
				},
				lookAtCards ({ deckName } = {}) {
					return character.lookAtCards(channel, deckName)
						.catch(err => log(err));
				},
				lookAtMonsters ({ inDetail } = {}) {
					return character.lookAtMonsters(channel, inDetail)
						.catch(err => log(err));
				},
				lookAtRing ({ ringName } = {}) {
					return game.lookAtRing(channel, ringName)
						.catch(err => log(err));
				},
				lookAt (thing) {
					return game.lookAt(channel, thing)
						.catch(err => log(err));
				},
				editMonster ({ monsterName } = {}) {
					return game.editMonster(channel, monsterName)
						.catch(err => log(err));
				}
			}))
			.catch(err => log(err));
	}

	static getCardTypes () {
		return cardTypes.reduce((obj, Card) => {
			obj[Card.cardType.toLowerCase()] = Card;
			return obj;
		}, {});
	}

	static getMonsterTypes () {
		return monsterTypes.reduce((obj, Monster) => {
			obj[Monster.monsterType.toLowerCase()] = Monster;
			return obj;
		}, {});
	}

	getAllMonstersLookup () {
		return reduce(this.characters, (all, character) => {
			character.monsters.forEach((monster) => {
				all[monster.givenName.toLowerCase()] = monster;
			});

			return all;
		}, {});
	}

	lookAtMonster (channel, monsterName, character) {
		if (monsterName) {
			const allMonsters = this.getAllMonstersLookup();
			const monster = allMonsters[monsterName.toLowerCase()];
			const ownsMonster = character.ownsMonster(monsterName);

			if (monster) return monster.look(channel, ownsMonster);
		}

		return Promise.reject(channel({
			announce: `I can find no monster by the name of ${monsterName}.`,
			delay: 'short'
		}));
	}

	editMonster (channel, monsterName) {
		if (monsterName) {
			const allMonsters = this.getAllMonstersLookup();
			const monster = allMonsters[monsterName.toLowerCase()];

			if (monster) return monster.edit(channel);
		}

		return Promise.reject(channel({
			announce: `I can find no monster by the name of ${monsterName}.`,
			delay: 'short'
		}));
	}

	lookAtCard (channel, cardName) {
		if (cardName) {
			const cards = this.constructor.getCardTypes();
			const Card = cards[cardName.toLowerCase()];

			if (Card) {
				const card = new Card();
				return card.look(channel);
			}
		}

		return Promise.reject(channel({
			announce: `Sorry, we don't carry ${cardName} cards here.`,
			delay: 'short'
		}));
	}

	getCardProbabilities () { // eslint-disable-line class-methods-use-this
		return cardProbabilities;
	}

	getRing () {
		return this.ring;
	}

	lookAtRing (channel, ringName = 'main') {
		return this.getRing(ringName).look(channel);
	}

	lookAt (channel, thing) {
		if (thing) {
			// What is this thing?

			// Is it a player handbook?
			if (thing.match(/player(?:s)? handbook/i)) {
				const handbook = new PlayerHandbook();
				return handbook.look(channel);
			}

			// Is it a monster manual?
			if (thing.match(/monster(?:s)? manual/i)) { // monster manual will talk about the different monsters you can capture and their stats etc
				return Promise.reject(channel({
					announce: 'Monster manual coming soon!',
					delay: 'short'
				}));
			}

			// Is it a dungeon master guide?
			if (thing.match(/(?:dungeon master(?:s)?|dm) guide|dmg/i)) { // dmg will talk about how to make new cards, monsters, and dungeons. Basically, the developer docs
				return Promise.reject(channel({
					announce: 'dungeon master guide coming soon!',
					delay: 'short'
				}));
			}

			// Is it a monster?
			const monsters = this.getAllMonstersLookup();
			const monster = monsters[thing.toLowerCase()];

			if (monster) return monster.look(channel);

			// Is it a card?
			const cards = this.constructor.getCardTypes();
			const Card = cards[thing.toLowerCase()];

			if (Card) {
				const card = new Card();
				return card.look(channel);
			}
		}

		return Promise.reject(channel({
			announce: `I don't see a ${thing} here.`,
			delay: 'short'
		}));
	}

	drawCard (options, monster) {
		const card = draw(options, monster);

		this.emit('cardDrawn', { card });

		return card;
	}
}

Game.eventPrefix = 'game';

module.exports = Game;
