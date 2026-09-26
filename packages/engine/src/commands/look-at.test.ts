import { expect } from 'chai';
import sinon from 'sinon';

import lookAtHandlers from './look-at.js';

describe('commands/look-at.ts', () => {
	let regex: RegExp;
	let action: (context: any) => Promise<unknown>;

	before(() => {
		lookAtHandlers(((pattern: RegExp, handler: any) => {
			regex = pattern;
			action = handler;
		}) as any);
	});

	const run = (command: string) => {
		const character = { lookAtMonsters: sinon.stub().resolves() };
		const game = { lookAtRing: sinon.stub().resolves(), log: sinon.stub() };
		const results = command.match(regex);
		expect(results, command).to.not.equal(null);
		return action({ channel: sinon.stub(), character, game, results, user: { id: 'u1' } }).then(() => ({ character, game }));
	};

	it('shows your monsters in detail for the catalogued command', async () => {
		// `monsters in` precedes `monsters` in the pattern, so this used to look for a ring
		// called "detail" and announce "The ring is empty."
		const { character, game } = await run('look at monsters in detail');

		expect(character.lookAtMonsters).to.have.been.calledOnceWith(sinon.match.any, true);
		expect(game.lookAtRing).not.to.have.been.called;
	});

	it('still looks at the monsters in the ring', async () => {
		const { character, game } = await run('look at monsters in the ring');

		expect(game.lookAtRing).to.have.been.calledOnceWith('u1', undefined, false);
		expect(character.lookAtMonsters).not.to.have.been.called;
	});

	it('still lists your monsters without detail', async () => {
		const { character } = await run('look at monsters');

		expect(character.lookAtMonsters).to.have.been.calledOnceWith(sinon.match.any, false);
	});
});
