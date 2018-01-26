const { expect, sinon } = require('../../shared/test-setup');

const pause = require('../../helpers/pause');
const Beastmaster = require('../../characters/beastmaster');

const { hydrateDeck } = require('./hydrate');
const getCardCounts = require('../../items/helpers/counts').getItemCounts;

const testDeck = `[
	{
		"name":"HealCard",
		"options":{
			"icon":"💊"
		}
	},
	{
		"name":"FleeCard",
		"options":{
			"icon":"🏃"
		}
	},
	{
		"name":"RandomCard",
		"options":{
			"icon":"🎲"
		}
	},
	{
		"name":"HealCard",
		"options":{
			"icon":"💊"
		}
	},
	{
		"name":"HealCard",
		"options":{
			"icon":"💊"
		}
	},
	{
		"name":"HealCard",
		"options":{
			"icon":"💊"
		}
	},
	{
		"name":"RandomCard",
		"options":{
			"icon":"🎲"
		}
	},
	{
		"name":"FleeCard",
		"options":{
			"icon":"🏃"
		}
	},
	{
		"name":"HealCard",
		"options":{
			"icon":"💊"
		}
	},
	{
		"name":"BlastCard",
		"options":{
			"icon":"💥"
		}
	},
	{
		"name":"HealCard",
		"options":{
			"icon":"💊"
		}
	},
	{
		"name":"RandomCard",
		"options":{
			"icon":"🎲"
		}
	},
	{
		"name":"RandomCard",
		"options":{
			"icon":"🎲"
		}
	},
	{
		"name":"RandomCard",
		"options":{
			"icon":"🎲"
		}
	},
	{
		"name":"RandomCard",
		"options":{
			"icon":"🎲"
		}
	},
	{
		"name":"RandomCard",
		"options":{
			"icon":"🎲"
		}
	},
	{
		"name":"HealCard",
		"options":{
			"icon":"💊"
		}
	},
	{
		"name":"HealCard",
		"options":{
			"icon":"💊"
		}
	},
	{
		"name":"RandomCard",
		"options":{
			"icon":"🎲"
		}
	},
	{
		"name":"CurseCard",
		"options":{
			"icon":"😖"
		}
	},
	{
		"name":"WoodenSpearCard",
		"options":{
			"icon":"🌳"
		}
	},
	{
		"name":"WoodenSpearCard",
		"options":{
			"icon":"🌳"
		}
	},
	{
		"name":"HealCard",
		"options":{
			"icon":"💊"
		}
	},
	{
		"name":"BoostCard",
		"options":{
			"icon":"🆙"
		}
	},
	{
		"name":"WhiskeyShotCard",
		"options":{
			"icon":"🥃"
		}
	},
	{
		"name":"HitCard",
		"options":{
			"icon":"👊"
		}
	},
	{
		"name":"HitHarder",
		"options":{
			"icon":"🔨"
		}
	},
	{
		"name":"CurseCard",
		"options":{
			"icon":"😖"
		}
	},
	{
		"name":"RandomCard",
		"options":{
			"icon":"🎲"
		}
	}
]`;

describe('./cards/helpers/hydrate.js', () => {
	let pauseStub;

	before(() => {
		pauseStub = sinon.stub(pause, 'setTimeout');
	});

	beforeEach(() => {
		pauseStub.callsArg(0);
	});

	afterEach(() => {
		pauseStub.reset();
	});

	after(() => {
		pause.setTimeout.restore();
	});

	describe('hydrateDeck', () => {
		it('can restore from save state', () => {
			const player = new Beastmaster();

			const deck = hydrateDeck(testDeck, player);

			const cardCounts = getCardCounts(deck);

			expect(cardCounts.Hit).to.equal(1);
			expect(cardCounts.Heal).to.equal(9);
			expect(cardCounts.Flee).to.equal(2);
			expect(cardCounts.Blast).to.equal(1);
			expect(cardCounts['Random Play']).to.equal(9);
			expect(cardCounts.Soften).to.equal(2);
			expect(cardCounts['Hit Harder']).to.equal(1);
			expect(cardCounts['Whiskey Shot']).to.equal(1);
		});
	});
});
