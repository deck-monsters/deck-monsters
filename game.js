const reduce = require('lodash.reduce');

const { globalSemaphore } = require('./helpers/semaphore');
const BaseClass = require('./baseClass');
const Ring = require('./ring');
const { all: cardTypes, draw } = require('./cards');
const { all: monsterTypes } = require('./monsters');
const { create: createCharacter } = require('./characters');

const PlayerHandbook = require('./player-handbook');

const ChannelManager = require('./channel');

const { getFlavor } = require('./helpers/flavor');
const { formatCard, monsterCard } = require('./helpers/card');
const { XP_PER_VICTORY, XP_PER_DEFEAT } = require('./helpers/levels');

const noop = () => {};
const { signedNumber } = require('./helpers/signed-number');

const PUBLIC_CHANNEL = 'PUBLIC_CHANNEL';

class Game extends BaseClass {
	constructor (publicChannel, options, log = () => {}) {
		super(options, globalSemaphore);

		this.log = log;
		this.channelManager = new ChannelManager({}, this.log);
		this.channelManager.addChannel({ channel: publicChannel, channelName: PUBLIC_CHANNEL });
		this.publicChannel = ({ announce }) => this.channelManager.queueMessage({ announce, channelName: PUBLIC_CHANNEL });
		this.ring = new Ring(this.channelManager);

		this.initializeEvents();

		const game = this;
		this.on('stateChange', () => this.saveState(game));

		this.emit('initialized');
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
		return this.stateSaveFunc || noop;
	}

	set saveState (stateSaveFunc) {
		if (stateSaveFunc) {
			this.stateSaveFunc = game => stateSaveFunc(JSON.stringify(game));
		} else {
			delete this.stateSaveFunc;
		}
	}

	initializeEvents () {
		// Initialize Messaging
		this.on('card.played', this.announceCard);
		this.on('card.rolling', this.announceRolling);
		this.on('card.rolled', this.announceRolled);
		this.on('card.miss', this.announceMiss);
		this.on('creature.hit', this.announceHit);
		this.on('creature.heal', this.announceHeal);
		this.on('creature.condition', this.announceCondition);
		this.on('creature.die', this.announceDeath);
		this.on('creature.leave', this.announceLeave);
		this.on('card.stay', this.announceStay);
		this.on('ring.add', this.announceContestant);
		this.on('ring.remove', this.announceContestantLeave);
		this.on('ring.fight', this.announceFight);
		this.on('ring.turnBegin', this.announceTurnBegin);
		this.on('ring.endOfDeck', this.announceEndOfDeck);
		this.on('ring.roundComplete', this.announceNextRound);
		this.on('ring.fightConcludes', this.announceFightConcludes);

		this.on('cardDrop', this.announceCardDrop);
		this.on('gainedXP', this.announceXPGain);

		// Manage Fights
		this.on('creature.win', this.handleWinner);
		this.on('creature.loss', this.handleLoser);
	}

	announceXPGain (className, game, { contestant, creature, xpGained }) {
		const channel = contestant.channel;
		const channelName = contestant.channelName;

		this.channelManager.queueMessage({
			announce: `${creature.identity} gained ${xpGained}XP`,
			channel,
			channelName
		});
	}

	announceCardDrop (className, game, { contestant, card }) {
		const channel = contestant.channel;
		const channelName = contestant.channelName;

		const cardDropped = formatCard({
			title: `${card.icon}  ${card.cardType}`,
			description: card.description,
			stats: card.stats
		});

		this.channelManager.queueMessage({
			announce: `The following card dropped for ${contestant.monster.identity}'s victory for ${contestant.character.identity}:
${cardDropped}`,
			channel,
			channelName
		});
	}

	/* eslint-disable max-len */
	announceCard (className, card, { player }) {
		const channel = this.publicChannel;

		const cardPlayed = formatCard({
			title: `${card.icon}  ${card.cardType}`,
			description: card.description,
			stats: card.stats
		});

		channel({
			announce:
`${player.identity} lays down the following card:
${cardPlayed}`
		});
	}

	announceTurnBegin (className, ring, { contestant }) {
		const channel = this.publicChannel;
		const monster = contestant.monster;

		channel({
			announce:
`*It's ${contestant.character.givenName}'s turn.*

${contestant.character.identity} plays the following monster:
${monsterCard(monster, contestant.lastMonsterPlayed !== monster)}`
		});

		contestant.lastMonsterPlayed = monster;
	}

