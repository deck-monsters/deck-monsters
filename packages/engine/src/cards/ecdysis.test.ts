import { expect } from 'chai';

import { COMMON } from '../helpers/probabilities.js';
import { BASILISK } from '../constants/creature-types.js';
import { REASONABLE } from '../helpers/costs.js';
import { EcdysisCard } from './ecdysis.js';
import Basilisk from '../monsters/basilisk.js';

describe('./cards/ecdysis.ts', () => {
	let ecdysisCard: EcdysisCard;
	let basilisk: any;

	beforeEach(() => {
		ecdysisCard = new EcdysisCard();
		basilisk = new Basilisk({ acVariance: 0, xp: 1300 });
	});

	it('can be instantiated with defaults', () => {
		const stats = 'Boost: dex +1\rBoost: str +1';

		expect(ecdysisCard).to.be.an.instanceof(EcdysisCard);
		expect(ecdysisCard.cardType).to.equal('Ecdysis');
		expect((EcdysisCard as any).description).to.equal('Evolve into your more perfect form.');
		expect(ecdysisCard.icon).to.equal('📶');
		expect((ecdysisCard as any).boosts).to.deep.equal([
			{ prop: 'dex', amount: 1 },
			{ prop: 'str', amount: 1 },
		]);
		expect(ecdysisCard.stats).to.equal(stats);
		expect((ecdysisCard as any).cost).to.equal(REASONABLE.cost);
		expect((ecdysisCard as any).permittedClassesAndTypes).to.deep.equal([BASILISK]);
		expect((ecdysisCard as any).probability).to.equal(COMMON.probability);
	});

	it('can be instantiated with options', () => {
		const customEcdysisCard = new EcdysisCard({
			icon: '🆙',
			boosts: [
				{ prop: 'dex', amount: 20 },
				{ prop: 'str', amount: 20 },
			],
		} as any);

		const stats = 'Boost: dex +20\rBoost: str +20';

		expect(customEcdysisCard).to.be.an.instanceof(EcdysisCard);
		expect(customEcdysisCard.icon).to.equal('🆙');
		expect((customEcdysisCard as any).boosts).to.deep.equal([
			{ prop: 'dex', amount: 20 },
			{ prop: 'str', amount: 20 },
		]);
		expect(customEcdysisCard.stats).to.equal(stats);
	});

	it('increases dex & str by 1', () => {
		const startingDex = basilisk.dex;
		const startingStr = basilisk.str;

		const ring: any = {
			contestants: [{ monster: basilisk }, { monster: basilisk }],
			channelManager: { sendMessages: () => Promise.resolve() },
		};

		return ecdysisCard.play(basilisk, basilisk, ring).then(result => {
			expect(result).to.equal(true);
			expect(basilisk.dex).to.equal(startingDex + 1);
			expect(basilisk.str).to.equal(startingStr + 1);
		});
	});

	it('increases dex & str by custom amount', () => {
		const customEcdysisCard = new EcdysisCard({
			icon: '🆙',
			boosts: [
				{ prop: 'dex', amount: 2 },
				{ prop: 'str', amount: 3 },
			],
		} as any);
		const startingDex = basilisk.dex;
		const startingStr = basilisk.str;

		const ring: any = {
			contestants: [{ monster: basilisk }, { monster: basilisk }],
			channelManager: { sendMessages: () => Promise.resolve() },
		};

		return customEcdysisCard.play(basilisk, basilisk, ring).then(result => {
			expect(result).to.equal(true);
			expect(basilisk.dex).to.equal(startingDex + 2);
			expect(basilisk.str).to.equal(startingStr + 3);
		});
	});
});
