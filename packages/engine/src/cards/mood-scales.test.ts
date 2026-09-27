import { expect } from 'chai';
import sinon from 'sinon';

import { MoodScalesCard, isFurious, FURY_DAMAGE_DICE } from './mood-scales.js';
import { CloakOfInvisibilityCard } from './cloak-of-invisibility.js';
import { HitCard } from './hit.js';
import { HealCard } from './heal.js';
import { hydrateCard } from './helpers/hydrate.js';
import Dragon from '../monsters/dragon.js';
import Minotaur from '../monsters/minotaur.js';
import { isInvisible } from '../helpers/is-invisible.js';
import { DRAGON } from '../constants/creature-types.js';

describe('./cards/mood-scales.ts Mood Scales', () => {
	let dragon: any;
	let foe: any;
	let ring: any;
	let contestants: any[];
	let narrations: string[];

	beforeEach(() => {
		dragon = new Dragon({ name: 'Skarn', gender: 'androgynous', xp: 500 });
		foe = new Minotaur({ name: 'Bram' });
		contestants = [dragon, foe].map(monster => ({ monster, character: {} }));
		ring = { contestants, encounterEffects: [], channelManager: { sendMessages: () => Promise.resolve() } };
		dragon.startEncounter(ring);
		foe.startEncounter(ring);
		narrations = [];
	});

	afterEach(() => sinon.restore());

	const play = () => {
		const card = new MoodScalesCard();
		card.on('narration', (_c: string, _card: any, { narration }: any) => narrations.push(narration));
		return card.play(dragon, foe, ring, contestants);
	};

	it('is a level 1, Dragon-only hiding card from the back room', () => {
		expect(MoodScalesCard.permittedClassesAndTypes).to.deep.equal([DRAGON]);
		expect(MoodScalesCard.level).to.equal(1);
		expect(MoodScalesCard.notForSale).to.equal(true);
		expect(new MoodScalesCard()).to.be.instanceOf(CloakOfInvisibilityCard);
		expect(foe.canHoldCard(MoodScalesCard)).to.equal(false);
	});

	it('hides a calm dragon (above half HP) the way Cloak of Invisibility does', async () => {
		dragon.hp = dragon.maxHp;
		await play();

		expect(isInvisible(dragon)).to.equal(true);
		expect(isFurious(dragon)).to.equal(false);
		expect(narrations[0]).to.include('Skarn is calm. Their scales turn the colour of the rocks and the sea, and they fade from sight.');
	});

	it('makes a bloodied dragon furious instead: no hiding, and the next melee hit is stronger', async () => {
		dragon.hp = dragon.bloodiedValue;
		await play();

		expect(isInvisible(dragon)).to.equal(false);
		expect(isFurious(dragon)).to.equal(true);
		expect(narrations[0]).to.include(`Skarn is furious! Their scales blaze red, and there is no hiding now. (Next melee hit: +${FURY_DAMAGE_DICE} damage.)`);
	});

	it('strips a calm hiding when the dragon turns furious', async () => {
		dragon.hp = dragon.maxHp;
		await play();
		expect(isInvisible(dragon)).to.equal(true);

		dragon.hp = 1;
		await play();

		expect(isInvisible(dragon)).to.equal(false);
		expect(isFurious(dragon)).to.equal(true);
	});

	it('waits through other cards for the next melee hit, then spends the fury on it', async () => {
		dragon.hp = 1;
		await play();

		const heal = new HealCard();
		sinon.stub(heal, 'effect').resolves(true);
		await heal.play(dragon, dragon, ring, contestants);
		expect(isFurious(dragon), 'a heal does not spend it').to.equal(true);

		const hit = new HitCard();
		const damageRolls: any[] = [];
		hit.on('rolled', (_c: string, _card: any, { reason, roll }: any) => {
			if (reason === 'for damage.') damageRolls.push(roll);
		});
		sinon.stub(hit, 'hitCheck').returns({ attackRoll: { result: 20 }, success: true, strokeOfLuck: false, curseOfLoki: false } as any);
		await hit.play(dragon, foe, ring, contestants);

		expect(isFurious(dragon)).to.equal(false);
		expect(damageRolls[0].modifier).to.be.within(dragon.strModifier + 1, dragon.strModifier + 6);
	});

	it('keeps the fury through a miss: it is for the next melee hit', async () => {
		dragon.hp = 1;
		await play();

		const miss = new HitCard();
		sinon.stub(miss, 'hitCheck').returns({ attackRoll: { result: 1 }, success: false, strokeOfLuck: false, curseOfLoki: false } as any);
		await miss.play(dragon, foe, ring, contestants);

		expect(isFurious(dragon), 'a miss does not spend it').to.equal(true);
	});

	it('calms down properly: a calm play puts out a waiting fury and hides', async () => {
		dragon.hp = 1;
		await play();
		expect(isFurious(dragon)).to.equal(true);

		dragon.hp = dragon.maxHp;
		await play();

		expect(isFurious(dragon)).to.equal(false);
		expect(isInvisible(dragon)).to.equal(true);
	});

	it('does not stack a second fury', async () => {
		dragon.hp = 1;
		await play();
		await play();

		expect(dragon.encounterEffects.filter((e: any) => isFurious({ encounterEffects: [e] }))).to.have.length(1);
		expect(narrations.join('\n')).to.include('Skarn is already furious, and glows a little redder.');
	});

	it('clears with the fight', async () => {
		dragon.hp = 1;
		await play();
		dragon.endEncounter();
		expect(isFurious(dragon)).to.equal(false);
	});

	it('survives a JSON hydration round trip', () => {
		const restored = hydrateCard(JSON.parse(JSON.stringify(new MoodScalesCard())));
		expect(restored).to.be.instanceOf(MoodScalesCard);
		expect(restored.icon).to.equal('🦎');
	});
});
