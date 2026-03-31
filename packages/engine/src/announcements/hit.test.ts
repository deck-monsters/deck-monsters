import { expect } from 'chai';

import { announceHit } from './hit.js';
import Gladiator from '../monsters/gladiator.js';
import { HitCard } from '../cards/hit.js';
import { HitHarder as HitHarderCard } from '../cards/hit-harder.js';
import flavor from '../helpers/flavor.js';

describe('./announcements/hit.ts', () => {
	describe('hit announcement', () => {
		it('can announce normal hit to public channel', () => {
			const announcement = `💪 🤜 💪  Assailant hits Monster for 2 damage.

💪 *Monster has 31HP.*
`;
			const publicChannel = ({ announce }: { announce: string }) => {
				expect(announce).to.equal(announcement);
			};

			const monster = new Gladiator({ name: 'monster', hpVariance: 0, acVariance: 0 });
			const assailant = new Gladiator({ name: 'assailant', hpVariance: 0, acVariance: 0 });
			const card = { flavors: { hits: [['hits', 100]] as [string, number][] } };
			const damage = 2;
			const prevHp = 15;

			announceHit(publicChannel, {} as any, '', monster, { assailant, card, damage, prevHp });
		});

		it('can announce all flavors for hit card to public channel', () => {
			const promises: Promise<void>[] = [];

			const monster = new Gladiator({ name: 'monster', hpVariance: 0, acVariance: 0 });
			const assailant = new Gladiator({ name: 'assailant', hpVariance: 0, acVariance: 0 });
			const damage = 2;
			const prevHp = 15;

			for (let i = 0; i < flavor.flavors.hits.length; i++) {
				promises.push(
					new Promise<void>(resolve => {
						const publicChannel = ({ announce }: { announce: string }) => {
							resolve(expect(announce).to.not.include('undefined') as unknown as void);
						};

						const card = new HitCard({ flavors: { hits: [flavor.flavors.hits[i]] } });
						announceHit(publicChannel, {} as any, '', monster, { assailant, card, damage, prevHp });
					}),
				);
			}

			return Promise.all(promises);
		});

		it('can announce all flavors for hit harder card to public channel', () => {
			const promises: Promise<void>[] = [];

			const monster = new Gladiator({ name: 'monster', hpVariance: 0, acVariance: 0 });
			const assailant = new Gladiator({ name: 'assailant', hpVariance: 0, acVariance: 0 });
			const flavorflaves = (HitHarderCard as any).flavors;
			const damage = 2;
			const prevHp = 15;

			for (let i = 0; i < flavorflaves.hits.length; i++) {
				promises.push(
					new Promise<void>(resolve => {
						const publicChannel = ({ announce }: { announce: string }) => {
							resolve(expect(announce).to.not.include('undefined') as unknown as void);
						};

						const card = new HitCard({ flavors: { hits: [flavor.flavors.hits[i]] } });
						announceHit(publicChannel, {} as any, '', monster, { assailant, card, damage, prevHp });
					}),
				);
			}

			return Promise.all(promises);
		});

		it('can announce weak hit to public channel', () => {
			const announcement = `💪 🏓 💪  Assailant hits Monster for 1 damage.

💪 *Monster has 31HP.*
`;
			const publicChannel = ({ announce }: { announce: string }) => {
				expect(announce).to.equal(announcement);
			};

			const monster = new Gladiator({ name: 'monster', hpVariance: 0, acVariance: 0 });
			const assailant = new Gladiator({ name: 'assailant', hpVariance: 0, acVariance: 0 });
			const card = { flavors: { hits: [['hits', 100]] as [string, number][] } };
			const damage = 1;
			const prevHp = 15;

			announceHit(publicChannel, {} as any, '', monster, { assailant, card, damage, prevHp });
		});

		it('can announce strong damage to public channel', () => {
			const announcement = `💪 🔪 💪  Assailant hits Monster for 5 damage.

💪 *Monster has 31HP.*
`;
			const publicChannel = ({ announce }: { announce: string }) => {
				expect(announce).to.equal(announcement);
			};

			const monster = new Gladiator({ name: 'monster', hpVariance: 0, acVariance: 0 });
			const assailant = new Gladiator({ name: 'assailant', hpVariance: 0, acVariance: 0 });
			const card = { flavors: { hits: [['hits', 100]] as [string, number][] } };
			const damage = 5;
			const prevHp = 15;

			announceHit(publicChannel, {} as any, '', monster, { assailant, card, damage, prevHp });
		});

		it('can announce top damage to public channel', () => {
			const announcement = `💪 🔥 💪  Assailant hits Monster for 10 damage.

💪 *Monster has 31HP.*
`;
			const publicChannel = ({ announce }: { announce: string }) => {
				expect(announce).to.equal(announcement);
			};

			const monster = new Gladiator({ name: 'monster', hpVariance: 0, acVariance: 0 });
			const assailant = new Gladiator({ name: 'assailant', hpVariance: 0, acVariance: 0 });
			const card = { flavors: { hits: [['hits', 100]] as [string, number][] } };
			const damage = 10;
			const prevHp = 15;

			announceHit(publicChannel, {} as any, '', monster, { assailant, card, damage, prevHp });
		});

		it('can announce bloodied to public channel', () => {
			const announcement = `💪 🔥 💪  Assailant hits Monster for 10 damage.

💪 *Monster is now bloodied. Monster has only 15HP.*
`;
			const publicChannel = ({ announce }: { announce: string }) => {
				expect(announce).to.equal(announcement);
			};

			const monster = new Gladiator({ name: 'monster', hpVariance: 0, acVariance: 0 });
			const assailant = new Gladiator({ name: 'assailant', hpVariance: 0, acVariance: 0 });
			const card = { flavors: { hits: [['hits', 100]] as [string, number][] } };
			const damage = 10;
			const prevHp = 30;
			(monster as any).bloodied = 15;

			announceHit(publicChannel, {} as any, '', monster, { assailant, card, damage, prevHp });
		});

		it('can announce still bloodied after already bloodied to public channel', () => {
			const announcement = `💪 🔥 💪  Assailant hits Monster for 10 damage.

💪 *Monster has only 1HP.*
`;
			const publicChannel = ({ announce }: { announce: string }) => {
				expect(announce).to.equal(announcement);
			};

			const monster = new Gladiator({ name: 'monster', hpVariance: 0, acVariance: 0 });
			const assailant = new Gladiator({ name: 'assailant', hpVariance: 0, acVariance: 0 });
			const card = { flavors: { hits: [['hits', 100]] as [string, number][] } };
			const damage = 10;
			const prevHp = 13;
			(monster as any).hp = 1;

			announceHit(publicChannel, {} as any, '', monster, { assailant, card, damage, prevHp });
		});

		it('can announce 11 damage hit with custom icons', () => {
			const announcement = `💪 ✅ 💪  Assailant hits Monster for 11 damage.

💪 *Monster has only 1HP.*
`;
			const publicChannel = ({ announce }: { announce: string }) => {
				expect(announce).to.equal(announcement);
			};

			const monster = new Gladiator({ name: 'monster', hpVariance: 0, acVariance: 0 });
			const assailant = new Gladiator({ name: 'assailant', hpVariance: 0, acVariance: 0 });
			const card = {
				flavors: { hits: [['hits', 100]] as [string, number][] },
				flavorIcons: [
					{ floor: 1, icon: '❌' },
					{ floor: 5, icon: '❌' },
					{ floor: 10, icon: '✅' },
				],
			};
			const damage = 11;
			const prevHp = 12;
			(monster as any).hp = 1;

			announceHit(publicChannel, {} as any, '', monster, { assailant, card, damage, prevHp });
		});

		it('can announce 1 damage hit with custom icons', () => {
			const announcement = `💪 ✅ 💪  Assailant hits Monster for 1 damage.

💪 *Monster has only 1HP.*
`;
			const publicChannel = ({ announce }: { announce: string }) => {
				expect(announce).to.equal(announcement);
			};

			const monster = new Gladiator({ name: 'monster', hpVariance: 0, acVariance: 0 });
			const assailant = new Gladiator({ name: 'assailant', hpVariance: 0, acVariance: 0 });
			const card = {
				flavors: { hits: [['hits', 100]] as [string, number][] },
				flavorIcons: [
					{ floor: 1, icon: '✅' },
					{ floor: 5, icon: '❌' },
					{ floor: 10, icon: '❌' },
				],
			};
			const damage = 1;
			const prevHp = 2;
			(monster as any).hp = 1;

			announceHit(publicChannel, {} as any, '', monster, { assailant, card, damage, prevHp });
		});

		it('can announce with custom flavorText', () => {
			const announcement = `🔥 💪  Monster is caught in a sudden fire and takes 1 damage.

💪 *Monster has only 1HP.*
`;
			const publicChannel = ({ announce }: { announce: string }) => {
				expect(announce).to.equal(announcement);
			};

			const monster = new Gladiator({ name: 'monster', hpVariance: 0, acVariance: 0 });
			const assailant = new Gladiator({ name: 'assailant', hpVariance: 0, acVariance: 0 });
			const card = {
				flavorText: '🔥 💪  Monster is caught in a sudden fire and takes 1 damage.',
			};
			const damage = 1;
			const prevHp = 2;
			(monster as any).hp = 1;

			announceHit(publicChannel, {} as any, '', monster, { assailant, card, damage, prevHp });
		});

		it('can use custom flavor icon', () => {
			const announcement = `💪 🔥 💪  Assailant burns Monster for 1 damage.

💪 *Monster has only 1HP.*
`;
			const publicChannel = ({ announce }: { announce: string }) => {
				expect(announce).to.equal(announcement);
			};

			const monster = new Gladiator({ name: 'monster', hpVariance: 0, acVariance: 0 });
			const assailant = new Gladiator({ name: 'assailant', hpVariance: 0, acVariance: 0 });
			const card = {
				flavors: { hits: [['burns', 100, '🔥']] as [string, number, string][] },
			};
			const damage = 1;
			const prevHp = 2;
			(monster as any).hp = 1;

			announceHit(publicChannel, {} as any, '', monster, { assailant, card, damage, prevHp });
		});

		it('can use custom flavor', () => {
			const announcement = `💪 🔥 💪  Assailant burns Monster for 1 damage.

💪 *Monster has only 1HP.*
`;
			const publicChannel = ({ announce }: { announce: string }) => {
				expect(announce).to.equal(announcement);
			};

			const monster = new Gladiator({ name: 'monster', hpVariance: 0, acVariance: 0 });
			const assailant = new Gladiator({ name: 'assailant', hpVariance: 0, acVariance: 0 });
			const card = {
				flavor: { text: 'burns', icon: '🔥' },
			};
			const damage = 1;
			const prevHp = 2;
			(monster as any).hp = 1;

			announceHit(publicChannel, {} as any, '', monster, { assailant, card, damage, prevHp });
		});
	});
});
