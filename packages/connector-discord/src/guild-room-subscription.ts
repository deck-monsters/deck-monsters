import {
	type Client,
	type ChatInputCommandInteraction,
	type ButtonInteraction,
	type TextChannel,
	type DMChannel,
	ChannelType,
} from 'discord.js';
import { ConnectorAdapter } from '@deck-monsters/engine';
import type { RoomEventBus, ChannelCallback } from '@deck-monsters/engine';
import { eq, and } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from '@deck-monsters/server/db/schema';
import { userConnectors } from '@deck-monsters/server/db/schema';
import { buildMonsterCardEmbed } from './embeds/monster-card.js';
import { buildCardDisplayEmbed } from './embeds/card-display.js';
import { PromptHandler } from './prompt-handler.js';

type Db = NodePgDatabase<typeof schema>;

// Event types that should render a rich embed in the public channel
const EMBED_EVENT_TYPES = new Set([
	'ring.add',
	'ring.win',
	'ring.loss',
	'ring.draw',
	'ring.permaDeath',
	'ring.cardDrop',
	'card.played',
]);

/**
 * GuildRoomSubscription wires a single game room to a Discord guild.
 *
 * It creates a ConnectorAdapter for the room's event bus and routes:
 *   - Public events → the guild's designated #deck-monsters channel
 *   - Private events → DM to the target Discord user
 *   - Prompt requests → ephemeral follow-up with Discord buttons
 *
 * One instance should exist per active (guild, room) pair.
 */
export class GuildRoomSubscription {
	private adapter: ConnectorAdapter | null = null;
	private promptHandler = new PromptHandler();

	// Maps Supabase userId → Discord userId (populated when users interact)
	private supabaseToDiscord = new Map<string, string>();

	// Stores the active interaction per Discord user for follow-up prompts
	private activeInteractions = new Map<string, ChatInputCommandInteraction | ButtonInteraction>();

	constructor(
		private readonly client: Client,
		private readonly eventBus: RoomEventBus,
		private readonly guildId: string,
		private readonly roomId: string,
		private readonly announcementChannelId: string | null,
		private readonly db: Db
	) {}

	/** Start listening to the event bus. Call once after construction. */
	start(): void {
		const publicChannel = this.buildPublicChannel();
		this.adapter = new ConnectorAdapter(
			this.eventBus,
			publicChannel,
			`discord-${this.guildId}-${this.roomId}`
		);
	}

	/**
	 * Register a Discord user ↔ Supabase user mapping so that private events
	 * and prompt requests can be delivered to the right Discord account.
	 * Also stores the active interaction for prompt follow-ups.
	 */
	registerUser(
		discordUserId: string,
		supabaseUserId: string,
		interaction: ChatInputCommandInteraction | ButtonInteraction
	): void {
		this.supabaseToDiscord.set(supabaseUserId, discordUserId);
		this.activeInteractions.set(discordUserId, interaction);

		const privateChannel = this.buildPrivateChannel(discordUserId);
		this.adapter?.registerUser(supabaseUserId, privateChannel);
	}

	/** Remove a user's private channel registration. */
	unregisterUser(supabaseUserId: string): void {
		const discordId = this.supabaseToDiscord.get(supabaseUserId);
		if (discordId) {
			this.activeInteractions.delete(discordId);
			this.supabaseToDiscord.delete(supabaseUserId);
		}
		this.adapter?.unregisterUser(supabaseUserId);
	}

	/** Build the private channel callback for a given Discord user. */
	buildPrivateChannel(
		discordUserId: string,
		interaction?: ChatInputCommandInteraction | ButtonInteraction
	): ChannelCallback {
		return async ({ announce, question, choices }) => {
			// Interactive prompt
			if (question && choices) {
				const choiceKeys = Array.isArray(choices)
					? choices
					: Object.keys(choices);

				const activeInteraction =
					interaction ?? this.activeInteractions.get(discordUserId);

				if (!activeInteraction) {
					throw new Error(
						`No active interaction for Discord user ${discordUserId} — cannot deliver prompt`
					);
				}

				const answer = await this.promptHandler.sendPrompt(
					activeInteraction,
					question,
					choiceKeys
				);
				return answer;
			}

			// Announcement → DM
			if (announce) {
				await this.sendDm(discordUserId, announce);
			}

			return undefined;
		};
	}

	/** Tear down the event bus subscription. */
	dispose(): void {
		this.adapter?.dispose();
		this.adapter = null;
		this.supabaseToDiscord.clear();
		this.activeInteractions.clear();
	}

	// ---------------------------------------------------------------------------
	// Private helpers
	// ---------------------------------------------------------------------------

	private buildPublicChannel(): ChannelCallback {
		return async ({ announce }) => {
			if (!announce) return;

			const channel = await this.resolveAnnouncementChannel();
			if (!channel) return;

			// Check if the text corresponds to a ring event by scanning the last
			// event from the bus. We key off the announce text since the public
			// channel callback only receives { announce }.
			// For now post plain text; embeds are handled by the subscription
			// via a separate event listener in DiscordBot for rich types.
			await channel.send({ content: announce });
		};
	}

	private async resolveAnnouncementChannel(): Promise<TextChannel | null> {
		if (!this.announcementChannelId) return null;

		try {
			const channel = await this.client.channels.fetch(this.announcementChannelId);
			if (channel?.type === ChannelType.GuildText) {
				return channel as TextChannel;
			}
		} catch {
			// channel not found or no permission — silently skip
		}

		return null;
	}

	private async sendDm(discordUserId: string, text: string): Promise<void> {
		try {
			const user = await this.client.users.fetch(discordUserId);
			const dm = await user.createDM();
			await dm.send(text);
		} catch {
			// DMs blocked or user not found — silently skip
		}
	}

	/** Look up the Discord user ID for a given Supabase user ID. */
	async lookupDiscordId(supabaseUserId: string): Promise<string | null> {
		// Fast path: already cached from a prior interaction in this session
		const cached = this.supabaseToDiscord.get(supabaseUserId);
		if (cached) return cached;

		// Slow path: query the database
		const [row] = await this.db
			.select({ externalId: userConnectors.externalId })
			.from(userConnectors)
			.where(
				and(
					eq(userConnectors.userId, supabaseUserId),
					eq(userConnectors.connectorType, 'discord')
				)
			)
			.limit(1);

		if (row) {
			this.supabaseToDiscord.set(supabaseUserId, row.externalId);
			return row.externalId;
		}

		return null;
	}
}
