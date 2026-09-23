import { expect } from 'chai';

import Game from './game.js';
import { createTestChannel, noopStateStore } from './testing/index.js';
import { engineReady } from './helpers/engine-ready.js';
import { XP_PER_VICTORY, XP_PER_DEFEAT } from './helpers/experience.js';
import {
	COINS_PER_VICTORY,
	COINS_PER_DEFEAT,
	COINS_PER_DAILY_FIGHT,
} from './constants/coins.js';
import { earlyCoinBonus } from './constants/progression.js';
import Basilisk from './monsters/basilisk.js';

/**
 * Roadmap 10 §J ("Fight rewards may never be credited"): a player reported 2 wins and 9
 * losses with zero coins. Win/loss counts (`addWin`/`addLoss`, `Ring.handleWinner`/
 * `handleLoser`) are direct, synchronous calls, while coins and XP travel through
 * `contestant.monster.emit('win'|'loss', ...)` on the process-wide semaphore, then
 * `createRoomScopedEventGuard` (announcements/index.ts), then `Game.handleWinner`/
 * `handleLoser` (game.ts). No test previously drove a *real* `ring.fight()` — with real
 * characters registered via the game's own public creation path (`Game.getCharacter`,
 * the same method `trpc/router.ts` and `commands/index.ts` call) and monsters sent to the
 * ring via `Beastmaster#sendMonsterToTheRing` (the same method the `send monster to the
 * ring` command and the tRPC `sendMonsterToRing` procedure call) — to a decisive result
 * and asserted coin/XP crediting. This file closes that gap.
 *
 * Finding: the in-process reward path is sound. Every assertion below passes against the
 * current code, through the exact production call chain, both for a fresh game and after
 * a full save/restore round trip, and with a transient boss contestant in the mix. See the
 * bottom of this file for the remaining hypotheses this does NOT rule out.
 *
 * Getting the save/restore case to pass surfaced a second, unrelated finding: this
 * mocha/`tsx` test harness (not production) can silently split one source module into two
 * disconnected runtime instances when a lazy "break-circular-deps" `import()` (a
 * pre-existing pattern in `characters/helpers/hydrate.ts` and similar files) is exercised
 * alongside a *static* import of the same file elsewhere in the process — see the comment
 * on that test for the full mechanism. That split reproduces this very bug's symptom (a
 * counted win, zero coins) for a harness-only reason, and is why that one test dynamically
 * imports everything it touches instead of using this file's top-level static imports.
 */
