import { EmbedBuilder } from 'discord.js';

interface CardPayload {
	cardName?: string;
	cardType?: string;
	attackerName?: string;
	defenderName?: string;
	damage?: number;
	effect?: string;
	hit?: boolean;
	[key: string]: unknown;
}

/**
 * Builds a Discord embed for card.played events.
 * Shows the card name, attacker, defender, damage dealt, and any effect.
 */
export function buildCardDisplayEmbed(payload: CardPayload): EmbedBuilder {
	const title = payload.cardName
		? `⚔️ ${payload.cardName}`
		: '⚔️ Card Played';

	const embed = new EmbedBuilder()
		.setTitle(title)
		.setTimestamp()
		.setColor(payload.hit ? 0xed4245 : 0x99aab5); // red on hit, grey on miss

	const lines: string[] = [];

	if (payload.cardType) {
		lines.push(`**Type**: ${payload.cardType}`);
	}

	if (payload.attackerName) {
		lines.push(`**Attacker**: ${payload.attackerName}`);
	}

	if (payload.defenderName) {
		lines.push(`**Defender**: ${payload.defenderName}`);
	}

	if (payload.hit !== undefined) {
		lines.push(payload.hit ? '**Hit!**' : '*Miss!*');
	}

	if (payload.damage !== undefined && payload.damage > 0) {
		lines.push(`**Damage**: ${payload.damage}`);
	}

	if (payload.effect) {
		lines.push(`**Effect**: ${payload.effect}`);
	}

	if (lines.length > 0) {
		embed.setDescription(lines.join('\n'));
	}

	return embed;
}
