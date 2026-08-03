import { expect } from 'chai';
import sinon from 'sinon';
import {
	discordActiveFlows,
	tryAcquireDiscordFlow,
	releaseDiscordFlow,
	runDiscordCommandAction,
	busyFlowMessage,
} from '../command-flow.js';

describe('Discord command-flow coordinator', () => {
	afterEach(() => {
		discordActiveFlows.clear();
		sinon.restore();
	});

	it('acquires one flow per roomId:userId and rejects a second same-user flow quickly', () => {
		const first = tryAcquireDiscordFlow('room-1', 'user-a');
		expect(first.ok).to.equal(true);
		if (!first.ok) return;

		const second = tryAcquireDiscordFlow('room-1', 'user-a');
		expect(second.ok).to.equal(false);
		if (second.ok) return;
		expect(second.message).to.equal(busyFlowMessage);
		expect(second.message).to.match(/already in progress|prompt|wait/i);

		releaseDiscordFlow('room-1', 'user-a', first.token);
		const third = tryAcquireDiscordFlow('room-1', 'user-a');
		expect(third.ok).to.equal(true);
	});

	it('allows another user in the same room to acquire a flow independently', () => {
		const a = tryAcquireDiscordFlow('room-1', 'user-a');
		const b = tryAcquireDiscordFlow('room-1', 'user-b');
		expect(a.ok).to.equal(true);
		expect(b.ok).to.equal(true);
	});

	it('release is ownership-safe — stale tokens do not clear a newer flow', () => {
		const first = tryAcquireDiscordFlow('room-1', 'user-a');
		expect(first.ok).to.equal(true);
		if (!first.ok) return;

		releaseDiscordFlow('room-1', 'user-a', first.token);

		const second = tryAcquireDiscordFlow('room-1', 'user-a');
		expect(second.ok).to.equal(true);
		if (!second.ok) return;

		releaseDiscordFlow('room-1', 'user-a', first.token);
		expect(discordActiveFlows.get('room-1:user-a')).to.equal(second.token);

		releaseDiscordFlow('room-1', 'user-a', second.token);
		expect(discordActiveFlows.has('room-1:user-a')).to.equal(false);
	});

	it('runDiscordCommandAction serializes through roomId:userId and awaits the action', async () => {
		const lanes: string[] = [];
		let actionRan = false;
		const roomManager = {
			runSerializedEngineWork: async (laneKey: string, fn: () => Promise<unknown>) => {
				lanes.push(laneKey);
				return fn();
			},
		};

		await runDiscordCommandAction({
			roomManager,
			roomId: 'room-9',
			userId: 'user-z',
			action: async () => {
				actionRan = true;
			},
		});

		expect(lanes).to.deep.equal(['room-9:user-z']);
		expect(actionRan).to.equal(true);
		expect(discordActiveFlows.has('room-9:user-z')).to.equal(false);
	});

	it('runDiscordCommandAction rejects a concurrent same-user command without entering the lane', async () => {
		const lanes: string[] = [];
		const roomManager = {
			runSerializedEngineWork: async (laneKey: string, fn: () => Promise<unknown>) => {
				lanes.push(laneKey);
				return fn();
			},
		};

		const held = tryAcquireDiscordFlow('room-1', 'user-a');
		expect(held.ok).to.equal(true);

		try {
			await runDiscordCommandAction({
				roomManager,
				roomId: 'room-1',
				userId: 'user-a',
				action: async () => {
					expect.fail('action should not run while flow is held');
				},
			});
			expect.fail('should have thrown DiscordFlowBusyError');
		} catch (err) {
			expect((err as Error).name).to.equal('DiscordFlowBusyError');
			expect((err as Error).message).to.equal(busyFlowMessage);
		}
		expect(lanes).to.deep.equal([]);
	});

	it('prompt answers are deliverable outside the held lane (collector resolve unblocks the action)', async () => {
		let resolveAnswer!: (value: string) => void;
		const answerPromise = new Promise<string>((resolve) => {
			resolveAnswer = resolve;
		});

		const roomManager = {
			runSerializedEngineWork: async (_laneKey: string, fn: () => Promise<unknown>) => fn(),
		};

		const actionDone = runDiscordCommandAction({
			roomManager,
			roomId: 'room-1',
			userId: 'user-a',
			action: async () => answerPromise,
		});

		// Flow is held while waiting on the prompt answer
		expect(discordActiveFlows.has('room-1:user-a')).to.equal(true);

		// Answer arrives outside the lane (simulates Discord collector firing)
		resolveAnswer('Crimson');
		await actionDone;
		expect(discordActiveFlows.has('room-1:user-a')).to.equal(false);
	});
});
