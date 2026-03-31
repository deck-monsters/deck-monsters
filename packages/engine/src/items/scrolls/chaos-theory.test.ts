import { expect } from 'chai';
import sinon from 'sinon';

import { ChaosTheoryScroll } from './chaos-theory.js';
import { TARGET_RANDOM_PLAYER } from '../../helpers/targeting-strategies.js';

const makeMonster = (overrides: Record<string, unknown> = {}) => ({
	givenName: 'Jenn',
	pronouns: { he: 'she', him: 'her', his: 'her' },
	targetingStrategy: undefined as string | undefined,
	removeItem: sinon.stub().returns(false),
	...overrides
});

const makeCharacter = () => ({
	givenName: 'Character',
	pronouns: { he: 'she', him: 'her', his: 'her' },
	items: [] as any[],
	removeItem: (item: any) => {}
});

describe('./items/scrolls/chaos-theory.ts', () => {
	const channelStub = sinon.stub();

	before(() => {
		channelStub.resolves();
	});

	beforeEach(() => {
		channelStub.resolves();
	});

	afterEach(() => {
		channelStub.reset();
	});

	it('can be instantiated with defaults', () => {
		const chaosTheory = new ChaosTheoryScroll();
		const jenn = makeMonster();

		expect(chaosTheory).to.be.an.instanceof(ChaosTheoryScroll);
		expect(chaosTheory.numberOfUses).to.equal(3);
		expect(chaosTheory.expired).to.be.false;
		expect(chaosTheory.stats).to.equal('Usable 3 times.');
		expect(chaosTheory.icon).to.equal('🦋');
		expect(chaosTheory.getTargetingDetails(jenn)).to.equal(
			'Jenn will look around the ring and pick a random foe to target, unless directed otherwise by a specific card.'
		);
	});

	it('can change your targeting strategy', () => {
		const chaosTheory = new ChaosTheoryScroll();
		const character = makeCharacter();
		const monster = makeMonster();

		expect(monster.targetingStrategy).to.equal(undefined);

		return chaosTheory.use({ channel: channelStub, character, monster }).then(() => {
			expect(monster.targetingStrategy).to.equal(TARGET_RANDOM_PLAYER);
			expect(chaosTheory.used).to.equal(1);
			expect(chaosTheory.expired).to.be.false;
			return expect(chaosTheory.stats).to.equal('Usable 2 more times (of 3 total).');
		});
	});
});
