import { expect } from 'chai';
import sinon from 'sinon';
import { GuildRoomSubscription } from '../guild-room-subscription.js';

// ---------------------------------------------------------------------------
// Stubs
// ---------------------------------------------------------------------------

function makeEventBus() {
	const subscribers = new Map<string, { userId?: string; deliver: (e: unknown) => unknown }>();

	return {
		subscribe: sinon.stub().callsFake((id: string, sub: { userId?: string; deliver: (e: unknown) => unknown }) => {
			subscribers.set(id, sub);
			return () => { subscribers.delete(id); };
		}),
		unsubscribe: sinon.stub().callsFake((id: string) => { subscribers.delete(id); }),
		respondToPrompt: sinon.stub(),
		cancelPrompt: sinon.stub(),
		async _deliver(event: { scope?: string; targetUserId?: string; [k: string]: unknown }) {
			const promises: Promise<unknown>[] = [];
			for (const sub of subscribers.values()) {
				// Mimic RoomEventBus delivery logic: public events go to all;
				// private events only to matching userId subscribers
				if (event.scope === 'public' || sub.userId === event.targetUserId) {
					// Capture any returned promise so tests can await full completion
					const result = sub.deliver(event);
					if (result instanceof Promise) promises.push(result);
				}
			}
			await Promise.all(promises);
		},
	};
}

function makeDiscordClient() {
	const channel = {
		send: sinon.stub().resolves(),
	};
	const user = {
		createDM: sinon.stub().resolves({ send: sinon.stub().resolves() }),
	};
	return {
		channels: { fetch: sinon.stub().resolves(channel) },
		users: { fetch: sinon.stub().resolves(user) },
		_channel: channel,
		_user: user,
	};
}

function makeDbStub(discordId: string | null = null) {
	const limitStub = sinon.stub().resolves(
		discordId ? [{ externalId: discordId }] : []
	);
	const whereResult = Object.assign(
		Promise.resolve(discordId ? [{ externalId: discordId }] : []),
		{ limit: limitStub }
	);
	const whereStub = sinon.stub().returns(whereResult);
	const fromStub = sinon.stub().returns({ where: whereStub });

	return { select: sinon.stub().returns({ from: fromStub }) };
}

// ---------------------------------------------------------------------------

