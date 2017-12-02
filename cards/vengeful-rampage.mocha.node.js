const { expect, sinon } = require('../shared/test-setup');

const VenegefulRampageCard = require('./vengeful-rampage');
const Basilisk = require('../monsters/basilisk');
const pause = require('../helpers/pause');

describe('./cards/vengeful-rampage.js', () => {
	let pauseStub;

	before(() => {
		pauseStub = sinon.stub(pause, 'setTimeout');
	});

	beforeEach(() => {
		pauseStub.callsArg(0);
	});

	afterEach(() => {
		pauseStub.reset();
	});

	after(() => {
		pause.setTimeout.restore();
	});

	it('can be instantiated with defaults', () => {
		const venegefulRampage = new VenegefulRampageCard();

		expect(venegefulRampage).to.be.an.instanceof(VenegefulRampageCard);
		expect(venegefulRampage.probability).to.equal(10);
		expect(venegefulRampage.stats).to.equal('Hit: 1d20 vs AC\nDamage: 1d6 +1 per wound suffered');
	});

	it('deals damage equal to the amount of damage already taken', () => {
		const venegefulRampage = new VenegefulRampageCard();

		const player = new Basilisk({ name: 'player', hp: 2 });
		const target = new Basilisk({ name: 'target' });

		const roll = venegefulRampage.getDamageRoll(player, target);

		expect(roll.modifier).to.equal(player.DEFAULT_HP - player.hp);
	});
});
