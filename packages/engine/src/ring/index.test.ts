import { expect } from 'chai';
import sinon from 'sinon';

import { randomContestant } from '../helpers/bosses.js';
import Basilisk from '../monsters/basilisk.js';
import Beastmaster from '../characters/beastmaster.js';
import Game from '../game.js';
import { RoomEventBus } from '../events/index.js';
import { engineReady } from '../helpers/engine-ready.js';

describe('ring/index.ts', () => {
	before(async () => {
		await engineReady;
	});

	afterEach(() => {
		sinon.restore();
	});


	it('has an event bus', () => {
		const game = new Game();
		const ring = game.getRing();

		expect(ring.eventBus).to.be.instanceOf(RoomEventBus);
	});

	describe('monsters', () => {
		it('can be added', () => {
			const game = new Game();
			const ring = game.getRing();

			const character = new Beastmaster();
			const monster = new Basilisk();

			character.addMonster(monster);

			ring.addMonster({
				monster,
				character,
				userId: 'user-1',
			});

			expect(ring.contestants.length).to.equal(1);
			expect(ring.monsterIsInRing(monster)).to.equal(true);
		});

		it('can be removed', () => {
			const game = new Game();
			const ring = game.getRing();

			const character = new Beastmaster();
			const monster = new Basilisk();

			character.addMonster(monster);

			ring.addMonster({
				monster,
				character,
				userId: 'user-1',
			});

			expect(ring.contestants.length).to.equal(1);

			return ring
				.removeMonster({ monster, character, userId: 'user-1' })
				.then(() => expect(ring.monsterIsInRing(monster)).to.equal(false));
		});

		it('removes one of several contestants via the setter, not an in-place splice', () => {
			// Regression: removeMonster used to `.splice()` the array returned by the
			// `contestants` getter directly, so partial removals (ring not emptied)
			// never went through `setOptions()` and so never emitted `stateChange` —
			// a monster withdrawn from a still-populated ring could still be listed in
			// the last-persisted ringContestantRefs and get resurrected on restart.
			const game = new Game();
			const ring = game.getRing();

			const character1 = new Beastmaster();
			const monster1 = new Basilisk();
			character1.addMonster(monster1);
			const character2 = new Beastmaster();
			const monster2 = new Basilisk();
			character2.addMonster(monster2);

			ring.addMonster({ monster: monster1, character: character1, userId: 'user-1' });
			ring.addMonster({ monster: monster2, character: character2, userId: 'user-2' });
			expect(ring.contestants.length).to.equal(2);

			const contestantsBeforeRemoval = ring.contestants;

			return ring
				.removeMonster({ monster: monster1, character: character1, userId: 'user-1' })
				.then(() => {
					expect(ring.contestants.length).to.equal(1);
					expect(ring.contestants).to.not.equal(contestantsBeforeRemoval);
					expect(ring.monsterIsInRing(monster2)).to.equal(true);
				});
		});

		it('cannot be removed while an encounter is in progress', async () => {
			const game = new Game();
			const ring = game.getRing();

			const character = new Beastmaster();
			const monster = new Basilisk();

			character.addMonster(monster);

			ring.addMonster({ monster, character, userId: 'user-1' });
			expect(ring.contestants.length).to.equal(1);

			ring.startEncounter();

			let threw = false;
			try {
				await ring.removeMonster({ monster, character, userId: 'user-1' });
			} catch (_e) {
				threw = true;
			}
			expect(threw).to.equal(true);
		});
	});

	describe('bosses', () => {
		it('will spawn a boss', () => {
			const game = new Game();
			const ring = game.getRing();

			const contestant = ring.spawnBoss();

			expect(ring.contestants.length).to.equal(1);
			expect(ring.monsterIsInRing(contestant!.monster)).to.equal(true);
		});

		it('will remove a boss', () => {
			const game = new Game();
			const ring = game.getRing();

			const contestant = ring.spawnBoss()!;

			return ring.removeBoss(contestant).then(() =>
				expect(ring.contestants.length).to.equal(0)
			);
		});

		it('cancels pending boss despawn timers on dispose', () => {
			// Regression: the despawn setTimeout scheduled in spawnBoss() was never
			// stored anywhere, so Ring.dispose() could not cancel it — an orphaned
			// timer would fire against an already-disposed ring after the room
			// unloaded.
			//
			// spawnBoss() only schedules a despawn timer on a 50/50 coin flip
			// (`random(1)`), so we retry rather than pinning Math.random — pinning it
			// globally breaks the recursive probability-retry loop in
			// cards/helpers/draw.ts (`if (!Card) return draw(...)`), which never
			// terminates once every card's probability check returns the same fixed
			// result. clearRing() between attempts doesn't touch bossDespawnTimers
			// (only dispose() does), so any attempt landing heads is enough — the
			// ~2^-50 chance every one of 50 flips misses is negligible.
			const clock = sinon.useFakeTimers({ shouldClearNativeTimers: true });
			try {
				const game = new Game();
				const ring = game.getRing();
				const removeBossSpy = sinon.spy(ring, 'removeBoss');

				for (let attempt = 0; attempt < 50; attempt += 1) {
					ring.clearRing();
					ring.spawnBoss();
				}
				expect((ring as any).bossDespawnTimers.size).to.be.greaterThan(0);

				game.dispose();

				// Well past BOSS_DESPAWN_DELAY_MS (10 minutes) — if any timer survived
				// dispose(), removeBoss would fire here.
				clock.tick(11 * 60 * 1000);

				expect(removeBossSpy.called).to.equal(false);
			} finally {
				clock.restore();
			}
		});

		it('will not spawn a boss if an encounter is in progress', () => {
			const game = new Game();
			const ring = game.getRing();

			const character = new Beastmaster();
			const monster = new Basilisk();

			character.addMonster(monster);

			ring.addMonster({ monster, character, userId: 'user-1' });
			ring.startEncounter();

			expect(ring.contestants.length).to.equal(1);

			const contestant = ring.spawnBoss();

			expect(ring.contestants.length).to.equal(1);
			expect(contestant).to.be.undefined;
		});

		it('uses weighted cap bands from selected level source', () => {
			const game = new Game();
			const ring = game.getRing();
			const determineBossLevelCap = (ring as any).determineBossLevelCap.bind(ring);

			// 20%: keep full random distribution (no cap).
			expect(determineBossLevelCap([0, 1, 2], 1)).to.equal(undefined);
			expect(determineBossLevelCap([0, 1, 2], 20)).to.equal(undefined);
			// 30%: cap at highest level + 1.
			expect(determineBossLevelCap([0, 1, 2], 21)).to.equal(3);
			expect(determineBossLevelCap([0, 1, 2], 50)).to.equal(3);
			// 50%: cap at floor(average level).
			expect(determineBossLevelCap([0, 1, 2], 51)).to.equal(1);
			expect(determineBossLevelCap([0, 1, 2], 100)).to.equal(1);
		});

		it('falls back to room monster levels when no player monsters are in the ring', () => {
			const game = new Game();
			const ring = game.getRing();
			const roomMonsterA = randomContestant({
				isBoss: false,
				battles: { total: 30, wins: 26, losses: 4 },
			});
			const roomMonsterB = randomContestant({
				isBoss: false,
				battles: { total: 20, wins: 14, losses: 6 },
			});
			game.characters = {
				roomA: roomMonsterA.character,
				roomB: roomMonsterB.character,
			} as any;

			const determineStub = sinon.stub(ring as any, 'determineBossLevelCap').returns(0);
			(ring as any).getBossLevelCap();

			const selectedLevels = [...(determineStub.firstCall.args[0] as number[])].sort((a, b) => a - b);
			const roomLevels = [roomMonsterA.monster.level, roomMonsterB.monster.level].sort((a, b) => a - b);
			expect(selectedLevels).to.deep.equal(roomLevels);
		});

		it('prefers ring monster levels over room levels when ring has players', () => {
			const game = new Game();
			const ring = game.getRing();
			const highRoomMonster = randomContestant({
				isBoss: false,
				battles: { total: 60, wins: 55, losses: 5 },
			});
			game.characters = {
				highRoom: highRoomMonster.character,
			} as any;

			const ringMonsterA = randomContestant({
				isBoss: false,
				battles: { total: 2, wins: 1, losses: 1 },
			});
			const ringMonsterB = randomContestant({
				isBoss: false,
				battles: { total: 0, wins: 0, losses: 0 },
			});
			ring.addMonster(ringMonsterA);
			ring.addMonster(ringMonsterB);

			const determineStub = sinon.stub(ring as any, 'determineBossLevelCap').returns(0);
			(ring as any).getBossLevelCap();

			const selectedLevels = [...(determineStub.firstCall.args[0] as number[])].sort((a, b) => a - b);
			const ringLevels = [ringMonsterA.monster.level, ringMonsterB.monster.level].sort((a, b) => a - b);
			expect(selectedLevels).to.deep.equal(ringLevels);
		});

		it('uses ring-only levels for boss spawn timing context', () => {
			const game = new Game();
			const ring = game.getRing();
			const highRoomMonster = randomContestant({
				isBoss: false,
				battles: { total: 80, wins: 75, losses: 5 },
			});
			game.characters = { highRoom: highRoomMonster.character } as any;

			// Ring is empty, so timing remains beginner-paced regardless of room roster.
			expect((ring as any).isBeginnerBossTimingContext()).to.equal(true);

			const highRingMonster = randomContestant({
				isBoss: false,
				battles: { total: 80, wins: 75, losses: 5 },
			});
			ring.addMonster(highRingMonster);
			expect((ring as any).isBeginnerBossTimingContext()).to.equal(false);
		});

		it('maps level caps to expected XP boundaries', () => {
			const game = new Game();
			const ring = game.getRing();
			const getXpCapForLevel = (ring as any).constructor
				.toString()
				.includes('getXpCapForLevel');
			expect(getXpCapForLevel).to.equal(true);

			// spot-check known level boundaries from getLevel progression
			const xpCapForLevel = (ring as any).getSpawnedBossContestant
				? (level: number) => {
					const helper = (ring as any).constructor as any;
					// Reach private helper through spawned-boss path deterministically:
					// with cap N, max boss XP should never exceed the cap boundary.
					const capStub = sinon.stub(ring as any, 'getBossLevelCap').returns(level);
					const boss = ring.spawnBoss()!;
					capStub.restore();
					ring.clearRing();
					return boss.monster.xp;
				}
				: () => 0;

			expect(xpCapForLevel(0)).to.be.at.most(49);
			expect(xpCapForLevel(1)).to.be.at.most(99);
			expect(xpCapForLevel(2)).to.be.at.most(149);
			expect(xpCapForLevel(3)).to.be.at.most(249);
		});

		it('ignores dead and destroyed room monsters in fallback level selection', () => {
			const game = new Game();
			const ring = game.getRing();
			const aliveRoomMonster = randomContestant({
				isBoss: false,
				battles: { total: 0, wins: 0, losses: 0 },
			});
			const deadRoomMonster = randomContestant({
				isBoss: false,
				battles: { total: 60, wins: 55, losses: 5 },
			});
			const destroyedRoomMonster = randomContestant({
				isBoss: false,
				battles: { total: 90, wins: 85, losses: 5 },
			});
			deadRoomMonster.monster.hp = 0;
			destroyedRoomMonster.monster.hp = -999;
			game.characters = {
				aliveRoom: aliveRoomMonster.character,
				deadRoom: deadRoomMonster.character,
				destroyedRoom: destroyedRoomMonster.character,
			} as any;

			const determineStub = sinon.stub(ring as any, 'determineBossLevelCap').returns(0);
			(ring as any).getBossLevelCap();

			const selectedLevels = determineStub.firstCall.args[0] as number[];
			expect(selectedLevels).to.deep.equal([aliveRoomMonster.monster.level]);
		});

		it('treats empty-room capped bands as level 0', () => {
			const game = new Game();
			const ring = game.getRing();
			const determineBossLevelCap = (ring as any).determineBossLevelCap.bind(ring);

			expect(determineBossLevelCap([], 20)).to.equal(undefined);
			expect(determineBossLevelCap([], 21)).to.equal(0);
			expect(determineBossLevelCap([], 100)).to.equal(0);
		});

		it('caps spawned boss level when cap strategy applies', () => {
			const game = new Game();
			const ring = game.getRing();

			const capOneStub = sinon.stub(ring as any, 'getBossLevelCap').returns(1);
			const lowBoss = ring.spawnBoss();
			expect(lowBoss).to.not.be.undefined;
			expect(lowBoss!.monster.level).to.be.at.most(1);
			capOneStub.restore();

			ring.clearRing();

			const capThreeStub = sinon.stub(ring as any, 'getBossLevelCap').returns(3);
			const midBoss = ring.spawnBoss();
			expect(midBoss).to.not.be.undefined;
			expect(midBoss!.monster.level).to.be.at.most(3);
			capThreeStub.restore();
		});
	});

	describe('outcome handlers', () => {
		it('handlePermaDeath emits creature.permaDeath on the monster, like its win/loss/fled siblings', () => {
			// Regression: handlePermaDeath was missing the `contestant.monster.emit(...)`
			// call that handleWinner/handleLoser/handleFled all have. Game listens for
			// the global `creature.permaDeath` broadcast (via BaseClass.emit's
			// `${eventPrefix}.${event}` convention) to award the permaDeath consolation
			// XP/coins — without this emit, that listener never fired, so a
			// permanently destroyed monster granted its owner no reward at all.
			const game = new Game();
			const ring = game.getRing();

			const character = new Beastmaster();
			const monster = new Basilisk();
			character.addMonster(monster);

			const emitSpy = sinon.spy(monster, 'emit');
			const contestant = { character, monster, userId: 'user-1' };

			ring.handlePermaDeath({ contestant });

			expect(emitSpy.calledWith('permaDeath', { contestant })).to.equal(true);
		});
	});

	describe('fightConcludes', () => {
		it('can calculate xp for two level 1 monsters', () => {
			const game = new Game();
			const ring = game.getRing();

			let contestant1 = randomContestant({ battles: { total: 5, wins: 5, losses: 0 } });
			ring.addMonster(contestant1);

			let contestant2 = randomContestant({ battles: { total: 5, wins: 5, losses: 0 } });
			ring.addMonster(contestant2);

			contestant1.monster.hp = 0;
			contestant1.monster.killedBy = contestant2.monster;
			contestant2.monster.killed = contestant1.monster;

			const prevXP1 = contestant1.monster.xp;
			const prevXP2 = contestant2.monster.xp;

			ring.fightConcludes({ lastContestant: contestant2, rounds: 1 });

			contestant1 = ring.findContestant(contestant1.character, contestant1.monster)!;
			contestant2 = ring.findContestant(contestant2.character, contestant2.monster)!;

			expect(contestant1.won).to.be.undefined;
			expect(contestant2.won).to.equal(true);
			expect(contestant1.monster.xp).to.equal(prevXP1 + 1);
			expect(contestant2.monster.xp).to.equal(prevXP2 + 14);
		});

		it('can calculate xp for a higher level monster beating a lower level monster', () => {
			const game = new Game();
			const ring = game.getRing();

			let contestant1 = randomContestant({ battles: { total: 5, wins: 5, losses: 0 } });
			ring.addMonster(contestant1);

			let contestant2 = randomContestant({ battles: { total: 10, wins: 10, losses: 0 } });
			ring.addMonster(contestant2);

			contestant1.monster.hp = 0;
			contestant1.monster.killedBy = contestant2.monster;
			contestant2.monster.killed = contestant1.monster;

			const prevXP1 = contestant1.monster.xp;
			const prevXP2 = contestant2.monster.xp;

			ring.fightConcludes({ lastContestant: contestant2, rounds: 1 });

			contestant1 = ring.findContestant(contestant1.character, contestant1.monster)!;
			contestant2 = ring.findContestant(contestant2.character, contestant2.monster)!;

			expect(contestant1.won).to.be.undefined;
			expect(contestant2.won).to.equal(true);
			expect(contestant1.monster.xp).to.equal(prevXP1 + 1);
			expect(contestant2.monster.xp).to.equal(prevXP2 + 8);
		});

		it('can calculate xp for a lower level monster beating a higher level monster', () => {
			const game = new Game();
			const ring = game.getRing();

			let contestant1 = randomContestant({ battles: { total: 5, wins: 5, losses: 0 } });
			ring.addMonster(contestant1);

			let contestant2 = randomContestant({ battles: { total: 1, wins: 1, losses: 0 } });
			ring.addMonster(contestant2);

			contestant1.monster.hp = 0;
			contestant1.monster.killedBy = contestant2.monster;
			contestant2.monster.killed = contestant1.monster;

			const prevXP1 = contestant1.monster.xp;
			const prevXP2 = contestant2.monster.xp;

			ring.fightConcludes({ lastContestant: contestant2, rounds: 1 });

			contestant1 = ring.findContestant(contestant1.character, contestant1.monster)!;
			contestant2 = ring.findContestant(contestant2.character, contestant2.monster)!;

			expect(contestant1.won).to.be.undefined;
			expect(contestant2.won).to.equal(true);
			expect(contestant1.monster.xp).to.equal(prevXP1 + 1);
			expect(contestant2.monster.xp).to.equal(prevXP2 + 24);
		});

		it('can calculate xp when a monster flees', () => {
			const game = new Game();
			const ring = game.getRing();

			let contestant1 = randomContestant({ battles: { total: 5, wins: 5, losses: 0 } });
			ring.addMonster(contestant1);

			let contestant2 = randomContestant({ battles: { total: 5, wins: 5, losses: 0 } });
			ring.addMonster(contestant2);

			contestant1.monster.fled = true;

			const prevXP1 = contestant1.monster.xp;
			const prevXP2 = contestant2.monster.xp;

			ring.fightConcludes({ lastContestant: contestant2, rounds: 1 });

			contestant1 = ring.findContestant(contestant1.character, contestant1.monster)!;
			contestant2 = ring.findContestant(contestant2.character, contestant2.monster)!;

			expect(contestant1.won).to.be.undefined;
			expect(contestant2.won).to.be.undefined;
			expect(contestant1.monster.xp).to.equal(prevXP1 + 2);
			expect(contestant2.monster.xp).to.equal(prevXP2 + 4);
		});
	});

	describe('fight()', () => {
		it('runs to completion without throwing when monsters have properly hydrated cards', async function () {

			const game = new Game();
			const ring = game.getRing();

			const contestant1 = randomContestant({ isBoss: false, battles: { total: 5, wins: 3, losses: 2 } });
			const contestant2 = randomContestant({ isBoss: false, battles: { total: 5, wins: 3, losses: 2 } });

			// Verify cards are proper instances before adding to ring
			for (const card of contestant1.monster.cards) {
				expect(card.play, 'contestant1 card should have play()').to.be.a('function');
			}
			for (const card of contestant2.monster.cards) {
				expect(card.play, 'contestant2 card should have play()').to.be.a('function');
			}

			ring.addMonster(contestant1);
			ring.addMonster(contestant2);

			// fight() should resolve (not reject)
			let caughtError: unknown;
			try {
				await ring.fight();
			} catch (err) {
				caughtError = err;
			}

			expect(caughtError, 'fight() should not throw').to.be.undefined;
		});

		it('runs a full fight through the real (non-skipped) pacing path', async function () {
			// Regression (bug doc #20): the normal card-play path used to pace with
			// subEventDelay instead of the configured veryShortDelay, and — because
			// the whole test suite runs with DECK_MONSTERS_SKIP_DELAYS=1 — the
			// non-skip branches had zero coverage, so the wrong delay call could not
			// be caught by any test. This exercises the real timer path end to end
			// with midpoints shrunk to a few milliseconds so it stays fast.
			this.timeout(10_000);

			const prevSkip = process.env.DECK_MONSTERS_SKIP_DELAYS;
			delete process.env.DECK_MONSTERS_SKIP_DELAYS;
			process.env.DECK_MONSTERS_VERY_SHORT_DELAY_MIDPOINT_MS = '3';
			process.env.DECK_MONSTERS_SHORT_DELAY_MIDPOINT_MS = '3';
			process.env.DECK_MONSTERS_SUB_EVENT_DELAY_MIDPOINT_MS = '2';

			const game = new Game();
			try {
				const ring = game.getRing();

				ring.addMonster(randomContestant({ isBoss: false, battles: { total: 5, wins: 3, losses: 2 } }));
				ring.addMonster(randomContestant({ isBoss: false, battles: { total: 5, wins: 3, losses: 2 } }));

				await ring.fight();

				// A completed fight clears the ring and ends the encounter.
				expect(ring.inEncounter).to.equal(false);
				expect(ring.contestants.length).to.equal(0);
			} finally {
				process.env.DECK_MONSTERS_SKIP_DELAYS = prevSkip;
				delete process.env.DECK_MONSTERS_VERY_SHORT_DELAY_MIDPOINT_MS;
				delete process.env.DECK_MONSTERS_SHORT_DELAY_MIDPOINT_MS;
				delete process.env.DECK_MONSTERS_SUB_EVENT_DELAY_MIDPOINT_MS;
				game.dispose();
			}
		});

		it('cards on monsters spawned via randomContestant all have play() methods', () => {
			const contestant = randomContestant({ isBoss: false });

			expect(contestant.monster.cards.length, 'monster should have cards').to.be.above(0);
			for (const card of contestant.monster.cards) {
				expect(card.play, `card "${card.name}" should have play()`).to.be.a('function');
			}
		});

		it('addMonster logs pre-flight card validation warnings for plain-object cards', () => {
			const game = new Game();
			const ring = game.getRing();
			const logs: unknown[] = [];
			ring.log = (msg: unknown) => logs.push(msg);

			const contestant1 = randomContestant({ isBoss: false });

			// Simulate hydration failure: replace cards with plain objects lacking play()
			contestant1.monster.cards = [
				{ name: 'HitCard', options: {} },
				{ name: 'HealCard', options: {} },
			] as any[];

			ring.addMonster(contestant1);

			// The addMonster pre-flight validation should have logged warnings for each broken card
			const addWarnings = logs.filter(
				(l: any) => l?.context === 'ring.addMonster.cardValidation'
			);
			expect(addWarnings.length, 'should log one warning per broken card').to.equal(2);
			expect((addWarnings[0] as any).monsterName).to.equal(contestant1.monster.givenName);
			expect((addWarnings[0] as any).cardIndex).to.equal(0);
			expect((addWarnings[0] as any).hasPlay).to.equal('undefined');
		});

		it('ring.fight.invalidCard guard fires for plain-object cards and logs diagnostic info', async function () {

			const game = new Game();
			const ring = game.getRing();
			const logs: unknown[] = [];
			ring.log = (msg: unknown) => logs.push(msg);

			const contestant1 = randomContestant({ isBoss: false });
			const contestant2 = randomContestant({ isBoss: false });

			// Simulate hydration failure: replace all of contestant1's cards with plain
			// objects (no play() method). The guard fires and skips each one, so
			// contestant1 deals no damage while contestant2 chips away normally.
			//
			// We give contestant1 enough broken cards to outlast the fight — this avoids
			// the endOfDeck shortDelay (1–2 s) that would fire every round if contestant1
			// only had a single card and recycled through it.  With ~20 broken cards the
			// fight ends (contestant2 wins) well before contestant1 exhausts their deck,
			// keeping total test time to a few seconds.
			contestant1.monster.cards = Array.from({ length: 20 }, (_, i) => ({
				name: `BrokenCard${i}`,
				options: {},
			})) as any[];

			ring.addMonster(contestant1);
			ring.addMonster(contestant2);

			let caughtError: unknown;
			try {
				await ring.fight();
			} catch (err) {
				caughtError = err;
			}

			expect(caughtError, 'fight() should not throw with broken cards').to.be.undefined;

			// The invalid-card guard should have logged the skip attempt
			const fightWarnings = logs.filter(
				(l: any) => l?.context === 'ring.fight.invalidCard'
			);
			expect(fightWarnings.length, 'should log invalid-card guard warnings during fight').to.be.above(0);
			expect((fightWarnings[0] as any).typeof_play).to.equal('undefined');
		});
	});
});
