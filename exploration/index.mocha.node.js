const { expect, sinon } = require('../shared/test-setup');

const Basilisk = require('../monsters/basilisk');
const Beastmaster = require('../characters/beastmaster');
const ChannelManager = require('../channel');
const Game = require('../game');
const Discovery = require('./discoveries/base');
const DeathCard = require('./discoveries/death');
const NothingCard = require('./discoveries/nothing');

describe('./exploration/index.js', () => {
	let clock;
	let privateChannelStub;
	let publicChannelStub;

	let game;
	let exploration;

	let character;
	let monster;

	let channelName;

	before(() => {
		publicChannelStub = sinon.stub();
		privateChannelStub = sinon.stub();

		channelName = 'TEST_CHANNEL';
	});

	beforeEach(() => {
		publicChannelStub.resolves();
		privateChannelStub.resolves();
		clock = sinon.useFakeTimers();

		game = new Game(publicChannelStub);
		exploration = game.getExploration();

		character = new Beastmaster();
		monster = new Basilisk();
		character.addMonster(monster);

		exploration.sendMonsterExploring({
			monster,
			character,
			channel: privateChannelStub,
			channelName
		});
	});

	afterEach(() => {
		publicChannelStub.reset();
		privateChannelStub.reset();
		clock.restore();
	});

	it('has a channel manager', () => {
		expect(exploration.channelManager).to.be.an.instanceof(ChannelManager);
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
			expect(exploration.monsterIsExploring(monster)).to.be.true;

			const explorer = exploration.getExplorer(monster);

			exploration.sendMonsterHome(explorer);
			expect(exploration.explorers.length).to.equal(0);
			expect(exploration.monsterIsExploring(monster)).to.be.false;
		});

		it('can make discoveries', () => {
			const explorer = exploration.getExplorer(monster);

			const ADiscovery = exploration.makeDiscovery(explorer);
			expect(ADiscovery).to.be.instanceof(Discovery);
		});

		it('can explore', () => {
			const explorer = exploration.getExplorer(monster);
			expect(explorer.discoveries).to.have.lengthOf(0);

			exploration.doExploration();
			expect(explorer.discoveries).to.have.lengthOf(1);
		});

		it('is sent home after 15 discoveries', () => {
			const explorer = exploration.getExplorer(monster);
			expect(explorer.discoveries).to.have.lengthOf(0);

			const makeDiscoveryStub = sinon.stub(Object.getPrototypeOf(exploration), 'makeDiscovery');
			makeDiscoveryStub.callsFake((fakeExplorer) => {
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
			expect(exploration.monsterIsExploring(monster)).to.be.false;
		});

		it('is sent home if dead', () => {
			const explorer = exploration.getExplorer(monster);
			expect(explorer.discoveries).to.have.lengthOf(0);

			const makeDiscoveryStub = sinon.stub(Object.getPrototypeOf(exploration), 'makeDiscovery');
			makeDiscoveryStub.callsFake((player) => {
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
			expect(exploration.monsterIsExploring(monster)).to.be.false;
		});
	});
});
