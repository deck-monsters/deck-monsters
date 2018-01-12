const { expect, sinon } = require('../shared/test-setup');

const announceHit = require('./hit');
const pause = require('../helpers/pause');
const Gladiator = require('../monsters/gladiator');

const HitCard = require('../cards/hit');
const HitHarderCard = require('../cards/hit-harder');
const { flavors } = require('../helpers/flavor');

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

💪 *Monster has 30HP.*
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

		it('can announce all flavors for hit card to public channel', () => {
			const promises = [];

			const monster = new Gladiator({ name: 'monster', hpVariance: 0, acVariance: 0 });
			const assailant = new Gladiator({ name: 'assailant', hpVariance: 0, acVariance: 0 });

			const damage = 2;
			const prevHp = 15;

			for (let i = 0; i < flavors.hits.length; i++) {
				promises.push(new Promise((resolve) => {
					const publicChannel = ({ announce }) => {
						resolve(expect(announce).to.not.include('undefined'));
					};

					const card = new HitCard({ flavors: { hits: [flavors.hits[i]] } });

					announceHit(publicChannel, {}, '', monster, {
						assailant,
						card,
						damage,
						prevHp
					});
				}));
			}

			return expect(Promise.all(promises)).to.be.fulfilled;
		});

		it('can announce all flavors for hit harder card to public channel', () => {
			const promises = [];

			const monster = new Gladiator({ name: 'monster', hpVariance: 0, acVariance: 0 });
			const assailant = new Gladiator({ name: 'assailant', hpVariance: 0, acVariance: 0 });
			const flavorflaves = HitHarderCard.flavors;
			const damage = 2;
			const prevHp = 15;

			for (let i = 0; i < flavorflaves.hits.length; i++) {
				promises.push(new Promise((resolve) => {
					const publicChannel = ({ announce }) => {
						resolve(expect(announce).to.not.include('undefined'));
					};

					const card = new HitCard({ flavors: { hits: [flavors.hits[i]] } });

					announceHit(publicChannel, {}, '', monster, {
						assailant,
						card,
						damage,
						prevHp
					});
				}));
			}

			return expect(Promise.all(promises)).to.be.fulfilled;
		});

		it('can announce weak hit to public channel', () => {
			const announcement = `💪 🏓 💪  Assailant hits Monster for 1 damage.

💪 *Monster has 30HP.*
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

💪 *Monster has 30HP.*
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

💪 *Monster has 30HP.*
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

💪 *Monster is now bloodied. Monster has only 15HP.*
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

💪 *Monster has only 1HP.*
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

💪 *Monster has only 1HP.*
`;
			const publicChannel = ({ announce }) => {
				expect(announce).to.equal(announcement);
			};

			const monster = new Gladiator({ name: 'monster', hpVariance: 0, acVariance: 0 });
			const assailant = new Gladiator({ name: 'assailant', hpVariance: 0, acVariance: 0 });
			const card = {
				flavors: { hits: [['hits', 100]] },
				flavorIcons: [{ floor: 1, icon: '❌' }, { floor: 5, icon: '❌' }, { floor: 10, icon: '✅' }]
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

💪 *Monster has only 1HP.*
`;
			const publicChannel = ({ announce }) => {
				expect(announce).to.equal(announcement);
			};

			const monster = new Gladiator({ name: 'monster', hpVariance: 0, acVariance: 0 });
			const assailant = new Gladiator({ name: 'assailant', hpVariance: 0, acVariance: 0 });
			const card = {
				flavors: { hits: [['hits', 100]] },
				flavorIcons: [{ floor: 1, icon: '✅' }, { floor: 5, icon: '❌' }, { floor: 10, icon: '❌' }]
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

		it('can announce with custom flavorText', () => {
			const announcement = `🔥 💪  Monster is caught in a sudden fire and takes 1 damage.

💪 *Monster has only 1HP.*
`;
			const publicChannel = ({ announce }) => {
				expect(announce).to.equal(announcement);
			};

			const monster = new Gladiator({ name: 'monster', hpVariance: 0, acVariance: 0 });
			const assailant = new Gladiator({ name: 'assailant', hpVariance: 0, acVariance: 0 });
			const card = {
				flavorText: '🔥 💪  Monster is caught in a sudden fire and takes 1 damage.'
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

		it('can use custom flavor icon', () => {
			const announcement = `💪 🔥 💪  Assailant burns Monster for 1 damage.

💪 *Monster has only 1HP.*
`;
			const publicChannel = ({ announce }) => {
				expect(announce).to.equal(announcement);
			};

			const monster = new Gladiator({ name: 'monster', hpVariance: 0, acVariance: 0 });
			const assailant = new Gladiator({ name: 'assailant', hpVariance: 0, acVariance: 0 });
			const card = {
				flavors: { hits: [['burns', 100, '🔥']] }
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

		it('can use custom flavor', () => {
			const announcement = `💪 🔥 💪  Assailant burns Monster for 1 damage.

💪 *Monster has only 1HP.*
`;
			const publicChannel = ({ announce }) => {
				expect(announce).to.equal(announcement);
			};

			const monster = new Gladiator({ name: 'monster', hpVariance: 0, acVariance: 0 });
			const assailant = new Gladiator({ name: 'assailant', hpVariance: 0, acVariance: 0 });
			const card = {
				flavor: { text: 'burns', icon: '🔥' }
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
