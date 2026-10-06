import { expect } from 'chai';
import sinon from 'sinon';

import { announceBossWillSpawn } from './bossWillSpawn.js';
import { announceCard } from './card-played.js';
import { announceCardDrop } from './cardDrop.js';
import { announceContestant } from './contestant.js';
import { announceContestantLeave } from './contestantLeave.js';
import { announceDeath } from './death.js';
import { announceEffect } from './effect.js';
import { announceEndOfDeck } from './endOfDeck.js';
import { announceFight } from './fight.js';
import { announceFightConcludes } from './fightConcludes.js';
import { announceHeal } from './heal.js';
import { announceHit } from './hit.js';
import { announceItem } from './item-used.js';
import { announceLeave } from './leave.js';
import { announceLevelUp } from './level-up.js';
import { announceMiss } from './miss.js';
import { announceModifier } from './modifier.js';
import { announceNarration } from './narration.js';
import { announceNextRound } from './nextRound.js';
import { announceNextTurn } from './nextTurn.js';
import { announceTurnBegin } from './playerTurnBegin.js';
import { announceRingEvent } from './ringEvent.js';
import { announceRolled } from './rolled.js';
import { announceStay } from './stay.js';
import { announceXPGain } from './xpGain.js';

/**
 * Golden `event.text` for every announcer, written as exact literals.
 *
 * Why this exists: `text` is a contract. Discord sends it verbatim and pacing sizes its
 * pauses from its length, while the structured `payload.lines` grew beside it. feed-lines.test.ts
 * only checks that `lines` agree with `text`, so nothing compared `text` itself to what
 * `main` printed, and a compound-roll text change (bug 237) slipped through review. If a
 * literal here fails, either `text` drifted by accident (fix the announcer) or it changed on
 * purpose: update the literal and say why in a comment beside it, as the three below do.
 *
 * Every literal was run against `origin/main`'s announcers with the same inputs. The only
 * ones that differ are marked "CHANGED FROM MAIN".
 *
 * Inputs are plain objects (no random monster stats) and Math.random is stubbed to 0, so the
 * adjective and hit verb drawn by helpers/flavor.ts are stable. Ring-flavour rotation is keyed
 * by the `ring` object, so each case passes a fresh one.
 */

type Published = { type: string; scope: string; text: string; targetUserId?: string };
type Expected = { type: string; scope: string; text: string };

function run(announce: (eb: any) => void): Published[] {
	const published: Published[] = [];
	announce({ publish: (event: Published) => published.push(event) });
	return published;
}

const pronouns = { he: 'he', him: 'him', his: 'his', verbSuffix: 's' };
const monster = (name: string, extra: Record<string, unknown> = {}): any => ({
	icon: '🐗',
	givenName: name,
	identity: `🐗 ${name}`,
	identityWithHp: `🐗 ${name} (30 hp)`,
	creatureType: 'Minotaur',
	individualDescription: 'A gray minotaur.',
	stats: 'Type: Minotaur\nClass: Barbarian',
	rankings: 'Fights: 9 · Won: 4',
	displayLevel: 'Level 3',
	pronouns,
	hp: 30,
	maxHp: 40,
	ac: 12,
	gender: 'male',
	...extra,
});
const character = { icon: '🦊', givenName: 'Ada', identity: '🦊 Ada', pronouns };
const card = {
	icon: '🃏', name: 'Hit', itemType: 'Hit', cardType: 'Hit', description: 'Hits.', stats: 'Hits hard.',
	probability: 50, level: 1, cardClass: ['Fighter'], permittedClassesAndTypes: ['Barbarian'],
};
const item = { icon: '🧪', itemType: 'Potion', description: 'Heals a little.', stats: 'Heals 5', probability: 50 };
const ringEvent: any = { id: 'blood-feud', name: 'Blood Feud', banner: '🩸  BLOOD FEUD — every monster fights for itself.' };
const d20 = { primaryDice: '1d20', naturalRoll: { result: 15 }, bonusResult: 2, modifier: 1, result: 18 };

