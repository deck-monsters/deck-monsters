import { BaseClass } from '../shared/baseClass.js';
import { isProbable } from '../helpers/is-probable.js';
import { shuffle } from '../helpers/random.js';
import { add, formatLongTimestamp, toDate } from '../helpers/time.js';
import { ONE_MINUTE } from '../helpers/delay-times.js';

import HazardCard from './discoveries/hazard.js';
import NothingCard from './discoveries/nothing.js';
import DeathCard from './discoveries/death.js';
import Environment from '../monsters/environment.js';
import type { ChannelCallback } from '../channel/index.js';

export interface Explorer {
	monster: any;
	character: any;
	channel: ChannelCallback;
	channelName: string;
	startTime: Date;
	returnTime: Date;
	discoveries: any[];
}

export class Exploration extends BaseClass {
	static eventPrefix = 'exploration';

	static defaults = {
		discoveries: [DeathCard, HazardCard, NothingCard],
		environment: new Environment(),
	};

	log: (err: unknown) => void;

	constructor(
		_eventBusOrChannelManager: unknown,
		options: Record<string, unknown> = {},
		log: (err: unknown) => void = () => {}
	) {
		super(options);

		this.log = log;

		this.startExplorationTimer();
	}

	get environment(): any {
		return (this.options as any).environment;
	}

	set environment(environment: any) {
		this.setOptions({ environment } as any);
	}

	get explorers(): Explorer[] {
		return (this.options as any).explorers || [];
	}

	set explorers(explorers: Explorer[]) {
		this.setOptions({ explorers } as any);
	}

	get discoveries(): any[] {
		return (this.options as any).discoveries;
	}

	set discoveries(discoveries: any[]) {
		this.setOptions({ discoveries } as any);
	}

	getExplorer(targetMonster: any): Explorer | undefined {
		return this.explorers.find(explorer => explorer.monster === targetMonster);
	}

	monsterIsExploring(targetMonster: any): boolean {
		return !!this.getExplorer(targetMonster);
	}

	sendMonsterExploring({
		monster,
		character,
		channel,
		channelName,
	}: {
		monster: any;
		character: any;
		channel: ChannelCallback;
		channelName: string;
	}): void {
		if (!this.monsterIsExploring(monster)) {
			const explorer: Explorer = {
				monster,
				character,
				channel,
				channelName,
				startTime: toDate(),
				returnTime: add(Date.now(), 10000),
				discoveries: [],
			};

			this.explorers = [...this.explorers, explorer];

			this.emit('add', { explorer });

			channel({
				announce: `${monster.givenName} has gone exploring.

The Road goes ever on and on
Down from the town where it began.
Now far ahead the Road has gone,
And ${monster.givenName} must follow, if ${monster.pronouns.he} can,
Pursuing it with eager feet,
Until it joins some larger way
Where many treasures and fell beasts meet.
And whither then ${monster.pronouns.he} cannot say.`,
			});
		} else {
			const exploringMonster = this.getExplorer(monster)!;
			channel({
				announce: `Your monster is already exploring and will return at ${formatLongTimestamp(exploringMonster.returnTime)}`,
			});
		}
	}

	startExplorationTimer(): void {
		const exploration = this;

		setTimeout(() => {
			exploration.doExploration();
			exploration.startExplorationTimer();
		}, ONE_MINUTE);
	}

	makeDiscovery(explorer: Explorer): any {
		let discoveries = shuffle(this.discoveries);

		if (explorer) {
			discoveries = discoveries.filter((discovery: any) =>
				explorer.monster.canHold(discovery)
			);
		}

		const Discovery = discoveries.find(isProbable);

		if (!Discovery) return this.makeDiscovery(explorer);

		const discovery = new Discovery();
		discovery.look(explorer.channel);
		discovery.play(this.environment, explorer.monster);

		return discovery;
	}

	doExploration(): void {
		this.explorers.forEach(explorer => {
			const discovery = this.makeDiscovery(explorer);

			explorer.discoveries.push(discovery);

			if (
				explorer.monster.dead ||
				explorer.discoveries.length >= 15 ||
				toDate() > toDate(explorer.returnTime)
			) {
				this.sendMonsterHome(explorer);
			}
		});
	}

	sendMonsterHome(explorer: Explorer): void {
		if (this.monsterIsExploring(explorer.monster)) {
			const explorerIndex = this.explorers.indexOf(explorer);

			this.explorers.splice(explorerIndex, 1);

			const deadMessage = `${explorer.monster.givenName}'s carcase is wheeled home in a cart by a kindly stranger`;
			const aliveMessage = `${explorer.monster.givenName} has returned to nestle safely into your warm embrace.`;

			explorer.channel({
				announce: explorer.monster.dead ? deadMessage : aliveMessage,
			});
		}
	}
}

export default Exploration;
