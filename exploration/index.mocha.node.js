const { expect, sinon } = require('../shared/test-setup');

const Basilisk = require('../monsters/basilisk');
const Beastmaster = require('../characters/beastmaster');
const ChannelManager = require('../channel');
const Game = require('../game');

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

	describe('monsters', () => {
		it('can be sent exploring', () => {
			const game = new Game(publicChannelStub);
			const exploration = game.getExploration();

			const character = new Beastmaster();
			const monster = new Basilisk();
			const channelName = 'TEST_CHANNEL';

			character.addMonster(monster);

			exploration.sendMonster({
				monster,
				character,
				channel: privateChannelStub,
				channelName
			});

			expect(exploration.explorers.length).to.equal(1);
			expect(exploration.monsterIsExploring(monster)).to.equal(true);
		});
	});
});
