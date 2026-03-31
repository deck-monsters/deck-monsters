import { expect } from 'chai';
import sinon from 'sinon';

import { announceNarration } from './narration.js';

describe('./announcements/narration.ts', () => {
	describe('narration', () => {
		it('can announce to public channel', () => {
			const narration = 'success';

			const publicChannel = ({ announce }: { announce: string }) => {
				expect(announce).to.equal(narration);
			};

			announceNarration(publicChannel, {} as any, '', {}, { narration });
		});

		it('can announce to private channel', () => {
			const narration = 'success';
			const channel = 'channel';
			const channelName = 'channelName';

			const publicChannel = sinon.stub();
			const channelManager = {
				queueMessage: ({
					announce,
					channel: channelResult,
					channelName: channelNameResult,
				}: {
					announce: string;
					channel: string;
					channelName: string;
				}) => {
					expect(announce).to.equal(narration);
					expect(channelResult).to.equal(channel);
					expect(channelNameResult).to.equal(channelName);
					expect(publicChannel).to.not.have.been.called;
				},
				sendMessages: sinon.stub(),
			};

			announceNarration(publicChannel, channelManager, '', {}, { channel, channelName, narration });
		});
	});
});
