import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ComponentType,
	type ButtonInteraction,
	type ChatInputCommandInteraction,
	type Client,
	type DMChannel,
	type Message,
	type MessageComponentInteraction,
	type TextChannel,
} from 'discord.js';
import { PromptCancelledError } from '@deck-monsters/engine';

const PROMPT_TIMEOUT_MS = 120_000; // 2 minutes — matches engine default

/**
 * Sends an ephemeral follow-up with Discord buttons for each choice,
 * then waits for the user to click one. Resolves with the chosen value.
 *
 * The caller must have already called `interaction.deferReply({ ephemeral: true })`
 * before invoking this method so follow-ups are available.
 */
export class PromptHandler {
	async sendPrompt(
		interaction: ChatInputCommandInteraction | ButtonInteraction,
		question: string,
		choices: string[],
		timeoutMs = PROMPT_TIMEOUT_MS,
		onTimeout?: () => void
	): Promise<string> {
		const row = buildButtonRow(choices);

		const reply = await interaction.followUp({
			content: question,
			components: [row],
			ephemeral: true,
		});

		return collectButtonResponse(reply, interaction.user.id, choices, timeoutMs, onTimeout);
	}

	/**
	 * Sends a button prompt via DM when no interaction is available (e.g. when
	 * the command was issued as a free-text message rather than a slash command).
	 */
	async sendDmPrompt(
		client: Client,
		discordUserId: string,
		question: string,
		choices: string[],
		timeoutMs = PROMPT_TIMEOUT_MS,
		onTimeout?: () => void
	): Promise<string> {
		const user = await client.users.fetch(discordUserId);
		const dm = await user.createDM();
		const row = buildButtonRow(choices);
		const reply = await dm.send({ content: question, components: [row] });
		return collectButtonResponse(reply, discordUserId, choices, timeoutMs, onTimeout);
	}

	/**
	 * Asks a free-text question over DM and collects the user's next message.
	 * Used when the engine calls `channel({ question })` without choices
	 * (spawn name/color, character creation, etc.).
	 */
	async sendFreeTextDmPrompt(
		client: Client,
		discordUserId: string,
		question: string,
		timeoutMs = PROMPT_TIMEOUT_MS,
		onTimeout?: () => void
	): Promise<string> {
		const user = await client.users.fetch(discordUserId);
		const dm = await user.createDM();
		await dm.send({ content: question });
		return collectTextResponse(dm, discordUserId, timeoutMs, onTimeout);
	}
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildButtonRow(choices: string[]): ActionRowBuilder<ButtonBuilder> {
	// Discord allows max 5 buttons per row; if there are more choices we
	// truncate to 5 to avoid an API error. The engine currently never asks
	// more than 5 at a time, but this guard prevents a crash if it ever does.
	const capped = choices.slice(0, 5);

	const buttons = capped.map((choice) =>
		new ButtonBuilder()
			.setCustomId(choice)
			.setLabel(choice)
			.setStyle(ButtonStyle.Primary)
	);

	return new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons);
}

async function collectButtonResponse(
	reply: Message,
	userId: string,
	choices: string[],
	timeoutMs: number,
	onTimeout?: () => void
): Promise<string> {
	const collector = reply.createMessageComponentCollector({
		componentType: ComponentType.Button,
		filter: (i: MessageComponentInteraction) => i.user.id === userId,
		max: 1,
		time: timeoutMs,
	});

	return new Promise<string>((resolve, reject) => {
		let settled = false;

		collector.on('collect', async (btnInteraction: ButtonInteraction) => {
			// Acknowledge the button click and disable all buttons
			const disabledRow = buildDisabledRow(choices, btnInteraction.customId);
			await btnInteraction.update({ components: [disabledRow] });
			settled = true;
			resolve(btnInteraction.customId);
		});

		collector.on('end', (collected) => {
			if (settled || collected.size > 0) return;
			onTimeout?.();
			reject(new Error('Prompt timed out — no response within the allowed time.'));
		});
	});
}

/**
 * Collects the next DM text message from the expected Discord user only.
 * Unrelated users / other channels are filtered out. Cleans up on answer,
 * timeout, or explicit collector stop (cancel).
 */
async function collectTextResponse(
	channel: DMChannel | TextChannel,
	userId: string,
	timeoutMs: number,
	onTimeout?: () => void
): Promise<string> {
	const channelId = channel.id;
	const collector = channel.createMessageCollector({
		filter: (message) => message.author.id === userId && message.channelId === channelId,
		max: 1,
		time: timeoutMs,
	});

	return new Promise<string>((resolve, reject) => {
		let settled = false;

		const settle = (fn: () => void) => {
			if (settled) return;
			settled = true;
			fn();
		};

		collector.on('collect', (message) => {
			settle(() => {
				collector.stop('answered');
				resolve(message.content);
			});
		});

		collector.on('end', (collected, reason) => {
			if (settled) return;
			settle(() => {
				if (reason === 'cancelled' || reason === 'cancel') {
					reject(new PromptCancelledError());
					return;
				}
				onTimeout?.();
				reject(new Error('Prompt timed out — no response within the allowed time.'));
			});
		});
	});
}

function buildDisabledRow(
	choices: string[],
	selectedChoice: string
): ActionRowBuilder<ButtonBuilder> {
	const capped = choices.slice(0, 5);

	const buttons = capped.map((choice) =>
		new ButtonBuilder()
			.setCustomId(choice)
			.setLabel(choice)
			.setStyle(choice === selectedChoice ? ButtonStyle.Success : ButtonStyle.Secondary)
			.setDisabled(true)
	);

	return new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons);
}
