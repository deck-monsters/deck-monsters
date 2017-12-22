/* eslint-disable max-len */

const BaseClass = require('../baseClass');
const moment = require('moment');
const isProbable = require('../helpers/is-probable');
const pause = require('../helpers/pause');
const shuffle = require('lodash.shuffle');

const hazard = require('./hazard');

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

	get discoveries () { // eslint-disable-line class-methods-use-this
		return [
			{ type: 'nothing', probability: 100 },
			{ type: 'card', probability: 50 },
			{ type: 'monster', probability: 10 },
			{ type: 'coins', probability: 40 },
			{ type: 'xp', probability: 80 },
			{ type: 'item', probability: 90 },
			{ type: 'dungeon', probability: 30 },
			{ type: 'minion', probability: 60 },
			{ type: 'boss', probability: 5 },
			{ type: hazard, probability: 50 },
			{ type: 'merchant', probability: 70 },
			{ type: 'thief', probability: 30 },
			{ type: 'restAndRecovery', probability: 30 }
		];
	}

	getExplorer (targetMonster) {
		return this.explorers.find(explorer => explorer.monster === targetMonster);
	}

	monsterIsExploring (targetMonster) {
		return !!this.explorers.find(explorer => explorer.monster === targetMonster);
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

		const discovery = discoveries.find(isProbable);

		if (!discovery) return this.makeDiscovery(explorer);

		explorer.discoveries.push(discovery);

		discovery(explorer);

		return discovery;
	}

	doExploration () {
		this.explorers.forEach((explorer) => {
			this.makeDiscovery(explorer);

			if (explorer.discoveries.length >= 5 || moment() > explorer.returnTime) {
				this.sendMonsterHome(explorer);
			}
		});
	}

	sendMonsterHome (explorer) {
		if (this.monsterIsExploring(explorer.monster)) {
			const explorerIndex = this.explorers.indexOf(explorer);

			this.explorers.splice(explorerIndex, 1);

			this.channelManager.queueMessage({
				announce: `${explorer.monster.givenName} has returned to nestle safely into your warm embrace.`,
				channel: explorer.channel,
				channelName: explorer.channelName
			});
		}
	}
}

Exploration.eventPrefix = 'exploration';

module.exports = Exploration;
