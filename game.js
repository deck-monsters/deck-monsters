const reduce = require('lodash.reduce');
const moment = require('moment');
const zlib = require('zlib');

const { actionCard, monsterCard } = require('./helpers/card');
const { all: cardTypes, draw } = require('./cards');
const { all: monsterTypes } = require('./monsters');
const { COINS_PER_VICTORY, COINS_PER_DEFEAT } = require('./helpers/coins');
const { create: createCharacter } = require('./characters');
const { getFlavor } = require('./helpers/flavor');
const { globalSemaphore } = require('./helpers/semaphore');
const { signedNumber } = require('./helpers/signed-number');
const { XP_PER_VICTORY, XP_PER_DEFEAT } = require('./helpers/experience');
const aws = require('./helpers/aws');
const BaseClass = require('./baseClass');
const cardProbabilities = require('./card-probabilities.json');
const ChannelManager = require('./channel');
const PlayerHandbook = require('./player-handbook');
const Ring = require('./ring');

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
		// Initialize Messaging
		this.on('card.effect', this.announceEffect);
		this.on('card.miss', this.announceMiss);
		this.on('card.narration', this.announceNarration);
		this.on('card.played', this.announceCard);
		this.on('card.rolled', this.announceRolled);
		this.on('card.rolling', this.announceRolling);
		this.on('card.stay', this.announceStay);
		this.on('cardDrop', this.announceCardDrop);
		this.on('creature.die', this.announceDeath);
		this.on('creature.heal', this.announceHeal);
		this.on('creature.hit', this.announceHit);
		this.on('creature.leave', this.announceLeave);
		this.on('creature.modifier', this.announceModifier);
		this.on('gainedXP', this.announceXPGain);
		this.on('ring.add', this.announceContestant);
		this.on('ring.bossWillSpawn', this.announceBossWillSpawn);
		this.on('ring.endOfDeck', this.announceEndOfDeck);
		this.on('ring.fight', this.announceFight);
		this.on('ring.fightConcludes', this.announceFightConcludes);
		this.on('ring.gainedXP', this.announceXPGain);
		this.on('ring.remove', this.announceContestantLeave);
		this.on('ring.roundComplete', this.announceNextRound);
		this.on('ring.turnBegin', this.announceTurnBegin);

		// Manage Fights
		this.on('creature.win', this.handleWinner);
		this.on('creature.loss', this.handleLoser);
		this.on('creature.permaDeath', this.handlePermaDeath);
		this.on('creature.fled', this.handleFled);
	}

	/* eslint-disable max-len */
	announceXPGain (className, game, {
		contestant,
		creature,
		xpGained,
		killed,
		coinsGained
	}) {
		const { channel, channelName } = contestant;

		let coinsMessage = '';
		if (coinsGained) {
			coinsMessage = ` and ${coinsGained} coins`;
		}

		let killedMessage = '';
		if (killed) {
			killedMessage = ` for killing ${killed.length} ${killed.length > 1 ? 'monsters' : 'monster'}.`;
		}

		this.channelManager.queueMessage({
			announce: `${creature.identity} gained ${xpGained} XP${killedMessage}${coinsMessage}`,
			channel,
			channelName
		});
	}

	announceCardDrop (className, game, { contestant, card }) {
		const { publicChannel } = this;
		const { channel, channelName } = contestant;

		const cardDropped = actionCard(card);

		const announce = `${contestant.monster.identity} finds a card for ${contestant.character.identity} in the dust of the ring:

${cardDropped}`;

		this.channelManager.queueMessage({
			announce,
			channel,
			channelName
		});

		publicChannel({
			announce
		});
	}

	announceCard (className, card, { player }) {
		const channel = this.publicChannel;

		const cardPlayed = actionCard(card);

		channel({
			announce:
`${player.identity} lays down the following card:
${cardPlayed}`
		});
	}

	announceTurnBegin (className, ring, { contestant }) {
		const channel = this.publicChannel;
		const { monster } = contestant;

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
		const { monster } = contestant;

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

	announceDeath (className, monster, { assailant, destroyed }) {
		const channel = this.publicChannel;
		let announce;

		if (destroyed) {
			announce = `${monster.identityWithHp} has been sent to the land of ${monster.pronouns[2]} ancestors by ${assailant.identityWithHp}

			☠️  R.I.P ${monster.identity}
`;
		} else {
			announce = `💀  ${monster.identityWithHp} is killed by ${assailant.identityWithHp}
`;
		}

		channel({ announce });
	}

	announceLeave (className, monster, { activeContestants }) {
		const channel = this.publicChannel;
		const assailants = activeContestants
			.filter(contestant => contestant.monster !== monster)
			.map(contestant => contestant.monster.identityWithHp);

		channel({
			announce:
`${monster.identityWithHp} flees from ${assailants.join(' and ')}
`
		});
	}

	announceStay (className, card, { fleeRoll, player, activeContestants }) {
		const channel = this.publicChannel;

		if (fleeRoll) {
			const assailants = activeContestants
				.filter(contestant => contestant.monster !== player)
				.map(contestant => contestant.monster.identityWithHp);
				
			channel({
				announce:
	`${player.identityWithHp} tries to flee from ${assailants.join(' and ')}, but fails!`
			});
		} else {
			channel({
				announce:
	`${player.identityWithHp} bravely stays in the ring.`
			});
		}
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

	announceModifier (className, monster, {
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
`${monster.identity}'s ${attr} is now ${monster[attr]} (${dir} by ${Math.abs(amount)})`
		});
	}

	announceHit (className, monster, {
		assailant,
		card,
		damage,
		prevHp
	}) {
		const channel = this.publicChannel;
		const flavors = card && card.flavors;

		let icon = '🤜';
		if (damage >= 10) {
			icon = '🔥';
		} else if (damage >= 5) {
			icon = '🔪';
		} else if (damage === 1) {
			icon = '🏓';
		}

		const bloodied = (monster.bloodied && prevHp > monster.bloodiedValue) ? `${monster.givenName} is now bloodied. ` : '';
		const only = (monster.bloodied && monster.hp > 0) ? 'only ' : '';

		channel({
			announce:
`${assailant.icon} ${icon} ${monster.icon}  ${assailant.givenName} ${getFlavor('hits', flavors)} ${monster.givenName} for ${damage} damage.

${monster.icon}  *${bloodied}${monster.givenName} has ${only}${monster.hp}HP.*
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

	announceMiss (className, card, {
		attackResult, curseOfLoki, player, target
	}) {
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

	announceEffect (className, card, {
		player, target, effectResult
	}) {
		const channel = this.publicChannel;

		channel({
			announce:
`${target.icon}  ${target.givenName} is currently ${effectResult} by ${player.icon}  ${player.givenName}
`
		});
	}

	announceNarration (className, card, { narration }) {
		const channel = this.publicChannel;

		channel({ announce: narration });
	}

	announceContestant (className, ring, { contestant }) {
		const channel = this.publicChannel;
		const { character, monster } = contestant;

		channel({
			announce:
`A${getFlavor('monsterAdjective')} ${monster.creatureType} has entered the ring at the behest of ${character.icon}  ${character.givenName}.
${monsterCard(monster)}`
		});
	}

	announceContestantLeave (className, ring, { contestant }) {
		const channel = this.publicChannel;
		const { character, monster } = contestant;

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

	announceFightConcludes (className, ring, { deaths, isDraw, rounds }) {
		const channel = this.publicChannel;

		channel({
			announce:
`The fight concluded ${isDraw ? 'in a draw' : `with ${deaths} dead`} after ${rounds} ${rounds === 1 ? 'round' : 'rounds'}!
`
		});

		this.channelManager.sendMessages();
	}

	announceBossWillSpawn (className, ring, { delay }) {
		const channel = this.publicChannel;

		channel({
			announce: `A boss will enter the ring ${moment().add(delay).fromNow()}`
		});

		this.channelManager.sendMessages();
	}
	/* eslint-enable max-len */


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
