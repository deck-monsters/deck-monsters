import { expect } from 'chai';
import sinon from 'sinon';

import { LotteryTicket } from '../scrolls/lottery-ticket.js';
import transferItems from './transfer.js';

const makeCreature = (overrides: Record<string, unknown> = {}) => {
	const itemsArr: any[] = [];

	const creature: any = {
		givenName: 'Creature',
		pronouns: { he: 'she', him: 'her', his: 'her' },
		inEncounter: false,
		itemSlots: 3,
		get items() { return itemsArr; },
		set items(v: any[]) { itemsArr.length = 0; itemsArr.push(...v); },
		canHoldItem: (_item: any) => true,
		giveItem(item: any, to: any) {
			const idx = itemsArr.indexOf(item);
			if (idx > -1) itemsArr.splice(idx, 1);
			to.items.push(item);
		},
		...overrides
	};

	return creature;
};

describe('./items/helpers/transfer.ts', () => {
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

	it('throws an error if the creature has no items to give', () => {
		const from = makeCreature({ givenName: 'Monster' });
		const to = makeCreature({ givenName: 'Character', itemSlots: 12 });

		return transferItems({ from, to, channel: channelStub }).catch(() => {
			return expect(channelStub).to.have.been.calledWith({
				announce: "Monster doesn't have any items that Character can use."
			});
		});
	});

	it('can give an item to another creature', () => {
		const from = makeCreature({ givenName: 'Character', itemSlots: 12 });
		from.items = [new LotteryTicket()];

		const to = makeCreature({ givenName: 'Monster', itemSlots: 3 });

		channelStub.withArgs(sinon.match({ question: sinon.match('Lottery Ticket') }))
			.resolves('0');

		expect(from.items.length).to.equal(1);
		expect(to.items.length).to.equal(0);

		return transferItems({ from, to, channel: channelStub }).then(() => {
			expect(from.items.length).to.equal(0);
			return expect(to.items.length).to.equal(1);
		});
	});
});
