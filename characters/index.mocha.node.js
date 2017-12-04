const { expect, sinon } = require('../shared/test-setup');

const Beastmaster = require('./beastmaster');
const characters = require('./index');
const pause = require('../helpers/pause');

describe('./characters/index.js', () => {
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

	it('can get a random character', () => {
		const { randomCharacter } = characters;
		const character = randomCharacter();

		expect(character).to.be.an.instanceof(Beastmaster);
		expect(character.monsters.length).to.equal(1);
		expect(character.monsters[0].cards.length).to.equal(character.monsters[0].cardSlots);
		expect(character.givenName).to.be.a('string');
		expect(character.monsters[0].givenName).to.be.a('string');
	});
});
