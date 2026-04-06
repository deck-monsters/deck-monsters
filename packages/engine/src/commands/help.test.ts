import { expect } from 'chai';
import { helpersReady } from '../characters/helpers/random.js';
import { COMMAND_CATALOG, formatCommandList } from './catalog.js';
import { listen, loadHandlers } from './index.js';

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
		expect(announcements[0]).to.include('spawn monster');
	});
});
