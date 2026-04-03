import {
	Client,
	GatewayIntentBits,
	Partials,
	REST,
	Routes,
	type Interaction,
	type ChatInputCommandInteraction,
	type AutocompleteInteraction,
	type Message,
} from 'discord.js';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from '@deck-monsters/server/db/schema';
import type { RoomManager } from '@deck-monsters/server/room-manager';
import type { GuildRoomManager } from './guild-room-manager.js';
import type { GuildRoomSubscription } from './guild-room-subscription.js';
import { loadCommands, type CommandContext } from './slash-commands/index.js';
import { ensureConnectorUser } from '@deck-monsters/server/auth/connector-users';

type Db = NodePgDatabase<typeof schema>;

export class DiscordBot {
	readonly client: Client;
	private subscriptions = new Map<string, GuildRoomSubscription>();
	private commands: ReturnType<typeof loadCommands>;

	constructor(
		private readonly roomManager: RoomManager,
		private readonly guildRoomManager: GuildRoomManager,
		private readonly db: Db,
		private readonly log: (err: unknown) => void = console.error
	) {
		this.client = new Client({
			intents: [
				GatewayIntentBits.Guilds,
				GatewayIntentBits.GuildMessages,
				GatewayIntentBits.DirectMessages,
				GatewayIntentBits.MessageContent,
			],
			partials: [Partials.Channel],
		});

		this.commands = loadCommands();
		this.wireEvents();
	}

	async start(token: string, clientId: string): Promise<void> {
		await this.registerSlashCommands(token, clientId);
		await this.client.login(token);
	}

	/** Get or lazily create a GuildRoomSubscription for a (guild, room) pair. */
	async getOrCreateSubscription(guildId: string, roomId: string): Promise<GuildRoomSubscription> {
		const key = `${guildId}:${roomId}`;
		const existing = this.subscriptions.get(key);
		if (existing) return existing;

		const { GuildRoomSubscription } = await import('./guild-room-subscription.js');
		const announcementChannelId = await this.guildRoomManager.getAnnouncementChannel(guildId);
		const eventBus = await this.roomManager.getEventBus(roomId);

		const sub = new GuildRoomSubscription(
			this.client,
			eventBus,
			guildId,
			roomId,
			announcementChannelId,
			this.db
		);
		sub.start();

		this.subscriptions.set(key, sub);
		return sub;
	}

	disposeSubscription(guildId: string, roomId: string): void {
		const key = `${guildId}:${roomId}`;
		const sub = this.subscriptions.get(key);
		if (sub) {
			sub.dispose();
			this.subscriptions.delete(key);
		}
	}

	// ---------------------------------------------------------------------------
	// Event wiring
	// ---------------------------------------------------------------------------

	private wireEvents(): void {
		this.client.once('ready', () => {
			this.log(`Discord bot ready: ${this.client.user?.tag ?? 'unknown'}`);
		});

		this.client.on('interactionCreate', (interaction: Interaction) => {
			void this.handleInteraction(interaction);
		});

		this.client.on('messageCreate', (message: Message) => {
			void this.handleMessage(message);
		});
	}

	private async handleInteraction(interaction: Interaction): Promise<void> {
		if (interaction.isChatInputCommand()) {
			await this.handleSlashCommand(interaction);
		} else if (interaction.isAutocomplete()) {
			await this.handleAutocomplete(interaction);
		}
	}

	private async handleSlashCommand(interaction: ChatInputCommandInteraction): Promise<void> {
		const command = this.commands.get(interaction.commandName);
		if (!command) return;

		const ctx = this.buildContext();

		try {
			await command.execute(interaction, ctx);
		} catch (err) {
			this.log(err);
			const content = 'Something went wrong. Please try again.';
			if (interaction.deferred || interaction.replied) {
				await interaction.editReply({ content }).catch(() => {});
			} else {
				await interaction.reply({ content, ephemeral: true }).catch(() => {});
			}
		}
	}

	private async handleAutocomplete(interaction: AutocompleteInteraction): Promise<void> {
		const command = this.commands.get(interaction.commandName);
		if (!command?.autocomplete) return;

		const ctx = this.buildContext();
		try {
			await command.autocomplete(interaction, ctx);
		} catch (err) {
			this.log(err);
			await interaction.respond([]).catch(() => {});
		}
	}

	/**
	 * Handles free-text commands sent as DMs to the bot or as `dm <command>`
	 * mentions in a guild channel.
	 */
	private async handleMessage(message: Message): Promise<void> {
		if (message.author.bot) return;

		let commandText: string | null = null;
		const isDM = !message.guildId;

		if (isDM) {
			commandText = message.content.trim();
		} else {
			// Allow "dm <command>" in guild channels as a free-text fallback
			const match = message.content.match(/^dm\s+(.+)$/i);
			if (match) commandText = match[1].trim();
		}

		if (!commandText || !commandText.length) return;

		const guildId = message.guildId ?? `dm-${message.author.id}`;

		try {
			const supabaseUserId = await ensureConnectorUser(
				'discord',
				message.author.id,
				message.author.username
			);

			const roomId = await this.guildRoomManager.getOrCreateDefaultRoom(guildId, supabaseUserId);
			const game = await this.roomManager.getGame(roomId);

			const action = game.handleCommand({ command: commandText });
			if (!action) {
				await message.reply('Command not recognized. Try `/help` for a list of commands.');
				return;
			}

			const sub = await this.getOrCreateSubscription(guildId, roomId);
			sub.registerUserFromMessage(message.author.id, supabaseUserId);

			const channel = sub.buildPrivateChannel(message.author.id);

			await action({
				channel,
				channelName: message.channelId,
				isAdmin: false,
				isDM,
				user: { id: supabaseUserId, name: message.author.username },
			});
		} catch (err) {
			this.log(err);
			await message.reply('Something went wrong processing your command.').catch(() => {});
		}
	}

	// ---------------------------------------------------------------------------
	// Slash command registration
	// ---------------------------------------------------------------------------

	private async registerSlashCommands(token: string, clientId: string): Promise<void> {
		const commandData = [...this.commands.values()].map((c) => c.data.toJSON());

		const rest = new REST().setToken(token);

		await rest.put(Routes.applicationCommands(clientId), { body: commandData });

		this.log(`Registered ${commandData.length} slash commands.`);
	}

	private buildContext(): CommandContext {
		return {
			bot: this,
			roomManager: this.roomManager,
			guildRoomManager: this.guildRoomManager,
			db: this.db,
		};
	}
}
