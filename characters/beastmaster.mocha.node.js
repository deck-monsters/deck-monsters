const { expect, sinon } = require('../shared/test-setup');

const Beastmaster = require('./beastmaster');
const Minotaur = require('../monsters/minotaur');
const WeepingAngel = require('../monsters/weeping-angel');
const pause = require('../helpers/pause');

describe('./characters/beastmaster.js', () => {
	let channelStub;
	let pauseStub;

	before(() => {
		channelStub = sinon.stub();
		pauseStub = sinon.stub(pause, 'setTimeout');
	});

	beforeEach(() => {
		channelStub.resolves();
		pauseStub.callsArg(0);
	});

	afterEach(() => {
		channelStub.reset();
		pauseStub.reset();
	});

	after(() => {
		pause.setTimeout.restore();
	});

	it('can be instantiated', () => {
		const beastmaster = new Beastmaster();

		expect(beastmaster).to.be.an.instanceof(Beastmaster);
	});

	it('gets a deck by default', () => {
		const beastmaster = new Beastmaster();

		expect(beastmaster.deck.length).to.equal(10);
	});

	it('can spwan a monster', () => {
		const beastmaster = new Beastmaster();
		channelStub.onCall(1).resolves(0);
		channelStub.onCall(2).resolves('Foo');
		channelStub.onCall(3).resolves('Blue');
		channelStub.onCall(4).resolves(1);

		return beastmaster
			.spawnMonster(channelStub)
			.then((monster) => {
				expect(beastmaster.monsters[0]).to.equal(monster);
				expect(monster.name).to.equal('Basilisk');
				expect(monster.options).to.include({
					gender: 'female',
					color: 'blue',
					name: 'Foo'
				});
				expect(monster.givenName).to.equal('Foo');
			});
	});

	it('can revive a monster', () => {
		const beastmaster = new Beastmaster();
		channelStub.onCall(1).resolves(0);
		channelStub.onCall(2).resolves('Foo');
		channelStub.onCall(3).resolves('Blue');
		channelStub.onCall(4).resolves(0);

		return beastmaster
			.spawnMonster(channelStub)
			.then((monster) => {
				monster.hp = 0;
			})
			.then(() => beastmaster.reviveMonster({ monsterName: 'Foo', channel: channelStub }))
			.then(() => {
				expect(channelStub).to.have.been.calledWith({
					announce: 'Foo has begun to revive. He is a beginner monster, and therefore will be revived instantly.'
				});
			});
	});

	it('can revive a level 3 monster', () => {
		const beastmaster = new Beastmaster();
		channelStub.onCall(1).resolves(0);
		channelStub.onCall(2).resolves('Foo');
		channelStub.onCall(3).resolves('Blue');
		channelStub.onCall(4).resolves(2);

		return beastmaster
			.spawnMonster(channelStub)
			.then((monster) => {
				monster.hp = 0;
				monster.xp = 120;
			})
			.then(() => beastmaster.reviveMonster({ monsterName: 'Foo', channel: channelStub }))
			.then(() => {
				expect(channelStub).to.have.been.calledWith({
					announce: 'Foo has begun to revive. It is a level 2 monster, and therefore will be revived in an hour.'
				});
			});
	});

	it('can hold a card usable by one of its monsters', () => {
		const beastmaster = new Beastmaster();
		const minotaur = new Minotaur();
		const angel = new WeepingAngel();

		angel.xp = 300;
		beastmaster.monsters = [minotaur, angel];

		const correctClassAndLevel = beastmaster.canHoldCard({ level: 1, permittedClasses: ['Cleric'] });
		const wrongClass = beastmaster.canHoldCard({ level: 1, permittedClasses: ['Fighter'] });
		const wrongLevel = beastmaster.canHoldCard({ level: 10, permittedClasses: ['Cleric'] });

		expect(correctClassAndLevel).to.equal(true);
		expect(wrongClass).to.equal(false);
		expect(wrongLevel).to.equal(false);
	});
});
