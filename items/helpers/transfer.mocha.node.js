const { expect, sinon } = require('../../shared/test-setup');

const LotteryTicket = require('../scrolls/lottery-ticket');
const randomCharacter = require('../../characters/helpers/random');
const transferItems = require('./transfer');

describe('./items/helpers/transfer.js', () => {
	let clock;

	const channelStub = sinon.stub();

	beforeEach(() => {
		clock = sinon.useFakeTimers();
		channelStub.resolves();
	});

	afterEach(() => {
		clock.restore();
		channelStub.reset();
	});

	it('can give an item to a monster', () => {
		const character = randomCharacter({ name: 'Character', coins: 500, gender: 'female' });
		character.items = [new LotteryTicket()];

		const monster = character.monsters[0];
		monster.optionsStore.name = 'Monster';

		channelStub.withArgs({
			question: `Monster is holding no items and has space for 3 more:

0) Lottery Ticket [1]

Which item(s) should Character give her?`
		})
			.resolves('0');

		expect(character.items.length).to.equal(1);
		expect(monster.items.length).to.equal(0);

		return transferItems({ from: character, to: monster, channel: channelStub })
			.then(() => {
				expect(channelStub).to.have.been.calledWith({
					announce: 'You selected a lottery ticket item.'
				});

				expect(channelStub).to.have.been.calledWith({
					announce: `Character has given Monster the following item:

0) Lottery Ticket`
				});

				expect(character.items.length).to.equal(0);
				return expect(monster.items.length).to.equal(1);
			});
	});

	it('can give an item to a character', () => {
		const character = randomCharacter({ name: 'Character', coins: 500, gender: 'female' });

		const monster = character.monsters[0];
		monster.optionsStore.name = 'Monster';
		monster.items = [new LotteryTicket()];

		channelStub.withArgs({
			question: `Character is holding no items and has space for 12 more:

0) Lottery Ticket [1]

Which item(s) should Monster give her?`
		})
			.resolves('0');

		expect(monster.items.length).to.equal(1);
		expect(character.items.length).to.equal(0);

		return transferItems({ from: monster, to: character, channel: channelStub })
			.then(() => {
				expect(channelStub).to.have.been.calledWith({
					announce: 'You selected a lottery ticket item.'
				});

				expect(channelStub).to.have.been.calledWith({
					announce: `Monster has given Character the following item:

0) Lottery Ticket`
				});

				expect(character.items.length).to.equal(1);
				return expect(monster.items.length).to.equal(0);
			});
	});

	it('can give three items total to a monster', () => {
		const character = randomCharacter({ name: 'Character', coins: 500, gender: 'female' });
		character.items = [new LotteryTicket(), new LotteryTicket(), new LotteryTicket(), new LotteryTicket(), new LotteryTicket()];

		const monster = character.monsters[0];
		monster.optionsStore.name = 'Monster';
		monster.items = [new LotteryTicket()];

		channelStub.withArgs({
			question: `Monster is holding one item and has space for 2 more:

0) Lottery Ticket [5]

Which item(s) should Character give her?`
		})
			.resolves('0,0,0,0');

		expect(character.items.length).to.equal(5);
		expect(monster.items.length).to.equal(1);

		return transferItems({ from: character, to: monster, channel: channelStub })
			.then(() => {
				expect(channelStub).to.have.been.calledWith({
					announce: `You selected the following items:

0) Lottery Ticket
1) Lottery Ticket
2) Lottery Ticket
3) Lottery Ticket`
				});

				expect(channelStub).to.have.been.calledWith({
					announce: `Monster has run out of space, but Character has given her the following items:

0) Lottery Ticket
1) Lottery Ticket`
				});

				expect(character.items.length).to.equal(3);
				return expect(monster.items.length).to.equal(3);
			});
	});

	it('throws an error if the creature has no items to give', () => {
		const character = randomCharacter({ name: 'Character', coins: 500, gender: 'female' });

		const monster = character.monsters[0];
		monster.optionsStore.name = 'Monster';

		return transferItems({ from: monster, to: character, channel: channelStub })
			.catch(() => expect(channelStub).to.have.been.calledWith({
				announce: "Monster doesn't have any items that Character can use."
			}));
	});

	it('throws an error on an invalid selection', () => {
		const character = randomCharacter({ name: 'Character', coins: 500, gender: 'female' });
		character.items = [new LotteryTicket()];

		const monster = character.monsters[0];
		monster.optionsStore.name = 'Monster';
		monster.items = [new LotteryTicket()];

		channelStub.withArgs({
			question: `Monster is holding one item and has space for 2 more:

0) Lottery Ticket [1]

Which item(s) should Character give her?`
		})
			.resolves('0,0,0,0');

		expect(character.items.length).to.equal(1);
		expect(monster.items.length).to.equal(1);

		return transferItems({ from: character, to: monster, channel: channelStub })
			.catch(() => {
				expect(channelStub).to.have.been.calledWith({
					announce: 'Invalid selection: Lottery Ticket'
				});

				expect(character.items.length).to.equal(1);
				return expect(monster.items.length).to.equal(1);
			});
	});
});
