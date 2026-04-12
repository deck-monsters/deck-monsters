import { expect } from 'chai';

import { announceRolled } from './rolled.js';
import type { RoomEventBus } from '../events/index.js';

function makeEb(onPublish: (text: string) => void): RoomEventBus {
	return {
		publish: ({ text }: { text: string }) => {
			onPublish(text);
			return { id: '1', roomId: 'test', timestamp: 0, type: 'announce', scope: 'public', text, payload: {} };
		},
	} as unknown as RoomEventBus;
}

describe('./announcements/rolled.ts', () => {
	it('announces a partial roll payload without crashing', () => {
		let publishedText = '';
		const eb = makeEb((text) => {
			publishedText = text;
		});

		announceRolled(eb, '', {}, {
			reason: 'to determine how much to drink.',
			roll: { result: 5 },
			who: { givenName: 'Player' },
			outcome: 'Player grows stronger...',
		});

		expect(publishedText).to.include('Player rolled _5_ to determine how much to drink.');
		expect(publishedText).to.not.include('undefined');
		expect(publishedText).to.include('🎲 *5*');
	});
});
