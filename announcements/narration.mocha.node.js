const { expect, sinon } = require('../shared/test-setup');

const announceNarration = require('./narration');
const pause = require('../helpers/pause');

describe('./announcements/narration.js', () => {
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

	describe('narration', () => {
		it('can announce to public channel', () => {
			const narration = 'success';

			const publicChannel = ({ announce }) => {
				expect(announce).to.equal(narration);
			}

			announceNarration(publicChannel, {}, '', {}, { narration });
		});
	});
});
