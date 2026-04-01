import { EmbedBuilder } from 'discord.js';

interface MonsterPayload {
	monsterName?: string;
	monsterType?: string;
	hp?: number;
	maxHp?: number;
	ac?: number;
	level?: number;
	xp?: number;
	characterName?: string;
	[key: string]: unknown;
}

/**
 * Builds a Discord embed for ring events that involve a monster
 * (ring.add, ring.win, ring.loss, ring.draw, ring.permaDeath, ring.xp, ring.cardDrop).
 *
 * The embed uses data from GameEvent.payload; falls back gracefully when
 * fields are absent.
 */
export function buildMonsterCardEmbed(payload: MonsterPayload, title: string): EmbedBuilder {
	const embed = new EmbedBuilder().setTitle(title).setTimestamp();

	const lines: string[] = [];

	if (payload.monsterName) {
		lines.push(`**Monster**: ${payload.monsterName}${payload.monsterType ? ` *(${payload.monsterType})*` : ''}`);
	}

	if (payload.characterName) {
		lines.push(`**Beastmaster**: ${payload.characterName}`);
	}

	if (payload.hp !== undefined && payload.maxHp !== undefined) {
		const bar = buildHpBar(payload.hp, payload.maxHp);
		lines.push(`**HP**: ${payload.hp}/${payload.maxHp} ${bar}`);
	}

	if (payload.ac !== undefined) {
		lines.push(`**AC**: ${payload.ac}`);
	}

	if (payload.level !== undefined) {
		lines.push(`**Level**: ${payload.level}`);
	}

	if (payload.xp !== undefined) {
		lines.push(`**XP gained**: ${payload.xp}`);
	}

	if (lines.length > 0) {
		embed.setDescription(lines.join('\n'));
	}

	// Colour by outcome
	if (title.toLowerCase().includes('win') || title.toLowerCase().includes('victory')) {
		embed.setColor(0x57f287); // green
	} else if (
		title.toLowerCase().includes('loss') ||
		title.toLowerCase().includes('defeat') ||
		title.toLowerCase().includes('perma')
	) {
		embed.setColor(0xed4245); // red
	} else if (title.toLowerCase().includes('draw') || title.toLowerCase().includes('fled')) {
		embed.setColor(0xfee75c); // yellow
	} else {
		embed.setColor(0x5865f2); // blurple (default Discord brand)
	}

	return embed;
}

function buildHpBar(hp: number, maxHp: number): string {
	const pct = Math.max(0, Math.min(1, hp / maxHp));
	const filled = Math.round(pct * 10);
	const empty = 10 - filled;
	return `[${'█'.repeat(filled)}${'░'.repeat(empty)}]`;
}
