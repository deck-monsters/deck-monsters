import { expect } from 'chai';

import { announceHit } from './hit.js';
import Gladiator from '../monsters/gladiator.js';
import { HitCard } from '../cards/hit.js';
import { HitHarder as HitHarderCard } from '../cards/hit-harder.js';
import flavor from '../helpers/flavor.js';
import type { RoomEventBus } from '../events/index.js';

function makeEb(onPublish: (text: string) => void): RoomEventBus {
	return {
		publish: ({ text }: { text: string }) => {
			onPublish(text);
			return { id: '1', roomId: 'test', timestamp: 0, type: 'announce', scope: 'public', text, payload: {} };
		},
	} as unknown as RoomEventBus;
}

describe('./announcements/hit.ts', () => {
	describe('hit announcement', () => {
		it('can announce normal hit to public channel', () => {
			const announcement = `💪 🤜 💪  Assailant hits Monster for 2 damage.\n\n💪 *Monster has 31HP.*\n`;

			const eb = makeEb(text => expect(text).to.equal(announcement));

			const monster = new Gladiator({ name: 'monster', hpVariance: 0, acVariance: 0 });
			const assailant = new Gladiator({ name: 'assailant', hpVariance: 0, acVariance: 0 });
			const card = { flavors: { hits: [['hits', 100]] as [string, number][] } };
			const damage = 2;
			const prevHp = 15;

			announceHit(eb, '', monster, { assailant, card, damage, prevHp });
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
						const eb = makeEb(text => resolve(expect(text).to.not.include('undefined') as unknown as void));
						const card = new HitCard({ flavors: { hits: [flavor.flavors.hits[i]] } });
						announceHit(eb, '', monster, { assailant, card, damage, prevHp });
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
						const eb = makeEb(text => resolve(expect(text).to.not.include('undefined') as unknown as void));
						const card = new HitCard({ flavors: { hits: [flavor.flavors.hits[i]] } });
						announceHit(eb, '', monster, { assailant, card, damage, prevHp });
					}),
				);
			}

			return Promise.all(promises);
		});

		it('can announce weak hit to public channel', () => {
			const announcement = `💪 🏓 💪  Assailant hits Monster for 1 damage.\n\n💪 *Monster has 31HP.*\n`;
			const eb = makeEb(text => expect(text).to.equal(announcement));
			const monster = new Gladiator({ name: 'monster', hpVariance: 0, acVariance: 0 });
			const assailant = new Gladiator({ name: 'assailant', hpVariance: 0, acVariance: 0 });
			const card = { flavors: { hits: [['hits', 100]] as [string, number][] } };
			announceHit(eb, '', monster, { assailant, card, damage: 1, prevHp: 15 });
		});

		it('can announce strong damage to public channel', () => {
			const announcement = `💪 🔪 💪  Assailant hits Monster for 5 damage.\n\n💪 *Monster has 31HP.*\n`;
			const eb = makeEb(text => expect(text).to.equal(announcement));
			const monster = new Gladiator({ name: 'monster', hpVariance: 0, acVariance: 0 });
			const assailant = new Gladiator({ name: 'assailant', hpVariance: 0, acVariance: 0 });
			const card = { flavors: { hits: [['hits', 100]] as [string, number][] } };
			announceHit(eb, '', monster, { assailant, card, damage: 5, prevHp: 15 });
		});

		it('can announce top damage to public channel', () => {
			const announcement = `💪 🔥 💪  Assailant hits Monster for 10 damage.\n\n💪 *Monster has 31HP.*\n`;
			const eb = makeEb(text => expect(text).to.equal(announcement));
			const monster = new Gladiator({ name: 'monster', hpVariance: 0, acVariance: 0 });
			const assailant = new Gladiator({ name: 'assailant', hpVariance: 0, acVariance: 0 });
			const card = { flavors: { hits: [['hits', 100]] as [string, number][] } };
			announceHit(eb, '', monster, { assailant, card, damage: 10, prevHp: 15 });
		});

		it('can announce bloodied to public channel', () => {
			const announcement = `💪 🔥 💪  Assailant hits Monster for 10 damage.\n\n💪 *Monster is now bloodied. Monster has only 15HP.*\n`;
			const eb = makeEb(text => expect(text).to.equal(announcement));
			const monster = new Gladiator({ name: 'monster', hpVariance: 0, acVariance: 0 });
			const assailant = new Gladiator({ name: 'assailant', hpVariance: 0, acVariance: 0 });
			const card = { flavors: { hits: [['hits', 100]] as [string, number][] } };
			(monster as any).bloodied = 15;
			announceHit(eb, '', monster, { assailant, card, damage: 10, prevHp: 30 });
		});

		it('can announce still bloodied after already bloodied to public channel', () => {
			const announcement = `💪 🔥 💪  Assailant hits Monster for 10 damage.\n\n💪 *Monster has only 1HP.*\n`;
			const eb = makeEb(text => expect(text).to.equal(announcement));
			const monster = new Gladiator({ name: 'monster', hpVariance: 0, acVariance: 0 });
			const assailant = new Gladiator({ name: 'assailant', hpVariance: 0, acVariance: 0 });
			const card = { flavors: { hits: [['hits', 100]] as [string, number][] } };
			(monster as any).hp = 1;
			announceHit(eb, '', monster, { assailant, card, damage: 10, prevHp: 13 });
		});

		it('can announce 11 damage hit with custom icons', () => {
			const announcement = `💪 ✅ 💪  Assailant hits Monster for 11 damage.\n\n💪 *Monster has only 1HP.*\n`;
			const eb = makeEb(text => expect(text).to.equal(announcement));
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
			(monster as any).hp = 1;
			announceHit(eb, '', monster, { assailant, card, damage: 11, prevHp: 12 });
		});

		it('can announce 1 damage hit with custom icons', () => {
			const announcement = `💪 ✅ 💪  Assailant hits Monster for 1 damage.\n\n💪 *Monster has only 1HP.*\n`;
			const eb = makeEb(text => expect(text).to.equal(announcement));
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
			(monster as any).hp = 1;
			announceHit(eb, '', monster, { assailant, card, damage: 1, prevHp: 2 });
		});

		it('can announce with custom flavorText', () => {
			const announcement = `🔥 💪  Monster is caught in a sudden fire and takes 1 damage.\n\n💪 *Monster has only 1HP.*\n`;
			const eb = makeEb(text => expect(text).to.equal(announcement));
			const monster = new Gladiator({ name: 'monster', hpVariance: 0, acVariance: 0 });
			const assailant = new Gladiator({ name: 'assailant', hpVariance: 0, acVariance: 0 });
			const card = {
				flavorText: '🔥 💪  Monster is caught in a sudden fire and takes 1 damage.',
			};
			(monster as any).hp = 1;
			announceHit(eb, '', monster, { assailant, card, damage: 1, prevHp: 2 });
		});

		it('can use custom flavor icon', () => {
			const announcement = `💪 🔥 💪  Assailant burns Monster for 1 damage.\n\n💪 *Monster has only 1HP.*\n`;
			const eb = makeEb(text => expect(text).to.equal(announcement));
			const monster = new Gladiator({ name: 'monster', hpVariance: 0, acVariance: 0 });
			const assailant = new Gladiator({ name: 'assailant', hpVariance: 0, acVariance: 0 });
			const card = {
				flavors: { hits: [['burns', 100, '🔥']] as [string, number, string][] },
			};
			(monster as any).hp = 1;
			announceHit(eb, '', monster, { assailant, card, damage: 1, prevHp: 2 });
		});

		it('can use custom flavor', () => {
			const announcement = `💪 🔥 💪  Assailant burns Monster for 1 damage.\n\n💪 *Monster has only 1HP.*\n`;
			const eb = makeEb(text => expect(text).to.equal(announcement));
			const monster = new Gladiator({ name: 'monster', hpVariance: 0, acVariance: 0 });
			const assailant = new Gladiator({ name: 'assailant', hpVariance: 0, acVariance: 0 });
			const card = {
				flavor: { text: 'burns', icon: '🔥' },
			};
			(monster as any).hp = 1;
			announceHit(eb, '', monster, { assailant, card, damage: 1, prevHp: 2 });
		});
	});
});
