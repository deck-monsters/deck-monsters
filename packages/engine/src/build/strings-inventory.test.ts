import { expect } from 'chai';
import { readFileSync } from 'fs';
import { dirname, resolve } from 'path';
import { fileURLToPath } from 'url';

import {
	collectStringsInventories,
	renderStringsInventory,
	signatureCardsFor,
} from './strings-inventory.js';
import Unicorn from '../monsters/unicorn.js';
import { UNICORN } from '../constants/creature-types.js';

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../../..');

describe('build/strings-inventory', () => {
	const inventories = collectStringsInventories();

	// The hand-written inventories went stale the moment the Unicorn's voice changed; this is
	// the guard that replaced them.
	it('matches every checked-in inventory (run pnpm run build:docs if this fails)', () => {
		for (const [path, content] of Object.entries(inventories)) {
			const onDisk = readFileSync(resolve(REPO_ROOT, `${path}.md`), 'utf8');
			expect(onDisk, path).to.equal(content);
		}
	});

	it('is deterministic', () => {
		expect(renderStringsInventory(Unicorn)).to.equal(renderStringsInventory(Unicorn));
	});

	it('lists each signature card with its narration rendered as placeholders', () => {
		const unicorn = inventories['docs/reference/strings/unicorn'];
		for (const Card of signatureCardsFor(UNICORN)) {
			expect(unicorn).to.include(`## ${(Card as any).cardType}`);
		}
		expect(unicorn).to.include('`{target}\'s horn is still 🦄 stuck fast in the stocke, ne thence releast.`');
		expect(unicorn).to.include('{he} {is/are} made the conquest of {his} own fury.');
		expect(unicorn).not.to.include('${');
	});

	it('renders ternaries as their branches, never as source', () => {
		for (const [path, content] of Object.entries(inventories)) {
			expect(content, path).not.to.match(/ \? ['"`]/);
		}
		expect(inventories['docs/reference/strings/weeping-angel']).to.include('Time shift {succeeded! / failed.}');
	});

	it('finds lines in other files that name a card', () => {
		expect(inventories['docs/reference/strings/unicorn']).to.include(
			'`packages/engine/src/cards/immobilize.ts` immobilize → narration'
		);
	});
});
