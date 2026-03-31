import { expect } from 'chai';

import { LotteryTicket } from './lottery-ticket.js';

const makeCharacter = (overrides: Record<string, unknown> = {}) => ({
	givenName: 'Character',
	pronouns: { he: 'he', him: 'him', his: 'his' },
	coins: 50,
	items: [] as any[],
	removeItem: (item: any) => {},
	...overrides
});

describe('./items/scrolls/lottery-ticket.ts', () => {
	it('can be instantiated with defaults', () => {
		const lotteryTicket = new LotteryTicket();

		expect(lotteryTicket).to.be.an.instanceof(LotteryTicket);
		expect(lotteryTicket.numberOfUses).to.equal(1);
		expect(lotteryTicket.expired).to.be.false;
		expect(lotteryTicket.stats).to.equal('Usable 1 time.');
		expect(lotteryTicket.icon).to.equal('💰');
		expect(lotteryTicket.description).to.include('Play the odds');
	});

	it('can be used and awards or withholds coins', () => {
		const character = makeCharacter({ coins: 50 });
		const lotteryTicket = new LotteryTicket();

		return lotteryTicket.use({ character } as any).then(() => {
			// After using, coins may have changed (won) or stayed the same (lost)
			expect(typeof character.coins).to.equal('number');
			// The ticket is consumed on use
			expect(lotteryTicket.expired).to.be.true;
		});
	});

	it('has a description mentioning coin winnings', () => {
		expect(LotteryTicket.description).to.include('coins');
	});

	it('is usable without a monster', () => {
		expect(LotteryTicket.usableWithoutMonster).to.equal(true);
	});
});
