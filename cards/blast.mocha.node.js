const { expect, sinon } = require('../shared/test-setup');

const { randomCharacter } = require('../characters');
const Basilisk = require('../monsters/basilisk');
const BlastCard = require('./blast');
const pause = require('../helpers/pause');

describe('./cards/blast.js', () => {
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

	it('can be instantiated with defaults', () => {
		const blast = new BlastCard();

		expect(blast).to.be.an.instanceof(BlastCard);
		expect(blast.stats).to.equal('Blast: 3 base damage +1 per level of the caster');
	});

	it('can be instantiated with options', () => {
		const blast = new BlastCard({ damage: 10, levelDamage: 2 });

		expect(blast).to.be.an.instanceof(BlastCard);
		expect(blast.stats).to.equal('Blast: 10 base damage +2 per level of the caster');
	});

	it('can be played', () => {
		const blast = new BlastCard({ damage: 4, levelDamage: 2 });

		const player = new Basilisk({ name: 'player' });
		const target1 = new Basilisk({ name: 'target1' });
		const target2 = new Basilisk({ name: 'target2' });
		const ring = {
			contestants: [
				{ monster: player },
				{ monster: target1 },
				{ monster: target2 }
			]
		};

		const playerStatingHp = player.hp;
		const playerLevel = player.level;
		const damage = 4 + (2 * playerLevel);
		const target1StatingHp = target1.hp;
		const target2StatingHp = target2.hp;

		return blast
			.play(player, target1, ring, ring.contestants)
			.then(() => {
				expect(player.hp).to.equal(playerStatingHp);
				expect(target1.hp).to.equal(target1StatingHp - damage);
				expect(target2.hp).to.equal(target2StatingHp - damage);
			});
	});

	it('is only applied to active players', () => {
		const blast = new BlastCard({ damage: 4, levelDamage: 2 });

		const player = new Basilisk({ name: 'player' });
		const target1 = new Basilisk({ name: 'target1' });
		const target2 = new Basilisk({ name: 'target2' });
		const ring = {
			contestants: [
				{ monster: player },
				{ monster: target1 },
				{ monster: target2 }
			]
		};
		const activeContestants = [
			{ monster: player },
			{ monster: target1 }
		];

		const playerStatingHp = player.hp;
		const playerLevel = player.level;
		const damage = 4 + (2 * playerLevel);
		const target1StatingHp = target1.hp;
		const target2StatingHp = target2.hp;

		return blast
			.play(player, target1, ring, activeContestants)
			.then(() => {
				expect(player.hp).to.equal(playerStatingHp);
				expect(target1.hp).to.equal(target1StatingHp - damage);
				expect(target2.hp).to.equal(target2StatingHp);
			});
	});

	it('returns true if the target is not killed', () => {
		const blast = new BlastCard({ damage: 4, levelDamage: 2 });

		const player = new Basilisk({ name: 'player' });
		const target = {};

		target.character = randomCharacter();
		target.monster = target.character.monsters[0];
		target.monster.hp = 99;

		const ring = {
			contestants: [
				{ monster: player },
				target
			]
		};

		return blast
			.play(player, target.monster, ring, ring.contestants)
			.then((fightContinues) => {
				expect(fightContinues).to.equal(true);
			});
	});

	it('returns false if the target is killed', () => {
		const blast = new BlastCard({ damage: 4, levelDamage: 2 });

		const player = new Basilisk({ name: 'player' });
		const target = {};

		target.character = randomCharacter();
		target.monster = target.character.monsters[0];
		target.monster.hp = 1;

		const ring = {
			contestants: [
				{ monster: player },
				target
			]
		};

		return blast
			.play(player, target.monster, ring, ring.contestants)
			.then((fightContinues) => {
				expect(fightContinues).to.equal(false);
			});
	});

	it('has hit flavors', () => {
		const blast = new BlastCard();

		expect(blast.flavors.hits).to.be.an('array');
	});
});
