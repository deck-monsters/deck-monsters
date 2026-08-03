import { expect } from 'chai';
import sinon from 'sinon';
import { announceAndThrow } from './announce-and-throw.js';
import { CommandRefusalError, isCommandRefusal } from './command-refusal-error.js';

// ---------------------------------------------------------------------------
// announceAndThrow behaviour
// ---------------------------------------------------------------------------

describe('announceAndThrow', () => {
	afterEach(() => sinon.restore());

	it('calls channel with the announce message before rejecting', async () => {
		const channel = sinon.stub().resolves();
		const message = 'You need a monster in the ring first.';

		await announceAndThrow(channel, message).catch(() => {});

		expect(channel.calledOnce).to.be.true;
		expect(channel.firstCall.args[0]).to.deep.include({ announce: message });
	});

	it('rejects with CommandRefusalError, not a plain Error — fails if implementation reverts to new Error()', async () => {
		const channel = sinon.stub().resolves();
		const message = 'Quota exhausted — try again tomorrow.';

		let caught: unknown;
		await announceAndThrow(channel, message).catch((e) => { caught = e; });

		// instanceof CommandRefusalError is false for `new Error()` — this is the discriminating
		// assertion that breaks if the implementation reverts to plain Error.
		expect(caught).to.be.instanceOf(CommandRefusalError);
		// Also verify the constructor name is the narrow type, not the base class.
		expect((caught as Error).constructor.name).to.equal('CommandRefusalError');
	});

	it('carries the exact announce text as the error message', async () => {
		const channel = sinon.stub().resolves();
		const message = 'The ring is full! Wait for the current battle to finish.';

		let caught: unknown;
		await announceAndThrow(channel, message).catch((e) => { caught = e; });

		expect((caught as Error).message).to.equal(message);
	});

	it('sets isCommandRefusal sentinel to true — verified via the type guard', async () => {
		const channel = sinon.stub().resolves();

		let caught: unknown;
		await announceAndThrow(channel, 'any').catch((e) => { caught = e; });

		// Use the exported type guard rather than (err as any) to avoid `as any` in tests
		expect(isCommandRefusal(caught)).to.equal(true);
	});

	it('passes extra fields through to the channel call', async () => {
		const channel = sinon.stub().resolves();

		await announceAndThrow(channel, 'msg', { delay: 'short' }).catch(() => {});

		expect(channel.firstCall.args[0]).to.deep.include({ announce: 'msg', delay: 'short' });
	});

	it('awaits channel before throwing — channel runs even if it is slow', async () => {
		const order: string[] = [];
		const channel = sinon.stub().callsFake(async () => {
			await new Promise<void>(resolve => setImmediate(resolve));
			order.push('channel');
		});

		await announceAndThrow(channel, 'msg').catch(() => { order.push('throw'); });

		expect(order).to.deep.equal(['channel', 'throw']);
	});
});

// ---------------------------------------------------------------------------
// isCommandRefusal type guard
// ---------------------------------------------------------------------------

describe('isCommandRefusal', () => {
	it('returns true for a CommandRefusalError instance', () => {
		expect(isCommandRefusal(new CommandRefusalError('msg'))).to.be.true;
	});

	it('returns true for a cross-boundary object with isCommandRefusal: true (sentinel compatible)', () => {
		// Simulates a CommandRefusalError from a different module realm (different dist copy,
		// bundler chunk) where instanceof would return false.
		const foreign = Object.assign(new Error('msg'), { isCommandRefusal: true as const });
		expect(isCommandRefusal(foreign)).to.be.true;
	});

	it('returns false for a plain Error without the sentinel', () => {
		expect(isCommandRefusal(new Error('plain'))).to.be.false;
	});

	it('returns false for null', () => {
		expect(isCommandRefusal(null)).to.be.false;
	});

	it('returns false for undefined', () => {
		expect(isCommandRefusal(undefined)).to.be.false;
	});

	it('returns false for a string', () => {
		expect(isCommandRefusal('just a string')).to.be.false;
	});

	it('returns false when isCommandRefusal property is not exactly true', () => {
		const almost = Object.assign(new Error('msg'), { isCommandRefusal: 1 });
		expect(isCommandRefusal(almost)).to.be.false;
	});
});