const cases: Array<[string, () => Published[]]> = [
	['contestant: player entrance', () => run(eb => announceContestant(eb, 'Ring', {}, { contestant: { monster: monster('Bull'), isBoss: false, character } }))],
	['contestant: boss entrance', () => run(eb => announceContestant(eb, 'Ring', {}, { contestant: { monster: monster('Bull', { targetingStrategy: 'TARGET_LOWEST_HP_PLAYER' }), isBoss: true, character } }))],
	['contestantLeave: player', () => run(eb => announceContestantLeave(eb, 'Ring', {}, { contestant: { monster: monster('Bull'), isBoss: false, character } }))],
	['contestantLeave: boss', () => run(eb => announceContestantLeave(eb, 'Ring', {}, { contestant: { monster: monster('Bull'), isBoss: true, character } }))],
	['fight', () => run(eb => announceFight(eb, 'Ring', {}, { contestants: [{}, {}] }))],
	['nextRound', () => run(eb => announceNextRound(eb, 'Ring', {}, { round: 1 }))],
	['nextTurn', () => run(eb => announceNextTurn(eb, 'Ring', {}, { contestants: [{ monster: monster('Bull') }, { monster: monster('Cow', { hp: 32, maxHp: 32, identityWithHp: '🐄 Cow (32 hp)' }) }], round: 1, turn: 0 }))],
	['playerTurnBegin: first turn (full monster card)', () => run(eb => announceTurnBegin(eb, 'Ring', {}, { contestant: { monster: monster('Bull'), character } }))],
	['playerTurnBegin: repeat turn', () => {
		const m = monster('Bull');
		return run(eb => announceTurnBegin(eb, 'Ring', {}, { contestant: { monster: m, character, lastMonsterPlayed: m, team: 'Reds' } }));
	}],
	['card-played', () => run(eb => announceCard(eb, 'Hit', card, { player: monster('Bull') }))],
	['rolled: attack vs ac with outcome', () => run(eb => announceRolled(eb, 'Hit', {}, { who: character, reason: "vs Cow's ac (12) to determine if the hit was a success.", roll: d20, vs: 12, outcome: 'Hit!' }))],
	['rolled: stroke of luck', () => run(eb => announceRolled(eb, 'Hit', {}, { who: character, reason: 'r', roll: { ...d20, naturalRoll: { result: 20 }, result: 20, strokeOfLuck: true }, vs: 25 }))],
	['rolled: curse of Loki', () => run(eb => announceRolled(eb, 'Hit', {}, { who: character, reason: 'r', roll: { ...d20, naturalRoll: { result: 1 }, result: 1, curseOfLoki: true }, vs: 5 }))],
	['rolled: damage, nothing to beat', () => run(eb => announceRolled(eb, 'Hit', {}, { who: character, reason: 'for damage.', roll: { naturalRoll: { result: 4 }, bonusResult: 0, modifier: 0, result: 4 } }))],
	['rolled: result-only numeric roll', () => run(eb => announceRolled(eb, 'Hit', {}, { who: character, reason: 'for fun.', roll: { result: 7 } }))],
	// Blink's compound hp & xp roll: authored strings, not one total (bug 237).
	['rolled: compound Blink-style roll', () => run(eb => announceRolled(eb, 'Blink', {}, {
		who: character,
		reason: 'to steal potential energy from 🐗 Cow (30 hp).',
		roll: { primaryDice: '1d4 (hp) & 1d6 (xp)', result: '2 (hp) & 9 (xp)', naturalRoll: { result: '2 & 9' }, bonusResult: 0, modifier: 0 },
	}))],
	['hit: random verb (Math.random stubbed)', () => run(eb => announceHit(eb, 'Hit', monster('Cow'), { assailant: monster('Bull'), card: {}, damage: 7, prevHp: 37 }))],
	['hit: bloodied target', () => run(eb => announceHit(eb, 'Hit', monster('Cow', { hp: 5, bloodied: true, bloodiedValue: 20 }), { assailant: monster('Bull'), card: { flavors: { hits: [['hits', 100]] } }, damage: 7, prevHp: 12 }))],
	['miss: blocked', () => {
		const target = monster('Cow');
		return run(eb => announceMiss(eb, 'Hit', {}, { attackResult: 3, curseOfLoki: false, player: monster('Bull'), target }));
	}],
	['miss: barely blocked', () => run(eb => announceMiss(eb, 'Hit', {}, { attackResult: 9, curseOfLoki: false, player: monster('Bull'), target: monster('Cow') }))],
	['miss: curse of Loki', () => run(eb => announceMiss(eb, 'Hit', {}, { attackResult: 1, curseOfLoki: true, player: monster('Bull'), target: monster('Cow') }))],
	['miss: dead target', () => run(eb => announceMiss(eb, 'Hit', {}, { attackResult: 9, curseOfLoki: false, player: monster('Bull'), target: monster('Cow', { dead: true }) }))],
	['heal', () => run(eb => announceHeal(eb, { monsterIsInRing: () => true }, 'Heal', monster('Bull'), { amount: 4 }))],
	['death: destroyed', () => run(eb => announceDeath(eb, 'Ring', monster('Cow'), { assailant: monster('Bull'), destroyed: true }))],
	['death: killed', () => run(eb => announceDeath(eb, 'Ring', monster('Cow'), { assailant: monster('Bull'), destroyed: false }))],
	['leave', () => {
		const a = monster('Bull');
		return run(eb => announceLeave(eb, 'Flee', a, { activeContestants: [{ monster: a }, { monster: monster('Cow') }, { monster: monster('Ox') }] }));
	}],
	['stay: failed flee', () => {
		const a = monster('Bull');
		return run(eb => announceStay(eb, 'Flee', a, { fleeRoll: {}, player: a, activeContestants: [{ monster: a }, { monster: monster('Cow') }] }));
	}],
	['stay: bravely stays', () => {
		const a = monster('Bull');
		return run(eb => announceStay(eb, 'Flee', a, { player: a, activeContestants: [{ monster: a }] }));
	}],
	['fightConcludes: single winner', () => run(eb => announceFightConcludes(eb, 'Ring', {}, { deaths: 1, isDraw: false, rounds: 1, winners: [{ monsterName: 'Bull', team: null }] }))],
	['fightConcludes: team win', () => run(eb => announceFightConcludes(eb, 'Ring', {}, { deaths: 2, isDraw: false, rounds: 3, winners: [{ monsterName: 'Bull', team: 'Reds' }, { monsterName: 'Cow', team: 'Reds' }] }))],
	['fightConcludes: draw', () => run(eb => announceFightConcludes(eb, 'Ring', {}, { deaths: 0, isDraw: true, rounds: 2 }))],
	['xpGain', () => run(eb => announceXPGain(eb, 'Ring', {}, { contestant: { userId: 'u1' }, creature: monster('Bull'), xpGained: 12, killed: [1], coinsGained: 3, reasons: 'First blood.' }))],
	['cardDrop', () => run(eb => announceCardDrop(eb, 'Ring', {}, { contestant: { monster: monster('Bull'), character, userId: 'u1' }, card }))],
	['narration', () => run(eb => announceNarration(eb, 'Ring', {}, { narration: 'A cold wind crosses the sand.' }))],
	['effect', () => run(eb => announceEffect(eb, 'Curse', {}, { player: monster('Bull'), target: monster('Cow'), effectResult: 'cursed by', narration: 'It stings.' }))],
	['modifier', () => run(eb => announceModifier(eb, 'Boost', monster('Bull', { ac: 14, encounterModifiers: { ac: 2 } }), { amount: 2, attr: 'ac', prevValue: 12 }))],
	['item-used', () => run(eb => announceItem(eb, 'Item', item, { character, monster: monster('Bull') }))],
	['endOfDeck', () => run(eb => announceEndOfDeck(eb, 'Ring', {}, { contestant: { monster: monster('Bull') } }))],
	['level-up', () => run(eb => announceLevelUp(eb, monster('Bull'), 3))],
	['bossWillSpawn', () => run(eb => announceBossWillSpawn(eb, 'Ring', {}, { delay: 60000 }))],
	['ringEvent', () => run(eb => announceRingEvent(eb, 'Ring', {}, { ringEvent }))],
];

