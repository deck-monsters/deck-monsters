const { expect } = require('../shared/test-setup');

const ConcussionCard = require('./concussion');
const Gladiator = require('../monsters/gladiator');
const HitCard = require('./hit');

describe('./cards/concussion.js', () => {
	it('can be instantiated with defaults', () => {
		const concussion = new ConcussionCard();
		const hit = new HitCard({ damageDice: '1d4' });

		const stats = `${hit.stats}
Curse: int -1-2 depending on how hard the hit is, with a maximum total curse of -3 per level. Afterwards penalties come out of hp instead.`;

		expect(concussion).to.be.an.instanceof(ConcussionCard);
		expect(concussion.icon).to.equal('🥊');
		expect(concussion.curseAmount).to.be.above(-3);
		expect(concussion.curseAmount).to.be.below(0);
		expect(concussion.cursedProp).to.equal('int');
		expect(concussion.stats).to.equal(stats);
	});

	it('decreases int', () => {
		const concussion = new ConcussionCard();

		const player = new Gladiator({ name: 'player' });
		const target = new Gladiator({ name: 'target' });
		const previousInt = target.int;

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
				return expect(target.int).to.be.below(previousInt);
			});
	});
});
