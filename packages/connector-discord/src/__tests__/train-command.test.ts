import { expect } from 'chai';

import { spawn, train } from '../slash-commands/spawn.js';

describe('/train slash command', () => {
	it('registers train as the canonical command and keeps spawn as its alias', async () => {
		const { loadCommands } = await import('../slash-commands/index.js');
		const commands = loadCommands();

		expect(train.data.name).to.equal('train');
		expect(spawn.data.name).to.equal('spawn');
		expect(spawn.data.description).to.include('(alias of /train)');
		expect(commands.has('train')).to.equal(true);
		expect(commands.has('spawn')).to.equal(true);
	});
});
