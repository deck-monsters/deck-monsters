const { expect, sinon } = require('../shared/test-setup');

const announceHit = require('./hit');
const pause = require('../helpers/pause');
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
		it('can announce normal hit to public channel', () => {
			const announcement = `💪 🤜 💪  Assailant hits Monster for 2 damage.

💪  *Monster has 30HP.*
`;
			const publicChannel = ({ announce }) => {
				expect(announce).to.equal(announcement);
			};

			const monster = new Gladiator({ name: 'monster', hpVariance: 0, acVariance: 0 });
			const assailant = new Gladiator({ name: 'assailant', hpVariance: 0, acVariance: 0 });
			const card = { flavors: { hits: [['hits', 100]] } };
			const damage = 2;
			const prevHp = 15;

			announceHit(publicChannel, {}, '', monster, {
				assailant,
				card,
				damage,
				prevHp
			});
		});

		it('can announce weak hit to public channel', () => {
			const announcement = `💪 🏓 💪  Assailant hits Monster for 1 damage.

💪  *Monster has 30HP.*
`;
			const publicChannel = ({ announce }) => {
				expect(announce).to.equal(announcement);
			};

			const monster = new Gladiator({ name: 'monster', hpVariance: 0, acVariance: 0 });
			const assailant = new Gladiator({ name: 'assailant', hpVariance: 0, acVariance: 0 });
			const card = { flavors: { hits: [['hits', 100]] } };
			const damage = 1;
			const prevHp = 15;

			announceHit(publicChannel, {}, '', monster, {
				assailant,
				card,
				damage,
				prevHp
			});
		});

		it('can announce strong damage to public channel', () => {
			const announcement = `💪 🔪 💪  Assailant hits Monster for 5 damage.

💪  *Monster has 30HP.*
`;
			const publicChannel = ({ announce }) => {
				expect(announce).to.equal(announcement);
			};

			const monster = new Gladiator({ name: 'monster', hpVariance: 0, acVariance: 0 });
			const assailant = new Gladiator({ name: 'assailant', hpVariance: 0, acVariance: 0 });
			const card = { flavors: { hits: [['hits', 100]] } };
			const damage = 5;
			const prevHp = 15;

			announceHit(publicChannel, {}, '', monster, {
				assailant,
				card,
				damage,
				prevHp
			});
		});

		it('can announce top damage to public channel', () => {
			const announcement = `💪 🔥 💪  Assailant hits Monster for 10 damage.

💪  *Monster has 30HP.*
`;
			const publicChannel = ({ announce }) => {
				expect(announce).to.equal(announcement);
			};

			const monster = new Gladiator({ name: 'monster', hpVariance: 0, acVariance: 0 });
			const assailant = new Gladiator({ name: 'assailant', hpVariance: 0, acVariance: 0 });
			const card = { flavors: { hits: [['hits', 100]] } };
			const damage = 10;
			const prevHp = 15;

			announceHit(publicChannel, {}, '', monster, {
				assailant,
				card,
				damage,
				prevHp
			});
		});

		it('can announce bloodied to public channel', () => {
			const announcement = `💪 🔥 💪  Assailant hits Monster for 10 damage.

💪  *Monster is now bloodied. Monster has only 15HP.*
`;
			const publicChannel = ({ announce }) => {
				expect(announce).to.equal(announcement);
			};

			const monster = new Gladiator({ name: 'monster', hpVariance: 0, acVariance: 0 });
			const assailant = new Gladiator({ name: 'assailant', hpVariance: 0, acVariance: 0 });
			const card = { flavors: { hits: [['hits', 100]] } };
			const damage = 10;
			const prevHp = 30;
			monster.bloodied = 15;

			announceHit(publicChannel, {}, '', monster, {
				assailant,
				card,
				damage,
				prevHp
			});
		});

		it('can announce still bloodied after already bloodied to public channel', () => {
			const announcement = `💪 🔥 💪  Assailant hits Monster for 10 damage.

💪  *Monster has only 1HP.*
`;
			const publicChannel = ({ announce }) => {
				expect(announce).to.equal(announcement);
			};

			const monster = new Gladiator({ name: 'monster', hpVariance: 0, acVariance: 0 });
			const assailant = new Gladiator({ name: 'assailant', hpVariance: 0, acVariance: 0 });
			const card = { flavors: { hits: [['hits', 100]] } };
			const damage = 10;
			const prevHp = 13;
			monster.hp = 1;

			announceHit(publicChannel, {}, '', monster, {
				assailant,
				card,
				damage,
				prevHp
			});
		});

		it('can announce 11 damage hit with custom icons', () => {
			const announcement = `💪 ✅ 💪  Assailant hits Monster for 11 damage.

💪  *Monster has only 1HP.*
`;
			const publicChannel = ({ announce }) => {
				expect(announce).to.equal(announcement);
			};

			const monster = new Gladiator({ name: 'monster', hpVariance: 0, acVariance: 0 });
			const assailant = new Gladiator({ name: 'assailant', hpVariance: 0, acVariance: 0 });
			const card = {
				flavors: { hits: [['hits', 100]] },
				icons: [{ floor: 1, icon: '❌' }, { floor: 5, icon: '❌' }, { floor: 10, icon: '✅' }]
			};
			const damage = 11;
			const prevHp = 12;
			monster.hp = 1;

			announceHit(publicChannel, {}, '', monster, {
				assailant,
				card,
				damage,
				prevHp
			});
		});

		it('can announce 1 damage hit with custom icons', () => {
			const announcement = `💪 ✅ 💪  Assailant hits Monster for 1 damage.

💪  *Monster has only 1HP.*
`;
			const publicChannel = ({ announce }) => {
				expect(announce).to.equal(announcement);
			};

			const monster = new Gladiator({ name: 'monster', hpVariance: 0, acVariance: 0 });
			const assailant = new Gladiator({ name: 'assailant', hpVariance: 0, acVariance: 0 });
			const card = {
				flavors: { hits: [['hits', 100]] },
				icons: [{ floor: 1, icon: '✅' }, { floor: 5, icon: '❌' }, { floor: 10, icon: '❌' }]
			};
			const damage = 1;
			const prevHp = 2;
			monster.hp = 1;

			announceHit(publicChannel, {}, '', monster, {
				assailant,
				card,
				damage,
				prevHp
			});
		});
	});
});