describe('GuildRoomSubscription', () => {
	afterEach(() => sinon.restore());

	it('routes public events to the announcement channel', async () => {
		const client = makeDiscordClient();
		// Make channel return a guild text channel
		const { ChannelType } = await import('discord.js');
		const textChannel = { send: sinon.stub().resolves(), type: ChannelType.GuildText };
		client.channels.fetch = sinon.stub().resolves(textChannel);

		const eventBus = makeEventBus();
		const db = makeDbStub();

		const sub = new GuildRoomSubscription(
			client as any,
			eventBus as any,
			'guild-1',
			'room-1',
			'ch-123',
			db as any
		);
		sub.start();

		// Simulate a public announce event arriving via the direct event bus subscriber
		await eventBus._deliver({
			id: '1',
			roomId: 'room-1',
			scope: 'public',
			type: 'announce',
			text: 'Round 1 begins!',
			payload: {},
			timestamp: Date.now(),
		});

		expect(textChannel.send.calledOnce).to.be.true;
		expect(textChannel.send.firstCall.args[0].content).to.equal('Round 1 begins!');
	});

	it('delivers private events as DMs to the registered Discord user', async () => {
		const client = makeDiscordClient();
		const eventBus = makeEventBus();
		const db = makeDbStub();

		const sub = new GuildRoomSubscription(
			client as any,
			eventBus as any,
			'guild-1',
			'room-1',
			null,
			db as any
		);
		sub.start();

		const privateChannel = sub.buildPrivateChannel('discord-user-42');
		await privateChannel({ announce: 'Your monster won!' });

		expect(client.users.fetch.calledWith('discord-user-42')).to.be.true;
		expect(client._user.createDM.calledOnce).to.be.true;
	});

	it('lookupDiscordId returns from cache if previously registered', async () => {
		const client = makeDiscordClient();
		const eventBus = makeEventBus();
		const db = makeDbStub('discord-cached');

		const mockInteraction = { user: { id: 'discord-cached' }, deferReply: sinon.stub() };

		const sub = new GuildRoomSubscription(
			client as any,
			eventBus as any,
			'guild-1',
			'room-1',
			null,
			db as any
		);
		sub.start();
		sub.registerUser('discord-cached', 'supabase-abc', mockInteraction as any);

		const result = await sub.lookupDiscordId('supabase-abc');
		expect(result).to.equal('discord-cached');
		// Database should NOT have been queried since it's in the cache
		expect(db.select.called).to.be.false;
	});

	it('lookupDiscordId falls back to db when not in cache', async () => {
		const client = makeDiscordClient();
		const eventBus = makeEventBus();
		const db = makeDbStub('discord-from-db');

		const sub = new GuildRoomSubscription(
			client as any,
			eventBus as any,
			'guild-1',
			'room-1',
			null,
			db as any
		);

		const result = await sub.lookupDiscordId('supabase-unknown');
		expect(result).to.equal('discord-from-db');
		expect(db.select.calledOnce).to.be.true;
	});

	it('dispose tears down the adapter', () => {
		const client = makeDiscordClient();
		const eventBus = makeEventBus();
		const db = makeDbStub();

		const sub = new GuildRoomSubscription(
			client as any,
			eventBus as any,
			'guild-1',
			'room-1',
			null,
			db as any
		);
		sub.start();
		sub.dispose();

		expect(eventBus.unsubscribe.calledOnce).to.be.true;
	});

	it('registerUserFromMessage registers user mapping without an interaction', async () => {
		const client = makeDiscordClient();
		const eventBus = makeEventBus();
		const db = makeDbStub();

		const sub = new GuildRoomSubscription(
			client as any,
			eventBus as any,
			'guild-1',
			'room-1',
			null,
			db as any
		);
		sub.start();

		sub.registerUserFromMessage('discord-42', 'supabase-abc');

		// The Supabase→Discord mapping should be cached
		const discordId = await sub.lookupDiscordId('supabase-abc');
		expect(discordId).to.equal('discord-42');
		// DB should not have been queried
		expect(db.select.called).to.be.false;
	});

	it('buildPrivateChannel falls back to DM prompt when no interaction is available', async () => {
		const dmSend = sinon.stub().callsFake(async () => {
			// Return a message that immediately resolves the button collector with 'option-b'
			const collector = {
				on: sinon.stub().callsFake((event: string, fn: (...args: unknown[]) => void) => {
					if (event === 'collect') {
						setImmediate(() => {
							fn({
								customId: 'option-b',
								user: { id: 'discord-42' },
								update: sinon.stub().resolves(),
							});
						});
					} else if (event === 'end') {
						setImmediate(() => fn({ size: 1 }));
					}
				}),
			};
			return { createMessageComponentCollector: sinon.stub().returns(collector) };
		});

		const dmChannel = { send: dmSend };
		const user = { createDM: sinon.stub().resolves(dmChannel) };
		const client = makeDiscordClient();
		client.users.fetch = sinon.stub().resolves(user) as any;

		const eventBus = makeEventBus();
		const db = makeDbStub();

		const sub = new GuildRoomSubscription(
			client as any,
			eventBus as any,
			'guild-1',
			'room-1',
			null,
			db as any
		);
		sub.start();

		// Build a private channel with no interaction — triggers the DM fallback
		const channel = sub.buildPrivateChannel('discord-42');
		const answer = await channel({ announce: undefined as any, question: 'Pick one:', choices: ['option-a', 'option-b'] as any });

		expect(answer).to.equal('option-b');
		expect(dmSend.calledOnce).to.be.true;
	});
});
