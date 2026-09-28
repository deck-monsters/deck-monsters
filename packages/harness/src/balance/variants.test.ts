import { expect } from 'chai';
import { allMonsters, engineReady, getCardClassByTypeName } from '@deck-monsters/engine';
import { VARIANTS, applyVariants } from './variants.js';

type Klass = { name: string; prototype: object } & Record<string, unknown>;
const cls = (name: string): Klass => (allMonsters as unknown as Klass[]).find(M => M.name === name)!;

describe('balance experiment variants', () => {
	before(async () => {
		await engineReady;
	});

	it('undoes every variant exactly', () => {
		const Dragon = cls('Dragon');
		const Gladiator = cls('Gladiator');
		const Tsunami = getCardClassByTypeName('Tsunami') as unknown as { prototype: Record<string, unknown> };
		const FireBreath = getCardClassByTypeName('Fire Breath') as unknown as { prototype: Record<string, unknown> };
		const snapshot = (): unknown[] => [
			Dragon.hpVariance, Dragon.acVariance, Gladiator.hpVariance, Gladiator.acVariance,
			Object.getOwnPropertyNames(Dragon.prototype).sort().join(), Object.getOwnPropertyNames(Gladiator.prototype).sort().join(),
			Tsunami.prototype.effect, FireBreath.prototype.wind,
		];
		const before = snapshot();
		const undo = applyVariants(Object.keys(VARIANTS));
		expect(snapshot()).to.not.deep.equal(before);
		undo();
		expect(snapshot()).to.deep.equal(before);
	});

	it('refuses an unknown variant and leaves nothing applied', () => {
		const Dragon = cls('Dragon');
		const hp = Dragon.hpVariance;
		expect(() => applyVariants(['dragon-hp+3', 'no-such-variant'])).to.throw('Unknown variant');
		expect(Dragon.hpVariance).to.equal(hp);
	});
});
