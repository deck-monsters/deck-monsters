import { expect } from 'chai';
import sinon from 'sinon';

import Basilisk from '../monsters/basilisk.js';
import Beastmaster from '../characters/beastmaster.js';
import Game from '../game.js';
import { RoomEventBus } from '../events/index.js';
import BaseDiscoveryCard from './discoveries/base.js';
import DeathCard from './discoveries/death.js';
import NothingCard from './discoveries/nothing.js';

describe('exploration/index.ts', () => {
	let privateChannelStub: sinon.SinonStub;
	let publicChannelStub: sinon.SinonStub;

	let game: Game;
	let exploration: any;

	let character: any;
	let monster: any;

	let channelName: string;
	let clock: sinon.SinonFakeTimers;

	beforeEach(() => {
		publicChannelStub = sinon.stub().resolves(undefined);
		privateChannelStub = sinon.stub().resolves(undefined);
		clock = sinon.useFakeTimers({ shouldClearNativeTimers: true });

		channelName = 'TEST_CHANNEL';

		game = new Game();
		exploration = game.getExploration();

		character = new Beastmaster();
		monster = new Basilisk();
		character.addMonster(monster);

		exploration.sendMonsterExploring({
			monster,
			character,
			channel: privateChannelStub,
			channelName,
		});
	});

	afterEach(() => {
		clock.restore();
		sinon.restore();
	});

	it('has an event bus', () => {
		expect(game.eventBus).to.be.instanceOf(RoomEventBus);
	});

	describe('monsters', () => {
		it('can be sent exploring', () => {
			expect(exploration.explorers.length).to.equal(1);
			expect(exploration.monsterIsExploring(monster)).to.equal(true);
		});

		it('can not be re-sent exploring if already exploring', () => {
			expect(exploration.explorers.length).to.equal(1);
			expect(exploration.monsterIsExploring(monster)).to.equal(true);
			expect(exploration.explorers.length).to.equal(1);
			expect(exploration.monsterIsExploring(monster)).to.equal(true);
		});

		it('can be sent home', () => {
			expect(exploration.explorers.length).to.equal(1);
			expect(exploration.monsterIsExploring(monster)).to.equal(true);

			const explorer = exploration.getExplorer(monster);

			exploration.sendMonsterHome(explorer);
			expect(exploration.explorers.length).to.equal(0);
			expect(exploration.monsterIsExploring(monster)).to.equal(false);
		});

		it('can make discoveries', () => {
			const explorer = exploration.getExplorer(monster);

			const aDiscovery = exploration.makeDiscovery(explorer);
			expect(aDiscovery).to.be.instanceOf(BaseDiscoveryCard);
		});

		it('can explore', () => {
			const explorer = exploration.getExplorer(monster);
			expect(explorer.discoveries).to.have.length(0);

			exploration.doExploration();
			expect(explorer.discoveries).to.have.length(1);
		});

		it('is sent home after 15 discoveries', () => {
			const explorer = exploration.getExplorer(monster);
			expect(explorer.discoveries).to.have.length(0);

			const makeDiscoveryStub = sinon
				.stub(Object.getPrototypeOf(exploration), 'makeDiscovery')
				.callsFake((fakeExplorer: any) => {
					const nothing = new NothingCard();
					nothing.look(fakeExplorer.channel);
					nothing.play(fakeExplorer.monster, fakeExplorer.monster);

					return nothing;
				});

			while (exploration.monsterIsExploring(explorer.monster)) {
				exploration.doExploration();
			}

			makeDiscoveryStub.restore();

			expect(explorer.discoveries.length).to.equal(15);
			expect(exploration.explorers.length).to.equal(0);
			expect(exploration.monsterIsExploring(monster)).to.equal(false);
		});

		it('is sent home if dead', () => {
			const explorer = exploration.getExplorer(monster);
			expect(explorer.discoveries).to.have.length(0);

			const makeDiscoveryStub = sinon
				.stub(Object.getPrototypeOf(exploration), 'makeDiscovery')
				.callsFake((player: any) => {
					const death = new DeathCard();
					death.look(player.channel);
					death.play(player.monster, player.monster);

					return death;
				});

			while (exploration.monsterIsExploring(explorer.monster)) {
				exploration.doExploration();
			}

			makeDiscoveryStub.restore();

			expect(explorer.discoveries.length).to.equal(1);
			expect(exploration.explorers.length).to.equal(0);
			expect(exploration.monsterIsExploring(monster)).to.equal(false);
		});
	});
});
