const { expect, sinon } = require('../../shared/test-setup');

const Beastmaster = require('../beastmaster');
const pause = require('../../helpers/pause');

const { hydrateCharacter } = require('./hydrate');

const sampleCharacterData = '{"name":"Beastmaster","options":{"acVariance":2,"hpVariance":2,"gender":"male","deck":[{"name":"FightOrFlightCard","options":{"icon":"😖"}},{"name":"FistsOfVirtueCard","options":{"icon":"🙏"}},{"name":"FleeCard","options":{"icon":"🏃"}},{"name":"FleeCard","options":{"icon":"🏃"}},{"name":"HealCard","options":{"icon":"💊"}},{"name":"HitCard","options":{"icon":"👊"}},{"name":"DelayedHitCard","options":{"icon":"🤛"}},{"name":"DelayedHitCard","options":{"icon":"🤛"}},{"name":"HitCard","options":{"icon":"👊"}},{"name":"HitCard","options":{"icon":"👊"}},{"name":"HitCard","options":{"icon":"👊"}},{"name":"HitCard","options":{"icon":"👊"}},{"name":"HitCard","options":{"icon":"👊"}},{"name":"HitCard","options":{"icon":"👊"}},{"name":"HitCard","options":{"icon":"👊"}},{"name":"HitCard","options":{"icon":"👊"}},{"name":"HitCard","options":{"icon":"👊"}},{"name":"HitCard","options":{"icon":"👊"}},{"name":"HitCard","options":{"icon":"👊"}},{"name":"HitCard","options":{"icon":"👊"}},{"name":"HitCard","options":{"icon":"👊"}},{"name":"HitCard","options":{"icon":"👊"}},{"name":"RandomCard","options":{"icon":"🎲"}},{"name":"RandomCard","options":{"icon":"🎲"}},{"name":"RandomCard","options":{"icon":"🎲"}},{"name":"RandomCard","options":{"icon":"🎲"}},{"name":"WoodenSpearCard","options":{"icon":"🌳"}},{"name":"HitCard","options":{"icon":"👊"}},{"name":"FleeCard","options":{"icon":"🏃"}},{"name":"RandomCard","options":{"icon":"🎲"}},{"name":"FleeCard","options":{"icon":"🏃"}},{"name":"KalevalaCard","options":{"icon":"🎻"}},{"name":"FleeCard","options":{"icon":"🏃"}},{"name":"RandomCard","options":{"icon":"🎲"}},{"name":"HitCard","options":{"icon":"👊"}},{"name":"FleeCard","options":{"icon":"🏃"}},{"name":"HitCard","options":{"icon":"👊"}}],"monsterSlots":4,"monsters":[{"name":"Gladiator","options":{"acVariance":2,"hpVariance":5,"gender":"male","dexModifier":1,"strModifier":1,"color":"silver","location":"an underground fight club","size":{"adjective":"nimble","height":"just over 5 feet"},"icon":"💪","name":"El Cid","hp":38,"battles":{"wins":9,"losses":14,"total":26},"cards":[{"name":"KalevalaCard","options":{"icon":"🎻"}},{"name":"RandomCard","options":{"icon":"🎲"}},{"name":"FistsOfVirtueCard","options":{"icon":"🙏"}},{"name":"WoodenSpearCard","options":{"icon":"🌳"}},{"name":"FightOrFlightCard","options":{"icon":"😖"}},{"name":"RandomCard","options":{"icon":"🎲"}},{"name":"HitCard","options":{"icon":"👊"}}],"xp":80}},{"name":"Basilisk","options":{"acVariance":1,"hpVariance":3,"gender":"androgynous","dexModifier":-1,"strModifier":3,"color":"lean, mean, emerald green","location":"forest","size":{"adjective":"slender","weight":"240lbs"},"icon":"🐍","name":"Envy","hp":34,"battles":{"wins":4,"losses":7,"total":11},"cards":[{"name":"KalevalaCard","options":{"icon":"🎻"}},{"name":"RandomCard","options":{"icon":"🎲"}},{"name":"FistsOfVirtueCard","options":{"icon":"🙏"}},{"name":"FightOrFlightCard","options":{"icon":"😖"}},{"name":"HitCard","options":{"icon":"👊"}},{"name":"RandomCard","options":{"icon":"🎲"}},{"name":"HitCard","options":{"icon":"👊"}}],"xp":60}},{"name":"WeepingAngel","options":{"acVariance":1,"hpVariance":5,"gender":"androgynous","dexModifier":3,"strModifier":-1,"color":"invisible","nationality":"English","descriptor":"nuttier","icon":"🌟","name":"Who?","hp":34,"battles":{"wins":4,"losses":9,"total":14},"cards":[{"name":"FightOrFlightCard","options":{"icon":"😖"}},{"name":"RandomCard","options":{"icon":"🎲"}},{"name":"HitCard","options":{"icon":"👊"}},{"name":"HitCard","options":{"icon":"👊"}},{"name":"HitCard","options":{"icon":"👊"}},{"name":"RandomCard","options":{"icon":"🎲"}},{"name":"HitCard","options":{"icon":"👊"}}],"xp":40}},{"name":"Minotaur","options":{"acVariance":2,"hpVariance":3,"gender":"female","strModifier":2,"color":"platinum blonde","pattern":"bold","descriptor":"awe-inspiring","icon":"🐗","name":"Brynhild","hp":37,"battles":{"wins":6,"losses":7,"total":13},"cards":[{"name":"KalevalaCard","options":{"icon":"🎻"}},{"name":"RandomCard","options":{"icon":"🎲"}},{"name":"FistsOfVirtueCard","options":{"icon":"🙏"}},{"name":"FightOrFlightCard","options":{"icon":"😖"}},{"name":"HitCard","options":{"icon":"👊"}},{"name":"RandomCard","options":{"icon":"🎲"}},{"name":"HitCard","options":{"icon":"👊"}}],"xp":50}}],"name":"rodesp","icon":"🇧🇹","hp":42,"battles":{"wins":25,"losses":44,"total":73},"xp":294,"coins":213}}'; // eslint-disable-line max-len

describe('./characters/helpers/hydrate.js', () => {
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

	it('can hydrate a character', () => {
		const character = hydrateCharacter(JSON.parse(sampleCharacterData));

		expect(character).to.be.an.instanceof(Beastmaster);
		expect(character.monsters.length).to.equal(4);
		expect(character.deck.length).to.equal(37);

		expect(character.deck.find(card => card.name === 'DelayedHit')).to.be.defined;

		const characterKalevala = character.deck.find(card => card.name === 'KalevalaCard');
		const monsterKalevala = character.monsters[1].cards.find(card => card.name === 'KalevalaCard');
		expect(characterKalevala).to.equal(monsterKalevala);
	});
});
