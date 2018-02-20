const { expect } = require('../shared/test-setup');

const ConcussionCard = require('./concussion');
const Gladiator = require('../monsters/gladiator');
const HitCard = require('./hit');

describe('./cards/brain-drain.js', () => {
	it('can be instantiated with defaults', () => {
		const concussion = new ConcussionCard();
		const hit = new HitCard({ damageDice: '1d4' });

		const stats = `${hit.stats}
Curse: xp -20
can reduce xp down to 40, then takes 4 from hp instead.`;

		expect(concussion).to.be.an.instanceof(ConcussionCard);
		expect(concussion.icon).to.equal('🥊');
		expect(concussion.curseAmount).to.equal(-20);
		expect(concussion.cursedProp).to.equal('xp');
		expect(concussion.stats).to.equal(stats);
	});

	it('decreases xp', () => {
		const concussion = new ConcussionCard();

		const player = new Gladiator({ name: 'player' });
		const target = new Gladiator({ name: 'target' });
		target.xp = 300;

		expect(target.xp).to.equal(300);

		const ring = {
			contestants: [
				{ monster: player },
				{ monster: target }
			],
			channelManager: {
				sendMessages: () => Promise.resolve()
			}
		};

		return concussion.play(player, target, ring)
			.then((result) => {
				expect(result).to.equal(true);
				return expect(target.xp).to.equal(280);
			});
	});

	it('makes a difference for their modifiers', () => {
		const concussion = new ConcussionCard();

		const player = new Gladiator({ name: 'player' });
		const target = new Gladiator({ name: 'target' });
		target.xp = 100;

		expect(target.xp).to.equal(100);

		const startingStrMod = target.strModifier;
		const startingIntMod = target.intModifier;
		const startingDexMod = target.dexModifier;

		const ring = {
			contestants: [
				{ monster: player },
				{ monster: target }
			],
			channelManager: {
				sendMessages: () => Promise.resolve()
			}
		};

		return concussion.play(player, target, ring)
			.then((result) => {
				expect(result).to.equal(true);
				expect(startingStrMod).to.be.above(target.strModifier);
				expect(startingIntMod).to.be.above(target.intModifier);
				expect(startingDexMod).to.be.above(target.dexModifier);
				return expect(target.xp).to.equal(80);
			});
	});
});
