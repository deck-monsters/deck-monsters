import { expect } from 'chai';
import sinon from 'sinon';

import { MirrorShieldCard, isMirrorShielded, splitReflectedDamage } from './mirror-shield.js';
import { BlastCard } from './blast.js';
import { Blast2Card } from './blast-2.js';
import { FireBreathCard, isBurning } from './fire-breath.js';
import { SandstormCard } from './sandstorm.js';
import { TsunamiCard, TSUNAMI_DAMAGE } from './tsunami.js';
import { HitCard } from './hit.js';
import { MesmerizeCard } from './mesmerize.js';
import { hydrateCard } from './helpers/hydrate.js';
import Gladiator from '../monsters/gladiator.js';
import Jinn from '../monsters/jinn.js';
import Unicorn from '../monsters/unicorn.js';
import Dragon from '../monsters/dragon.js';
import Minotaur from '../monsters/minotaur.js';
import { BARD, FIGHTER } from '../constants/creature-classes.js';
import { MIRROR_SHIELD_EFFECT, SANDSTORM_EFFECT } from '../constants/effect-types.js';

describe('./cards/mirror-shield.ts Mirror Shield', () => {
	let holder: any;
	let caster: any;
	let bystander: any;
	let ring: any;
	let contestants: any[];
	let narrations: string[];

	beforeEach(() => {
		holder = new Gladiator({ name: 'Tor', gender: 'male', xp: 300 });
		caster = new Unicorn({ name: 'Nola', gender: 'female', xp: 300 });
		bystander = new Minotaur({ name: 'Bram', gender: 'male', xp: 300 });
		// Caster first, so a caster that falls mid-attack has not yet reached the bystander.
		contestants = [caster, holder, bystander].map(monster => ({ monster, character: {} }));
		ring = { contestants, encounterEffects: [], channelManager: { sendMessages: () => Promise.resolve() } };
		for (const { monster } of contestants) {
			monster.startEncounter(ring);
			monster.hp = monster.maxHp;
		}
		narrations = [];
	});

	afterEach(() => sinon.restore());

	const listen = (card: any) => {
		card.on('narration', (_c: string, _card: any, { narration }: any) => narrations.push(narration));
		return card;
	};

	const raise = (who = holder) => listen(new MirrorShieldCard()).play(who, who, ring, contestants);
	const shields = (monster: any) =>
		monster.encounterEffects.filter((effect: any) => effect.effectType === MIRROR_SHIELD_EFFECT).length;

	// A Blast that deals exactly `damage` to each target, so the arithmetic is exact.
	const blastOf = (damage: number) => {
		const blast = new BlastCard();
		sinon.stub(blast, 'areaDamage').returns(damage);
		return blast;
	};

	it('is an uncommon level 1 Fighter and Bard card', () => {
		expect(MirrorShieldCard.permittedClassesAndTypes).to.deep.equal([FIGHTER, BARD]);
		expect(MirrorShieldCard.level).to.equal(1);
		expect(new Gladiator({ xp: 300 }).canHoldCard(MirrorShieldCard)).to.equal(true);
		expect(new Jinn({ xp: 300 }).canHoldCard(MirrorShieldCard)).to.equal(true);
		expect(new Unicorn({ xp: 300 }).canHoldCard(MirrorShieldCard)).to.equal(false);
		expect(new MirrorShieldCard().getTargets(holder)).to.deep.equal([holder]);
		expect(new MirrorShieldCard().stats).to.include('half hits whoever cast it');
	});

	it('splits damage the way Fire Breath halves it: floor and at least 1 for the holder, the rest to the caster', () => {
		expect(splitReflectedDamage(8)).to.deep.equal({ holder: 4, caster: 4 });
		expect(splitReflectedDamage(7)).to.deep.equal({ holder: 3, caster: 4 });
		expect(splitReflectedDamage(5)).to.deep.equal({ holder: 2, caster: 3 });
		expect(splitReflectedDamage(1)).to.deep.equal({ holder: 1, caster: 1 });
		expect(splitReflectedDamage(0)).to.deep.equal({ holder: 0, caster: 0 });
		expect(splitReflectedDamage(-2)).to.deep.equal({ holder: 0, caster: 0 });
	});

	it('raises a shield on its player and announces it', async () => {
		await raise();
		expect(isMirrorShielded(holder)).to.equal(true);
		expect(narrations.join('\n')).to.include('raises a polished shield');
	});

	it('turns Blast back: the holder takes half, the caster takes half, and the shield is spent', async () => {
		await raise();
		const [casterHp, holderHp, bystanderHp] = [caster.hp, holder.hp, bystander.hp];

		await listen(blastOf(8)).play(caster, holder, ring, contestants);

		expect(holder.hp).to.equal(holderHp - 4);
		expect(caster.hp).to.equal(casterHp - 4);
		expect(bystander.hp, 'everyone else is hit in full').to.equal(bystanderHp - 8);
		expect(isMirrorShielded(holder)).to.equal(false);
		expect(narrations.join('\n')).to.include("Tor's shield catches Nola's Blast and turns it back!");
	});

	it('rounds an odd Blast: the holder takes the floor, the caster the rest', async () => {
		await raise();
		const [casterHp, holderHp] = [caster.hp, holder.hp];

		await blastOf(7).play(caster, holder, ring, contestants);

		expect(holder.hp).to.equal(holderHp - 3);
		expect(caster.hp).to.equal(casterHp - 4);
	});

	it('uses the real Blast damage, and Blast II, the same way', async () => {
		await raise();
		const blast = new BlastCard();
		const full = blast.areaDamage(caster);
		const holderHp = holder.hp;
		await blast.play(caster, holder, ring, contestants);
		expect(holder.hp).to.equal(holderHp - splitReflectedDamage(full).holder);

		await raise();
		const blast2 = new Blast2Card();
		const full2 = blast2.areaDamage(caster);
		expect(full2).to.equal(3 + caster.intModifier);
		const before = holder.hp;
		await blast2.play(caster, holder, ring, contestants);
		expect(holder.hp).to.equal(before - splitReflectedDamage(full2).holder);
	});

	it('turns Fire Breath back with no dodge roll, no burn on the holder, and none on the caster', async () => {
		const dragon = new Dragon({ name: 'Skarn', gender: 'female', xp: 300 });
		dragon.startEncounter(ring);
		dragon.hp = dragon.maxHp;
		const dragonContestants = [dragon, holder].map(monster => ({ monster, character: {} }));
		await raise();
		const breath = new FireBreathCard();
		const dodge = sinon.spy(breath, 'dodge');
		const full = breath.areaDamage(dragon);
		const [dragonHp, holderHp] = [dragon.hp, holder.hp];

		await breath.play(dragon, holder, ring, dragonContestants);

		expect(dodge.called).to.equal(false);
		expect(holder.hp).to.equal(holderHp - splitReflectedDamage(full).holder);
		expect(dragon.hp).to.equal(dragonHp - splitReflectedDamage(full).caster);
		expect(isBurning(holder)).to.equal(false);
		expect(isBurning(dragon)).to.equal(false);
		expect(isMirrorShielded(holder)).to.equal(false);
	});

	it('turns a Sandstorm back without confusing the holder', async () => {
		const jinn = new Jinn({ name: 'Zed', gender: 'male', xp: 300 });
		jinn.startEncounter(ring);
		jinn.hp = jinn.maxHp;
		const jinnContestants = [jinn, holder].map(monster => ({ monster, character: {} }));
		await raise();
		const storm = new SandstormCard();
		const full = storm.areaDamage(jinn);
		const [jinnHp, holderHp] = [jinn.hp, holder.hp];

		await storm.play(jinn, holder, ring, jinnContestants);

		expect(holder.hp).to.equal(holderHp - splitReflectedDamage(full).holder);
		expect(jinn.hp).to.equal(jinnHp - splitReflectedDamage(full).caster);
		expect(holder.encounterEffects.some((effect: any) => effect.effectType === SANDSTORM_EFFECT)).to.equal(false);
	});

	it('turns a Tsunami back: 2 to the holder, 3 to the caster (the dragon rides its own wave here)', async () => {
		const dragon = new Dragon({ name: 'Skarn', gender: 'female', xp: 300 });
		dragon.startEncounter(ring);
		dragon.hp = dragon.maxHp;
		const wave = new TsunamiCard();
		sinon.stub(wave, 'rideTheWave').returns(true);
		const waveContestants = [dragon, holder, bystander].map(monster => ({ monster, character: {} }));
		await raise();
		const [dragonHp, holderHp, bystanderHp] = [dragon.hp, holder.hp, bystander.hp];

		await wave.play(dragon, holder, ring, waveContestants);

		expect(TSUNAMI_DAMAGE).to.equal(5);
		expect(holder.hp).to.equal(holderHp - 2);
		expect(dragon.hp).to.equal(dragonHp - 3);
		expect(bystander.hp).to.equal(bystanderHp - TSUNAMI_DAMAGE);
	});

	it('lets a single-target attack through and stays up', async () => {
		await raise();
		const hit = new HitCard();
		sinon.stub(hit, 'hitCheck').returns({ attackRoll: { result: 20 }, success: true, strokeOfLuck: false, curseOfLoki: false } as any);
		sinon.stub(hit, 'rollForDamage').returns({ result: 4 } as any);
		const [casterHp, holderHp] = [caster.hp, holder.hp];

		await hit.play(caster, holder, ring, contestants);

		expect(holder.hp).to.be.below(holderHp);
		expect(caster.hp).to.equal(casterHp);
		expect(isMirrorShielded(holder)).to.equal(true);
	});

	it('ignores an area card that is not an attack (Mesmerize) and stays up', async () => {
		await raise();
		await new MesmerizeCard().play(caster, holder, ring, contestants);
		expect(isMirrorShielded(holder)).to.equal(true);
	});

	it('is spent after one use: the next Blast lands in full', async () => {
		await raise();
		await blastOf(8).play(caster, holder, ring, contestants);
		const [casterHp, holderHp] = [caster.hp, holder.hp];

		await blastOf(8).play(caster, holder, ring, contestants);

		expect(holder.hp).to.equal(holderHp - 8);
		expect(caster.hp).to.equal(casterHp);
	});

	it('does not turn back the holder\'s own area attack, and stays up', async () => {
		await raise();
		const blast = blastOf(6);
		// A confused caster aiming at itself: Blast normally spares its own caster, so aim it by hand.
		sinon.stub(blast, 'getTargets').returns([holder]);
		const holderHp = holder.hp;

		await blast.play(holder, holder, ring, contestants);

		expect(holder.hp, 'a Blast at yourself is not aimed at you by someone else').to.equal(holderHp - 6);
		expect(isMirrorShielded(holder)).to.equal(true);
	});

	it('does nothing when the caster fell earlier in the same attack, and stays up', async () => {
		// Order [caster, bystander, holder]: the caster is struck down while reaching the bystander
		// (by something other than this shield), and the card still arrives at the holder.
		const order = [caster, bystander, holder].map(monster => ({ monster, character: {} }));
		await raise();
		const blast = blastOf(8);
		const holderHp = holder.hp;
		sinon.stub(bystander, 'hit').callsFake(async () => {
			caster.hp = 0;
			return true;
		});

		await blast.play(caster, bystander, ring, order);

		expect(holder.hp, 'the engine resolves it as before, no reflection to a fallen caster').to.equal(holderHp - 8);
		expect(isMirrorShielded(holder)).to.equal(true);
	});

	it('lets the reflection kill the caster, credits the holder, and spares the targets it had not reached', async () => {
		await raise();
		caster.hp = 3;
		const [holderHp, bystanderHp] = [holder.hp, bystander.hp];

		await blastOf(8).play(caster, holder, ring, contestants);

		expect(caster.dead).to.equal(true);
		expect(caster.killedBy).to.equal(holder);
		expect(holder.hp).to.equal(holderHp - 4);
		expect(bystander.hp, 'the blast ended with its caster').to.equal(bystanderHp);
	});

	it('does not stack: a second shield finds the first still raised and does nothing', async () => {
		await raise();
		await raise();
		expect(shields(holder)).to.equal(1);
		expect(narrations.join('\n')).to.include("Tor's shield is already raised.");

		const [casterHp, holderHp] = [caster.hp, holder.hp];
		await blastOf(8).play(caster, holder, ring, contestants);
		await blastOf(8).play(caster, holder, ring, contestants);

		// One reflection (4 / 4), then one full blast (8): a second shield never absorbs two attacks.
		expect(holder.hp).to.equal(holderHp - 4 - 8);
		expect(caster.hp).to.equal(casterHp - 4);
	});

	it('goes to the confused target when its player is confused', async () => {
		await listen(new MirrorShieldCard()).effect(caster, holder, ring);
		expect(isMirrorShielded(holder)).to.equal(true);
		expect(isMirrorShielded(caster)).to.equal(false);
		expect(narrations.join('\n')).to.include('In confusion, Nola holds a shield up for Tor.');
	});

	it('survives a JSON hydration round trip, and the encounter cleanup drops the shield', async () => {
		const restored = hydrateCard(JSON.parse(JSON.stringify(new MirrorShieldCard())));
		expect(restored).to.be.an.instanceof(MirrorShieldCard);

		await raise();
		holder.endEncounter?.();
		expect(isMirrorShielded(holder)).to.equal(false);
	});
});
