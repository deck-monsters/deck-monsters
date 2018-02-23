const find = require('lodash.find');
const reduce = require('lodash.reduce');
const zlib = require('zlib');

const { all: cardTypes, draw } = require('./cards');
const { all: itemTypes } = require('./items');
const { all: monsterTypes } = require('./monsters');
const { COINS_PER_VICTORY, COINS_PER_DEFEAT } = require('./constants/coins');
const { create: createCharacter } = require('./characters');
const { globalSemaphore } = require('./helpers/semaphore');
const { listen, loadHandlers } = require('./commands');
const { XP_PER_VICTORY, XP_PER_DEFEAT } = require('./helpers/experience');
const announcements = require('./announcements');
const aws = require('./helpers/aws');
const BaseClass = require('./shared/baseClass');
const cardProbabilities = require('./card-probabilities.json');
const ChannelManager = require('./channel');
const dungeonMasterGuide = require('./build/dungeon-master-guide');
const Exploration = require('./exploration');
const monsterManual = require('./build/monster-manual');
const playerHandbook = require('./build/player-handbook');
const Ring = require('./ring');

// channel names
const { MAIN_RING } = require('./helpers/channel-names');

class Game extends BaseClass {
	constructor ({ mainRing, theWorld }, options, log = () => {}) {
		super(options, globalSemaphore);

		this.log = log;
		this.key = `DeckMonsters.Backup.${Date.now()}`;
		this.channelManager = new ChannelManager({}, this.log);
		this.channelManager.addChannel({ channel: mainRing.channel, channelName: mainRing.channelName });
		this.channelManager.addChannel({ channel: theWorld.channel, channelName: theWorld.channelName });
		this.publicChannel = ({ announce, channelName = MAIN_RING }) => this.channelManager.queueMessage({ announce, channelName });
		this.ring = new Ring(this.channelManager, { spawnBosses: this.options.spawnBosses }, this.log);
		this.exploration = new Exploration(this.channelManager, {}, this.log);

		this.initializeEvents();
		loadHandlers();

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
		announcements.initialize(this);

		this.on('creature.win', this.handleWinner);
		this.on('creature.loss', this.handleLoser);
		this.on('creature.permaDeath', this.handlePermaDeath);
		this.on('creature.fled', this.handleFled);
	}

	handleCommand ({
		command,
		game = this
	}) {
		return listen({
			command,
			game
		});
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

	getCharacter ({
		channel,
		gender,
		icon,
		id,
		name,
		type
	}) {
		const game = this;

		return Promise
			.resolve(this.characters[id])
			.then((existingCharacter) => {
				if (!existingCharacter) {
					return createCharacter(channel, {
						name, type, gender, icon, game
					})
						.then((character) => {
							game.characters[id] = character;

							game.emit('characterCreated', { character });

							return character;
						});
				}

				return existingCharacter;
			});
	}

	static getCardTypes () {
		return cardTypes.reduce((obj, Card) => {
			obj[Card.cardType.toLowerCase()] = Card;
			return obj;
		}, {});
	}

	static getItemTypes () {
		return itemTypes.reduce((obj, Item) => {
			obj[Item.itemType.toLowerCase()] = Item;
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

	findCharacterByName (name) {
		return find(this.characters, character => character.givenName.toLowerCase() === name.toLowerCase());
	}

	lookAtCharacter (channel, characterName, self) {
		if (characterName) {
			const character = this.findCharacterByName(characterName);
			const isSelf = character === self;

			if (character) return character.look(channel, isSelf);
		}

		return Promise.reject(channel({
			announce: `I can find no character by the name of ${characterName}.`,
			delay: 'short'
		}));
	}

	editCharacter (channel, characterName) {
		if (characterName) {
			const character = this.findCharacterByName(characterName);

			if (character) return character.edit(channel);
		}

		return Promise.reject(channel({
			announce: `I can find no character by the name of ${characterName}.`,
			delay: 'short'
		}));
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
				return card.look(channel, true);
			}
		}

		return Promise.reject(channel({
			announce: `Sorry, we don't carry ${cardName} cards here.`,
			delay: 'short'
		}));
	}

	lookAtItem (channel, itemName) {
		if (itemName) {
			const items = this.constructor.getItemTypes();
			const Item = items[itemName.toLowerCase()];

			if (Item) {
				const item = new Item();
				return item.look(channel, true);
			}
		}

		return Promise.reject(channel({
			announce: `Sorry, we don't carry ${itemName} here.`,
			delay: 'short'
		}));
	}

	getCardProbabilities () { // eslint-disable-line class-methods-use-this
		return cardProbabilities;
	}

	getRing () {
		return this.ring;
	}

	getExploration () {
		return this.exploration;
	}

	lookAtRing (channel, ringName = 'main', showCharacters, summary) {
		return this.getRing(ringName).look(channel, showCharacters, summary);
	}

	lookAtRingCards (channel, ringName = 'main') {
		return this.getRing(ringName).lookAtCards(channel);
	}

	lookAt (channel, thing) {
		if (thing) {
			// What is this thing?

			// Is it a dungeon master guide?
			if (thing.match(/(?:dungeon master(?:s)?|dm) guide|dmg/i)) {
				return dungeonMasterGuide({ channel });
			}

			// Is it a monster manual?
			if (thing.match(/monster(?:s)? manual/i)) {
				return monsterManual({ channel });
			}

			// Is it a player handbook?
			if (thing.match(/player(?:s)? handbook/i)) {
				return playerHandbook(channel);
			}

			// Is it a monster?
			const monsters = this.getAllMonstersLookup();
			const monster = monsters[thing];

			if (monster) return monster.look(channel);

			// Is it a card?
			const cards = this.constructor.getCardTypes();
			const Card = cards[thing];

			if (Card) {
				const card = new Card();
				return card.look(channel);
			}

			// Is it an item?
			const items = this.constructor.getItemTypes();
			const Item = items[thing];

			if (Item) {
				const item = new Item();
				return item.look(channel);
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
