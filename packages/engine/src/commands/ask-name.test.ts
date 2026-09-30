import { expect } from 'chai';
import sinon from 'sinon';

import { listen, loadHandlers } from './index.js';

// A new player is asked what to call them (roadmap 39 B5). The admin alias debugging
// feature is not: its name is the alias, not a person.
describe('commands/listen askName', () => {
	before(() => loadHandlers());

	const run = async (command: string, userName: string, isAdmin: boolean) => {
		const getCharacter = sinon.stub().resolves({});
		const game = { getCharacter, channelManager: {} };
		const action = listen({ command, game });
		await action!({
			channel: async () => undefined,
			channelName: 'c',
			isAdmin,
			user: { id: 'u1', name: userName },
		}).catch(() => undefined);
		return getCharacter;
	};

	it('asks a new player their name', async () => {
		const getCharacter = await run('look at monsters', 'sam', false);

		expect(getCharacter.firstCall.args[0]).to.include({ id: 'u1', name: 'sam', askName: true });
	});

	it('does not ask for an admin alias', async () => {
		const getCharacter = await run('look at monsters as bob', 'sam', true);

		expect(getCharacter.firstCall.args[0]).to.include({ askName: false });
	});
});
