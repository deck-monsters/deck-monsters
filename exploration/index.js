/* eslint-disable max-len */

const BaseClass = require('../baseClass');
const moment = require('moment');
const isProbable = require('../helpers/is-probable');
const pause = require('../helpers/pause');
const shuffle = require('lodash.shuffle');

const HazardCard = require('./discoveries/hazard');
const NothingCard = require('./discoveries/nothing');
const DeathCard = require('./discoveries/death');

const { ONE_MINUTE } = require('../helpers/delay-times');

class Exploration extends BaseClass {
	constructor (channelManager, { ...options } = {}, log) {
		super(options);

		this.log = log;
		this.channelManager = channelManager;

		this.startExplorationTimer();
	}

	get explorers () {
		return this.options.explorers || [];
	}

	set explorers (explorers) {
		return this.setOptions({
			explorers
		});
	}

	set discoveries (discoveries) {
		this.setOptions({
			discoveries
		});
	}

	get discoveries () { // eslint-disable-line class-methods-use-this
		return this.options.discoveries;
	}

	getExplorer (targetMonster) {
		return this.explorers.find(explorer => JSON.stringify(explorer.monster) === JSON.stringify(targetMonster));
	}

	monsterIsExploring (targetMonster) {
		return !!this.getExplorer(targetMonster);
	}

	sendMonsterExploring ({
		monster, character, channel, channelName
	}) {
		if (!this.monsterIsExploring(monster)) {
			const explorer = {
				monster,
				character,
				channel,
				channelName,
				startTime: moment(),
				returnTime: moment().add(10, 'seconds'),
				discoveries: []
			};

			this.explorers = [...this.explorers, explorer];

			this.emit('add', {
				explorer
			});

			this.channelManager.queueMessage({
				announce: `${monster.givenName} has gone exploring.

The Road goes ever on and on
Down from the town where it began.
Now far ahead the Road has gone,
And ${monster.givenName} must follow, if ${monster.pronouns[0]} can,
Pursuing it with eager feet,
Until it joins some larger way
Where many treasures and fell beasts meet.
And whither then ${monster.pronouns[0]} cannot say.`,
				channel,
				channelName
			});
		} else {
			const exploringMonster = this.getExplorer(monster);
			this.channelManager.queueMessage({
				announce: `Your monster is already exploring and will return at ${exploringMonster.returnTime.format('dddd, MMMM Do YYYY, h:mm:ss a')}`,
				channel,
				channelName
			});
		}
	}

	startExplorationTimer () {
		const exploration = this;

		pause.setTimeout(() => {
			exploration.doExploration();
			exploration.startExplorationTimer();
		}, ONE_MINUTE);
	}

	makeDiscovery (explorer) {
		const discoveries = shuffle(this.discoveries);

		// if (explorer) {
		// 	discoveries = discoveries.filter(discovery => explorer.canFind(discovery));
		// }

		const Discovery = discoveries.find(isProbable);

		if (!Discovery) return this.makeDiscovery(explorer);

		const discovery = new Discovery();
		discovery.look(explorer.channel);
		discovery.play(explorer.monster, explorer.monster)

		return discovery;
	}

	doExploration () {
		this.explorers.forEach((explorer) => {
			explorer.discoveries.push(this.makeDiscovery(explorer));

			if (explorer.monster.dead || explorer.discoveries.length >= 15 || moment() > explorer.returnTime) {
				this.sendMonsterHome(explorer);
			}
		});
	}

	sendMonsterHome (explorer) {
		if (this.monsterIsExploring(explorer.monster)) {
			const explorerIndex = this.explorers.indexOf(explorer);

			this.explorers.splice(explorerIndex, 1);

			const deadMessage = `${explorer.monster.givenName}'s carcase is wheeled home in a cart by a kindly stranger`;
			const aliveMessage = `${explorer.monster.givenName} has returned to nestle safely into your warm embrace.`;

			this.channelManager.queueMessage({
				announce: explorer.monster.dead ? deadMessage : aliveMessage,
				channel: explorer.channel,
				channelName: explorer.channelName
			});
		}
	}
}

Exploration.eventPrefix = 'exploration';
Exploration.defaults = {
	discoveries: [
		DeathCard,
		HazardCard,
		NothingCard
		// 'card',
		// 'monster',
		// 'coins',
		// 'xp',
		// 'item',
		// 'dungeon',
		// 'minion',
		// 'boss'
		// 'merchant',
		// 'thief',
		// 'restAndRecovery'
	]
}

module.exports = Exploration;
