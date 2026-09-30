import { expect } from 'chai';
import { helpersReady } from '../characters/helpers/random.js';
import { COMMAND_CATALOG, formatCommandList } from './catalog.js';
import { getArray } from '../helpers/get-array.js';
import { isCommand, listen, loadHandlers } from './index.js';

describe('COMMAND_CATALOG', () => {
	before(async () => {
		await helpersReady;
		loadHandlers();
	});

	it('has at least 20 entries', () => {
		expect(COMMAND_CATALOG.length).to.be.greaterThan(20);
	});

	it('every entry has required fields', () => {
		for (const entry of COMMAND_CATALOG) {
			expect(entry.command, 'command').to.be.a('string').and.not.equal('');
			expect(entry.description, 'description').to.be.a('string').and.not.equal('');
			expect(entry.category, 'category').to.be.a('string').and.not.equal('');
		}
	});

	it('formatCommandList returns a non-empty string with category headers', () => {
		const output = formatCommandList();
		expect(output).to.include('Deck Monsters');
		expect(output).to.include('Monsters');
		expect(output).to.include('The Ring');
	});

	it('help command is recognized by listen()', () => {
		const action = listen({ command: 'help', game: {} });
		expect(action).to.not.be.null;
	});

	it('commands command is recognized by listen()', () => {
		const action = listen({ command: 'commands', game: {} });
		expect(action).to.not.be.null;
	});

	it('help command responds with command list', async () => {
		const action = listen({ command: 'help', game: {} });
		expect(action).to.not.be.null;

		const announcements: string[] = [];
		await action!({
			channel: ({ announce }: { announce?: string }) => {
				if (announce) announcements.push(announce);
				return Promise.resolve('');
			},
			channelName: 'test',
			isDM: true,
			user: { id: 'u1', name: 'Tester' },
		});

		expect(announcements.length).to.be.greaterThan(0);
		expect(announcements[0]).to.include('train a monster');
		expect(announcements[0]).to.include('call [monster] out of the ring');
	});

	it('states that items can still be used mid-fight', async () => {
		const action = listen({ command: 'help', game: {} });
		expect(action).to.not.be.null;

		const announcements: string[] = [];
		await action!({
			channel: ({ announce }: { announce?: string }) => {
				if (announce) announcements.push(announce);
				return Promise.resolve('');
			},
			channelName: 'test',
			isDM: true,
			user: { id: 'u1', name: 'Tester' },
		});

		expect(announcements[0]).to.include('mid-fight');
		expect(announcements[0]).to.include('Targeting scrolls');

		// The caveat is the load-bearing half. `items/helpers/use.ts` restricts the usable
		// pool to `monster.items` while the monster is in an encounter, and
		// `items/helpers/transfer.ts` blocks handing anything over then — so help that
		// promises "you can use items mid-fight" without saying "only ones it already
		// carries" sends a player to try a pocket potion and be refused with no
		// explanation. That is worse than saying nothing, and an earlier draft of this
		// copy did exactly that. Assert the caveat, not just the headline.
		expect(announcements[0]).to.match(/already carrying/i);
		expect(announcements[0]).to.match(/give \[item\] to \[monster\]/i);
	});
});

describe('isCommand', () => {
	before(() => {
		loadHandlers();
	});

	it('recognises commands the dispatcher runs, and not card names', () => {
		expect(isCommand('send Pip to the ring')).to.equal(true);
		expect(isCommand('help')).to.equal(true);
		expect(isCommand('Hit')).to.equal(false);
		expect(isCommand('banana')).to.equal(false);
	});
});

describe('command reference equip example', () => {
	it('does not tell the player to type a JSON array', () => {
		for (const entry of COMMAND_CATALOG) {
			expect(entry.description).not.to.match(/JSON|\[\"/);
		}
	});

	it('uses a cards list the parser splits into one entry per card', () => {
		const entry = COMMAND_CATALOG.find((e) => e.command.startsWith('equip [monster] with'));
		const list = /^equip \S+ with (.+)$/.exec(entry?.example ?? '')?.[1];
		expect(list).to.be.a('string');
		expect(getArray(list)).to.deep.equal(['Hit', 'Hit', 'Heal']);
		// The example is a real command: the dispatcher recognises it.
		expect(listen({ command: entry?.example, game: {} })).to.not.be.null;
	});
});
