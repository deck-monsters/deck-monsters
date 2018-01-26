/* eslint-disable max-len */
const { expect, sinon } = require('../../shared/test-setup');

const pause = require('../../helpers/pause');
const LaCarambadaScroll = require('./la-carambada-according-to-clever-hans');
const Jinn = require('../../monsters/jinn');

const { TARGET_MAX_HP_PLAYER_ACCORDING_TO_HANS } = require('../../helpers/targeting-strategies');
const { ALMOST_NOTHING } = require('../../helpers/costs');
const { COMMON } = require('../../helpers/probabilities');

describe('./items/scrolls/la-carambada-according-to-clever-hans.js', () => {
	let channelStub;
	let pauseStub;

	before(() => {
		channelStub = sinon.stub();
		pauseStub = sinon.stub(pause, 'setTimeout');
	});

	beforeEach(() => {
		channelStub.resolves();
		pauseStub.callsArg(0);
	});

	afterEach(() => {
		channelStub.reset();
		pauseStub.reset();
	});

	after(() => {
		pause.setTimeout.restore();
	});

	it('can be instantiated with defaults', () => {
		const laCarambada = new LaCarambadaScroll();
		const jenn = new Jinn({ name: 'jenn', acVariance: 0, xp: 1300, gender: 'female' });

		expect(laCarambada.probability).to.equal(COMMON.probability);
		expect(laCarambada.cost).to.equal(ALMOST_NOTHING.cost);
		expect(laCarambada).to.be.an.instanceof(LaCarambadaScroll);
		expect(laCarambada.numberOfUses).to.equal(3);
		expect(laCarambada.expired).to.be.false;
		expect(laCarambada.stats).to.equal('Usable 3 times.');
		expect(laCarambada.icon).to.equal('👦');
		expect(laCarambada.targetingStrategy).to.equal(TARGET_MAX_HP_PLAYER_ACCORDING_TO_HANS);
		expect(laCarambada.itemType).to.equal('The Ballad of La Carambada According to Clever Hans');
		expect(laCarambada.getTargetingDetails(jenn)).to.equal("Clever Jenn's mother told her that she should target whichever living monster would have the highest hp if they were at full health (that is, the highest maximum hp), unless directed otherwise by a specific card, and that's exactly what she'll do.");
		expect(laCarambada.description).to.equal(`Junto a ellos, aterrorizó la comarca, aguardando el día de la venganza. Hizo fama por su diestro manejo de la pistola, del machete y, sobre todo, por su extraordinaria habilidad para cabalgar. En tiempos en que las mujeres acompañaban a sus hombres a un lado del caballo, ver a una mujer galopando era un acontecimiento mayor.

Your mother told you to target whoever has the highest maximum hp in the ring even if they currently have less hp, and that's exactly what you'll do.`);
	});
});
