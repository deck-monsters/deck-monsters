import { expect } from 'chai';

import { buildQuickActions } from './quick-actions.js';

const USER = 'user-1';

const makeCards = (count: number): Array<{ cardType: string }> =>
	Array.from({ length: count }, (_, i) => ({ cardType: `Card${i}` }));

const makeGame = (
	character: Record<string, unknown> | undefined,
	contestants: Array<{ userId?: string; monster?: unknown; isBoss?: boolean }> = []
) => ({
	characters: character ? { [USER]: character } : {},
	ring: { contestants },
});

describe('buildQuickActions', () => {
	it('suggests spawning when the player has no character yet', () => {
		const actions = buildQuickActions(makeGame(undefined), USER);
		expect(actions.map((a) => a.command)).to.deep.equal([
			'spawn monster',
			'look at the ring',
		]);
	});

	it('suggests spawning when the character owns no monsters', () => {
		const actions = buildQuickActions(makeGame({ monsters: [], deck: [] }), USER);
		expect(actions[0]?.command).to.equal('spawn monster');
	});

	it('does not suggest send when the monster has no cards equipped', () => {
		const monster = { givenName: 'Fluffy', cards: [] };
		const actions = buildQuickActions(makeGame({ monsters: [monster], deck: [] }), USER);
		expect(actions.map((a) => a.command)).to.not.include('send Fluffy to the ring');
	});

	it('does not suggest send when the monster has fewer cards than slots', () => {
		const monster = { givenName: 'Fluffy', cards: makeCards(3) };
		const actions = buildQuickActions(makeGame({ monsters: [monster], deck: [] }), USER);
		expect(actions.map((a) => a.command)).to.not.include('send Fluffy to the ring');
	});

	it('suggests send when the monster has a full default deck (9 cards)', () => {
		const monster = { givenName: 'Fluffy', cards: makeCards(9) };
		const actions = buildQuickActions(makeGame({ monsters: [monster], deck: [] }), USER);
		expect(actions.map((a) => a.command)).to.include('send Fluffy to the ring');
	});

	it('suggests send when cards meet a custom cardSlots count', () => {
		const monster = { givenName: 'Fluffy', cards: makeCards(2), cardSlots: 2 };
		const actions = buildQuickActions(makeGame({ monsters: [monster], deck: [] }), USER);
		expect(actions.map((a) => a.command)).to.include('send Fluffy to the ring');
	});

	it('suggests equip instead of send when idle monsters are not deck-ready but unequipped cards exist', () => {
		const monster = { givenName: 'Fluffy', cards: [] };
		const actions = buildQuickActions(
			makeGame({ monsters: [monster], deck: [{ cardType: 'Hit' }] }),
			USER
		);
		const commands = actions.map((a) => a.command);
		expect(commands).to.include('equip Fluffy');
		expect(commands).to.not.include('send Fluffy to the ring');
	});

	it('offers the ring view instead of a send for a monster already fighting', () => {
		const monster = { givenName: 'Fluffy' };
		const game = makeGame({ monsters: [monster], deck: [] }, [
			{ userId: USER, monster },
		]);
		const commands = buildQuickActions(game, USER).map((a) => a.command);
		expect(commands).to.include('look at the ring');
		expect(commands).to.not.include('send Fluffy to the ring');
	});

	it('does not suggest send for a second monster when one is already in the ring', () => {
		const inRing = { givenName: 'Fluffy', cards: makeCards(9) };
		const idle = { givenName: 'Rex', cards: makeCards(9) };
		const game = makeGame({ monsters: [inRing, idle], deck: [] }, [
			{ userId: USER, monster: inRing },
		]);
		const commands = buildQuickActions(game, USER).map((a) => a.command);
		expect(commands).to.include('look at the ring');
		expect(commands).to.not.include('send Rex to the ring');
		expect(commands).to.not.include('send Fluffy to the ring');
	});

	it('offers to revive a dead monster', () => {
		const game = makeGame({
			monsters: [{ givenName: 'Fluffy', dead: true }],
			deck: [],
		});
		expect(buildQuickActions(game, USER).map((a) => a.command)).to.include('revive Fluffy');
	});

	it('does not offer to revive a permanently destroyed monster', () => {
		const game = makeGame({
			monsters: [{ givenName: 'Fluffy', dead: true, destroyed: true }],
			deck: [],
		});
		expect(buildQuickActions(game, USER).map((a) => a.command)).to.not.include('revive Fluffy');
	});

	it('offers to equip only when unequipped cards exist', () => {
		const monster = { givenName: 'Fluffy' };
		const without = buildQuickActions(makeGame({ monsters: [monster], deck: [] }), USER);
		expect(without.map((a) => a.command)).to.not.include('equip Fluffy');

		const withCards = buildQuickActions(
			makeGame({ monsters: [monster], deck: [{ cardType: 'Hit' }] }),
			USER
		);
		expect(withCards.map((a) => a.command)).to.include('equip Fluffy');
	});

	it('does not offer to equip a monster that is in the ring', () => {
		const monster = { givenName: 'Fluffy' };
		const game = makeGame({ monsters: [monster], deck: [{ cardType: 'Hit' }] }, [
			{ userId: USER, monster },
		]);
		expect(buildQuickActions(game, USER).map((a) => a.command)).to.not.include('equip Fluffy');
	});

	it('ignores ring contestants belonging to other players', () => {
		const mine = { givenName: 'Fluffy', cards: makeCards(9) };
		const theirs = { givenName: 'Rex' };
		const game = makeGame({ monsters: [mine], deck: [] }, [
			{ userId: 'someone-else', monster: theirs },
		]);
		const commands = buildQuickActions(game, USER).map((a) => a.command);
		expect(commands).to.include('send Fluffy to the ring');
		expect(commands).to.not.include('look at the ring');
	});

	it('caps suggestions and never emits duplicates', () => {
		const game = makeGame(
			{
				monsters: [
					{ givenName: 'InRing', cards: makeCards(9) },
					{ givenName: 'Idle', cards: makeCards(9) },
					{ givenName: 'Dead', dead: true },
				],
				deck: [{ cardType: 'Hit' }],
			},
			[]
		);
		const actions = buildQuickActions(game, USER);
		expect(actions.length).to.be.at.most(4);
		expect(new Set(actions.map((a) => a.command)).size).to.equal(actions.length);
	});

	it('tolerates malformed game state without throwing', () => {
		expect(() => buildQuickActions({}, USER)).to.not.throw();
		expect(() =>
			buildQuickActions(makeGame({ monsters: 'nope', deck: null } as never), USER)
		).to.not.throw();
		const partial = buildQuickActions(
			makeGame({ monsters: [{}, { givenName: '  ' }], deck: [] }),
			USER
		);
		expect(partial[0]?.command).to.equal('spawn monster');
	});
});
