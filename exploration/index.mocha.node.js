const { expect, sinon } = require('../shared/test-setup');

const Basilisk = require('../monsters/basilisk');
const Beastmaster = require('../characters/beastmaster');
const ChannelManager = require('../channel');
const Game = require('../game');
const Discovery = require('./discoveries/base');
const DeathCard = require('./discoveries/death');
const NothingCard = require('./discoveries/nothing');

describe.only('./exploration/index.js', () => {
	let clock;
	let privateChannelStub;
	let publicChannelStub;

	before(() => {
		publicChannelStub = sinon.stub();
		privateChannelStub = sinon.stub();
	});

	beforeEach(() => {
		publicChannelStub.resolves();
		privateChannelStub.resolves();
		clock = sinon.useFakeTimers();
	});

	afterEach(() => {
		publicChannelStub.reset();
		privateChannelStub.reset();
		clock.restore();
	});

	it('has a channel manager', () => {
		const game = new Game(publicChannelStub);
		const exploration = game.getExploration();

		expect(exploration.channelManager).to.be.an.instanceof(ChannelManager);
	});

	describe('monsters', () => {
		it('can be sent exploring', () => {
			const game = new Game(publicChannelStub);
			const exploration = game.getExploration();

			const character = new Beastmaster();
			const monster = new Basilisk();
			const channelName = 'TEST_CHANNEL';

			character.addMonster(monster);

			exploration.sendMonsterExploring({
				monster,
				character,
				channel: privateChannelStub,
				channelName
			});

			expect(exploration.explorers.length).to.equal(1);
			expect(exploration.monsterIsExploring(monster)).to.equal(true);
		});

		it('can not be re-sent exploring if already exploring', () => {
			const game = new Game(publicChannelStub);
			const exploration = game.getExploration();

			const character = new Beastmaster();
			const monster = new Basilisk();
			const channelName = 'TEST_CHANNEL';

			character.addMonster(monster);

			exploration.sendMonsterExploring({
				monster,
				character,
				channel: privateChannelStub,
				channelName
			});

			expect(exploration.explorers.length).to.equal(1);
			expect(exploration.monsterIsExploring(monster)).to.equal(true);

			exploration.sendMonsterExploring({
				monster,
				character,
				channel: privateChannelStub,
				channelName
			});

			expect(exploration.explorers.length).to.equal(1);
			expect(exploration.monsterIsExploring(monster)).to.equal(true);
		});

		it('can be sent home', () => {
			const game = new Game(publicChannelStub);
			const exploration = game.getExploration();

			const character = new Beastmaster();
			const monster = new Basilisk();
			const channelName = 'TEST_CHANNEL';

			character.addMonster(monster);

			exploration.sendMonsterExploring({
				monster,
				character,
				channel: privateChannelStub,
				channelName
			});

			expect(exploration.explorers.length).to.equal(1);
			expect(exploration.monsterIsExploring(monster)).to.be.true;

			const explorer = exploration.getExplorer(monster);

			exploration.sendMonsterHome(explorer);
			expect(exploration.explorers.length).to.equal(0);
			expect(exploration.monsterIsExploring(monster)).to.be.false;
		});

		it('can make discoveries', () => {
			const game = new Game(publicChannelStub);
			const exploration = game.getExploration();

			const character = new Beastmaster();
			const monster = new Basilisk();
			const channelName = 'TEST_CHANNEL';

			character.addMonster(monster);

			exploration.sendMonsterExploring({
				monster,
				character,
				channel: privateChannelStub,
				channelName
			});

			const explorer = exploration.getExplorer(monster);
			const ADiscovery = exploration.makeDiscovery(explorer);

			expect(ADiscovery).to.be.instanceof(Discovery);
		});

		it('can explore', () => {
			const game = new Game(publicChannelStub);
			const exploration = game.getExploration();

			const character = new Beastmaster();
			const monster = new Basilisk();
			const channelName = 'TEST_CHANNEL';

			character.addMonster(monster);

			exploration.sendMonsterExploring({
				monster,
				character,
				channel: privateChannelStub,
				channelName
			});
			const explorer = exploration.getExplorer(monster);
			expect(explorer.discoveries).to.have.lengthOf(0);

			exploration.doExploration();

			expect(explorer.discoveries).to.have.lengthOf(1);
		});

		it('is sent home after 15 discoveries', () => {
			const game = new Game(publicChannelStub);
			const exploration = game.getExploration();

			const character = new Beastmaster();
			const monster = new Basilisk();
			const channelName = 'TEST_CHANNEL';

			character.addMonster(monster);

			exploration.sendMonsterExploring({
				monster,
				character,
				channel: privateChannelStub,
				channelName
			});
			const explorer = exploration.getExplorer(monster);
			expect(explorer.discoveries).to.have.lengthOf(0);

			const makeDiscoveryStub = sinon.stub(Object.getPrototypeOf(exploration), 'makeDiscovery');
			makeDiscoveryStub.callsFake((explorer) => {
				const nothing = new NothingCard();
				nothing.look(explorer.channel);
				nothing.play(explorer.monster, explorer.monster);

				return nothing;
			});

			while (exploration.monsterIsExploring(monster)) {
				exploration.doExploration();
			}

			makeDiscoveryStub.restore();

			expect(explorer.discoveries.length).to.equal(15);
			expect(exploration.explorers.length).to.equal(0);
			expect(exploration.monsterIsExploring(monster)).to.be.false;
		});

		it('is sent home if dead', () => {
			const game = new Game(publicChannelStub);
			const exploration = game.getExploration();

			const character = new Beastmaster();
			const monster = new Basilisk();
			const channelName = 'TEST_CHANNEL';

			character.addMonster(monster);

			exploration.sendMonsterExploring({
				monster,
				character,
				channel: privateChannelStub,
				channelName
			});
			const explorer = exploration.getExplorer(monster);
			expect(explorer.discoveries).to.have.lengthOf(0);

			const makeDiscoveryStub = sinon.stub(Object.getPrototypeOf(exploration), 'makeDiscovery');
			makeDiscoveryStub.callsFake((explorer) => {
				const death = new DeathCard();
				death.look(explorer.channel);
				death.play(explorer.monster, explorer.monster);

				return death;
			});

			while (exploration.monsterIsExploring(monster)) {
				exploration.doExploration();
			}

			makeDiscoveryStub.restore();

			expect(explorer.monster.dead).to.be.true;
			expect(explorer.discoveries.length).to.be.below(2);
			expect(exploration.explorers.length).to.equal(0);
			expect(exploration.monsterIsExploring(monster)).to.be.false;
		});
	});
});
