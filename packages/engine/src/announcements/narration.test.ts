import { expect } from 'chai';
import sinon from 'sinon';

import { announceNarration } from './narration.js';
import type { RoomEventBus } from '../events/index.js';

function makeEb(onPublish?: (text: string) => void): RoomEventBus {
	return {
		publish: ({ text }: { text: string }) => {
			if (onPublish) onPublish(text);
			return { id: '1', roomId: 'test', timestamp: 0, type: 'announce', scope: 'public', text, payload: {} };
		},
	} as unknown as RoomEventBus;
}

describe('./announcements/narration.ts', () => {
	describe('narration', () => {
		it('can announce to public channel', () => {
			const narration = 'success';
			let published = false;
			const eb = makeEb(text => {
				expect(text).to.equal(narration);
				published = true;
			});

			announceNarration(eb, '', {}, { narration });
			expect(published).to.equal(true);
		});

		it('can announce to private channel', () => {
			const narration = 'success';
			const channel = sinon.stub().resolves();
			const ebPublish = sinon.stub();
			const eb = { publish: ebPublish } as unknown as RoomEventBus;

			announceNarration(eb, '', {}, { channel, channelName: 'channelName', narration });

			expect(channel).to.have.been.calledOnce;
			expect(channel.firstCall.args[0]).to.deep.equal({ announce: narration });
			expect(ebPublish).to.not.have.been.called;
		});
	});
});