describe('fight rewards are credited end-to-end (roadmap 10 §J)', () => {
	before(async () => {
		await engineReady;
	});

	/**
	 * A card whose `play()` routes through the real damage/death path
	 * (`BaseCreature#hit` → `creatures/health.ts#hit` → `#die`), so `killedBy`/`killed`
	 * populate on both monsters exactly as a live Hit card would.
	 *
	 * This deliberately does NOT use the `monster.hp = 0` shortcut several `ring/
	 * index.test.ts` tests use to force a fast conclusion: that shortcut never calls
	 * `die()`, so `killedBy` stays unset and `calculateXP`'s dead-with-no-killer branch
	 * (`helpers/experience.ts`) awards the loser's monster 0 XP — which would make this
	 * suite unable to tell "no XP because the reward path is broken" apart from "no XP
	 * because the test setup didn't go through a real kill." Going through `.hit()` keeps
	 * the monster-XP assertions meaningful.
	 */
	const lethalCard = (name: string) => ({
		name,
		play: async (
			attacker: { name: string },
			target: { hp: number; hit: (damage: number, assailant: unknown) => Promise<boolean> }
		) => {
			// Exactly enough damage to bring hp to 0 — not the monster's hp + a large
			// overkill margin. `BaseCreature#destroyed` is `hp < -maxHp/2`
			// (creatures/base.ts): overkill damage lands there and turns this into a
			// `permaDeath` (double the defeat coins, no revive) instead of an ordinary
			// `loss`, which is a different reward path than the one this test means to
			// exercise.
			await target.hit(target.hp, attacker);
			return true;
		},
	});
	const passCard = (name: string) => ({ name, play: async () => true });

	/** Nine slots is `BaseMonster`'s default `cardSlots`; `sendMonsterToTheRing` refuses a
	 * monster with fewer cards than that ("does not send a companion... without a full
	 * deck"), so every deck below is padded to nine regardless of how many cards the fight
	 * actually needs to reach a decisive result. */
	const fullDeck = (first: ReturnType<typeof lethalCard> | ReturnType<typeof passCard>) => [
		first,
		...Array.from({ length: 8 }, (_, i) => passCard(`Wait ${i}`)),
	];

	/**
	 * Registers two real `Beastmaster`s through `Game.getCharacter` (the same public path
	 * `trpc/router.ts#getOrCreateCharacter` and `commands/index.ts` use), each with a real
	 * `Basilisk` monster added via `Beastmaster#addMonster` and sent to the ring via
	 * `Beastmaster#sendMonsterToTheRing` (the same method the `sendMonsterToRing` tRPC
	 * procedure and the `send monster to the ring` command call, which itself calls
	 * `Ring#addMonster`). The winner's monster carries a card that lethally hits the loser
	 * on the very first turn, so the fight resolves deterministically in one round.
	 */
	async function setUpDecisiveDuel(
		game: Game
	): Promise<{ winner: any; loser: any; winnerMonster: Basilisk; loserMonster: Basilisk }> {
		const channelA = createTestChannel(game.eventBus, 'user-a');
		const channelB = createTestChannel(game.eventBus, 'user-b');

		const winner = await game.getCharacter({
			channel: channelA.fn,
			id: 'user-a',
			name: 'Winner Trainer',
			gender: 'female',
			icon: '🦊',
		});
		const loser = await game.getCharacter({
			channel: channelB.fn,
			id: 'user-b',
			name: 'Loser Trainer',
			gender: 'male',
			icon: '🐍',
		});

		const winnerMonster = new Basilisk({ name: 'Champion' });
		winnerMonster.cards = fullDeck(lethalCard('Finisher'));
		winner.addMonster(winnerMonster);

		const loserMonster = new Basilisk({ name: 'Underdog' });
		loserMonster.cards = fullDeck(passCard('Wait 0'));
		loser.addMonster(loserMonster);

		await winner.sendMonsterToTheRing({
			ring: game.ring,
			channel: channelA.fn,
			channelName: 'ring',
			userId: 'user-a',
		});
		await loser.sendMonsterToTheRing({
			ring: game.ring,
			channel: channelB.fn,
			channelName: 'ring',
			userId: 'user-b',
		});

		return { winner, loser, winnerMonster, loserMonster };
	}

	function assertDecisiveRewards({
		winner,
		loser,
		winnerMonster,
		loserMonster,
		before: snapshot,
	}: {
		winner: any;
		loser: any;
		winnerMonster: Basilisk;
		loserMonster: Basilisk;
		before: {
			winnerCoins: number;
			loserCoins: number;
			winnerXp: number;
			loserXp: number;
			winnerMonsterXp: number;
			loserMonsterXp: number;
			winnerWins: number;
			loserLosses: number;
		};
	}): void {
		// The bug report: coins stayed at 0 despite a recorded win/loss. Both are each
		// character's very first fight, so both collect the once-per-UTC-day bonus and
		// the new-player bonus on top of the flat outcome payout.
		expect(winner.coins, 'winner owner coins').to.equal(
			snapshot.winnerCoins + COINS_PER_VICTORY + COINS_PER_DAILY_FIGHT + earlyCoinBonus(0)
		);
		expect(loser.coins, 'loser owner coins').to.equal(
			snapshot.loserCoins + COINS_PER_DEFEAT + COINS_PER_DAILY_FIGHT + earlyCoinBonus(0)
		);

		// Character (owner) XP — Game.handleWinner/handleLoser.
		expect(winner.xp, 'winner owner xp').to.equal(snapshot.winnerXp + XP_PER_VICTORY);
		expect(loser.xp, 'loser owner xp').to.equal(snapshot.loserXp + XP_PER_DEFEAT);

		// Monster XP — a separate reward path (Ring.awardMonsterXP / calculateXP), decided
		// by `killed`/`killedBy` populated via the real `.hit()` → `.die()` path above.
		expect(winnerMonster.xp, 'winner monster xp').to.be.greaterThan(snapshot.winnerMonsterXp);
		expect(loserMonster.xp, 'loser monster xp').to.be.greaterThan(snapshot.loserMonsterXp);

		// Win/loss counters must be consistent with the coin/XP awards above, not just
		// independently present — the reported bug was 2 wins/9 losses *with* zero coins,
		// i.e. the counters and the rewards had already drifted apart in production.
		expect(winner.battles.wins, 'winner owner win count').to.equal(snapshot.winnerWins + 1);
		expect(loser.battles.losses, 'loser owner loss count').to.equal(snapshot.loserLosses + 1);
		expect(winnerMonster.battles.wins, 'winner monster win count').to.equal(1);
		expect(loserMonster.battles.losses, 'loser monster loss count').to.equal(1);
	}

	it('credits coins, XP, and win/loss counters to both sides of a real ring.fight()', async () => {
		const errors: unknown[] = [];
		const log = (err: unknown): number => errors.push(err);
		const game = new Game({ roomId: 'rewards-fresh-room', spawnBosses: false }, log);
		game.stateStore = noopStateStore;

		try {
			const { winner, loser, winnerMonster, loserMonster } = await setUpDecisiveDuel(game);

			const snapshot = {
				winnerCoins: winner.coins,
				loserCoins: loser.coins,
				winnerXp: winner.xp,
				loserXp: loser.xp,
				winnerMonsterXp: winnerMonster.xp,
				loserMonsterXp: loserMonster.xp,
				winnerWins: winner.battles.wins,
				loserLosses: loser.battles.losses,
			};

			await game.ring.fight();

			assertDecisiveRewards({ winner, loser, winnerMonster, loserMonster, before: snapshot });
			expect(errors, 'no engine errors logged during the fight').to.deep.equal([]);
		} finally {
			game.dispose();
		}
	});

	it('still credits rewards after a save/restore round trip, using the restored characters', async () => {
		// Every import in this test is dynamic (`await import(...)`), including `Game`
		// and `restoreGame` themselves, which the rest of this file imports statically.
		// This is load-bearing, not a style choice:
		//
		// `characters/helpers/hydrate.ts` (reached from `restoreGame` via
		// `characters/index.ts`) breaks a circular dependency by dynamically importing
		// `monsters/helpers/hydrate.js` at its own module-load time
		// (`export const hydrateHelpersReady = loadHelpers().catch(...)`), and that
		// module's transitive closure (monster classes → `BaseCreature` →
		// `shared/baseClass.ts` → `helpers/semaphore.ts`) is therefore only ever reached
		// through one `import()` call. Under this suite's `tsx`-transformed mocha loader
		// (see `.mocharc.yml`'s `import: tsx`) that closure is compiled as a SEPARATE
		// module graph from the one reached by this file's OWN top-level `import Game
		// from './game.js'` — with its own, different `globalSemaphore` object. A monster
		// hydrated by `restoreGame` then emits `creature.win`/`loss` on a semaphore that
		// `Game.initializeEvents()`'s listeners (bound to the *statically*-imported
		// graph's semaphore) are not listening on, so `Game.handleWinner`/`handleLoser`
		// silently never fire and `winner.coins` stays exactly 0 — reproducing this
		// roadmap item's symptom (win recorded, no coins) from a TEST-HARNESS identity
		// split, not the production ownership-guard bug this file is investigating.
		// `game.test.ts`'s cross-room-leakage test already documents the mirror image of
		// this split (there, mixing a dynamic and a static import of the same class
		// broke a *different* assertion). Node's real ESM loader has no such split — one
		// resolved URL is one cached module regardless of static/dynamic entry — so this
		// is confirmed test-tooling-only: routing every import in this one test through
		// `import()` puts `Game`, `restoreGame`, `Basilisk`, and the hydrated hydration
		// closure all in the SAME graph, and the assertions below pass for the same
		// production reason the other two tests in this file do.
		const DynGame = (await import('./game.js')).default;
		const dynRestoreGame = (await import('./index.js')).restoreGame;
		const DynBasilisk = (await import('./monsters/basilisk.js')).default;
		const dynTesting = await import('./testing/index.js');

		const errors: unknown[] = [];
		const log = (err: unknown): number => errors.push(err);
		const game = new DynGame({ roomId: 'rewards-restore-room', spawnBosses: false }, log);
		game.stateStore = dynTesting.noopStateStore;

		let restoredGame: InstanceType<typeof DynGame> | undefined;
		try {
			// Build the characters/monsters pre-restore with a plain, fully-serializable
			// deck — the custom lethal/pass cards above are plain objects with no
			// registered card type, so they would hydrate back as inert `UnknownCard`s if
			// they round-tripped through JSON. They are assigned fresh, in-memory, to the
			// *restored* monsters below instead — the fight itself always happens after
			// restore, so only character/monster identity needs to survive serialization.
			const channelA = dynTesting.createTestChannel(game.eventBus, 'user-a');
			const channelB = dynTesting.createTestChannel(game.eventBus, 'user-b');

			await game.getCharacter({
				channel: channelA.fn,
				id: 'user-a',
				name: 'Winner Trainer',
				gender: 'female',
				icon: '🦊',
			});
			await game.getCharacter({
				channel: channelB.fn,
				id: 'user-b',
				name: 'Loser Trainer',
				gender: 'male',
				icon: '🐍',
			});
			game.characters['user-a'].addMonster(new DynBasilisk({ name: 'Champion' }));
			game.characters['user-b'].addMonster(new DynBasilisk({ name: 'Underdog' }));

			const serialized = JSON.stringify(game);
			restoredGame = dynRestoreGame(serialized, log);

			// The restored characters must be the ones in the restored game's own
			// `characters` map — the room-scoped ownership guard
			// (`createRoomScopedEventGuard`) attributes a `creature.win`/`loss` event by
			// walking *this* game's `characters`, so a reward credited to a stale
			// pre-restore character reference would prove nothing about the restored room.
			const winner = restoredGame!.characters['user-a'];
			const loser = restoredGame!.characters['user-b'];
			expect(winner, 'winner should survive restore').to.exist;
			expect(loser, 'loser should survive restore').to.exist;

			const winnerMonster = winner.monsters[0];
			const loserMonster = loser.monsters[0];
			expect(winnerMonster, 'winner monster should survive restore').to.exist;
			expect(loserMonster, 'loser monster should survive restore').to.exist;

			// Now wire up the decisive fight on the restored, live objects.
			winnerMonster.cards = fullDeck(lethalCard('Finisher'));
			loserMonster.cards = fullDeck(passCard('Wait 0'));

			await winner.sendMonsterToTheRing({
				ring: restoredGame!.ring,
				channel: channelA.fn,
				channelName: 'ring',
				userId: 'user-a',
			});
			await loser.sendMonsterToTheRing({
				ring: restoredGame!.ring,
				channel: channelB.fn,
				channelName: 'ring',
				userId: 'user-b',
			});

			const snapshot = {
				winnerCoins: winner.coins,
				loserCoins: loser.coins,
				winnerXp: winner.xp,
				loserXp: loser.xp,
				winnerMonsterXp: winnerMonster.xp,
				loserMonsterXp: loserMonster.xp,
				winnerWins: winner.battles.wins,
				loserLosses: loser.battles.losses,
			};

			await restoredGame!.ring.fight();

			assertDecisiveRewards({ winner, loser, winnerMonster, loserMonster, before: snapshot });
			expect(errors, 'no engine errors logged during setup, restore, or the fight').to.deep.equal([]);
		} finally {
			game.dispose();
			restoredGame?.dispose();
		}
	});

	it('still credits the player side after a real fight against a transient boss contestant', async () => {
		// Boss owner id 'boss' (helpers/bosses.ts#randomContestant) is never registered in
		// `game.characters` — see docs/architecture/analytics-and-history.md's note that
		// it "is not a profile UUID and is filtered before any foreign-key write." That
		// also means the room-scoped ownership guard correctly rejects the boss side's own
		// creature.win/loss broadcast (it owns no character in this room) — this test
		// confirms that rejection does not collaterally swallow the *player's* reward,
		// which fires from the same fightConcludes() call on the same tick.
		const errors: unknown[] = [];
		const log = (err: unknown): number => errors.push(err);
		const game = new Game({ roomId: 'rewards-boss-room', spawnBosses: false }, log);
		game.stateStore = noopStateStore;

		try {
			const channel = createTestChannel(game.eventBus, 'user-a');
			const player = await game.getCharacter({
				channel: channel.fn,
				id: 'user-a',
				name: 'Boss Slayer',
				gender: 'female',
				icon: '🦊',
			});

			const playerMonster = new Basilisk({ name: 'Champion' });
			playerMonster.cards = fullDeck(lethalCard('Finisher'));
			player.addMonster(playerMonster);

			await player.sendMonsterToTheRing({
				ring: game.ring,
				channel: channel.fn,
				channelName: 'ring',
				userId: 'user-a',
			});

			const bossContestant = game.ring.spawnBoss();
			expect(bossContestant, 'a boss should have been able to spawn into an empty ring').to.exist;
			expect(game.characters['boss'], 'the boss must not be registered as a room character').to.not.exist;

			const snapshot = {
				coins: player.coins,
				xp: player.xp,
				monsterXp: playerMonster.xp,
				wins: player.battles.wins,
			};

			await game.ring.fight();

			expect(player.coins, 'player owner coins').to.equal(
				snapshot.coins + COINS_PER_VICTORY + COINS_PER_DAILY_FIGHT + earlyCoinBonus(0)
			);
			expect(player.xp, 'player owner xp').to.equal(snapshot.xp + XP_PER_VICTORY);
			expect(playerMonster.xp, 'player monster xp').to.be.greaterThan(snapshot.monsterXp);
			expect(player.battles.wins, 'player owner win count').to.equal(snapshot.wins + 1);
			expect(errors, 'no engine errors logged during the fight').to.deep.equal([]);
		} finally {
			game.dispose();
		}
	});
});

