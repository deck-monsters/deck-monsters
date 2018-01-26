/* eslint-disable max-len */

const { expect, sinon } = require('../../shared/test-setup');

const ChaosTheoryScroll = require('../scrolls/chaos-theory');
const LotteryTicket = require('../scrolls/lottery-ticket');
const randomCharacter = require('../../characters/helpers/random');
const useItems = require('./use');

describe('./items/helpers/use.js', () => {
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

	it('can use an item on self', () => {
		const character = randomCharacter({ name: 'Character', coins: 500, gender: 'female' });
		character.items = [new LotteryTicket()];

		channelStub.withArgs({
			question: `Which item should Character use on herself?

0) Lottery Ticket [1]`
		})
			.resolves('0');

		channelStub.withArgs({
			question: 'Is this correct? (yes/no)'
		})
			.resolves('yes');

		expect(character.items.length).to.equal(1);

		const useStub = sinon.stub();
		useStub.resolves();

		return useItems({ channel: channelStub, character, use: useStub })
			.then(() => {
				expect(channelStub).to.have.been.calledWith({
					announce: 'You selected a lottery ticket item.'
				});

				return expect(useStub).to.have.been.calledWith({ channel: channelStub, isMonsterItem: false, item: character.items[0], monster: undefined });
			});
	});

	it('can use an item on a monster', () => {
		const character = randomCharacter({ name: 'Character', coins: 500, gender: 'female' });

		const monster = character.monsters[0];
		monster.optionsStore.name = 'Monster';
		monster.items = [new ChaosTheoryScroll()];

		channelStub.withArgs({
			question: `Which item should Character use on Monster?

0) Chaos Theory for Beginners [1]`
		})
			.resolves('0');

		channelStub.withArgs({
			question: 'Is this correct? (yes/no)'
		})
			.resolves('yes');

		expect(monster.items.length).to.equal(1);

		const useStub = sinon.stub();
		useStub.resolves();

		return useItems({ channel: channelStub, character, monster, use: useStub })
			.then(() => {
				expect(channelStub).to.have.been.calledWith({
					announce: 'You selected a chaos theory for beginners item.'
				});

				return expect(useStub).to.have.been.calledWith({ channel: channelStub, isMonsterItem: true, item: monster.items[0], monster });
			});
	});
});
