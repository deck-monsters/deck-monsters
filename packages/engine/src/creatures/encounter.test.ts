import { expect } from 'chai';

import Basilisk from '../monsters/basilisk.js';

describe('creatures/encounter', () => {
	let monsters: Basilisk[] = [];

	afterEach(() => {
		for (const monster of monsters) {
			monster.disposeTimers();
		}
		monsters = [];
	});

	function makeBasilisk (options: Record<string, unknown> = {}): Basilisk {
		const monster = new Basilisk(options);
		monsters.push(monster);
		return monster;
	}

	it('does not materialize encounter state when reading encounterModifiers outside combat (#68)', () => {
		const monster = makeBasilisk();

		expect(monster.encounter).to.equal(undefined);

		const modifiers = monster.encounterModifiers;

		expect(modifiers).to.deep.equal({});
		expect(monster.encounter).to.equal(undefined);
	});

	it('materializes encounter modifiers on write after a read-only empty view', () => {
		const monster = makeBasilisk();

		monster.encounterModifiers = { ac: 2 };

		expect(monster.encounter).to.not.equal(undefined);
		expect(monster.encounterModifiers.ac).to.equal(2);
	});
});
