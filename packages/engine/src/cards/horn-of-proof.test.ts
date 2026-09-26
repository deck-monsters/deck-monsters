import { expect } from 'chai';
import sinon from 'sinon';

import { HornOfProofCard } from './horn-of-proof.js';
import { hydrateCard } from './helpers/hydrate.js';
import Unicorn from '../monsters/unicorn.js';
import Gladiator from '../monsters/gladiator.js';
import WeepingAngel from '../monsters/weeping-angel.js';
import Jinn from '../monsters/jinn.js';
import { BAD_BATCH_EFFECT } from '../constants/effect-types.js';
import { CLERIC } from '../constants/creature-classes.js';
import { UNICORN } from '../constants/creature-types.js';

const holdEffect = () => Object.assign(() => undefined, { effectType: 'ImmobilizeEffect' });

describe('./cards/horn-of-proof.ts Horn of Proof', () => {
	let unicorn: any;
	let foe: any;
	let ring: any;
	let contestants: any[];

	beforeEach(() => {
		unicorn = new Unicorn({ name: 'Nola', xp: 300 });
		foe = new Gladiator({ name: 'Tor' });
		contestants = [{ monster: unicorn }, { monster: foe }];
		ring = {
			contestants,
			encounterEffects: [],
			channelManager: { sendMessages: () => Promise.resolve() },
		};
		unicorn.startEncounter(ring);
		foe.startEncounter(ring);
		unicorn.hp = unicorn.maxHp - 10;
	});

	afterEach(() => sinon.restore());

	it('is a level 2 Unicorn or Cleric card', () => {
		expect(HornOfProofCard.permittedClassesAndTypes).to.deep.equal([UNICORN, CLERIC]);
		expect(HornOfProofCard.level).to.equal(2);
		expect(new WeepingAngel({ xp: 300 }).canHoldCard(HornOfProofCard)).to.equal(true);
		expect(new Jinn({ xp: 300 }).canHoldCard(HornOfProofCard)).to.equal(false);
		expect(new HornOfProofCard().stats).to.include('Then heal 3 hp.');
	});

	it('heals a fixed 3 hp', async () => {
		const before = unicorn.hp;
		await new HornOfProofCard().play(unicorn, foe, ring, contestants);
		expect(unicorn.hp).to.equal(before + 3);
	});

	it('removes a hold first, and only the hold', async () => {
		const hold = holdEffect();
		unicorn.encounterEffects = [hold];
		unicorn.encounterModifiers.immobilizedTurns = 2;
		unicorn.encounterModifiers.dex = -2;
		ring.encounterEffects = [Object.assign(() => undefined, { effectType: BAD_BATCH_EFFECT })];

		await new HornOfProofCard().effect(unicorn, unicorn, ring);

		expect(unicorn.encounterEffects).to.deep.equal([]);
		expect(unicorn.encounterModifiers.immobilizedTurns).to.equal(0);
		expect(unicorn.encounterModifiers.dex).to.equal(-2);
		expect(ring.encounterEffects).to.have.length(1);
	});

	it('otherwise lifts the harshest stat curse', async () => {
		unicorn.encounterModifiers.dex = -1;
		unicorn.encounterModifiers.str = -3;
		unicorn.encounterModifiers.ac = 2; // a brace is not a curse

		await new HornOfProofCard().effect(unicorn, unicorn, ring);

		expect(unicorn.encounterModifiers.str).to.equal(0);
		expect(unicorn.encounterModifiers.dex).to.equal(-1);
		expect(unicorn.encounterModifiers.ac).to.equal(2);
	});

	it('otherwise pours away one Bad Batch waiting in the ring, and only one', async () => {
		const other = () => undefined;
		const first = Object.assign(() => undefined, { effectType: BAD_BATCH_EFFECT });
		const second = Object.assign(() => undefined, { effectType: BAD_BATCH_EFFECT });
		ring.encounterEffects = [first, other, second];

		await new HornOfProofCard().effect(unicorn, unicorn, ring);

		expect(ring.encounterEffects).to.deep.equal([other, second]);
	});

	it('still heals when there is nothing to purify', async () => {
		const card = new HornOfProofCard();
		const narrations: string[] = [];
		card.on('narration', (_c: string, _card: any, { narration }: any) => narrations.push(narration));
		const before = unicorn.hp;

		await card.effect(unicorn, unicorn, ring);

		expect(narrations[0]).to.include('nothing to purify');
		expect(unicorn.hp).to.equal(before + 3);
	});

	it('hydrates from JSON', () => {
		const restored = hydrateCard(JSON.parse(JSON.stringify(new HornOfProofCard())));
		expect(restored).to.be.instanceOf(HornOfProofCard);
	});
});
