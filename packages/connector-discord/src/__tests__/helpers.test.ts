import { expect } from 'chai';
import sinon from 'sinon';
import { resolveUser, resolveConnectorUserId, dispatchCommand } from '../slash-commands/helpers.js';
import { discordActiveFlows, busyFlowMessage } from '../command-flow.js';

function makeSelectChain(result: unknown[]) {
	const limitStub = sinon.stub().resolves(result);
	const whereResult = Object.assign(Promise.resolve(result), { limit: limitStub });
	const whereStub = sinon.stub().returns(whereResult);
	const fromStub = sinon.stub().returns({ where: whereStub });
	return { from: fromStub };
}

describe('resolveUser / resolveConnectorUserId', () => {
	afterEach(() => {
		discordActiveFlows.clear();
		sinon.restore();
	});

	it('resolveUser resolves the guild/user active room (not always the default)', async () => {
		const db = {
			select: sinon.stub().callsFake(() => makeSelectChain([{ userId: 'supabase-user-1' }])),
		};

		const guildRoomManager = {
			resolveRoomForUser: sinon.stub().resolves('active-sub-room'),
			getOrCreateDefaultRoom: sinon.stub().resolves('default-room'),
		};

		const interaction = {
			user: { id: 'discord-snowflake-1', username: 'Alice' },
			guildId: 'guild-abc',
			channelId: 'channel-1',
		};

		const ctx = {
			db: db as any,
			guildRoomManager: guildRoomManager as any,
			roomManager: {} as any,
			bot: {} as any,
		};

		const result = await resolveUser(interaction as any, ctx as any);

		expect(result.supabaseUserId).to.equal('supabase-user-1');
		expect(result.roomId).to.equal('active-sub-room');
		expect(guildRoomManager.resolveRoomForUser.calledOnceWith('guild-abc', 'supabase-user-1')).to
			.be.true;
		expect(guildRoomManager.getOrCreateDefaultRoom.called).to.be.false;
	});

	it('resolveConnectorUserId returns the supabase id without resolving a room', async () => {
		const db = {
			select: sinon.stub().callsFake(() => makeSelectChain([{ userId: 'supabase-user-1' }])),
		};
		const guildRoomManager = {
			resolveRoomForUser: sinon.stub().resolves('should-not-be-called'),
		};
		const interaction = {
			user: { id: 'discord-snowflake-1', username: 'Alice' },
			guildId: 'guild-abc',
		};
		const ctx = {
			db: db as any,
			guildRoomManager: guildRoomManager as any,
			roomManager: {} as any,
			bot: {} as any,
		};

		const userId = await resolveConnectorUserId(interaction as any, ctx as any);
		expect(userId).to.equal('supabase-user-1');
		expect(guildRoomManager.resolveRoomForUser.called).to.be.false;
	});
});

describe('dispatchCommand serialization / active flows', () => {
	afterEach(() => {
		discordActiveFlows.clear();
		sinon.restore();
	});

	function makeDispatchEnv(opts: {
		action?: (args: unknown) => Promise<unknown>;
		lanes?: string[];
	} = {}) {
		const lanes = opts.lanes ?? [];
		const action = opts.action ?? (async () => undefined);
		const handleCommand = sinon.stub().returns(action);
		const registerUser = sinon.stub();
		const buildPrivateChannel = sinon.stub().returns(async () => undefined);

		const interaction = {
			user: { id: 'discord-1', username: 'Alice' },
			guildId: 'guild-1',
			channelId: 'channel-1',
		};

		const ctx = {
			db: {} as any,
			guildRoomManager: {} as any,
			roomManager: {
				getGame: sinon.stub().resolves({ handleCommand }),
				getMemberRole: sinon.stub().resolves('member'),
				runSerializedEngineWork: async (laneKey: string, fn: () => Promise<unknown>) => {
					lanes.push(laneKey);
					return fn();
				},
			},
			bot: {
				getOrCreateSubscription: sinon.stub().resolves({
					registerUser,
					buildPrivateChannel,
				}),
			},
		};

		return { interaction, ctx, lanes, handleCommand, registerUser, buildPrivateChannel, action };
	}

	it('runs the action in a per-user roomId:userId engine lane', async () => {
		const { interaction, ctx, lanes } = makeDispatchEnv();

		const recognized = await dispatchCommand(
			interaction as any,
			'spawn basilisk',
			ctx as any,
			'supabase-user-1',
			'room-abc'
		);

		expect(recognized).to.equal(true);
		expect(lanes).to.deep.equal(['room-abc:supabase-user-1']);
		expect(discordActiveFlows.has('room-abc:supabase-user-1')).to.equal(false);
	});

	it('rejects a second concurrent same-user command with actionable text', async () => {
		let release!: () => void;
		const held = new Promise<void>((resolve) => {
			release = resolve;
		});

		const env = makeDispatchEnv({
			action: async () => held,
		});

		const first = dispatchCommand(
			env.interaction as any,
			'spawn',
			env.ctx as any,
			'supabase-user-1',
			'room-abc'
		);

		// Let the first flow acquire the lock and enter the lane
		await new Promise((r) => setImmediate(r));
		expect(discordActiveFlows.has('room-abc:supabase-user-1')).to.equal(true);

		try {
			await dispatchCommand(
				env.interaction as any,
				'look at ring',
				env.ctx as any,
				'supabase-user-1',
				'room-abc'
			);
			expect.fail('second command should be rejected');
		} catch (err) {
			expect((err as Error).message).to.equal(busyFlowMessage);
			expect((err as Error).name).to.equal('DiscordFlowBusyError');
		}

		release();
		await first;
	});

	it('allows a concurrent command from another user in the same room', async () => {
		let releaseA!: () => void;
		const heldA = new Promise<void>((resolve) => {
			releaseA = resolve;
		});

		const envA = makeDispatchEnv({ action: async () => heldA });
		const envB = makeDispatchEnv();
		// Share roomManager lane tracking across users
		const lanes: string[] = [];
		const sharedRoomManager = {
			getGame: sinon.stub().callsFake(async () => ({
				handleCommand: sinon.stub().callsFake((args: { command: string }) => {
					if (args.command === 'spawn') return async () => heldA;
					return async () => undefined;
				}),
			})),
			getMemberRole: sinon.stub().resolves('member'),
			runSerializedEngineWork: async (laneKey: string, fn: () => Promise<unknown>) => {
				lanes.push(laneKey);
				return fn();
			},
		};
		(envA.ctx as any).roomManager = sharedRoomManager;
		(envB.ctx as any).roomManager = sharedRoomManager;
		(envB.ctx as any).bot = envA.ctx.bot;

		const first = dispatchCommand(
			envA.interaction as any,
			'spawn',
			envA.ctx as any,
			'user-a',
			'room-abc'
		);
		await new Promise((r) => setImmediate(r));

		const second = await dispatchCommand(
			{ ...envB.interaction, user: { id: 'discord-2', username: 'Bob' } } as any,
			'look at ring',
			envB.ctx as any,
			'user-b',
			'room-abc'
		);

		expect(second).to.equal(true);
		expect(lanes).to.include('room-abc:user-a');
		expect(lanes).to.include('room-abc:user-b');

		releaseA();
		await first;
	});
});