const EXPECTED: Record<string, Expected[]> = {
	// CHANGED FROM MAIN (roadmap 46 task 9, ring-flavour.ts): the player entrance sentence on the second line is new; main printed only the arrival line and the card.
	"contestant: player entrance": [
		{ type: "ring.add", scope: "public", text: "A fierce Minotaur answers the call of 🦊 Ada.\nBull lowers his horns. The way in was easy. The way out is somebody else's problem.\n\n```\n==================================\n 🐗  Bull\n----------------------------------\n\n A gray minotaur.\n\n Type: Minotaur\n Class: Barbarian\n\n Fights: 9 · Won: 4\n\n==================================\n```\n" },
	],
	// CHANGED FROM MAIN (roadmap 46 task 9, ring-flavour.ts): the boss entrance sentence on the second line is new; main printed only the arrival line, temperament and card.
	"contestant: boss entrance": [
		{ type: "ring.add", scope: "public", text: "A fierce Minotaur enters the ring, sent by the house (👑 The Editor). He picks on whoever looks weakest.\nBull stamps into the ring. Half bull, all temper.\n\n```\n==================================\n 🐗  Bull\n----------------------------------\n\n A gray minotaur.\n\n Type: Minotaur\n Class: Barbarian\n\n Fights: 9 · Won: 4\n\n==================================\n```\n" },
	],
	"contestantLeave: player": [
		{ type: "ring.remove", scope: "public", text: "Bull is called back from the ring by 🦊 Ada." },
	],
	"contestantLeave: boss": [
		{ type: "ring.remove", scope: "public", text: "Bull is recalled to the gates by 👑 The Editor." },
	],
	"fight": [
		{ type: "ring.fight", scope: "public", text: "\n________________________________________\n^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^\n2 contestants stand tall under the laudations and hissing jeers of a roaring crowd.\n\n⚔︎ Let the games begin! ⚔︎\n" },
	],
	// CHANGED FROM MAIN (roadmap 46 task 9, ring-flavour.ts): the round beat sentence is new; main printed only the round banner.
	"nextRound": [
		{ type: "announce", scope: "public", text: "\n--------------------\n🏁  round 2\nThe crowd settles. The sand does not.\n" },
	],
	"nextTurn": [
		{ type: "announce", scope: "public", text: "\n🎲  round 1, turn 1\n\n🐗 Bull (30 hp) vs 🐄 Cow (32 hp)\n\n" },
	],
	"playerTurnBegin: first turn (full monster card)": [
		{ type: "announce", scope: "public", text: "*It's Ada's turn. Bull plays the next card in his deck.*\n\n🦊 Ada plays the following monster:\n\n```\n==================================\n 🐗  Bull\n----------------------------------\n\n A gray minotaur.\n\n Type: Minotaur\n Class: Barbarian\n\n Fights: 9 · Won: 4\n\n==================================\n```\n" },
	],
	"playerTurnBegin: repeat turn": [
		{ type: "announce", scope: "public", text: "*It's Ada's turn. Bull plays the next card in his deck.*\n\n🐗 Bull — 30/40 hp · ac 12 · Level 3 · Reds" },
	],
	"card-played": [
		{ type: "card.played", scope: "public", text: "🐗 Bull lays down the following card:\n\n```\n==================================\n 🃏  Hit  •\n----------------------------------\n\n Hits.\n\n==================================\n```\n" },
	],
	"rolled: attack vs ac with outcome": [
		{ type: "announce", scope: "public", text: "Ada rolled _15 +2 +1 on 1d20_ vs Cow's ac (12) to determine if the hit was a success.\n🎲 *18 v 12*\n    Hit!\n " },
	],
	"rolled: stroke of luck": [
		{ type: "announce", scope: "public", text: "Ada rolled _20 +2 +1 on 1d20_ r\n🎲 *Nat 20! v 25*\n " },
	],
	"rolled: curse of Loki": [
		{ type: "announce", scope: "public", text: "Ada rolled _1 +2 +1 on 1d20_ r\n🎲 *Crit Fail! v 5*\n " },
	],
	"rolled: damage, nothing to beat": [
		{ type: "announce", scope: "public", text: "Ada rolled _4_ for damage.\n🎲 *4*\n " },
	],
	"rolled: result-only numeric roll": [
		{ type: "announce", scope: "public", text: "Ada rolled _7_ for fun.\n🎲 *7*\n " },
	],
	// CHANGED FROM MAIN (10b #237): the roll line prints the authored dice (`2 & 9`); main printed `_0 on ..._` after a failed number conversion.
	"rolled: compound Blink-style roll": [
		{ type: "announce", scope: "public", text: "Ada rolled _2 & 9 on 1d4 (hp) & 1d6 (xp)_ to steal potential energy from 🐗 Cow (30 hp).\n🎲 *2 (hp) & 9 (xp)*\n " },
	],
	"hit: random verb (Math.random stubbed)": [
		{ type: "announce", scope: "public", text: "🐗 🔪 🐗  Bull slices Cow for 7 damage.\n\n🐗 *Cow has 30HP.*\n" },
	],
	"hit: bloodied target": [
		{ type: "announce", scope: "public", text: "🐗 🔪 🐗  Bull hits Cow for 7 damage.\n\n🐗 *Cow has only 5HP.*\n" },
	],
	"miss: blocked": [
		{ type: "announce", scope: "public", text: "🐗 🛡 🐗    Bull is blocked by Cow \n" },
	],
	"miss: barely blocked": [
		{ type: "announce", scope: "public", text: "🐗 ⚔️ 🐗    Bull is barely blocked by Cow \n" },
	],
	"miss: curse of Loki": [
		{ type: "announce", scope: "public", text: "🐗 💨 🐗    Bull misses Cow horribly\n" },
	],
	"miss: dead target": [
		{ type: "announce", scope: "public", text: "🐗 🙇‍ 🐗    Bull stops mercilessly beating the dead body of Cow \n" },
	],
	"heal": [
		{ type: "announce", scope: "public", text: "🐗 💊 Bull healed 4 hp and has *30 hp*." },
	],
	"death: destroyed": [
		{ type: "announce", scope: "public", text: "In accordance with XinWey's Doctrine: A person needs to experience real danger or they will never find joy in excelling. There has to be a risk of failure, the chance to die.\nAs such, 🐗 Cow (30 hp) has been sent to the land of his ancestors by 🐗 Bull (30 hp)\nSo it is written. So it is done.\n☠️  R.I.P 🐗 Cow\n" },
	],
	"death: killed": [
		{ type: "announce", scope: "public", text: "💀  🐗 Cow (30 hp) is killed by 🐗 Bull (30 hp)\n" },
	],
	"leave": [
		{ type: "ring.fled", scope: "public", text: "🐗 Bull (30 hp) flees from 🐗 Cow (30 hp) and 🐗 Ox (30 hp)\n" },
	],
	"stay: failed flee": [
		{ type: "announce", scope: "public", text: "🐗 Bull (30 hp) tries to flee from 🐗 Cow (30 hp), but fails!" },
	],
	"stay: bravely stays": [
		{ type: "announce", scope: "public", text: "🐗 Bull (30 hp) bravely stays in the ring." },
	],
	"fightConcludes: single winner": [
		{ type: "announce", scope: "public", text: "🏆 Bull wins!\nThe fight concluded with 1 dead after 1 round!\n\n≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡\n" },
	],
	"fightConcludes: team win": [
		{ type: "announce", scope: "public", text: "🏆 Reds wins! (Bull, Cow)\nThe fight concluded with 2 dead after 3 rounds!\n\n≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡\n" },
	],
	"fightConcludes: draw": [
		{ type: "announce", scope: "public", text: "The fight concluded in a draw after 2 rounds!\n\n≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡≡\n" },
	],
	"xpGain": [
		{ type: "ring.xp", scope: "private", text: "🐗 Bull gained 12 XP for killing 1 monster. and 3 coins\n\nFirst blood." },
	],
	"cardDrop": [
		{ type: "ring.cardDrop", scope: "private", text: "🐗 Bull finds a card for 🦊 Ada in the dust of the ring:\n\n\n```\n==================================\n 🃏  Hit  •\n----------------------------------\n\n Hits.\n\n Hits hard.\n\n Level: 1\n Usable by: Barbarian\n MSRP: free\n Class: Fighter\n\n==================================\n```\n" },
		{ type: "ring.cardDrop", scope: "public", text: "🐗 Bull finds a card for 🦊 Ada in the dust of the ring:\n\n\n```\n==================================\n 🃏  Hit  •\n----------------------------------\n\n Hits.\n\n Hits hard.\n\n Level: 1\n Usable by: Barbarian\n MSRP: free\n Class: Fighter\n\n==================================\n```\n" },
	],
	"narration": [
		{ type: "announce", scope: "public", text: "A cold wind crosses the sand." },
	],
	"effect": [
		{ type: "announce", scope: "public", text: "🐗 Cow is currently cursed by 🐗 Bull. It stings.\n" },
	],
	"modifier": [
		{ type: "announce", scope: "public", text: "🐗 Bull's ac is now 14 (increased by 2)" },
	],
	"item-used": [
		{ type: "announce", scope: "public", text: "🦊 Ada uses the following item on Bull:\n\n```\n==================================\n 🧪  Potion  •\n----------------------------------\n\n Heals a little.\n\n Heals 5\n\n Level: Beginner\n Usable by: All\n MSRP: free\n\n==================================\n```\n" },
	],
	"endOfDeck": [
		{ type: "announce", scope: "public", text: "🐗 Bull is out of cards." },
	],
	"level-up": [
		{ type: "announce", scope: "public", text: "🎉 🐗  **Bull** has reached level 3! (Level 3)" },
	],
	"bossWillSpawn": [
		{ type: "announce", scope: "public", text: "A boss will enter the ring in 1 minute." },
	],
	"ringEvent": [
		{ type: "announce", scope: "public", text: "🩸  BLOOD FEUD — every monster fights for itself." },
	],
};

describe('announcement text goldens (event.text is a contract)', () => {
	let clock: sinon.SinonFakeTimers;
	beforeEach(() => {
		sinon.stub(Math, 'random').returns(0);
		// Date.now() feeds bossWillSpawn's "in N minutes" wording.
		clock = sinon.useFakeTimers({ now: 1_700_000_000_000, toFake: ['Date'] });
	});
	afterEach(() => { clock.restore(); sinon.restore(); });

	it('covers every case with a literal, and every literal with a case', () => {
		expect(Object.keys(EXPECTED).sort()).to.deep.equal(cases.map(([name]) => name).sort());
	});

	for (const [name, call] of cases) {
		it(name, () => {
			const got: Expected[] = call().map(({ type, scope, text }) => ({ type, scope, text }));
			if (process.env.GOLDEN_DUMP) console.log(`GOLDEN ${JSON.stringify({ name, got })}`);
			expect(got).to.deep.equal(EXPECTED[name]);
		});
	}
});
