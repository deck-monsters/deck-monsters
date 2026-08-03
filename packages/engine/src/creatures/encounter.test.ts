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

	it('materializes encounter modifiers via setter outside combat', () => {
		const monster = makeBasilisk();

		monster.encounterModifiers = { ac: 2 };

		expect(monster.encounter).to.not.equal(undefined);
		expect(monster.encounterModifiers.ac).to.equal(2);
	});

	it('merges sequential property writes through a held empty view', () => {
		const monster = makeBasilisk();
		const view = monster.encounterModifiers;

		view.ac = 2;
		view.dexModifier = 3;

		expect(monster.encounterModifiers).to.deep.equal({ ac: 2, dexModifier: 3 });
	});

	it('merges Object.assign into a held empty view without dropping keys', () => {
		const monster = makeBasilisk();
		const view = monster.encounterModifiers;

		Object.assign(view, { ac: 2, str: 1 });

		expect(monster.encounterModifiers).to.deep.equal({ ac: 2, str: 1 });
	});

	it('forwards reads on a held view after materializing via proxy write', () => {
		const monster = makeBasilisk();
		const view = monster.encounterModifiers;

		view.healModifier = 4;

		expect(view.healModifier).to.equal(4);
		expect(monster.encounterModifiers.healModifier).to.equal(4);
	});
});
