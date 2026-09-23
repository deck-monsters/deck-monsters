import { expect } from 'chai';
import sinon from 'sinon';

import { LotteryTicket } from '../scrolls/lottery-ticket.js';
import { ChaosTheoryScroll } from '../scrolls/chaos-theory.js';
import useItems from './use.js';

const makeCharacter = (overrides: Record<string, unknown> = {}) => {
	const itemsArr: any[] = [];

	return {
		givenName: 'Character',
		pronouns: { he: 'she', him: 'her', his: 'her' },
		get items() { return itemsArr; },
		set items(v: any[]) { itemsArr.length = 0; itemsArr.push(...v); },
		canUseItem: (_item: any) => true,
		removeItem(item: any) {
			const idx = itemsArr.indexOf(item);
			if (idx > -1) itemsArr.splice(idx, 1);
		},
		...overrides
	};
};

const makeMonster = (overrides: Record<string, unknown> = {}) => {
	const itemsArr: any[] = [];

	return {
		givenName: 'Monster',
		pronouns: { he: 'he', him: 'him', his: 'his' },
		inEncounter: false,
		get items() { return itemsArr; },
		set items(v: any[]) { itemsArr.length = 0; itemsArr.push(...v); },
		canUseItem: (_item: any) => true,
		removeItem(item: any) {
			const idx = itemsArr.indexOf(item);
			if (idx > -1) itemsArr.splice(idx, 1);
		},
		...overrides
	};
};

