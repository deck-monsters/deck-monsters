import { expect } from 'chai';
import { helpersReady } from './random.js';
import { hydrateCharacter } from './hydrate.js';

describe('hydrateCharacter resilience', () => {
	before(async () => {
		await helpersReady;
	});

	it('succeeds with a valid Beastmaster characterObj', () => {
		const characterObj = {
			name: 'Beastmaster',
			options: { deck: [], items: [], monsters: [] },
		};
		const character = hydrateCharacter(characterObj);
		expect(character).to.exist;
	});

	it('falls back to Beastmaster for unknown character types instead of throwing', () => {
		const characterObj = {
			name: 'DeprecatedCharacterType',
			options: { deck: [], items: [], monsters: [] },
		};
		const warnings: string[] = [];
		// Should not throw
		const character = hydrateCharacter(characterObj, (msg) => warnings.push(msg));
		expect(character).to.exist;
		expect(warnings).to.have.length.greaterThan(0);
		expect(warnings[0]).to.include('Unknown character type');
	});

	it('filters null monsters from the hydrated monster array', () => {
		const characterObj = {
			name: 'Beastmaster',
			options: {
				deck: [],
				items: [],
				monsters: [
					// Invalid monster — will throw during hydrateMonster and be filtered
					{ name: '__invalid_monster__', options: { name: 'X', creatureType: 'Unknown' } },
				],
			},
		};
		// Should not throw; the bad monster is skipped
		const character = hydrateCharacter(characterObj) as any;
		expect(character.options?.monsters ?? []).to.satisfy(
			(arr: unknown[]) => arr.every(m => m !== null && m !== undefined)
		);
	});
});