	announceEndOfDeck (className, ring, { contestant }) {
		const channel = this.publicChannel;
		const monster = contestant.monster;

		channel({
			announce:
`${monster.identity} is out of cards.`
		});
	}

	announceNextRound (className, ring, { round }) {
		const channel = this.publicChannel;

		channel({
			announce:
`
🏁       round ${round} complete

###########################################`
		});
	}

	announceDeath (className, monster, { assailant }) {
		const channel = this.publicChannel;

		channel({
			announce:
`${monster.identityWithHp} is killed by ${assailant.identityWithHp}
`
		});
	}

	announceLeave (className, monster, { assailant }) {
		const channel = this.publicChannel;

		channel({
			announce:
`${monster.identityWithHp} flees from ${assailant.identityWithHp}
`
		});
	}

	announceStay (className, monster, { player, target }) {
		const channel = this.publicChannel;

		channel({
			announce:
`${player.identityWithHp} tries to flee from ${target.identityWithHp}, but fails!`
		});
	}

	announceRolling (className, monster, {
		reason,
		roll,
		player
	}) {
		const channel = this.publicChannel;

		let title = roll.primaryDice;
		if (roll.bonusDice) {
			title += signedNumber(roll.bonusDice);
		}
		if (roll.modifier) {
			title += signedNumber(roll.modifier);
		}

		channel({
			announce:
`🎲  ${player.identity} rolls ${title} ${reason}`
		});
	}

	announceRolled (className, monster, {
		reason,
		roll,
		player,
		outcome
	}) {
		const channel = this.publicChannel;

		channel({
			announce:
`🎲  ${player.identity} rolled a ${roll.result} (natural ${roll.naturalRoll.result}${signedNumber(roll.bonusResult)}${signedNumber(roll.modifier)}) ${reason}
    ${outcome}`
		});
	}

	announceCondition (className, monster, {
			amount,
			attr
		}) {
		const channel = this.publicChannel;

		let dir = 'increased';
		if (amount < 0) {
			dir = 'decreased';
		}

		channel({
			announce:
`${monster.identity}'s ${attr} ${dir} by ${amount}`
		});
	}

	announceHit (className, monster, { assailant, damage }) {
		const channel = this.publicChannel;

		let icon = '🤜';
		if (damage >= 10) {
			icon = '🔥';
		} else if (damage >= 5) {
			icon = '🔪';
		} else if (damage === 1) {
			icon = '🏓';
		}

		channel({
			announce:
`${assailant.icon} ${icon} ${monster.icon}  ${assailant.givenName} ${getFlavor('hits')} ${monster.givenName} for ${damage} damage.

${monster.icon}  *${monster.givenName} has ${monster.hp}HP left.*
`
		});
	}

	announceHeal (className, monster, { amount }) {
		const channel = this.publicChannel;

		if (this.ring.monsterIsInRing(monster)) {
			channel({
				announce:
`${monster.icon} 💊      ${monster.givenName} heals ${amount} hp
${monster.icon}  ${monster.givenName} now has ${monster.hp}HP.`
			});
		}
	}

	announceMiss (className, card, { attackResult, curseOfLoki, player, target }) {
		const channel = this.publicChannel;

		let action = 'is blocked by';
		let flavor = '';
		let icon = '🛡';

		if (curseOfLoki) {
			action = 'misses';
			flavor = 'horribly';
			icon = '💨';
		} else if (attackResult > 5) {
			action = 'is barely blocked by';
			icon = '⚔️';
		}

		channel({
			announce:
`${player.icon} ${icon} ${target.icon}    ${player.givenName} ${action} ${target.givenName} ${flavor}
`
		});
	}

	announceContestant (className, ring, { contestant }) {
		const channel = this.publicChannel;
		const monster = contestant.monster;
		const character = contestant.character;

		channel({
			announce:
`A${getFlavor('monsterAdjective')} ${monster.name} has entered the ring at the behest of ${character.icon}  ${character.givenName}.
${monsterCard(monster)}`
		});
	}

