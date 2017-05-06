const reduce = require('lodash.reduce');

const { globalSemaphore } = require('./helpers/semaphore');
const BaseClass = require('./baseClass');
const Ring = require('./ring');
const { draw } = require('./cards');
const { all } = require('./monsters');
const { Player } = require('./players');

const { getFlavor } = require('./helpers/flavor');
const { XP_PER_VICTORY, XP_PER_DEFEAT } = require('./helpers/levels');

const noop = () => {};
const signedNumber = number => (number > 0 ? `+${number}` : number.toString());
const monsterWithHp = monster => `${monster.icon} ${monster.givenName} (${monster.hp} hp)`;

class Game extends BaseClass {
	constructor (publicChannel, options) {
		super(options, globalSemaphore);

		this.ring = new Ring();
		this.publicChannel = publicChannel;
		this.initializeEvents();

		const game = this;
		this.on('stateChange', () => this.saveState(game));

		this.emit('initialized');
	}

	get players () {
		if (this.options.players === undefined) this.players = {};

		return this.options.players || {};
	}

	set players (players) {
		this.setOptions({
			players
		});
	}

	get saveState () {
		return this.stateSaveFunc || noop;
	}

	set saveState (stateSaveFunc) {
		if (stateSaveFunc) {
			this.stateSaveFunc = game => stateSaveFunc(JSON.stringify(game));
		} else {
			this.stateSaveFunc = stateSaveFunc;
		}
	}

	initializeEvents () {
		// Initialize Messaging
		this.on('card.played', this.announceCard);
		this.on('card.rolled', this.announceRolled);
		this.on('card.miss', this.announceMiss);
		this.on('creature.hit', this.announceHit);
		this.on('creature.heal', this.announceHeal);
		this.on('creature.condition', this.announceCondition);
		this.on('creature.die', this.announceDeath);
		this.on('creature.leave', this.announceLeave);
		this.on('card.stay', this.announceStay);
		this.on('ring.fight', this.announceFight);
		this.on('ring.roundComplete', this.announceNextRound);
		this.on('ring.fightConcludes', this.announceFightConcludes);

		// Manage Fights
		this.on('creature.win', this.handleWinner);
		this.on('creature.loss', this.handleLoser);
		this.on('ring.fightConcludes', this.clearRing);
	}

	/* eslint-disable max-len */
	announceCard (className, card, { player, target }) {
		const channel = this.publicChannel;

		channel({
			announce: `${monsterWithHp(player)} plays a ${card.cardType.toLowerCase()} card against ${monsterWithHp(target)}`
		});
	}

	announceNextRound (className, ring, { contestants, round }) {
		const channel = this.publicChannel;

		channel({
			announce: `
round ${round} complete
`
		});
	}

	announceDeath (className, monster, { assailant }) {
		const channel = this.publicChannel;

		channel({
			announce: `${monsterWithHp(monster)} is killed by ${monsterWithHp(assailant)}`
		});
	}

	announceLeave (className, monster, { assailant }) {
		const channel = this.publicChannel;

		channel({
			announce: `${monsterWithHp(monster)} flees from ${monsterWithHp(assailant)}`
		});
	}

	announceStay (className, monster, { player, target }) {
		const channel = this.publicChannel;

		channel({
			announce: `${monsterWithHp(player)} tries to flee from ${monsterWithHp(target)}, but failed!`
		});
	}

	announceRolled (className, monster, {
		attackResult,
		attackRoll,
		curseOfLoki,
		damageResult,
		damageRoll,
		player,
		strokeOfLuck,
		target
	}) {
		const channel = this.publicChannel;

		let detail = '';
		if (attackResult) {
			if (strokeOfLuck) {
				channel({
					announce: `${player.icon}        STROKE OF LUCK!!!!`
				});
			} else if (curseOfLoki) {
				channel({
					announce: `${player.icon}        Botched it.`
				});
			}
			detail += `${attackRoll.naturalRoll.result} ${signedNumber(attackResult - attackRoll.naturalRoll.result)} vs ${target.ac}, for ${damageRoll.naturalRoll.result} ${signedNumber(damageResult - damageRoll.naturalRoll.result)} damage`;
		}

		channel({
			announce: `${player.icon}        Rolled ${detail}`
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
			announce: `${monster.icon} ${monster.givenName} ${dir} ${monster.pronouns[2]} ${attr} by ${amount}`
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
			announce: `${assailant.icon} ${icon} ${monster.icon}    ${assailant.givenName} ${getFlavor('hits')} ${monster.givenName} for ${damage} damage`
		});
	}

	announceHeal (className, monster, { amount }) {
		const channel = this.publicChannel;

		channel({
			announce: `${monster.icon} 💊      ${monster.givenName} heals ${amount} hp`
		});
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
			announce: `${player.icon} ${icon} ${target.icon}    ${player.givenName} ${action} ${target.givenName} ${flavor}`
		});
	}

	announceFight (className, ring, { contestants }) {
		const channel = this.publicChannel;

		channel({
			announce: contestants.map(contestant => monsterWithHp(contestant.monster)).join(' vs ')
		});
	}

	announceFightConcludes (className, game, { contestants, deadContestants, deaths, isDraw, rounds }) {
		const channel = this.publicChannel;

		channel({
			announce: `
The fight concluded ${isDraw ? 'in a draw' : `with ${deaths} dead`} afer ${rounds} rounds!
`
		});
	}
	/* eslint-enable max-len */

	handleWinner (className, monster, { contestant }) {
		// Award XP draw a card, maybe kick off more events (that could be messaged)

		// Add XP to both the monster and the player in the case of victory
		contestant.monster.xp += XP_PER_VICTORY;
		contestant.player.xp += XP_PER_VICTORY;

		// Also draw a new card for the player
		const card = this.drawCard();
		contestant.player.addCard(card);
	}

	handleLoser (className, monster, { contestant }) {
		// Award XP, maybe kick off more events (that could be messaged)

		// The player still earns a small bit of XP in the case of defeat
		contestant.player.xp += XP_PER_DEFEAT;
	}

	clearRing () {
		this.ring.clearRing();
	}

	getPlayer ({ id, name }) {
		const ring = this.ring;
		let player = this.players[id];

		if (!player) {
			player = new Player({
				name
			});

			this.players[id] = player;

			this.emit('playerCreated', { player });
		}

		return {
			player,
			spawnMonster (channel, options) {
				return player.spawnMonster(channel, options || {});
			},
			equipMonster (channel, options) {
				return player.equipMonster(channel, options || {});
			},
			sendMonsterToTheRing (channel, options) {
				return player.sendMonsterToTheRing(ring, channel, options || {});
			}
		};
	}

	static getMonsterTypes () {
		return all.reduce((obj, Monster) => {
			obj[Monster.monsterType] = Monster;
			return obj;
		}, {});
	}

	getAllMonsters () {
		return reduce(this.players, (obj, player) => {
			player.monsters.forEach((monster) => {
				obj[monster.givenName] = monster;
			});

			return obj;
		}, {});
	}

	drawCard (options) {
		const card = draw(options);

		this.emit('cardDrawn', { card });

		return card;
	}
}

Game.eventPrefix = 'game';

module.exports = Game;