/**
 * Remaining hypotheses for the original report (2 wins / 9 losses, 0 coins), NOT ruled
 * out by this file, with evidence for/against each from reading the code:
 *
 * - Persistence debounce losing an in-memory coin award before it is ever saved:
 *   `Game.awardFightCoins` mutates `character.coins` in place and `scheduleSave()` debounces
 *   30s off the same `stateChange` broadcast this fight already emits (game.ts,
 *   `setOptions`), so a normal shutdown should still flush it. Weak evidence against: a
 *   process that dies *inside* that 30s window (crash, deploy, OOM) between several fights
 *   would lose the coin deltas but NOT the win/loss counts if a separate write path
 *   persisted those first — worth checking whether anything besides `Game.persistState()`
 *   (a full room snapshot) ever writes `battles` independently of `coins`. From reading
 *   `RoomManager`/`FightStatsSubscriber` (docs/architecture/analytics-and-history.md), the
 *   room's *live* balance is `characters[...].coins` in the same JSON blob as `battles` —
 *   both live or die together in one `persistState()` write, so this would have to be a
 *   projection-only symptom (Workshop wallet reading a stale `room_player_stats` row) that
 *   #145's staleness fix already addresses, not a live-balance loss. Needs a production
 *   log/metric correlating a save failure with a reported-zero session, which this
 *   in-process suite cannot produce.
 * - Connector-side character identity drift (the reporting user's connector-resolved
 *   `userId` not matching the `userId` `sendMonsterToTheRing`/`ring.addMonster` recorded,
 *   e.g. across a Discord account relink or a `guild_user_active_rooms` repair pointing at
 *   a stale room): would make `contestant.character` a *different* object than
 *   `game.characters[reportingUserId]`, so the reward lands on the wrong (or a since-
 *   orphaned) character while the reporting user's own balance never moves — the win/loss
 *   *counter* the player is looking at, though, comes from the room roster / their own
 *   `battles` read, which would also read the wrong character in that scenario. This can't
 *   be exercised without a real connector identity mapping; see
 *   docs/architecture/rooms-and-identity.md's "Profile identity and room characters".
 * - A second, currently-undiscovered gap in `createRoomScopedEventGuard`'s ownership walk
 *   (announcements/index.ts) that only misfires for some character/monster shape this
 *   suite's setup doesn't reproduce — e.g. a character or monster hydrated by a path other
 *   than `Game.getCharacter`/`hydrateCharacter` that doesn't land in the raw `optionsStore`
 *   shape `rawArray()` expects. Every path exercised here (`getCharacter`,
 *   `addMonster`, `sendMonsterToTheRing`, and a save/restore round trip through
 *   `restoreGame`/`hydrateCharacter`) credits correctly, which narrows this hypothesis
 *   without eliminating it.
 */
