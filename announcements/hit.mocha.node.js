const { expect, sinon } = require('../shared/test-setup');
const flavor = require('../helpers/flavor');

const announceHit = require('./hit');
const pause = require('../helpers/pause');
const HitCard = require('../cards/hit');
const Gladiator = require('../monsters/gladiator');

describe('./announcements/hit.js', () => {
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

	describe('hit announcement', () => {
		it('can announce to public channel', () => {
			const announcement = `💪 🔪 💪  Assailant hits Monster for 7 damage.

💪  *Monster has 30HP.*
`
			const publicChannel = ({ announce }) => {
				expect(announce).to.equal(announcement);
			}

			const monster = new Gladiator({ name: 'monster', hp: 30, ac: 10 });
			const assailant = new Gladiator({ name: 'assailant', hp: 30, ac: 10 });
			const card = {flavors: {hits: [['hits', 100]]}};
			const damage = 7;
			const prevHp = 15;

			announceHit(publicChannel, {}, '', monster, {
				assailant,
				card,
				damage,
				prevHp
			});
		});
	});
});
