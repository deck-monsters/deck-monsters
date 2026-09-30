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

	describe('parsing', () => {
		const parse = (command: string) => {
			const m = command.match(regex);
			return m && [(m[1] || '').trim().toLowerCase(), (m[2] || '').trim().toLowerCase()];
		};

		it('reads a bare name as no type, so the default game.lookAt runs', () => {
			expect(parse('look at Fluffy')).to.deep.equal(['', 'fluffy']);
			expect(parse('look at Hit')).to.deep.equal(['', 'hit']);
			expect(parse('look at Healing Potion')).to.deep.equal(['', 'healing potion']);
			// A type word still needs its own space: this is a name, not type "monster".
			expect(parse('look at monstrous')).to.deep.equal(['', 'monstrous']);
		});

		it('keeps the typed forms parsing as before', () => {
			expect(parse('look at monsters')).to.deep.equal(['monsters', '']);
			expect(parse('look at monsters in detail')).to.deep.equal(['monsters in', 'detail']);
			expect(parse('look at the ring')).to.deep.equal(['ring', '']);
			expect(parse('look at card Heal')).to.deep.equal(['card', 'heal']);
			expect(parse('look at monster rankings')).to.deep.equal(['monster', 'rankings']);
			expect(parse('look at player handbook')).to.deep.equal(['player handbook', '']);
		});

		it('sends a bare name to game.lookAt', async () => {
			const game = { lookAt: sinon.stub().resolves(), log: sinon.stub() };
			await action({ channel: sinon.stub(), character: {}, game, results: 'look at fluffy'.match(regex), user: { id: 'u1' } });
			expect(game.lookAt).to.have.been.calledOnceWith(sinon.match.any, 'fluffy');
		});
	});
});
