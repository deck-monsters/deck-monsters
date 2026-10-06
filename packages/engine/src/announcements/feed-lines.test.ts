import { expect } from 'chai';
import sinon from 'sinon';

import Game from '../game.js';
import { createTestChannel, noopStateStore } from '../testing/index.js';
import Basilisk from '../monsters/basilisk.js';
import Gladiator from '../monsters/gladiator.js';
import HitCard from '../cards/hit.js';
import BlastCard from '../cards/blast.js';
import { FireBreathCard } from '../cards/fire-breath.js';
import { HelmOfAweCard } from '../cards/helm-of-awe.js';
import Dragon from '../monsters/dragon.js';
import allMonsters from '../monsters/helpers/all.js';
import { playerEntrance, ROUND_BEATS } from './ring-flavour.js';
import { DelayedHit } from '../cards/delayed-hit.js';
import { TARGET_LOWEST_HP_PLAYER } from '../helpers/targeting-strategies.js';
import { formatCardLine, itemCardLine, monsterCardLine, monsterTurnFeedLine } from '../helpers/card.js';
import { announceContestant } from './contestant.js';
import { announceBossWillSpawn } from './bossWillSpawn.js';
import { announceCardDrop } from './cardDrop.js';
import { announceContestantLeave } from './contestantLeave.js';
import { announceDeath } from './death.js';
import { announceEffect } from './effect.js';
import { announceEndOfDeck } from './endOfDeck.js';
import { announceFight } from './fight.js';
import { announceFightConcludes } from './fightConcludes.js';
import { announceHeal } from './heal.js';
import { announceItem } from './item-used.js';
import { announceLeave } from './leave.js';
import { announceLevelUp } from './level-up.js';
import { announceModifier } from './modifier.js';
import { announceRingEvent } from './ringEvent.js';
import { announceStay } from './stay.js';
import { announceXPGain } from './xpGain.js';
import { announceHit } from './hit.js';
import { announceMiss } from './miss.js';
import { announceNextRound } from './nextRound.js';
import { announceNextTurn } from './nextTurn.js';
import { announceRolled } from './rolled.js';
import type { FeedLine, GameEvent } from '../events/types.js';

type Published = { type: string; scope: string; text: string; payload: Record<string, any> };

function capture() {
	const published: Published[] = [];
	return {
		eb: { publish: (event: Published) => published.push(event) } as any,
		published,
	};
}

const linesOf = (event: Published): FeedLine[] => event.payload.lines as FeedLine[];

/**
 * The layout `lines` leaves out of `text`: code fences, ASCII rules and blank lines, with
 * every remaining line trimmed. A rule is four or more of one rule character.
 */
