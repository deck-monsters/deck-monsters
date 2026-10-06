import { expect } from 'chai';

import Game from '../game.js';
import { createTestChannel, noopStateStore } from '../testing/index.js';
import Basilisk from '../monsters/basilisk.js';
import Gladiator from '../monsters/gladiator.js';
import HitCard from '../cards/hit.js';
import BlastCard from '../cards/blast.js';
import { DelayedHit } from '../cards/delayed-hit.js';
import { TARGET_LOWEST_HP_PLAYER } from '../helpers/targeting-strategies.js';
import { formatCardLine, itemCardLine, monsterCardLine } from '../helpers/card.js';
import { announceContestant } from './contestant.js';
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

describe('feed lines (payload.lines)', () => {
	describe('consistency with text over a simulated fight', () => {
		// Public ring traffic and the private fight-result events. Private `announce` and
		// `ring.remove` events are command replies to one player ("The ring is empty."), which
		// are not fight-feed lines and are deliberately left without `lines`.
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

		it('gives every feed event lines that say exactly what its text says', async function () {
			this.timeout(60000);
			const previousSkip = process.env.DECK_MONSTERS_SKIP_DELAYS;
			process.env.DECK_MONSTERS_SKIP_DELAYS = '1';
			const game = new Game({ roomId: 'feed-lines-room', spawnBosses: false }, () => 0);
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
				boss.monster.cards = [new BlastCard(), new DelayedHit(), ...Array.from({ length: 7 }, () => new HitCard())];
				champion.hp = 200;

				await (game.ring as any).fight();

				const feed = events.filter(e => FEED_TYPES.has(e.type) && !(e.scope === 'private' && ['announce', 'ring.remove'].includes(e.type)));
				const kinds = new Set<string>();
				expect(feed.length).to.be.greaterThan(20);

				for (const event of feed) {
					const lines = event.payload.lines as FeedLine[] | undefined;
					expect(lines, `${event.type} has no lines: ${JSON.stringify(event.text)}`).to.be.an('array').that.is.not.empty;

					for (const line of lines!) {
						kinds.add(line.kind);
						expect(line.text, `${event.type}/${line.kind}`).to.be.a('string').and.not.equal('');
						// Single lines, except a card, which is its frame's inner lines.
						if (line.kind !== 'card') expect(line.text, `${line.kind} spans lines`).to.not.include('\n');
						for (const inner of line.text.split('\n')) {
							expect(inner, `${line.kind} has layout whitespace`).to.equal(inner.trim()).and.not.equal('');
							expect(inner).to.not.match(RULE);
							expect(inner).to.not.include('```');
						}
					}

					let expected = cleanLines(event.text).join(' ');
					// The turn banner's `A vs B` roster line is one text line and one `standing`
					// line per contestant: " vs " is layout between them.
					if (lines!.some(line => line.kind === 'turn')) expected = expected.replace(/ vs /g, ' ');
					const actual = lines!.flatMap(line => line.text.split('\n')).join(' ');
					expect(actual, `${event.type} lines drifted from text`).to.equal(expected);

					// Plain JSON: it is persisted and replayed.
					expect(JSON.parse(JSON.stringify(lines))).to.deep.equal(lines);
				}

				// The simulated fight exercised the structured kinds this test is here to guard.
				for (const kind of ['arrival', 'card', 'turn', 'standing', 'turn-begin', 'play', 'roll', 'hit', 'hp', 'fight-end']) {
					expect(kinds.has(kind), `no ${kind} line in the fight`).to.equal(true);
				}
			} finally {
				game.dispose();
				if (previousSkip === undefined) delete process.env.DECK_MONSTERS_SKIP_DELAYS;
				else process.env.DECK_MONSTERS_SKIP_DELAYS = previousSkip;
			}
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
			expect(linesOf(published[0]!)).to.deep.equal([{ kind: 'round', text: '🏁  round 2', round: 2 }]);
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
			const [arrival, temperament, card] = linesOf(published[0]!);

			expect(arrival).to.include({ kind: 'arrival', name: 'Seeskane Orcbane', boss: true });
			expect(arrival).to.not.have.property('owner');
			expect(arrival!.text).to.include('enters the ring, sent by the house');
			expect(arrival!.text).to.not.include('picks on whoever');
			expect(temperament!.kind).to.equal('temperament');
			expect(temperament!.text).to.include('picks on whoever looks weakest');
			expect(card!.kind).to.equal('card');
		});

		it("names the owner on a player's arrival and says no temperament", () => {
			const { eb, published } = capture();
			announceContestant(eb, 'Ring', {}, { contestant: contestant(false) });
			const [arrival, card, ...rest] = linesOf(published[0]!);

			expect(arrival).to.include({ kind: 'arrival', boss: false, owner: 'Incredible Swan' });
			expect(card!.kind).to.equal('card');
			expect(rest).to.deep.equal([]);
		});
	});
});
