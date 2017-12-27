const { expect, sinon } = require('../shared/test-setup');

const { randomContestant } = require('../helpers/bosses');
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

		it('will not spawn a boss if an encounter is in progress', () => {
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

			ring.startEncounter();

			expect(ring.contestants.length).to.equal(1);

			const contestant = ring.spawnBoss();

			expect(ring.contestants.length).to.equal(1);
			expect(contestant).to.equal(undefined);
		});
	});

	describe.only('fightConcludes', () => {
		it('can calculate xp for two level 1 monsters', () => {
			const game = new Game(publicChannelStub);
			const ring = game.getRing();

			let contestant1 = randomContestant({
				battles: {
					total: 5,
					wins: 5,
					losses: 0
				}
			});
			ring.addMonster(contestant1);

			let contestant2 = randomContestant({
				battles: {
					total: 5,
					wins: 5,
					losses: 0
				}
			});
			ring.addMonster(contestant2);

			contestant1.monster.hp = 0;
			contestant1.monster.killedBy = contestant2.monster;
			contestant2.monster.killed = contestant1.monster;

			const prevXP1 = contestant1.monster.xp;
			const prevXP2 = contestant2.monster.xp;

			ring.fightConcludes({ lastContestant: contestant2, rounds: 1 });

			contestant1 = ring.findContestant(contestant1.character, contestant1.monster);
			contestant2 = ring.findContestant(contestant2.character, contestant2.monster);

			expect(contestant1.won).to.equal(undefined);
			expect(contestant2.won).to.equal(true);
			expect(contestant1.monster.xp).to.equal(prevXP1 + 1);
			expect(contestant2.monster.xp).to.equal(prevXP2 + 13);
		});

		it('can calculate xp for a higher level monster beating a lower level monster', () => {
			const game = new Game(publicChannelStub);
			const ring = game.getRing();

			let contestant1 = randomContestant({
				battles: {
					total: 5,
					wins: 5,
					losses: 0
				}
			});
			ring.addMonster(contestant1);

			let contestant2 = randomContestant({
				battles: {
					total: 10,
					wins: 10,
					losses: 0
				}
			});
			ring.addMonster(contestant2);

			contestant1.monster.hp = 0;
			contestant1.monster.killedBy = contestant2.monster;
			contestant2.monster.killed = contestant1.monster;

			const prevXP1 = contestant1.monster.xp;
			const prevXP2 = contestant2.monster.xp;

			ring.fightConcludes({ lastContestant: contestant2, rounds: 1 });

			contestant1 = ring.findContestant(contestant1.character, contestant1.monster);
			contestant2 = ring.findContestant(contestant2.character, contestant2.monster);

			expect(contestant1.won).to.equal(undefined);
			expect(contestant2.won).to.equal(true);
			expect(contestant1.monster.xp).to.equal(prevXP1 + 2);
			expect(contestant2.monster.xp).to.equal(prevXP2 + 7);
		});

		it('can calculate xp for a lower level monster beating a higher level monster', () => {
			const game = new Game(publicChannelStub);
			const ring = game.getRing();

			let contestant1 = randomContestant({
				battles: {
					total: 5,
					wins: 5,
					losses: 0
				}
			});
			ring.addMonster(contestant1);

			let contestant2 = randomContestant({
				battles: {
					total: 1,
					wins: 1,
					losses: 0
				}
			});
			ring.addMonster(contestant2);

			contestant1.monster.hp = 0;
			contestant1.monster.killedBy = contestant2.monster;
			contestant2.monster.killed = contestant1.monster;

			const prevXP1 = contestant1.monster.xp;
			const prevXP2 = contestant2.monster.xp;

			ring.fightConcludes({ lastContestant: contestant2, rounds: 1 });

			contestant1 = ring.findContestant(contestant1.character, contestant1.monster);
			contestant2 = ring.findContestant(contestant2.character, contestant2.monster);

			expect(contestant1.won).to.equal(undefined);
			expect(contestant2.won).to.equal(true);
			expect(contestant1.monster.xp).to.equal(prevXP1 + 1);
			expect(contestant2.monster.xp).to.equal(prevXP2 + 24);
		});

		it('can calculate xp when a monster flees', () => {
			const game = new Game(publicChannelStub);
			const ring = game.getRing();

			let contestant1 = randomContestant({
				battles: {
					total: 5,
					wins: 5,
					losses: 0
				}
			});
			ring.addMonster(contestant1);

			let contestant2 = randomContestant({
				battles: {
					total: 5,
					wins: 5,
					losses: 0
				}
			});
			ring.addMonster(contestant2);

			contestant1.monster.fled = true;

			const prevXP1 = contestant1.monster.xp;
			const prevXP2 = contestant2.monster.xp;

			ring.fightConcludes({ lastContestant: contestant2, rounds: 1 });

			contestant1 = ring.findContestant(contestant1.character, contestant1.monster);
			contestant2 = ring.findContestant(contestant2.character, contestant2.monster);

			expect(contestant1.won).to.equal(undefined);
			expect(contestant2.won).to.equal(undefined);
			expect(contestant1.monster.xp).to.equal(prevXP1 + 2);
			expect(contestant2.monster.xp).to.equal(prevXP2 + 3);
		});
	});
});
