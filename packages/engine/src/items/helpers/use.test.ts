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
});
