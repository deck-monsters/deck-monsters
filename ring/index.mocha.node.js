const { expect, sinon } = require('../shared/test-setup');

const Basilisk = require('../monsters/basilisk');
const Beastmaster = require('../characters/beastmaster');
const ChannelManager = require('../channel');
const Game = require('../game');

describe('./ring/index.js', () => {
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
		const ring = game.getRing();

		expect(ring.channelManager).to.be.an.instanceof(ChannelManager);
	});

	describe('monsters', () => {
		it('can be added', () => {
			const game = new Game(publicChannelStub);
			const ring = game.getRing();

			const character = new Beastmaster();
			const monster = new Basilisk();
			const channelName = 'TEST_CHANNEL';

			character.addMonster(monster);

			ring.addMonster({
				monster,
				character,
				channel: privateChannelStub,
				channelName
			});

			expect(ring.contestants.length).to.equal(1);
			expect(ring.monsterIsInRing(monster)).to.equal(true);
		});

		it('can be removed', () => {
			const game = new Game(publicChannelStub);
			const ring = game.getRing();

			const character = new Beastmaster();
			const monster = new Basilisk();
			const channelName = 'TEST_CHANNEL';

			character.addMonster(monster);

			ring.addMonster({
				monster,
				character,
				channel: privateChannelStub,
				channelName
			});

			expect(ring.contestants.length).to.equal(1);

			return ring.removeMonster({
				monster,
				character,
				channel: privateChannelStub,
				channelName
			})
				.then(() => expect(ring.monsterIsInRing(monster)).to.equal(false));
		});

		it('cannot be removed while an encounter is in progress', () => {
			const game = new Game(publicChannelStub);
			const ring = game.getRing();

			const character = new Beastmaster();
			const monster = new Basilisk();
			const channelName = 'TEST_CHANNEL';

			character.addMonster(monster);

			ring.addMonster({
				monster,
				character,
				channel: privateChannelStub,
				channelName
			});

			expect(ring.contestants.length).to.equal(1);

			ring.startEncounter();

			return expect(ring.removeMonster({
				monster,
				character,
				channel: privateChannelStub,
				channelName
			})).to.eventually.be.rejected;
		});
	});

	describe('bosses', () => {
		it('will spawn a boss', () => {
			const game = new Game(publicChannelStub);
			const ring = game.getRing();

			const contestant = ring.spawnBoss();

			expect(ring.contestants.length).to.equal(1);
			expect(ring.monsterIsInRing(contestant.monster)).to.equal(true);
		});

		it('will remove a boss', () => {
			const game = new Game(publicChannelStub);
			const ring = game.getRing();

			const contestant = ring.spawnBoss();

			return ring.removeBoss(contestant)
				.then(() => expect(ring.contestants.length).to.equal(0));
		});

		it('will not spawn a boss if players are already in the ring', () => {
			const game = new Game(publicChannelStub);
			const ring = game.getRing();

			const character = new Beastmaster();
			const monster = new Basilisk();
			const channelName = 'TEST_CHANNEL';

			character.addMonster(monster);

			ring.addMonster({
				monster,
				character,
				channel: privateChannelStub,
				channelName
			});

			expect(ring.contestants.length).to.equal(1);

			const contestant = ring.spawnBoss();

			expect(ring.contestants.length).to.equal(1);
			expect(contestant).to.equal(undefined);
		});
	});
});
