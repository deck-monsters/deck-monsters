import { expect } from 'chai';
import sinon from 'sinon';
import { GuildRoomSubscription } from '../guild-room-subscription.js';

// ---------------------------------------------------------------------------
// Stubs
// ---------------------------------------------------------------------------

function makeEventBus() {
	let subscriberDeliver: ((event: unknown) => void) | null = null;

	return {
		subscribe: sinon.stub().callsFake((_id: string, sub: { deliver: (e: unknown) => void }) => {
			subscriberDeliver = sub.deliver;
			return () => {};
		}),
		unsubscribe: sinon.stub(),
		respondToPrompt: sinon.stub(),
		_deliver(event: unknown) {
			subscriberDeliver?.(event);
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

		// Simulate a public event arriving via ConnectorAdapter
		// We test the public channel callback directly
		const publicChannel = (sub as any).buildPublicChannel();
		await publicChannel({ announce: 'Round 1 begins!' });

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
});
