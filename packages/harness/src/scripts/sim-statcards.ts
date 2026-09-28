#!/usr/bin/env node
/**
 * What a stat card is worth per play: `node dist/scripts/sim-statcards.js`.
 *
 * Since 10b #175 a temporary DEX, STR, or INT change moves the rolls that stat feeds, so a
 * boost or curse card is an automatic swing every time it is played (roadmap 33). Each
 * cell is a mirror match: one side's four-card hand swaps a Hit for the card under test,
 * the other side keeps four Hits. The swing is that side's share of decisive fights minus
 * the same measurement with four Hits a side (the mirror's own noise). Positive means the
 * card is worth more than the Hit it replaced. AC cards are included as a reference: #175
 * did not change them.
 *
 * `SIM_STATCARD_FIGHTS` sets fights per cell (default 300).
 */
import '../sim-env.js';
import '../set-env.js';
import { engineReady } from '@deck-monsters/engine';
import { simulate, type SimMonsterType, type SimResult } from '../simulate.js';

const FIGHTS = Number(process.env.SIM_STATCARD_FIGHTS ?? 300);
const TYPES: SimMonsterType[] = ['Minotaur', 'Gladiator', 'WeepingAngel'];
const LEVELS = [1, 5, 10];
const CARDS = [
	'Adrenaline Rush',
	'Ecdysis',
	'Calisthenics',
	'Feline Companion',
	'Concussion',
	'Molasses',
	'Harden',
	'Soften',
	'Basic Shield',
	'Thick Skin',
];

function share(res: SimResult): number {
	const a = res.winRates['Sim 1'] ?? 0;
	const b = res.winRates['Sim 2'] ?? 0;
	return a + b > 0 ? (100 * a) / (a + b) : 50;
}

async function cell(type: SimMonsterType, level: number, card: string | undefined, seed: number): Promise<number> {
	const hits = ['Hit', 'Hit', 'Hit', 'Hit'];
	const res = await simulate({
		monsters: [
			{ type, level, deck: card ? [card, 'Hit', 'Hit', 'Hit'] : hits },
			{ type, level, deck: hits },
		],
		fights: FIGHTS,
		seed,
		roomId: `sim-statcards-${type}-${level}`,
	});
	return share(res);
}

async function main(): Promise<void> {
	await engineReady;
	const columns = TYPES.flatMap(type => LEVELS.map(level => ({ type, level })));
	process.stdout.write(`Stat cards, mirror matches, ${FIGHTS} fights per cell; swing in points of win share\n\n`);
	process.stdout.write(`${'card'.padEnd(18)}${columns.map(({ type, level }) => `${type.slice(0, 5)}${level}`.padStart(9)).join('')}   mean\n`);
	const base: number[] = [];
	let seed = 7001;
	for (const { type, level } of columns) base.push(await cell(type, level, undefined, (seed += 13)));
	process.stdout.write(`${'(4 Hits: share)'.padEnd(18)}${base.map(v => v.toFixed(0).padStart(9)).join('')}\n`);
	for (const card of CARDS) {
		const row: number[] = [];
		seed = 7001;
		for (let i = 0; i < columns.length; i += 1) {
			const { type, level } = columns[i]!;
			row.push((await cell(type, level, card, (seed += 13))) - base[i]!);
		}
		const mean = row.reduce((a, b) => a + b, 0) / row.length;
		process.stdout.write(`${card.padEnd(18)}${row.map(v => `${v >= 0 ? '+' : ''}${v.toFixed(0)}`.padStart(9)).join('')}${`${mean >= 0 ? '+' : ''}${mean.toFixed(1)}`.padStart(7)}\n`);
	}
	// Same forced exit as the other sim scripts (see simulation-harness.md).
	process.exit(0);
}

main().catch(err => {
	console.error(err);
	process.exit(1);
});
