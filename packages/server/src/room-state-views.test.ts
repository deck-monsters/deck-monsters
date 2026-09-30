import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { allCards, getLevel } from '@deck-monsters/engine';
import { expect } from 'chai';

// Roadmap 37 task 7, the part that needs no database: the query-view migration must stay in step
// with the engine. A card added to the registry without a card_types row would show up in
// room_state_monster_cards with its raw class name instead of its display name (or, worse,
// break a `card_type = '...'` filter silently), so this fails the build instead.
const VIEWS_MIGRATION = path.resolve(
	path.dirname(fileURLToPath(import.meta.url)),
	'../../../supabase/migrations/20260930120000_room_state_query_views.sql'
);

const sql = readFileSync(VIEWS_MIGRATION, 'utf8');

function seededCardTypes(): Map<string, string> {
	const block = sql.match(/insert into public\.card_types[\s\S]*?on conflict/i)?.[0] ?? '';
	const rows = [...block.matchAll(/\('((?:[^']|'')+)',\s*'((?:[^']|'')+)'\)/g)];
	return new Map(rows.map((m) => [m[1]!.replace(/''/g, "'"), m[2]!.replace(/''/g, "'")]));
}

function migrationThresholds(): number[] {
	const body = sql.match(/unnest\(array\[([\s\S]*?)\]::bigint\[\]\)/)?.[1] ?? '';
	return body.split(',').map((s) => Number(s.trim()));
}

describe('room-state query views migration', () => {
	it('seeds card_types with every card class the engine registers', () => {
		const seeded = seededCardTypes();
		const missing = allCards.map((C) => C.name).filter((name) => !seeded.has(name));
		expect(
			missing,
			`add these to card_types in a new migration (see docs/architecture/rooms-and-identity.md, "Querying room state"): ${missing.join(', ')}`
		).to.deep.equal([]);
	});

	it('seeds the display name each card class declares, and nothing the engine lacks', () => {
		const seeded = seededCardTypes();
		const classes = new Map(allCards.map((C) => [C.name, C]));
		const wrong: string[] = [];
		const stale: string[] = [];
		for (const [className, cardType] of seeded) {
			const C = classes.get(className);
			if (!C) stale.push(className);
			else if ((C.cardType ?? C.name) !== cardType) wrong.push(`${className}: seeded "${cardType}", engine "${C.cardType}"`);
		}
		expect(wrong).to.deep.equal([]);
		expect(stale).to.deep.equal([]);
	});

	it('uses XP thresholds that match the engine level curve exactly', () => {
		const thresholds = migrationThresholds();
		expect(thresholds).to.have.length(40);
		thresholds.forEach((t, i) => {
			expect(getLevel(t), `xp ${t}`).to.equal(i + 1);
			expect(getLevel(t - 1), `xp ${t - 1}`).to.equal(i);
		});
		// The next level past the list must be unreachable in practice (cap is documented).
		expect(thresholds[39]).to.be.greaterThan(8e9);
	});
});
