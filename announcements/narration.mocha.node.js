const { expect, sinon } = require('../shared/test-setup');

const announceNarration = require('./narration');
const pause = require('../helpers/pause');

describe('./announcements/narration.js', () => {
	let pauseStub;

	before(() => {
		pauseStub = sinon.stub(pause, 'getThrottleRate');
		pauseStub.returns(5);
	});

	after(() => {
		pause.getThrottleRate.restore();
	});

	describe('narration', () => {
		it('can announce to public channel', () => {
			const narration = 'success';

			const publicChannel = ({ announce }) => {
				expect(announce).to.equal(narration);
			};

			announceNarration(publicChannel, {}, '', {}, { narration });
		});

		it('can announce to private channel', () => {
			const narration = 'success';
			const channel = 'channel';
			const channelName = 'channelName';

			const publicChannel = sinon.stub();
			const channelManager = {
				queueMessage: ({ announce, channel: channelResult, channelName: channelNameResult }) => {
					expect(announce).to.equal(narration);
					expect(channelResult).to.equal(channel);
					expect(channelNameResult).to.equal(channelName);
					expect(publicChannel).to.not.have.been.called;
				},
				sendMessages: sinon.stub()
			};

			announceNarration('', { channelManager, channel: publicChannel }, { channel, channelName, narration });
		});
	});
});
