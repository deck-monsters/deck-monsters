import { expect } from 'chai';
import sinon from 'sinon';

import { listen, loadHandlers } from './index.js';

/**
 * Teams were joinable but never leavable (the Sorting Hat only offered other houses). The
 * owner asked for leaving to be possible and obvious (docs/roadmap/31).
 */
describe('commands/character: leave team', () => {
	before(() => {
		loadHandlers();
	});

	const run = async (command: string, character: any) => {
		const game = { getCharacter: sinon.stub().resolves(character), log: sinon.stub() };
		const channel = sinon.stub().resolves(undefined);
		const action = listen({ command, game });
		expect(action, command).to.not.equal(null);
		await action!({ channel, channelName: 'dm', isDM: true, isAdmin: false, user: { id: 'u1', name: 'Tester' }, game } as any)
			.catch(() => undefined);
		return channel.firstCall?.args[0]?.announce as string;
	};

	it('takes the character and every monster off their teams', async () => {
		const monsters = [{ team: 'Gryffindor' }, { team: undefined }, { team: 'Slytherin' }];
		const character = { team: 'Gryffindor', monsters };

		const said = await run('leave team', character);

		expect(character.team).to.equal(undefined);
		expect(monsters.map(m => m.team)).to.deep.equal([undefined, undefined, undefined]);
		expect(said).to.include('have left Gryffindor and Slytherin');
	});

	it('accepts the other obvious phrasings', async () => {
		for (const command of ['leave my team', 'clear team', 'clear my team', 'quit team']) {
			const character = { team: 'Ravenclaw', monsters: [] };
			await run(command, character);
			expect(character.team, command).to.equal(undefined);
		}
	});

	it('says so when nobody is on a team, and points at the Sorting Hat', async () => {
		const said = await run('leave team', { team: undefined, monsters: [{}] });
		expect(said).to.include('not on a team');
		expect(said).to.include('Sorting Hat');
	});

	it('waits for a fight to finish rather than switching sides mid-fight', async () => {
		const monsters = [{ team: 'Gryffindor', inEncounter: true }];
		const character = { team: 'Gryffindor', monsters };

		const said = await run('leave team', character);

		expect(said).to.include('fighting right now');
		expect(character.team).to.equal('Gryffindor');
	});
});