	announceContestantLeave (className, ring, { contestant }) {
		const channel = this.publicChannel;
		const monster = contestant.monster;
		const character = contestant.character;

		channel({
			announce:
`${monster.givenName} was summoned from the ring by ${character.identity}.`
		});
	}

	announceFight (className, ring, { contestants }) {
		const channel = this.publicChannel;

		channel({
			announce: contestants.map(contestant => contestant.monster.identityWithHp).join(' vs ')
		});
	}

	announceFightConcludes (className, game, { deaths, isDraw, rounds }) {
		const channel = this.publicChannel;

		channel({
			announce:
`The fight concluded ${isDraw ? 'in a draw' : `with ${deaths} dead`} after ${rounds} ${rounds === 1 ? 'round' : 'rounds'}!
`
		});

		this.channelManager.sendMessages();
	}
	/* eslint-enable max-len */

	handleWinner (className, monster, { contestant }) {
		// Award XP draw a card, maybe kick off more events (that could be messaged)

		// Add XP to both the monster and the character in the case of victory
		contestant.monster.xp += XP_PER_VICTORY;
		contestant.character.xp += XP_PER_VICTORY;

		// Also draw a new card for the player
		const card = this.drawCard({ character: contestant.character });
		contestant.character.addCard(card);

		this.emit('cardDrop', {
			contestant,
			card
		});

		this.emit('gainedXP', {
			contestant,
			creature: contestant.character,
			xpGained: XP_PER_VICTORY
		});

		this.emit('gainedXP', {
			contestant,
			creature: contestant.monster,
			xpGained: XP_PER_VICTORY
		});
	}

	handleLoser (className, monster, { contestant }) { // eslint-disable-line class-methods-use-this
		// Award XP, maybe kick off more events (that could be messaged)

		// The character still earns a small bit of XP in the case of defeat
		contestant.character.xp += XP_PER_DEFEAT;

		this.emit('gainedXP', {
			contestant,
			creature: contestant.character,
			xpGained: XP_PER_DEFEAT
		});
	}

	clearRing () {
		this.ring.clearRing();
	}

	getCharacter (channel, channelName, { id, name, type, gender, icon }) {
		const game = this;
		const ring = this.ring;
		const log = this.log;

		return Promise
			.resolve(this.characters[id])
			.then((existingCharacter) => {
				if (!existingCharacter) {
					return createCharacter(channel, { name, type, gender, icon })
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
				equipMonster ({ monsterName } = {}) {
					return character.equipMonster({ monsterName, channel })
						.catch(err => log(err));
				},
				callMonsterOutOfTheRing ({ monsterName } = '') {
					return character.callMonsterOutOfTheRing({ monsterName, ring, channel, channelName })
						.catch(err => log(err));
				},
				sendMonsterToTheRing ({ monsterName } = {}) {
					return character.sendMonsterToTheRing({ monsterName, ring, channel, channelName })
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
					return game.lookAtMonster(channel, monsterName)
						.catch(err => log(err));
				},
				lookAtCard ({ cardName } = {}) {
					return game.lookAtCard(channel, cardName)
						.catch(err => log(err));
				},
				lookAt (thing) {
					return game.lookAt(channel, thing)
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

	lookAtMonster (channel, monsterName) {
		if (monsterName) {
			const allMonsters = this.getAllMonstersLookup();
			const monster = allMonsters[monsterName.toLowerCase()];

			if (monster) return monster.look(channel);
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

	lookAt (channel, thing) {
		if (thing) {
			// What is this thing?

			// Is it a player handbook?
			if (thing.match(/player(?:s)? handbook/i)) {
				const handbook = new PlayerHandbook();
				return handbook.look(channel);
			}

			// Is it a monster manual?
			if (thing.match(/monster manual/i)) { // monster manual will talk about the different monsters you can capture and their stats etc
				return Promise.reject(channel({
					announce: 'Monster manual coming soon!',
					delay: 'short'
				}));
			}

			// Is it a dungeon master guide?
			if (thing.match(/dungeon master guide/i)) { // dmg will talk about how to make new cards, monsters, and dungeons. Basically, the developer docs
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

	drawCard (options) {
		const card = draw(options);

		this.emit('cardDrawn', { card });

		return card;
	}
}

Game.eventPrefix = 'game';

module.exports = Game;
