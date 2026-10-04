import { expect } from 'chai';

import { Game } from '../game.js';
import allMonsters from '../monsters/helpers/all.js';
import { holdableByLevel } from '../cards/helpers/holdable.js';
import lookAtHandlers from './look-at.js';
import { COMMAND_CATALOG } from './catalog.js';

describe('look at cards for [monster]', () => {
	let regex: RegExp;
	let action: (context: any) => Promise<unknown>;

	before(() => {
		lookAtHandlers(((pattern: RegExp, handler: any) => {
			regex = pattern;
			action = handler;
		}) as any);
	});

	const monsterOf = (creatureType: string, level: number, name = 'Rex'): any => {
		const Monster = allMonsters.find(M => (M as any).creatureType === creatureType) as any;
		const monster = new Monster({ name, xp: 0 });
		// Same technique as hold-verdict.test.ts: pin the level without grinding XP.
		Object.defineProperty(monster, 'level', { get: () => level });
		return monster;
	};

	const runCommand = async (command: string, monsters: any[]) => {
		const out: string[] = [];
		const calls: string[] = [];
		const game: any = {
			getAllMonstersLookup: () => Object.fromEntries(monsters.map(m => [m.givenName.toLowerCase(), m])),
			lookAtCardsFor: (c: any, n: string) => Game.prototype.lookAtCardsFor.call(game, c, n),
			log: (e: unknown) => out.push(`LOG ${(e as Error)?.message ?? e}`),
		};
		const character: any = {
			lookAtCards: () => {
				calls.push('deck');
				return Promise.resolve();
			},
		};
		const results = command.match(regex);
		expect(results, command).to.not.equal(null);
		await action({
			channel: ({ announce }: { announce?: string }) => {
				if (announce) out.push(announce);
				return Promise.resolve('');
			},
			character,
			game,
			results,
			user: { id: 'u1' },
		});
		return { out, calls };
	};

	it('parses with `for` to the new method, and the old forms still list the deck', async () => {
		const rex = monsterOf('Gladiator', 0);
		expect((await runCommand('look at cards for Rex', [rex])).calls).to.deep.equal([]);
		expect((await runCommand('look at cards', [rex])).calls).to.deep.equal(['deck']);
		expect((await runCommand('look at deck', [rex])).calls).to.deep.equal(['deck']);
	});

	it("lists a level 0 monster's cards by role, then what opens later", async () => {
		const rex = monsterOf('Gladiator', 0);
		const { out } = await runCommand('LOOK AT CARDS FOR rex', [rex]);
		const lines = out[0].split('\n');
		expect(lines[0]).to.equal('Rex can use these cards now:');
		const levels = holdableByLevel(rex);
		const laterAt = lines.indexOf('Later:');
		expect(laterAt).to.be.greaterThan(1);
		for (const line of lines.slice(1, laterAt)) {
			expect(line).to.match(/^[A-Z][A-Za-z ]+: .+\.$/);
		}
		const nowText = lines.slice(0, laterAt).join('\n');
		for (const name of levels.filter(l => l.level === 0).flatMap(l => l.cards.map(c => c.name))) {
			expect(nowText, name).to.include(name);
		}
		const first = levels.find(l => l.level > 0)!;
		expect(lines[laterAt + 1]).to.match(new RegExp(`^Level ${first.level}: `));
		// A card that is not open yet never shows above `Later:`.
		for (const name of levels.filter(l => l.level > 0).flatMap(l => l.cards.map(c => c.name))) {
			expect(nowText.split('\n').slice(1).join('\n'), name).not.to.match(new RegExp(`(^|[ ,])${name}[,.]| ${name}\\.`));
		}
	});

	it('moves cards up from Later as the level rises, and drops Later when nothing is left', async () => {
		const low = (await runCommand('look at cards for rex', [monsterOf('Gladiator', 0)])).out[0];
		const levels = holdableByLevel('Gladiator');
		const twoLater = levels.find(l => l.level === 2);
		const mid = (await runCommand('look at cards for rex', [monsterOf('Gladiator', 2)])).out[0];
		if (twoLater) {
			expect(low).to.include('Level 2:');
			expect(mid).not.to.include('Level 2:');
		}
		const maxLevel = Math.max(...levels.map(l => l.level));
		const top = (await runCommand('look at cards for rex', [monsterOf('Gladiator', maxLevel)])).out[0];
		expect(top).not.to.include('Later:');
		expect(top.split('\n')[0]).to.equal('Rex can use these cards now:');
	});

	it('joins with "and", no Oxford comma', async () => {
		const out = (await runCommand('look at cards for rex', [monsterOf('Gladiator', 0)])).out[0];
		expect(out).to.match(/: [^.\n]*, [^.\n]* and [^.,\n]+\./);
		expect(out).not.to.match(/, and /);
	});

	it('refuses an unknown monster with the usual line', async () => {
		const { out } = await runCommand('look at cards for nobody', [monsterOf('Gladiator', 0)]);
		expect(out.join('\n')).to.include('I can find no monster by the name of nobody.');
	});

	it('is in the catalogue under cards, with its example', () => {
		const entry = COMMAND_CATALOG.find(c => c.command === 'look at cards for [monster]');
		expect(entry).to.deep.include({
			category: 'cards',
			description: 'See which cards a monster can use now, and which open up at later levels',
			example: 'look at cards for Rex',
		});
	});
});
