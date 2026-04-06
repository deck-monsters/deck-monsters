import { expect } from 'chai';
import sinon from 'sinon';
import zlib from 'node:zlib';

import Game from './game.js';
import { BaseCard } from './cards/base.js';
import Ring from './ring/index.js';
import { RoomEventBus } from './events/index.js';

describe('game.ts', () => {
	afterEach(() => {
		sinon.restore();
	});

	it('has an event bus', () => {
		const game = new Game();

		expect(game.eventBus).to.be.instanceOf(RoomEventBus);
	});

	it('has card probabilities', () => {
		const game = new Game();

		expect(game.getCardProbabilities()).to.be.an('object');
	});

	it('has a ring', () => {
		const game = new Game();

		expect(game.ring).to.be.instanceOf(Ring);
		expect(game.getRing()).to.equal(game.ring);
	});

	it('can look at the ring', () => {
		const game = new Game();
		const lookStub = sinon.stub(game.ring, 'look');

		game.lookAtRing('user-1');

		expect(lookStub.calledOnce).to.equal(true);
		expect(lookStub.calledWith('user-1', undefined, undefined)).to.equal(true);
	});

	it('can save state', () => {
		const clock = sinon.useFakeTimers({ shouldClearNativeTimers: true });
		const game = new Game();
		const saveStateStub = sinon.stub();

		try {
			game.saveState = saveStateStub;
			game.emit('stateChange');

			// Advance past the 30s debounce; clock.tick also drains setImmediate callbacks
			clock.tick(31_000);

			expect(saveStateStub.calledOnce).to.equal(true);
			const arg = saveStateStub.firstCall.args[0] as string;
			const decoded = zlib.gunzipSync(Buffer.from(arg, 'base64')).toString();
			expect(JSON.parse(decoded)).to.be.an('object');
		} finally {
			// Clear stateSaveFunc so stale listener doesn't fire setTimeout in subsequent tests
			game.saveState = undefined;
			clock.restore();
		}
	});

	it('can draw a card', () => {
		const game = new Game();
		const card = game.drawCard({ useless: 'option' });

		expect(card).to.be.instanceOf(BaseCard);
		expect(card.name).to.not.equal(BaseCard.name);
	});

	it('can draw a card for a specific monster', () => {
		const game = new Game();
		const canHoldCard = sinon.stub().returns(true);
		const monster = { canHoldCard };
		const card = game.drawCard({ useless: 'option' }, monster);

		expect(card).to.be.instanceOf(BaseCard);
		expect(canHoldCard.called).to.equal(true);
	});

	describe('getCharacter Player-name auto-update', () => {
		it('updates givenName when existing character has placeholder "Player" name', async () => {
			const game = new Game();
			const channel = sinon.stub().resolves('0');

			// getCharacter will call createCharacter which uses the provided name as default
			// without prompting — char will be created with givenName 'Player'
			const char1 = await game.getCharacter({ channel, id: 'user-1', name: 'Player' });
			expect((char1 as any).givenName).to.equal('Player');

			// Second call with the real name resolved server-side
			const char2 = await game.getCharacter({ channel, id: 'user-1', name: 'RealName' });

			expect(char2).to.equal(char1); // same object returned
			// startCase splits camelCase: 'RealName' → 'Real Name'
			expect((char2 as any).givenName).to.equal('Real Name');
		});

		it('does not overwrite a custom character name with the real display name', async () => {
			const game = new Game();
			const channel = sinon.stub().resolves('0');

			// Create char with placeholder name
			const char1 = await game.getCharacter({ channel, id: 'user-2', name: 'Player' });
			// User explicitly renamed their character via editSelf — update via setOptions
			(char1 as any).setOptions({ name: 'CustomHero' });
			expect((char1 as any).givenName).to.equal('Custom Hero');

			const char2 = await game.getCharacter({ channel, id: 'user-2', name: 'RealName' });
			// 'Custom Hero' !== 'Player', so no override should happen
			expect((char2 as any).givenName).to.equal('Custom Hero'); // unchanged
		});
	});
});
