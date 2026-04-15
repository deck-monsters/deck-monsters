import { expect } from 'chai';
import sinon from 'sinon';

import { listen, loadHandlers } from './index.js';

const USER = { id: 'u1', name: 'Tester' };

describe('commands/card-management', () => {
	before(() => {
		loadHandlers();
	});

	afterEach(() => {
		sinon.restore();
	});

	function makeActionOptions(game: any) {
		return {
			channel: sinon.stub().resolves(undefined),
			channelName: 'dm',
			isDM: true,
			isAdmin: false,
			user: USER,
			game,
		};
	}

	function makeCharacter(overrides: Record<string, unknown> = {}) {
		return {
			equipMonster: sinon.stub().resolves(undefined),
			unequipCard: sinon.stub().resolves(undefined),
			unequipAll: sinon.stub().resolves(undefined),
			moveCard: sinon.stub().resolves(undefined),
			savePreset: sinon.stub().resolves(undefined),
			loadPreset: sinon.stub().resolves(undefined),
			deletePreset: sinon.stub().resolves(undefined),
			getPresets: sinon.stub().returns({ aggro: ['hit'] }),
			lookAtInventory: sinon.stub().resolves(undefined),
			lookAtCardInventory: sinon.stub().resolves(undefined),
			...overrides,
		};
	}

	it('routes unequip command with optional count', async () => {
		const character = makeCharacter();
		const game = {
			getCharacter: sinon.stub().resolves(character),
			log: sinon.stub(),
		};
		const action = listen({ command: 'unequip 2 Hit from Stonefang', game });
		expect(action).to.not.equal(null);

		await action!(makeActionOptions(game));

		expect(character.unequipCard.calledOnce).to.equal(true);
		expect(character.unequipCard.firstCall.args[0]).to.include({
			cardName: 'hit',
			count: 2,
			monsterName: 'stonefang',
		});
	});

	it('routes move command with source and destination monsters', async () => {
		const character = makeCharacter();
		const game = {
			getCharacter: sinon.stub().resolves(character),
			log: sinon.stub(),
		};
		const action = listen({ command: 'move Hit from Stonefang to Mirebell', game });
		expect(action).to.not.equal(null);

		await action!(makeActionOptions(game));

		expect(character.moveCard.calledOnce).to.equal(true);
		expect(character.moveCard.firstCall.args[0]).to.include({
			cardName: 'hit',
			fromMonsterName: 'stonefang',
			toMonsterName: 'mirebell',
		});
	});

	it('routes look at inventory commands', async () => {
		const character = makeCharacter();
		const game = {
			getCharacter: sinon.stub().resolves(character),
			log: sinon.stub(),
			lookAt: sinon.stub().resolves(undefined),
		};

		const inventoryAction = listen({ command: 'look at inventory', game });
		const cardsAction = listen({ command: 'look at all cards', game });
		expect(inventoryAction).to.not.equal(null);
		expect(cardsAction).to.not.equal(null);

		await inventoryAction!(makeActionOptions(game));
		await cardsAction!(makeActionOptions(game));

		expect(character.lookAtInventory.calledOnce).to.equal(true);
		expect(character.lookAtCardInventory.calledOnce).to.equal(true);
	});

	it('routes preset commands', async () => {
		const privateChannel = sinon.stub().resolves(undefined);
		const character = makeCharacter({
			getPresets: sinon.stub().returns({ aggro: ['hit'] }),
		});
		const game = {
			getCharacter: sinon.stub().resolves(character),
			log: sinon.stub(),
		};

		const saveAction = listen({ command: 'save preset aggro for Stonefang', game });
		const loadAction = listen({ command: 'load preset aggro on Stonefang', game });
		const deleteAction = listen({ command: 'delete preset aggro for Stonefang', game });
		const listAction = listen({ command: 'look at presets for Stonefang', game });

		await saveAction!({ ...makeActionOptions(game), channel: privateChannel });
		await loadAction!({ ...makeActionOptions(game), channel: privateChannel });
		await deleteAction!({ ...makeActionOptions(game), channel: privateChannel });
		await listAction!({ ...makeActionOptions(game), channel: privateChannel });

		expect(character.savePreset.calledOnce).to.equal(true);
		expect(character.loadPreset.calledOnce).to.equal(true);
		expect(character.deletePreset.calledOnce).to.equal(true);
		expect(character.getPresets.calledOnceWith('stonefang')).to.equal(true);
		expect(privateChannel.called).to.equal(true);
	});
});