describe('./items/helpers/use.ts', () => {
	let clock: sinon.SinonFakeTimers;
	const channelStub = sinon.stub();

	beforeEach(() => {
		clock = sinon.useFakeTimers({ shouldClearNativeTimers: true });
		channelStub.resolves();
	});

	afterEach(() => {
		clock.restore();
		channelStub.reset();
	});

	it('can use an item on self', () => {
		const character = makeCharacter();
		character.items = [new LotteryTicket()];

		channelStub.withArgs(sinon.match({ question: sinon.match('Lottery Ticket') })).resolves('0');
		channelStub.withArgs({ question: 'Are you sure? (yes/no)' }).resolves('yes');

		expect(character.items.length).to.equal(1);

		const useStub = sinon.stub().resolves();

		return useItems({ channel: channelStub, character, use: useStub }).then(() => {
			expect(channelStub.calledWith(sinon.match({ announce: sinon.match('lottery ticket item') }))).to.equal(true);
			return expect(useStub.calledOnce).to.equal(true);
		});
	});

	it('can use an item on a monster', () => {
		const character = makeCharacter();
		const monster = makeMonster();
		monster.items = [new ChaosTheoryScroll()];

		channelStub.withArgs(sinon.match({ question: sinon.match('Chaos Theory') })).resolves('0');
		channelStub.withArgs({ question: 'Are you sure? (yes/no)' }).resolves('yes');

		const useStub = sinon.stub().resolves();

		return useItems({ channel: channelStub, character, monster, use: useStub }).then(() => {
			expect(channelStub.calledWith(sinon.match({ announce: sinon.match('chaos theory') }))).to.equal(true);
			return expect(useStub.calledOnce).to.equal(true);
		});
	});

	/**
	 * A chat client has no button to not press, so the confirmation is the only thing between
	 * a typo and a spent item. A caller whose UI already confirmed has nothing left to ask —
	 * and asking anyway is what kept item use out of the web client entirely, since a prompt
	 * cannot be answered inside a tRPC mutation. See docs/architecture/workshop-and-items.md.
	 */
	describe('confirmed', () => {
		it('asks for confirmation by default', () => {
			const character = makeCharacter();
			character.items = [new LotteryTicket()];
			channelStub.withArgs({ question: 'Are you sure? (yes/no)' }).resolves('yes');
			const useStub = sinon.stub().resolves();

			return useItems({
				channel: channelStub,
				character,
				itemSelection: ['lottery ticket'],
				use: useStub
			}).then(() => {
				expect(channelStub.calledWith({ question: 'Are you sure? (yes/no)' })).to.equal(true);
			});
		});

		it('skips the prompt when the caller already confirmed', () => {
			const character = makeCharacter();
			character.items = [new LotteryTicket()];
			const useStub = sinon.stub().resolves();

			return useItems({
				channel: channelStub,
				character,
				confirmed: true,
				itemSelection: ['lottery ticket'],
				use: useStub
			}).then(() => {
				expect(channelStub.calledWith({ question: 'Are you sure? (yes/no)' })).to.equal(false);
				expect(useStub.calledOnce).to.equal(true);
			});
		});

		it('still refuses an item the character cannot use', () => {
			// `confirmed` skips the confirmation, not the rules.
			const character = makeCharacter({ canUseItem: () => false });
			character.items = [new LotteryTicket()];
			const useStub = sinon.stub().resolves();

			return useItems({ channel: channelStub, character, confirmed: true, use: useStub })
				.then(() => expect.fail('expected a rejection'))
				.catch((err: Error) => {
					expect(err.message).to.contain("doesn't have any items");
					expect(useStub.called).to.equal(false);
				});
		});
	});

	/**
	 * Previously this fell through to the confirmation and then a no-op `mapSeries([])`, so
	 * the caller was told the use succeeded while nothing happened.
	 */
	it('rejects when a named item is not among the usable ones', () => {
		const character = makeCharacter();
		character.items = [new LotteryTicket()];
		const useStub = sinon.stub().resolves();

		return useItems({
			channel: channelStub,
			character,
			confirmed: true,
			itemSelection: ['a potion that does not exist'],
			use: useStub
		})
			.then(() => expect.fail('expected a rejection'))
			.catch((err: Error) => {
				expect(err.message).to.contain('can not use');
				expect(useStub.called).to.equal(false);
			});
	});

	it('uses the items it did match when only some of a selection is unusable', () => {
		const character = makeCharacter();
		character.items = [new LotteryTicket()];
		const useStub = sinon.stub().resolves();

		return useItems({
			channel: channelStub,
			character,
			confirmed: true,
			itemSelection: ['lottery ticket', 'nonexistent'],
			use: useStub
		}).then(() => {
			expect(useStub.calledOnce).to.equal(true);
		});
	});

	/**
	 * Both pools can hold the same item type. The pool is `[...monster.items,
	 * ...character.items]` and a name match takes the first hit, so without a source the
	 * monster's copy is spent even when the player clicked the one in their pocket.
	 * Reported by Codex review on #372.
	 */
	describe('itemSource', () => {
		it("takes the character's copy when the character's row was clicked", () => {
			const character = makeCharacter();
			const monster = makeMonster();
			const pocketCopy = new ChaosTheoryScroll();
			const stockedCopy = new ChaosTheoryScroll();
			character.items = [pocketCopy];
			monster.items = [stockedCopy];
			const useStub = sinon.stub().resolves();

			return useItems({
				channel: channelStub,
				character,
				confirmed: true,
				itemSelection: ['chaos theory for beginners'],
				itemSource: 'character',
				monster,
				use: useStub
			}).then(() => {
				expect(useStub.firstCall.args[0].item).to.equal(pocketCopy);
			});
		});

		it("takes the monster's copy when the monster's row was clicked", () => {
			const character = makeCharacter();
			const monster = makeMonster();
			const pocketCopy = new ChaosTheoryScroll();
			const stockedCopy = new ChaosTheoryScroll();
			character.items = [pocketCopy];
			monster.items = [stockedCopy];
			const useStub = sinon.stub().resolves();

			return useItems({
				channel: channelStub,
				character,
				confirmed: true,
				itemSelection: ['chaos theory for beginners'],
				itemSource: 'monster',
				monster,
				use: useStub
			}).then(() => {
				expect(useStub.firstCall.args[0].item).to.equal(stockedCopy);
			});
		});

		it('keeps first-match behaviour when no source is named, for chat callers', () => {
			const character = makeCharacter();
			const monster = makeMonster();
			const pocketCopy = new ChaosTheoryScroll();
			const stockedCopy = new ChaosTheoryScroll();
			character.items = [pocketCopy];
			monster.items = [stockedCopy];
			const useStub = sinon.stub().resolves();

			return useItems({
				channel: channelStub,
				character,
				confirmed: true,
				itemSelection: ['chaos theory for beginners'],
				monster,
				use: useStub
			}).then(() => {
				expect(useStub.firstCall.args[0].item).to.equal(stockedCopy);
			});
		});
	});
});