import { expect } from 'chai';

import {
	collectAllRootArtifacts,
	collectCardsMarkdown,
	collectDmgMarkdown,
	collectInGameDmgMarkdown,
	collectMonstersMarkdown,
	DM_ONLY_MARKERS,
	FILE_ONLY_OPERATOR_MARKERS,
	generateRootDocs,
	normalizeLineEndings,
} from './root-docs.js';

describe('root-docs generation', () => {
	it('includes DM-only operational sections in root DMG but not in CARDS', async () => {
		const dmg = await collectDmgMarkdown();
		const cards = await collectCardsMarkdown();

		for (const marker of DM_ONLY_MARKERS) {
			expect(dmg, `DMG should include "${marker}"`).to.include(marker);
			expect(cards, `CARDS must not include "${marker}"`).to.not.include(marker);
		}
	});

	it('excludes file-only operator markers from in-game DMG while root DMG retains them', async () => {
		const rootDmg = await collectDmgMarkdown();
		const inGameDmg = await collectInGameDmgMarkdown();

		for (const marker of FILE_ONLY_OPERATOR_MARKERS) {
			expect(rootDmg, `root DMG should include "${marker}"`).to.include(marker);
			expect(inGameDmg, `in-game DMG must not include "${marker}"`).to.not.include(marker);
		}

		expect(inGameDmg).to.include('── Combat Math');
		expect(inGameDmg).to.include('── Stats Reference');
	});

	it('documents Basilisk/Jinn/Minotaur spawn HP/AC using engine variance semantics', async () => {
		const monsters = await collectMonstersMarkdown();
		const dmg = await collectDmgMarkdown();

		expect(monsters).to.include('HP:  30–35');
		expect(monsters).to.include('AC:  7–9');
		expect(monsters).to.include('HP:  28–33');
		expect(monsters).to.include('HP:  32–37');
		expect(monsters).to.include('AC:  4–6');
		expect(dmg).to.include('hpVariance = random(0, 5) + typeHpOffset');
		expect(dmg).to.include('acVariance = random(0, 2) + typeAcOffset');
	});

	it('keeps CARDS player-facing (description + rarity, not verbose DPT tables)', async () => {
		const cards = await collectCardsMarkdown();
		const dmg = await collectDmgMarkdown();

		expect(cards).to.include('Player Reference');
		expect(cards).to.not.match(/Hit chance: \d+% \| DPT:/);
		expect(dmg).to.match(/Hit chance: \d+% \| DPT:/);
	});

	it('uses LF line endings in all generated root artifacts', async () => {
		const artifacts = await collectAllRootArtifacts();

		for (const [name, content] of Object.entries(artifacts)) {
			expect(content, `${name} must not contain carriage returns`).to.not.include('\r');
		}
	});

	it('generateRootDocs is reproducible for every root artifact without touching disk', async () => {
		const first = await collectAllRootArtifacts();
		const second = await collectAllRootArtifacts();

		for (const key of Object.keys(first) as Array<keyof typeof first>) {
			expect(second[key], `${key} should be byte-identical`).to.equal(first[key]);
		}

		const writes: string[] = [];
		await generateRootDocs((basename, content, suffix = 'md') => {
			writes.push(`${basename}.${suffix}:${content.length}`);
		});
		expect(writes).to.deep.equal([
			'DMG.md:' + first.DMG.length,
			'CARDS.md:' + first.CARDS.length,
			'MONSTERS.md:' + first.MONSTERS.length,
			'PLAYER_HANDBOOK.md:' + first.PLAYER_HANDBOOK.length,
			'cards.html:' + first.cardsHtml.length,
		]);
	});

	it('normalizes CRLF and bare CR to LF', () => {
		expect(normalizeLineEndings('a\r\nb\rc')).to.equal('a\nb\nc');
	});
});
