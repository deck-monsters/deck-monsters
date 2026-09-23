import { expect } from 'chai';

import { edit, editSelf } from './edit.js';
import Basilisk from '../monsters/basilisk.js';
import { CommandRefusalError } from '../helpers/command-refusal-error.js';

// Both `edit` and `editSelf` ask the connector to pick a field/attribute from a small,
// fixed menu, then resolve the answer against that menu — the exact shape
// docs/reference/prompt-answer-contract.md describes. A sequenced channel stub returns canned
// answers to each successive prompt; every call (announce or question) consumes one slot.
const makeSequencedChannel = (answers: unknown[]) => {
	const channel = async (_message: any = {}) => answers.shift();
	return channel;
};

describe('creatures/edit', () => {
	let monsters: Basilisk[] = [];

	afterEach(() => {
		for (const monster of monsters) {
			monster.disposeTimers();
		}
		monsters = [];
	});

	function makeMonster(options: Record<string, unknown> = {}): Basilisk {
		// The underlying option key for the display name is `name`, not `givenName` —
		// `givenName` is a derived getter (creatures/base.ts) that reads `options.name`.
		const monster = new Basilisk({ name: 'Original', icon: '🦎', ...options });
		monsters.push(monster);
		return monster;
	}

	describe('editSelf', () => {
		it('resolves a numeric index answer, the shape the web client sends', async () => {
			const monster = makeMonster();
			const channel = makeSequencedChannel(['0', 'Renamed', 'yes']);

			await editSelf(monster, channel as any);

			expect(monster.givenName).to.equal('Renamed');
		});

		it('resolves a label answer, the shape the Discord connector sends', async () => {
			const monster = makeMonster();
			const channel = makeSequencedChannel(['Icon/color (currently: 🦎)', '🔥', 'yes']);

			await editSelf(monster, channel as any);

			expect(monster.icon).to.equal('🔥');
		});

		it('rejects an unrecognised field answer instead of defaulting to icon', async () => {
			const monster = makeMonster();
			const channel = makeSequencedChannel(['Not A Field']);

			let error: unknown;
			try {
				await editSelf(monster, channel as any);
			} catch (caught) {
				error = caught;
			}

			expect(error).to.be.instanceOf(CommandRefusalError);
			expect((error as Error).message).to.include('Not A Field');
			expect(monster.givenName).to.equal('Original');
			expect(monster.icon).to.equal('🦎');
		});
	});

	describe('edit', () => {
		// `edit()` calls `creature.look(channel)` first (an announce), which consumes one
		// slot of the sequenced channel before the "which attribute" question is asked.
		it('resolves a numeric index answer against the offered attribute choices', async () => {
			const monster = makeMonster();
			const optionKeys = Object.keys(monster.options);
			const targetIndex = optionKeys.indexOf('name');
			expect(targetIndex).to.be.greaterThan(-1);

			const channel = makeSequencedChannel(['(look announce)', String(targetIndex), 'Renamed', 'yes']);

			await edit(monster, channel as any);

			expect(monster.givenName).to.equal('Renamed');
		});

		it('resolves a label answer against the offered attribute choices', async () => {
			const monster = makeMonster();
			const optionKeys = Object.keys(monster.options);
			const targetKey = 'name';
			const label = `${targetKey} (${JSON.stringify(monster.options[targetKey])})`;

			expect(optionKeys).to.include(targetKey);

			const channel = makeSequencedChannel(['(look announce)', label, 'Renamed', 'yes']);

			await edit(monster, channel as any);

			expect(monster.givenName).to.equal('Renamed');
		});

		it('rejects an unrecognised attribute answer instead of editing the wrong field', async () => {
			const monster = makeMonster();
			const channel = makeSequencedChannel(['(look announce)', 'Not An Attribute']);

			let error: unknown;
			try {
				await edit(monster, channel as any);
			} catch (caught) {
				error = caught;
			}

			expect(error).to.be.instanceOf(CommandRefusalError);
			expect((error as Error).message).to.include('Not An Attribute');
			expect(monster.givenName).to.equal('Original');
		});
	});
});
