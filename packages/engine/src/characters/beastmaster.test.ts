import { expect } from 'chai';
import sinon from 'sinon';
import Beastmaster from './beastmaster.js';

describe('characters/beastmaster', () => {
	let channelStub: sinon.SinonStub;

	beforeEach(() => {
		channelStub = sinon.stub().resolves(undefined);
	});

	afterEach(() => {
		channelStub.reset();
		sinon.restore();
	});

	it('can be instantiated', () => {
		const beastmaster = new Beastmaster();

		expect(beastmaster).to.be.instanceOf(Beastmaster);
	});

	it('starts with the correct number of monster slots', () => {
		const beastmaster = new Beastmaster();

		expect(beastmaster.monsterSlots).to.equal(7);
	});

	it('starts with an empty monster list', () => {
		const beastmaster = new Beastmaster();

		expect(beastmaster.monsters).to.deep.equal([]);
	});

	it('can add a monster', () => {
		const beastmaster = new Beastmaster();
		const fakeMonster = { givenName: 'TestMonster' } as any;

		beastmaster.addMonster(fakeMonster);

		expect(beastmaster.monsters).to.include(fakeMonster);
	});

	it('can drop a monster', () => {
		const beastmaster = new Beastmaster();
		const fakeMonster = { givenName: 'TestMonster' } as any;

		beastmaster.addMonster(fakeMonster);
		expect(beastmaster.monsters).to.include(fakeMonster);

		beastmaster.dropMonster(fakeMonster);
		expect(beastmaster.monsters).to.not.include(fakeMonster);
	});

	it('can report whether it owns a monster by name', () => {
		const beastmaster = new Beastmaster();
		const fakeMonster = { givenName: 'Ragnar' } as any;

		expect(beastmaster.ownsMonster('Ragnar')).to.equal(false);

		beastmaster.addMonster(fakeMonster);

		expect(beastmaster.ownsMonster('Ragnar')).to.equal(true);
		expect(beastmaster.ownsMonster('ragnar')).to.equal(true);
		expect(beastmaster.ownsMonster('Unknown')).to.equal(false);
	});
});
