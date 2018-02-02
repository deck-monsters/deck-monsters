const { expect } = require('../shared/test-setup');

const VenegefulRampageCard = require('./vengeful-rampage');
const Basilisk = require('../monsters/basilisk');

describe('./cards/vengeful-rampage.js', () => {
	it('can be instantiated with defaults', () => {
		const venegefulRampage = new VenegefulRampageCard();

		expect(venegefulRampage).to.be.an.instanceof(VenegefulRampageCard);
		expect(venegefulRampage.probability).to.equal(15);
		expect(venegefulRampage.stats).to.equal('Hit: 1d20 vs ac\nDamage: 1d6 +1 per wound suffered');
	});

	it('deals damage equal to the amount of damage already taken', () => {
		const venegefulRampage = new VenegefulRampageCard();

		const player = new Basilisk({ name: 'player', hp: 26, hpVariance: 0 });
		const target = new Basilisk({ name: 'target' });

		const roll = venegefulRampage.getDamageRoll(player, target);

		expect(roll.modifier).to.equal(2);
	});

	it('does max damage equal to double player damage modifier', () => {
		const venegefulRampage = new VenegefulRampageCard();

		const player = new Basilisk({ name: 'player', hp: 2, hpVariance: 0, strModifier: 6 });
		const target = new Basilisk({ name: 'target' });

		const roll = venegefulRampage.getDamageRoll(player, target);

		expect(roll.modifier).to.equal(12);
	});
});
