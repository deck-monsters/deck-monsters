import { expect } from 'chai';

import {
	DM_ONLY_MARKERS,
	collectCardsMarkdown,
	collectDmgMarkdown,
} from './root-docs.js';

describe('root-docs generation', () => {
	it('includes DM-only operational sections in DMG but not in CARDS', async () => {
		const dmg = await collectDmgMarkdown();
		const cards = await collectCardsMarkdown();

		for (const marker of DM_ONLY_MARKERS) {
			expect(dmg, `DMG should include "${marker}"`).to.include(marker);
			expect(cards, `CARDS must not include "${marker}"`).to.not.include(marker);
		}
	});

	it('keeps CARDS player-facing (description + rarity, not verbose DPT tables)', async () => {
		const cards = await collectCardsMarkdown();
		const dmg = await collectDmgMarkdown();

		expect(cards).to.include('Player Reference');
		expect(cards).to.not.match(/Hit chance: \d+% \| DPT:/);
		expect(dmg).to.match(/Hit chance: \d+% \| DPT:/);
	});

	it('is reproducible — two consecutive generations are byte-identical', async () => {
		const firstDmg = await collectDmgMarkdown();
		const secondDmg = await collectDmgMarkdown();
		const firstCards = await collectCardsMarkdown();
		const secondCards = await collectCardsMarkdown();

		expect(secondDmg).to.equal(firstDmg);
		expect(secondCards).to.equal(firstCards);
	});
});
