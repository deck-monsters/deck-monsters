import { expect } from 'chai';
import sinon from 'sinon';

import { listen, loadHandlers } from './index.js';

/**
 * Through dispatch, not the regex alone: the single-card pattern was registered first and
 * its `.+?` took "all", so `unequip all from Brass` answered "Brass is not holding all."
 * A test of UNEQUIP_ALL_REGEX by itself passed the whole time (10b #185).
 */
describe('commands/monster: unequip dispatch', () => {
	before(() => {
		loadHandlers();
	});

	afterEach(() => sinon.restore());

	const run = async (command: string) => {
		const character = {
			unequipAll: sinon.stub().resolves(),
			unequipCard: sinon.stub().resolves(),
		};
		const game = { getCharacter: sinon.stub().resolves(character), log: sinon.stub() };
		const action = listen({ command, game });
		expect(action, command).to.not.equal(null);
		await action!({
			channel: sinon.stub().resolves(undefined),
			channelName: 'dm',
			isDM: true,
			isAdmin: false,
			user: { id: 'u1', name: 'Tester' },
			game,
		} as any);
		return character;
	};

	it('sends "unequip all from [monster]" to the unequip-all handler', async () => {
		const character = await run('unequip all from Brass');
		expect(character.unequipAll).to.have.been.calledOnce;
		expect(character.unequipAll.firstCall.args[0]).to.include({ monsterName: 'brass' });
		expect(character.unequipCard).not.to.have.been.called;
	});

	it('still sends a single card to the single-card handler', async () => {
		const character = await run('unequip 2 hit from Brass');
		expect(character.unequipCard).to.have.been.calledOnce;
		expect(character.unequipCard.firstCall.args[0]).to.include({ cardName: 'hit', monsterName: 'brass' });
		expect(character.unequipAll).not.to.have.been.called;
	});

	it('keeps "clear deck [monster]" working', async () => {
		const character = await run('clear deck Brass');
		expect(character.unequipAll).to.have.been.calledOnce;
	});
});