const RULE = /^([=\-_^≡#])\1{3,}$/;
const cleanLines = (text: string): string[] =>
	text
		.split('\n')
		.map(line => line.trim())
		.filter(line => line !== '' && line !== '```' && !RULE.test(line));

const FEED_TYPES = new Set([
	'announce',
	'card.played',
	'ring.add',
	'ring.remove',
	'ring.fight',
	'ring.fightResolved',
	'ring.fled',
	'ring.win',
	'ring.loss',
	'ring.draw',
	'ring.permaDeath',
	'ring.xp',
	'ring.cardDrop',
]);

/**
 * The contract between an event's `text` and its `lines`, checked line by line: every line is
 * clean (single line unless a card, no layout whitespace, no rules or fences), the lines
 * are plain JSON, and they are exactly `text` with layout removed. Two splits are allowed
 * because a text line holds two facts: a boss's temperament follows its arrival sentence, and
 * the turn banner's roster line is "A vs B".
 */
function expectLinesMatchText(event: Pick<Published, 'type' | 'text' | 'payload'>): FeedLine[] {
	const lines = event.payload.lines as FeedLine[] | undefined;
	const label = `${event.type}: ${JSON.stringify(event.text)}`;
	expect(lines, `no lines on ${label}`).to.be.an('array').that.is.not.empty;

	for (const line of lines!) {
		expect(line.text, `${line.kind} text`).to.be.a('string').and.not.equal('');
		if (line.kind !== 'card') expect(line.text, `${line.kind} spans lines`).to.not.include('\n');
		for (const inner of line.text.split('\n')) {
			expect(inner, `${line.kind} has layout whitespace`).to.equal(inner.trim()).and.not.equal('');
			expect(inner).to.not.match(RULE);
			expect(inner).to.not.include('```');
		}
	}

	const expected = cleanLines(event.text);
	for (const line of lines!) {
		if (line.kind !== 'temperament') continue;
		const at = expected.findIndex(text => text.endsWith(` ${line.text}`));
		if (at >= 0) expected.splice(at, 1, expected[at]!.slice(0, -line.text.length - 1), line.text);
	}
	const turnAt = lines!.findIndex(line => line.kind === 'turn');
	if (turnAt >= 0) {
		const rosterAt = expected.findIndex(text => text.includes(' vs '));
		const standings = lines!.filter(line => line.kind === 'standing').length;
		if (rosterAt >= 0 && standings > 1) expected.splice(rosterAt, 1, ...expected[rosterAt]!.split(' vs '));
	}
	const actual = lines!.flatMap(line => line.text.split('\n'));
	expect(actual, `lines drifted from text of ${label}`).to.deep.equal(expected);

	expect(JSON.parse(JSON.stringify(lines))).to.deep.equal(lines);
	return lines!;
}

describe('feed lines (payload.lines)', () => {
	describe('consistency with text over simulated fights', () => {
		async function simulate(championHp: number, bossCards: () => any[]): Promise<GameEvent[]> {
			const previousSkip = process.env.DECK_MONSTERS_SKIP_DELAYS;
			process.env.DECK_MONSTERS_SKIP_DELAYS = '1';
			const game = new Game({ roomId: `feed-lines-room-${championHp}`, spawnBosses: false }, () => 0);
			game.stateStore = noopStateStore;
			try {
				const events: GameEvent[] = [];
				const publish = game.eventBus.publish.bind(game.eventBus);
				(game.eventBus as any).publish = (event: any) => {
					const full = publish(event);
					events.push(full);
					return full;
				};

				const channel = createTestChannel(game.eventBus, 'user-a');
				const player = await game.getCharacter({ channel: channel.fn, id: 'user-a', name: 'Ada', gender: 'female', icon: '🦊' });
				const champion = new Basilisk({ name: 'Champion' });
				champion.cards = Array.from({ length: 9 }, () => new HitCard()) as any;
				player.addMonster(champion);
				await player.sendMonsterToTheRing({ ring: game.ring, channel: channel.fn, channelName: 'ring', userId: 'user-a' });

				const boss: any = game.ring.spawnBoss();
				boss.monster.cards = bossCards();
				champion.hp = championHp;

				await (game.ring as any).fight();
				return events;
			} finally {
				game.dispose();
				if (previousSkip === undefined) delete process.env.DECK_MONSTERS_SKIP_DELAYS;
				else process.env.DECK_MONSTERS_SKIP_DELAYS = previousSkip;
			}
		}

		// Private `announce` and `ring.remove` events are command replies to one player ("The
		// ring is empty."), not fight-feed lines, and are deliberately left without `lines`.
		const feedOf = (events: GameEvent[]) =>
			events.filter(e => FEED_TYPES.has(e.type) && !(e.scope === 'private' && ['announce', 'ring.remove'].includes(e.type)));

		it('gives every feed event of a won fight lines that say exactly what its text says', async function () {
			this.timeout(60000);
			const events = await simulate(200, () => [new BlastCard(), new DelayedHit(), ...Array.from({ length: 7 }, () => new HitCard())]);
			const feed = feedOf(events);
			expect(feed.length).to.be.greaterThan(20);

			const kinds = new Set<string>();
			for (const event of feed) for (const line of expectLinesMatchText(event)) kinds.add(line.kind);

			for (const kind of ['arrival', 'card', 'turn', 'standing', 'turn-begin', 'play', 'roll', 'hit', 'hp', 'fight-end']) {
				expect(kinds.has(kind), `no ${kind} line in the fight`).to.equal(true);
			}
		});

		it('does the same when the player loses (ring.loss / ring.permaDeath, the death lines)', async function () {
			this.timeout(60000);
			const events = await simulate(1, () => Array.from({ length: 9 }, () => new HitCard()));
			const feed = feedOf(events);
			const types = new Set(feed.map(e => e.type));
			expect(types.has('ring.loss') || types.has('ring.permaDeath')).to.equal(true);
			const kinds = new Set<string>();
			for (const event of feed) for (const line of expectLinesMatchText(event)) kinds.add(line.kind);
			expect(kinds.has('death')).to.equal(true);
		});
	});

	describe('announcers the fights do not reach', () => {
		const gladiator = (name: string) => new Gladiator({ name, hpVariance: 0, acVariance: 0 });
		const run = (announce: (eb: any) => void): FeedLine[] => {
			const { eb, published } = capture();
			announce(eb);
			expect(published, 'publishes exactly once').to.have.lengthOf(1);
			return expectLinesMatchText(published[0]!);
		};

		it('a doctrine death and an ordinary one', () => {
			const monster = gladiator('victim');
			const assailant = gladiator('slayer');
			const destroyed = run(eb => announceDeath(eb, '', monster, { assailant, destroyed: true }));
			expect(destroyed.map(l => l.kind)).to.deep.equal(['narration', 'death', 'narration', 'system']);
			expect(destroyed[1]).to.include({ name: 'Victim', by: 'Slayer', destroyed: true });

			const killed = run(eb => announceDeath(eb, '', monster, { assailant, destroyed: false }));
			expect(killed[0]).to.include({ kind: 'death', destroyed: false });
		});

		it('flee, a failed flee and staying', () => {
			const a = gladiator('runner');
			const b = gladiator('chaser');
			const activeContestants = [{ monster: a }, { monster: b }];
			expect(run(eb => announceLeave(eb, '', a, { activeContestants }))[0]).to.include({ kind: 'flee', name: 'Runner' });
			expect(run(eb => announceStay(eb, '', a, { fleeRoll: {}, player: a, activeContestants }))[0]).to.include({ kind: 'system', name: 'Runner' });
			expect(run(eb => announceStay(eb, '', a, { player: a, activeContestants }))[0]!.text).to.include('bravely stays');
		});

		it('an item use, with its card', () => {
			const item = { icon: '🧪', itemType: 'Potion', description: 'Heals a little.', stats: 'Heals 5', probability: 50 };
			const character = { identity: '🦊 Ada', givenName: 'Ada', pronouns: { him: 'him' } };
			const lines = run(eb => announceItem(eb, '', item, { character, monster: gladiator('target') }));
			expect(lines.map(l => l.kind)).to.deep.equal(['item', 'card']);
			expect(lines[0]).to.include({ actor: 'Ada', target: 'Target' });
		});

		it('level-up, boss-soon, ring event and end of deck', () => {
			const monster = gladiator('rising');
			expect(run(eb => announceLevelUp(eb, monster, 3))[0]).to.include({ kind: 'level-up', name: 'Rising', level: 3 });
			expect(run(eb => announceBossWillSpawn(eb, '', {}, { delay: 60000 }))[0]).to.include({ kind: 'boss-soon', delay: 60000 });
			const ringEvent: any = { id: 'blood-feud', name: 'Blood Feud', banner: '🩸  BLOOD FEUD — every monster fights for itself.' };
			expect(run(eb => announceRingEvent(eb, '', {}, { ringEvent }))[0]).to.include({ kind: 'ring-event', id: 'blood-feud', name: 'Blood Feud' });
			expect(run(eb => announceEndOfDeck(eb, '', {}, { contestant: { monster } }))[0]).to.include({ kind: 'end-of-deck', name: 'Rising' });
		});

		it('an effect (with multi-line narration) and a modifier', () => {
			const player = gladiator('caster');
			const target = gladiator('victim');
			const lines = run(eb => announceEffect(eb, '', {}, { player, target, effectResult: 'cursed by', narration: 'It stings.\nAgain.' }));
			expect(lines.map(l => l.kind)).to.deep.equal(['effect', 'narration']);
			expect(lines[0]).to.include({ target: 'Victim', source: 'Caster' });

			const monster: any = { identity: '🐍 Snake', givenName: 'Snake', ac: 12, encounterModifiers: { ac: 2 }, pronouns: { his: 'his' } };
			expect(run(eb => announceModifier(eb, '', monster, { amount: 2, attr: 'ac', prevValue: 10 }))[0]).to.include({
				kind: 'modifier', name: 'Snake', attr: 'ac', amount: 2, value: 12,
			});
		});

		it('a heal, and a contestant leaving', () => {
			const monster = gladiator('patient');
			const ring = { monsterIsInRing: () => true };
			expect(run(eb => announceHeal(eb, ring, '', monster, { amount: 4 }))[0]).to.include({ kind: 'heal', name: 'Patient', amount: 4, hp: monster.hp });

			const character = { identity: '🦊 Ada', givenName: 'Ada' };
			expect(run(eb => announceContestantLeave(eb, '', {}, { contestant: { character, monster, isBoss: false } }))[0]).to.include({ kind: 'system', name: 'Patient', boss: false });
			expect(run(eb => announceContestantLeave(eb, '', {}, { contestant: { character, monster, isBoss: true } }))[0]).to.include({ boss: true });
		});

		it('a curse-of-Loki miss, a summon, xp, a card drop and the fight banner', () => {
			const player = gladiator('swinger');
			const target = gladiator('dodger');
			const cursed = run(eb => announceMiss(eb, '', {}, { attackResult: 1, curseOfLoki: true, player, target }));
			expect(cursed[0]).to.include({ kind: 'miss', blocked: false });

			const xp = run(eb => announceXPGain(eb, '', {}, { contestant: { userId: 'u' }, creature: player, xpGained: 12, killed: [1], coinsGained: 3, reasons: 'First blood.\nAgain.' }));
			expect(xp.map(l => l.kind)).to.deep.equal(['xp', 'narration', 'narration']);
			expect(xp[0]).to.include({ xp: 12, coins: 3, killed: 1 });

			const { eb, published } = capture();
			announceCardDrop(eb, '', {}, { contestant: { monster: player, character: { identity: '🦊 Ada' }, userId: 'u' }, card: { icon: '🃏', itemType: 'Hit', cardType: 'Hit', description: 'Hits.', probability: 50 } });
			expect(published).to.have.lengthOf(2);
			for (const event of published) expectLinesMatchText(event);

			const fight = run(eb => announceFight(eb, '', {}, { contestants: [{}, {}] }));
			expect(fight.map(l => l.kind)).to.deep.equal(['fight-start', 'fight-start']);

			const conclude = run(eb => announceFightConcludes(eb, '', {}, { deaths: 1, isDraw: false, rounds: 2, winners: [{ monsterName: 'A', team: 'T' }, { monsterName: 'B', team: 'T' }] }));
			expect(conclude[0]).to.include({ kind: 'win' });
		});

		it('a repeat monster turn line, with no made-up hp', () => {
			const withHp = monsterTurnFeedLine({ icon: '🐗', givenName: 'Boar', hp: 10, maxHp: 20, ac: 5, displayLevel: 'L2' }, 'Reds');
			expect(withHp).to.deep.equal({ kind: 'standing', text: '🐗 Boar — 10/20 hp · ac 5 · L2 · Reds', name: 'Boar', hp: 10, maxHp: 20, ac: 5, level: 'L2', team: 'Reds' });
			const noHp = monsterTurnFeedLine({ icon: '🐗', givenName: 'Boar' });
			expect(noHp).to.not.have.property('hp');
			expect(noHp).to.not.have.property('maxHp');
		});
	});

	describe('rolls', () => {
		const roll = (opts: Parameters<typeof announceRolled>[3]) => {
			const { eb, published } = capture();
			announceRolled(eb, 'Card', {}, opts);
			return linesOf(published[0]!);
		};
		const who = { givenName: 'Ada' };

		it('carries natural, bonus, total, vs and a success verdict', () => {
			const [line, verdict, outcome] = roll({
				who,
				reason: 'vs Bob\'s ac (12) to determine if the hit was a success.',
				roll: { naturalRoll: { result: 15 }, bonusResult: 2, modifier: 1, result: 18, primaryDice: '1d20' },
				vs: 12,
				outcome: 'Hit!',
			});
			expect(line).to.include({ kind: 'roll', who: 'Ada', die: '1d20', natural: 15, bonus: 3, total: 18, vs: 12, result: 'success' });
			expect(line!.text).to.equal("Ada rolled _15 +2 +1 on 1d20_ vs Bob's ac (12) to determine if the hit was a success.");
			expect(verdict).to.include({ kind: 'verdict', text: '🎲 *18 v 12*', total: 18, vs: 12, result: 'success' });
			expect(outcome).to.deep.equal({ kind: 'outcome', text: 'Hit!' });
		});

		it('fails a roll that does not beat vs (a tie goes to the defender)', () => {
			const [line] = roll({ who, reason: 'r', roll: { naturalRoll: { result: 10 }, bonusResult: 2, modifier: 0, result: 12 }, vs: 12 });
			expect(line).to.include({ result: 'fail', total: 12, vs: 12 });
		});

		it('reports a stroke of luck as nat20 and a curse of Loki as nat1', () => {
			const [lucky, luckyVerdict] = roll({ who, reason: 'r', roll: { naturalRoll: { result: 20 }, bonusResult: 0, modifier: 0, result: 20, strokeOfLuck: true }, vs: 25 });
			expect(lucky).to.include({ result: 'nat20', natural: 20 });
			expect(luckyVerdict!.text).to.equal('🎲 *Nat 20! v 25*');

			const [cursed, cursedVerdict] = roll({ who, reason: 'r', roll: { naturalRoll: { result: 1 }, bonusResult: 0, modifier: 0, result: 1, curseOfLoki: true }, vs: 5 });
			expect(cursed).to.include({ result: 'nat1', natural: 1 });
			expect(cursedVerdict!.text).to.equal('🎲 *Crit Fail! v 5*');
		});

		it('leaves vs off a roll with nothing to beat', () => {
			const [line, verdict] = roll({ who, reason: 'for damage.', roll: { naturalRoll: { result: 4 }, bonusResult: 0, modifier: 0, result: 4 } });
			expect(line).to.not.have.property('vs');
			expect(verdict).to.not.have.property('vs');
			expect(line).to.include({ result: 'success', total: 4 });
		});
	});

	describe('hits, hp and misses', () => {
		it('puts the damage on the hit and the bloodied state on the hp line', () => {
			const { eb, published } = capture();
			const monster = new Gladiator({ name: 'monster', hpVariance: 0, acVariance: 0 });
			const assailant = new Gladiator({ name: 'assailant', hpVariance: 0, acVariance: 0 });
			const prevHp = monster.hp;
			monster.hp = 5;

			announceHit(eb, 'Monster', monster, { assailant, card: { flavors: { hits: [['hits', 100]] } }, damage: 7, prevHp });
			const [hit, hp, ...rest] = linesOf(published[0]!);

			expect(rest).to.deep.equal([]);
			expect(hit).to.include({ kind: 'hit', assailant: 'Assailant', target: 'Monster', damage: 7 });
			expect(hp).to.include({ kind: 'hp', name: 'Monster', hp: 5, bloodied: true });
			expect(hp!.text).to.include('is now bloodied. Monster has only 5HP.');
		});

		it('keeps a healthy target out of the bloodied state', () => {
			const { eb, published } = capture();
			const monster = new Gladiator({ name: 'monster', hpVariance: 0, acVariance: 0 });
			const assailant = new Gladiator({ name: 'assailant', hpVariance: 0, acVariance: 0 });
			announceHit(eb, 'Monster', monster, { assailant, card: { flavors: { hits: [['hits', 100]] } }, damage: 2, prevHp: monster.hp + 2 });

			expect(linesOf(published[0]!)[1]).to.include({ kind: 'hp', bloodied: false, hp: monster.hp });
		});

		it('marks a block as blocked and a curse miss as not', () => {
			const { eb, published } = capture();
			const player = new Gladiator({ name: 'player', hpVariance: 0, acVariance: 0 });
			const target = new Gladiator({ name: 'target', hpVariance: 0, acVariance: 0 });

			announceMiss(eb, 'Card', {}, { attackResult: 3, curseOfLoki: false, player, target });
			announceMiss(eb, 'Card', {}, { attackResult: 3, curseOfLoki: true, player, target });

			expect(linesOf(published[0]!)[0]).to.include({ kind: 'miss', assailant: 'Player', target: 'Target', blocked: true });
			expect(linesOf(published[0]!)[0]!.text).to.include('is blocked by Target');
			expect(linesOf(published[1]!)[0]).to.include({ kind: 'miss', blocked: false });
		});
	});

	describe('round and turn banners', () => {
		it('numbers the round banner from 1: the round about to begin', () => {
			const { eb, published } = capture();
			announceNextRound(eb, 'Ring', {}, { round: 1 });

			expect(published[0]!.text).to.include('round 2');
			expect(expectLinesMatchText(published[0]!)).to.deep.equal([
				{ kind: 'round', text: '🏁  round 2', round: 2 },
				{ kind: 'narration', text: ROUND_BEATS[0] },
			]);
		});

		// The ring starts its round counter at 1 and passes it through unchanged, so the turn
		// banner prints it as-is (the turn is the 0-based card index and prints `+ 1`).
		it('numbers the turn banner from round 1, turn 1, with a standing line per contestant', () => {
			const { eb, published } = capture();
			const a = { monster: { identityWithHp: '🐍 Killer (35 hp)', givenName: 'Killer', hp: 35, maxHp: 40 } };
			const b = { monster: { identityWithHp: '🌟 Blood (32 hp)', givenName: 'Blood', hp: 32, maxHp: 32 } };
			announceNextTurn(eb, 'Ring', {}, { contestants: [a, b], round: 1, turn: 0 });

			expect(published[0]!.text).to.include('round 1, turn 1');
			expect(linesOf(published[0]!)).to.deep.equal([
				{ kind: 'turn', text: '🎲  round 1, turn 1', round: 1, turn: 1 },
				{ kind: 'standing', text: '🐍 Killer (35 hp)', name: 'Killer', hp: 35, maxHp: 40 },
				{ kind: 'standing', text: '🌟 Blood (32 hp)', name: 'Blood', hp: 32, maxHp: 32 },
			]);
		});
	});

	describe('card frames', () => {
		it('is the frame body without fences or rules, with the title and icon as fields', () => {
			const line = monsterCardLine({
				icon: '🐗',
				givenName: 'Seeskane Orcbane',
				individualDescription: 'A gray minotaur.',
				stats: 'Type: Minotaur\nClass: Barbarian',
				rankings: 'Fights: 95 · Won: 65',
			});

			expect(line).to.include({ kind: 'card', title: 'Seeskane Orcbane', icon: '🐗' });
			const text = (line as { text: string }).text;
			expect(text.split('\n')[0]).to.equal('🐗  Seeskane Orcbane');
			expect(text).to.include('A gray minotaur.');
			expect(text).to.include('Class: Barbarian');
			expect(text).to.include('Fights: 95 · Won: 65');
			expect(text).to.not.match(/===|---|```/);
			for (const inner of text.split('\n')) expect(inner).to.equal(inner.trim()).and.not.equal('');
		});

		it('drops stats and rankings unless verbose, as the framed text does', () => {
			const line = formatCardLine({ title: 'Title', description: 'Desc', stats: 'Stats', rankings: 'Ranks', verbose: false });
			expect(line.text).to.equal('Title\nDesc');
		});

		it('builds an item card line from the same inputs as the framed card', () => {
			const line = itemCardLine({ icon: '🧪', itemType: 'Potion', description: 'Heals.', probability: 50 }, true);
			expect(line).to.include({ kind: 'card', icon: '🧪' });
			expect((line as { title: string }).title).to.match(/^Potion/);
		});
	});

	describe('boss arrival', () => {
		const contestant = (isBoss: boolean): any => ({
			isBoss,
			character: { givenName: 'Incredible Swan', icon: '🎎', identity: '🎎 Incredible Swan' },
			monster: {
				icon: '🐗',
				givenName: 'Seeskane Orcbane',
				creatureType: 'Minotaur',
				individualDescription: 'A battle-hardened, gray minotaur.',
				stats: 'Type: Minotaur',
				rankings: 'Fights: 95',
				pronouns: { he: 'he', him: 'him', his: 'his', verbSuffix: 's' },
				targetingStrategy: TARGET_LOWEST_HP_PLAYER,
			},
		});

		it('flags a boss and gives its temperament a line of its own', () => {
			const { eb, published } = capture();
			announceContestant(eb, 'Ring', {}, { contestant: contestant(true) });
			const [arrival, temperament, narration, card] = expectLinesMatchText(published[0]!);

			expect(arrival).to.include({ kind: 'arrival', name: 'Seeskane Orcbane', boss: true });
			expect(arrival).to.not.have.property('owner');
			expect(arrival!.text).to.include('enters the ring, sent by the house');
			expect(arrival!.text).to.not.include('picks on whoever');
			expect(temperament!.kind).to.equal('temperament');
			expect(temperament!.text).to.include('picks on whoever looks weakest');
			expect(narration).to.include({ kind: 'narration', text: 'Seeskane Orcbane stamps into the ring. Half bull, all temper.' });
			expect(card!.kind).to.equal('card');
		});

		it("names the owner on a player's arrival and says no temperament", () => {
			const { eb, published } = capture();
			announceContestant(eb, 'Ring', {}, { contestant: contestant(false) });
			const [arrival, narration, card, ...rest] = expectLinesMatchText(published[0]!);

			expect(arrival).to.include({ kind: 'arrival', boss: false, owner: 'Incredible Swan' });
			expect(narration!.kind).to.equal('narration');
			expect(card!.kind).to.equal('card');
			expect(rest).to.deep.equal([]);
		});
	});
});

describe('feed lines: the card decides the verdict', () => {
	const tie = { naturalRoll: { result: 10 }, bonusResult: 5, modifier: 0, result: 15, primaryDice: '1d20' };

	it('takes `success` over the default "total beats vs" rule', () => {
		const { eb, published } = capture();
		announceRolled(eb, 'Card', {}, { who: { givenName: 'Ada' }, reason: 'vs 15 to dodge.', roll: tie, vs: 15, success: true });
		announceRolled(eb, 'Card', {}, { who: { givenName: 'Ada' }, reason: 'and needs 10 or higher to flee.', roll: tie, success: false });

		expect(linesOf(published[0]!)[0]).to.include({ kind: 'roll', result: 'success', total: 15, vs: 15 });
		expect(linesOf(published[0]!)[1]).to.include({ kind: 'verdict', result: 'success' });
		// A flee roll shows no `vs`, but a failed one is still a fail.
		expect(linesOf(published[1]!)[0]).to.include({ result: 'fail' });
	});

	it('still lets a natural 20 or a curse of Loki win over `success`', () => {
		const { eb, published } = capture();
		announceRolled(eb, 'Card', {}, { who: { givenName: 'Ada' }, reason: 'r', roll: { ...tie, curseOfLoki: true }, success: true });
		expect(linesOf(published[0]!)[0]).to.include({ result: 'nat1' });
	});

	it("Fire Breath's dodge passes its own verdict, so meeting the difficulty reads as a success", () => {
		const card = new FireBreathCard();
		const dragon = new Dragon({ name: 'Ember' });
		const target = new Gladiator({ name: 'Tor' });
		const emitted: any[] = [];
		card.on('rolled', (_c: string, _card: any, opts: any) => emitted.push(opts));
		sinon.stub(card, 'checkSuccess').returns({ success: true, strokeOfLuck: false, curseOfLoki: false, tie: false } as any);

		card.dodge(dragon, target);
		sinon.restore();

		expect(emitted[0].success).to.equal(true);
		const { eb, published } = capture();
		announceRolled(eb, 'Card', {}, { ...emitted[0], roll: { ...tie, result: emitted[0].vs } });
		expect(linesOf(published[0]!)[0]).to.include({ result: 'success', total: emitted[0].vs, vs: emitted[0].vs });
	});

	it("Helm of Awe's failed flee roll is a fail, though it shows no vs", async () => {
		const dragon = new Dragon({ name: 'Ember', xp: 300 });
		const foe = new Gladiator({ name: 'Tor' });
		const contestants = [dragon, foe].map(monster => ({ monster, character: {} }));
		const ring: any = { contestants, encounterEffects: [], channelManager: { sendMessages: () => Promise.resolve() } };
		for (const { monster } of contestants) monster.startEncounter(ring);

		const fake = (natural: number) => ({
			primaryDice: '1d20', result: natural, naturalRoll: { result: natural }, bonusResult: 0, modifier: 0,
			strokeOfLuck: natural === 20, curseOfLoki: natural === 1,
		});
		const card = new HelmOfAweCard();
		const save = sinon.stub(card, 'getSaveRoll');
		save.onCall(0).returns(fake(2));
		save.onCall(1).returns(fake(1));
		sinon.stub(card, 'getFleeRoll').returns(fake(3));
		const emitted: any[] = [];
		card.on('rolled', (_c: string, _card: any, opts: any) => emitted.push(opts));

		await card.effect(dragon, foe, ring, contestants);
		await new HitCard().play(foe, dragon, ring, contestants);
		await new HitCard().play(foe, dragon, ring, contestants);
		sinon.restore();

		const flee = emitted.find(opts => String(opts.reason).includes('to flee'));
		expect(flee, 'a flee roll was emitted').to.not.equal(undefined);
		expect(flee.success).to.equal(false);
		const { eb, published } = capture();
		announceRolled(eb, 'Card', {}, flee);
		expect(linesOf(published[0]!)[0]).to.include({ kind: 'roll', result: 'fail' });
		expect(linesOf(published[0]!)[0]).to.not.have.property('vs');
	});
});

describe('feed lines: card frames carry unwrapped fields', () => {
	const long = 'A massive, tan, desert-dwelling basilisk with a nasty temper and a worse stare.';

	it('keeps the description on one line though the frame wraps it', () => {
		const line = monsterCardLine({
			icon: '🦎',
			givenName: 'Basil',
			individualDescription: long,
			stats: 'Type: Basilisk\nClass: Fighter\nLevel: 3 | XP: 40',
			rankings: 'Fights: 9 · Won: 4',
			displayLevel: 'Level 3',
		}) as Extract<FeedLine, { kind: 'card' }>;

		expect(line.text).to.not.include(long); // wrapped in the frame body
		expect(line.description).to.equal(long);
		expect(line.stats).to.deep.equal([
			{ label: 'Type', value: 'Basilisk' },
			{ label: 'Class', value: 'Fighter' },
			{ label: 'Level', value: '3' },
			{ label: 'XP', value: '40' },
		]);
		expect(line.rankings).to.deep.equal([{ label: 'Fights', value: '9 · Won: 4' }]);
		expect(line.level).to.equal('Level 3');
	});

	it('shows only stats on a non-verbose monster card, as the frame does', () => {
		const line = monsterCardLine({ icon: '🦎', givenName: 'Basil', individualDescription: long, stats: 'Type: Basilisk' }, false) as Extract<FeedLine, { kind: 'card' }>;
		expect(line).to.not.have.property('description');
		expect(line.stats).to.deep.equal([{ label: 'Type', value: 'Basilisk' }]);
	});

	it('gates an item card\'s stats and requirements on verbose, like the frame', () => {
		const item = { icon: '🧪', itemType: 'Potion', description: 'Heals.', stats: 'Heals 5', probability: 50 };
		const terse = itemCardLine(item, false) as Extract<FeedLine, { kind: 'card' }>;
		const full = itemCardLine(item, true) as Extract<FeedLine, { kind: 'card' }>;
		expect(terse.description).to.equal('Heals.');
		expect(terse).to.not.have.property('stats');
		expect(full.stats).to.deep.equal([{ label: '', value: 'Heals 5' }]);
		expect(full.rankings!.some(f => f.label === 'Usable by')).to.equal(true);
	});
});


describe('feed lines: additive ring flavour', () => {
	for (const gender of ['male', 'female', 'androgynous'] as const) {
		it(`alternates both Dragon entrances for ${gender} independently of other rooms, bosses and rounds`, () => {
			const monster = new Dragon({ name: 'Companion', gender });
			const basilisk = new Basilisk({ name: 'Basil' });
			const a = {}, b = {};
			const entrance = (ring: object, target: Dragon | Basilisk = monster, isBoss = false): string => {
				const { eb, published } = capture();
				announceContestant(eb, 'Ring', ring, { contestant: { monster: target, isBoss, character: { givenName: 'Ada', icon: '🦊' } } });
				return expectLinesMatchText(published[0]!).find(l => l.kind === 'narration')!.text;
			};
			try {
				const bone = `${monster.givenName} lands with a sheep bone caught between ${monster.pronouns.his} teeth. Somewhere, a shepherd is still shouting.`;
				const goblet = `${monster.givenName} folds ${monster.pronouns.his} wings. A pilfered goblet rolls out from under one of them.`;
				expect(entrance(a)).to.equal(bone);
				expect(entrance(b)).to.equal(bone);
				expect(entrance(a, monster, true)).to.include('The Editor deftly slips their jeweled hand into their pocket.');
				entrance(a, basilisk);
				const { eb, published } = capture();
				announceNextRound(eb, 'Ring', a, { round: 0 });
				expect(expectLinesMatchText(published[0]!)[1]!.text).to.equal(ROUND_BEATS[0]);
				expect(entrance(a)).to.equal(goblet);
				expect(entrance(b)).to.equal(goblet);
				expect(entrance(a)).to.equal(bone);
			} finally { monster.disposeTimers(); basilisk.disposeTimers(); }
		});
	}

	it('does not draw randomness when choosing Dragon entrance variants', () => {
		const monster = new Dragon({ name: 'Companion', gender: 'androgynous' });
		const ring = {};
		const random = sinon.spy(Math, 'random');
		try {
			for (let at = 0; at < 6; at++) playerEntrance(monster, ring);
			expect(random.called).to.equal(false);
		} finally { random.restore(); monster.disposeTimers(); }
	});

	for (const Monster of allMonsters) {
		for (const gender of ['male', 'female', 'androgynous']) {
			it(`${Monster.creatureType} entrance agrees with ${gender} and matches text for players and bosses`, () => {
				const monster = new Monster({ name: 'Companion', gender });
				try {
					for (const isBoss of [false, true]) {
						const { eb, published } = capture();
						announceContestant(eb, 'Ring', {}, { contestant: { monster, isBoss, character: { givenName: 'Ada', icon: '🦊' } } });
						const lines = expectLinesMatchText(published[0]!);
						expect(lines.filter(l => l.kind === 'narration')).to.have.lengthOf(1);
						expect(lines[0]!.text).to.include(isBoss ? 'sent by the house' : 'answers the call');
						const prose = lines.find(l => l.kind === 'narration')!.text;
						expect(prose).to.include(monster.givenName);
						if (!isBoss && Monster.creatureType === 'Gladiator') {
							expect(prose).to.include(gender === 'androgynous' ? 'they come by choice' : `${monster.pronouns.he} comes by choice`);
						}
					}
				} finally { monster.disposeTimers(); }
			});
		}
	}

	it('adds the roses only for a living Unicorn in this ring', () => {
		const monster = new (allMonsters.find(M => M.creatureType === 'Minotaur')!)({ name: 'Bull' });
		try {
			for (const contestants of [[], [{ monster: { creatureType: 'Unicorn', dead: true } }], [{ monster: { creatureType: 'Unicorn' }, fled: true }], [{ monster: { creatureType: 'Unicorn' } }]]) {
				const { eb, published } = capture();
				announceContestant(eb, 'Ring', { contestants }, { contestant: { monster, isBoss: true, character: {} } });
				const lines = expectLinesMatchText(published[0]!);
				expect(lines.find(l => l.kind === 'narration')!.text.includes('in no mood for roses')).to.equal(contestants.length === 1 && !('dead' in contestants[0]!.monster) && !('fled' in contestants[0]!));
			}
		} finally { monster.disposeTimers(); }
	});

	it('rotates rounds without adjacent repeats or cross-room influence, without random draws', () => {
		const a = {}, b = {};
		const beats: string[] = [];
		const random = sinon.spy(Math, 'random');
		try {
			for (let round = 0; round < ROUND_BEATS.length * 3; round++) {
				const { eb, published } = capture();
				announceNextRound(eb, 'Ring', a, { round });
				const lines = expectLinesMatchText(published[0]!);
				beats.push(lines[1]!.text);
				if (round > 0) expect(beats[round]).to.not.equal(beats[round - 1]);
			}
			const { eb, published } = capture();
			announceNextRound(eb, 'Ring', b, { round: 0 });
			expect(expectLinesMatchText(published[0]!)[1]!.text).to.equal(ROUND_BEATS[0]);
			expect(new Set(beats).size).to.equal(ROUND_BEATS.length);
			expect(random.called).to.equal(false);
		} finally { random.restore(); }
	});
});
