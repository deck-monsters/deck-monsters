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

	it('keeps enumeration consistent with reads on a view held across startEncounter', () => {
		// Regression: the empty view proxied a frozen target with no ownKeys trap, so
		// spreading or Object.keys()-ing a view captured before the encounter began
		// returned nothing while `view.ac` returned the real value. Any caller that
		// enumerated instead of reading a single prop would silently see no modifiers.
		const monster = makeBasilisk();
		const view = monster.encounterModifiers;

		monster.startEncounter({});
		monster.encounterModifiers.ac = 3;
		monster.encounterModifiers.str = -1;

		expect(view.ac, 'read through the held view').to.equal(3);
		expect(Object.keys(view).sort()).to.deep.equal(['ac', 'str']);
		expect({ ...view }).to.deep.equal({ ac: 3, str: -1 });
		expect('ac' in view).to.equal(true);
		expect('dexModifier' in view).to.equal(false);
	});

	it('reports no keys while there is still no encounter', () => {
		const monster = makeBasilisk();
		const view = monster.encounterModifiers;

		expect(Object.keys(view)).to.deep.equal([]);
		expect({ ...view }).to.deep.equal({});
		// Enumerating must not have materialized the encounter.
		expect(monster.encounter).to.equal(undefined);
	});
});
