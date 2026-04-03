import {
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	ComponentType,
	type ButtonInteraction,
	type ChatInputCommandInteraction,
	type Client,
	type Message,
	type MessageComponentInteraction,
} from 'discord.js';

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
		timeoutMs = PROMPT_TIMEOUT_MS
	): Promise<string> {
		const row = buildButtonRow(choices);

		const reply = await interaction.followUp({
			content: question,
			components: [row],
			ephemeral: true,
		});

		return collectButtonResponse(reply, interaction.user.id, choices, timeoutMs);
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
		timeoutMs = PROMPT_TIMEOUT_MS
	): Promise<string> {
		const user = await client.users.fetch(discordUserId);
		const dm = await user.createDM();
		const row = buildButtonRow(choices);
		const reply = await dm.send({ content: question, components: [row] });
		return collectButtonResponse(reply, discordUserId, choices, timeoutMs);
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
	timeoutMs: number
): Promise<string> {
	const collector = reply.createMessageComponentCollector({
		componentType: ComponentType.Button,
		filter: (i: MessageComponentInteraction) => i.user.id === userId,
		max: 1,
		time: timeoutMs,
	});

	return new Promise<string>((resolve, reject) => {
		collector.on('collect', async (btnInteraction: ButtonInteraction) => {
			// Acknowledge the button click and disable all buttons
			const disabledRow = buildDisabledRow(choices, btnInteraction.customId);
			await btnInteraction.update({ components: [disabledRow] });
			resolve(btnInteraction.customId);
		});

		collector.on('end', (collected) => {
			if (collected.size === 0) {
				reject(new Error('Prompt timed out — no response within the allowed time.'));
			}
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
