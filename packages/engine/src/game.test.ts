import { expect } from 'chai';
import sinon from 'sinon';
import zlib from 'node:zlib';

import Game from './game.js';
import { restoreGame } from './index.js';
import { BaseCard } from './cards/base.js';
import Ring from './ring/index.js';
import { RoomEventBus } from './events/index.js';
import { engineReady } from './helpers/engine-ready.js';
import { globalSemaphore } from './helpers/semaphore.js';
import { XP_PER_VICTORY, XP_PER_DEFEAT } from './helpers/experience.js';
import { COINS_PER_VICTORY, COINS_PER_DEFEAT } from './constants/coins.js';
import Basilisk from './monsters/basilisk.js';
import Beastmaster from './characters/beastmaster.js';

describe('game.ts', () => {
	afterEach(() => {
		sinon.restore();
	});

	it('has an event bus', () => {
		const game = new Game();

		expect(game.eventBus).to.be.instanceOf(RoomEventBus);
	});

	it('has card probabilities', () => {
		const game = new Game();

		expect(game.getCardProbabilities()).to.be.an('object');
	});

	it('has a ring', () => {
		const game = new Game();

		expect(game.ring).to.be.instanceOf(Ring);
		expect(game.getRing()).to.equal(game.ring);
	});

	it('keeps ring announcements scoped to the room that emitted them', () => {
		const roomA = new Game({ roomId: 'room-a' });
		const roomB = new Game({ roomId: 'room-b' });
		const roomAEvents: Array<{ type: string }> = [];
		const roomBEvents: Array<{ type: string }> = [];

		roomA.eventBus.subscribe('room-a-spy', {
			deliver: (event) => roomAEvents.push({ type: event.type }),
		});
		roomB.eventBus.subscribe('room-b-spy', {
			deliver: (event) => roomBEvents.push({ type: event.type }),
		});

		try {
			roomA.ring.emit('bossWillSpawn', { delay: 120_000 });
			expect(roomAEvents.some((event) => event.type === 'announce')).to.equal(true);
			expect(roomBEvents.some((event) => event.type === 'announce')).to.equal(false);
		} finally {
			roomA.dispose();
			roomB.dispose();
		}
	});

	it('does not mirror card-play announcements across active rooms', async () => {
		const roomA = new Game({ roomId: 'room-a' });
		const roomB = new Game({ roomId: 'room-b' });
		const roomAEvents: Array<{ type: string; text: string }> = [];
		const roomBEvents: Array<{ type: string; text: string }> = [];

		roomA.eventBus.subscribe('room-a-card-spy', {
			deliver: (event) => roomAEvents.push({ type: event.type, text: event.text ?? '' }),
		});
		roomB.eventBus.subscribe('room-b-card-spy', {
			deliver: (event) => roomBEvents.push({ type: event.type, text: event.text ?? '' }),
		});

		try {
			const { HitCard } = await import('./cards/hit.js');
			const Basilisk = (await import('./monsters/basilisk.js')).default;
			const Beastmaster = (await import('./characters/beastmaster.js')).default;

			const card = new HitCard();
			const monster = new Basilisk({ name: 'Room A Monster' });
			monster.cards = [card];

			const character = new Beastmaster({ name: 'Room A Trainer' });
			character.addMonster(monster);
			roomA.characters = { ...roomA.characters, 'room-a-user': character };

			globalSemaphore.emit('card.played', card.name, card, { player: monster });

			expect(roomAEvents.some((event) => event.type === 'card.played')).to.equal(true);
			expect(roomBEvents.some((event) => event.type === 'card.played')).to.equal(false);
		} finally {
			roomA.dispose();
			roomB.dispose();
		}
	});

	it('does not mirror level-up announcements across active rooms', async () => {
		const roomA = new Game({ roomId: 'room-a' });
		const roomB = new Game({ roomId: 'room-b' });
		const roomAEvents: Array<{ type: string; text: string }> = [];
		const roomBEvents: Array<{ type: string; text: string }> = [];

		roomA.eventBus.subscribe('room-a-levelup-spy', {
			deliver: (event) => roomAEvents.push({ type: event.type, text: event.text ?? '' }),
		});
		roomB.eventBus.subscribe('room-b-levelup-spy', {
			deliver: (event) => roomBEvents.push({ type: event.type, text: event.text ?? '' }),
		});

		try {
			const Basilisk = (await import('./monsters/basilisk.js')).default;
			const Beastmaster = (await import('./characters/beastmaster.js')).default;

			const monster = new Basilisk({ name: 'Room A Leveler' });
			const character = new Beastmaster({ name: 'Room A Trainer' });
			character.addMonster(monster);
			roomA.characters = { ...roomA.characters, 'room-a-user': character };

			globalSemaphore.emit('creature.levelUp', monster.name, monster, { monster, level: 2 });

			expect(roomAEvents.some((event) => event.text.includes('has reached level 2'))).to.equal(true);
			expect(roomBEvents.some((event) => event.text.includes('has reached level 2'))).to.equal(false);
		} finally {
			roomA.dispose();
			roomB.dispose();
		}
	});

	it('does not mirror heal announcements across active rooms', async () => {
		const roomA = new Game({ roomId: 'room-a' });
		const roomB = new Game({ roomId: 'room-b' });
		const roomAEvents: Array<{ type: string; text: string }> = [];
		const roomBEvents: Array<{ type: string; text: string }> = [];

		roomA.eventBus.subscribe('room-a-heal-spy', {
			deliver: (event) => roomAEvents.push({ type: event.type, text: event.text ?? '' }),
		});
		roomB.eventBus.subscribe('room-b-heal-spy', {
			deliver: (event) => roomBEvents.push({ type: event.type, text: event.text ?? '' }),
		});

		try {
			const Basilisk = (await import('./monsters/basilisk.js')).default;
			const Beastmaster = (await import('./characters/beastmaster.js')).default;

			const monster = new Basilisk({ name: 'Room A Healer' });
			const character = new Beastmaster({ name: 'Room A Trainer' });
			character.addMonster(monster);
			roomA.characters = { ...roomA.characters, 'room-a-user': character };
			roomA.ring.contestants = [{ monster, character, userId: 'room-a-user' }] as any;

			globalSemaphore.emit('creature.heal', monster.name, monster, { amount: 2 });

			expect(roomAEvents.some((event) => event.text.includes('healed 2 hp'))).to.equal(true);
			expect(roomBEvents.some((event) => event.text.includes('healed 2 hp'))).to.equal(false);
		} finally {
			roomA.dispose();
			roomB.dispose();
		}
	});

	it('does not double-award XP, coins, or a card drop from another room\'s win (creature.win cross-room leakage)', () => {
		// Regression: Game.initializeEvents() bound handleWinner/handleLoser/
		// handlePermaDeath/handleFled directly to `creature.*` — the ONLY
		// creature.* listeners in the engine that skipped the room-scoping guard
		// applied everywhere else in announcements/index.ts. Every loaded Game
		// instance shares one process-wide semaphore for these events, so a single
		// win anywhere used to grant its reward once per currently-loaded room.
		//
		// Basilisk/Beastmaster are imported statically (module top-level) here
		// rather than via dynamic import(): under this test runner's on-the-fly TS
		// transform, a dynamically-imported class's own module graph is a
		// SEPARATE instance from one reached via a static import, so its BaseClass
		// methods bind to a different (duplicate) globalSemaphore EventEmitter
		// than Game's listeners are registered on — the emitted event would
		// never reach them at all. That split is a test-tooling artifact of
		// mixing static and dynamic ESM imports of the same file within one
		// process, not something that can happen in the real compiled build.
		const roomA = new Game({ roomId: 'room-a' });
		const roomB = new Game({ roomId: 'room-b' });

		try {
			const monster = new Basilisk({ name: 'Winner' });
			const character = new Beastmaster({ name: 'Room A Trainer' });
			character.addMonster(monster);
			roomA.characters = { ...roomA.characters, 'room-a-user': character };

			const xpBefore = character.xp;
			const coinsBefore = character.coins;
			const deckLengthBefore = character.deck.length;

			const contestant = { character, monster, userId: 'room-a-user' };
			monster.emit('win', { contestant });

			expect(character.xp).to.equal(xpBefore + XP_PER_VICTORY);
			expect(character.coins).to.equal(coinsBefore + COINS_PER_VICTORY);
			expect(character.deck.length).to.equal(deckLengthBefore + 1);
		} finally {
			roomA.dispose();
			roomB.dispose();
		}
	});

	it('awards the permaDeath consolation reward exactly once, scoped to the owning room', () => {
		// Regression, two bugs in one: (1) Ring.handlePermaDeath never called
		// `contestant.monster.emit('permaDeath', ...)` like its win/loss/fled
		// siblings do, so Game.handlePermaDeath's listener never fired at all —
		// a permanently destroyed monster granted its owner no reward whatsoever.
		// (2) once reachable, the same cross-room leakage as the win test above
		// would double-award it per loaded room without the guard.
		const roomA = new Game({ roomId: 'room-a' });
		const roomB = new Game({ roomId: 'room-b' });

		try {
			const monster = new Basilisk({ name: 'Destroyed' });
			const character = new Beastmaster({ name: 'Room A Trainer' });
			character.addMonster(monster);
			roomA.characters = { ...roomA.characters, 'room-a-user': character };

			const xpBefore = character.xp;
			const coinsBefore = character.coins;

			const contestant = { character, monster, userId: 'room-a-user' };
			monster.emit('permaDeath', { contestant });

			expect(character.xp).to.equal(xpBefore + XP_PER_DEFEAT * 2);
			expect(character.coins).to.equal(coinsBefore + COINS_PER_DEFEAT * 2);
		} finally {
			roomA.dispose();
			roomB.dispose();
		}
	});

	it('does not let another room\'s activity reset this room\'s save debounce timer', () => {
		// Regression: setOptions() broadcast `stateChange` on the process-wide
		// globalSemaphore with zero arguments, so Game's listener (also bound on
		// globalSemaphore) could not tell which room changed and rescheduled its
		// own save on every mutation anywhere in the process. On a busy multi-room
		// server this could keep resetting a quiet room's debounce indefinitely.
		const clock = sinon.useFakeTimers({ shouldClearNativeTimers: true });
		const roomA = new Game({ roomId: 'room-a' });
		const roomB = new Game({ roomId: 'room-b' });
		const saveA = sinon.stub();

		try {
			roomA.saveState = saveA;

			roomA.emit('stateChange'); // schedules room A's save for t=30s

			// Room B mutates state every second for 25 seconds — if this leaked
			// across rooms it would keep resetting room A's 30s debounce timer.
			for (let i = 0; i < 25; i += 1) {
				clock.tick(1_000);
				roomB.emit('stateChange');
			}

			clock.tick(6_000); // t=31s: room A's own t=0 change should have flushed
			expect(saveA.calledOnce).to.equal(true);
		} finally {
			roomA.saveState = undefined;
			roomB.dispose();
			roomA.dispose();
			clock.restore();
		}
	});

	it('can look at the ring', () => {
		const game = new Game();
		const lookStub = sinon.stub(game.ring, 'look');

		game.lookAtRing('user-1');

		expect(lookStub.calledOnce).to.equal(true);
		expect(lookStub.calledWith('user-1', undefined, undefined)).to.equal(true);
	});

	it('can save state', () => {
		const clock = sinon.useFakeTimers({ shouldClearNativeTimers: true });
		const game = new Game();
		const saveStateStub = sinon.stub();

		try {
			game.saveState = saveStateStub;
			game.emit('stateChange');

			// Advance past the 30s debounce; clock.tick also drains setImmediate callbacks
			clock.tick(31_000);

			expect(saveStateStub.calledOnce).to.equal(true);
			const arg = saveStateStub.firstCall.args[0] as string;
			const decoded = zlib.gunzipSync(Buffer.from(arg, 'base64')).toString();
			expect(JSON.parse(decoded)).to.be.an('object');
		} finally {
			// Clear stateSaveFunc so stale listener doesn't fire setTimeout in subsequent tests
			game.saveState = undefined;
			clock.restore();
		}
	});

	it('does not schedule recursive saves while persisting ring contestants', () => {
		const clock = sinon.useFakeTimers({ shouldClearNativeTimers: true });
		const game = new Game();
		const saveStateStub = sinon.stub();

		try {
			game.ring.contestants = [
				{
					userId: 'user-1',
					character: { givenName: 'Hero' },
					monster: { stableId: 'monster-1', givenName: 'Fang' },
				},
				{
					userId: 'boss-1',
					isBoss: true,
					character: { givenName: 'Boss' },
					monster: { stableId: 'boss-monster', givenName: 'Big Boss' },
				},
			] as any;

			game.saveState = saveStateStub;
			game.emit('stateChange');

			clock.tick(31_000);
			expect(saveStateStub.calledOnce).to.equal(true);

			// Advance another debounce window without new state changes: no extra save.
			clock.tick(31_000);
			expect(saveStateStub.calledOnce).to.equal(true);

			const arg = saveStateStub.firstCall.args[0] as string;
			const decoded = zlib.gunzipSync(Buffer.from(arg, 'base64')).toString();
			const persisted = JSON.parse(decoded) as {
				options?: { ringContestantRefs?: Array<{ userId: string; stableId: string }> };
			};

			expect(persisted.options?.ringContestantRefs).to.deep.equal([
				{ userId: 'user-1', stableId: 'monster-1' },
			]);
		} finally {
			game.saveState = undefined;
			clock.restore();
		}
	});

	it('can draw a card', () => {
		const game = new Game();
		const card = game.drawCard({ useless: 'option' });

		expect(card).to.be.instanceOf(BaseCard);
		expect(card.name).to.not.equal(BaseCard.name);
	});

	it('can draw a card for a specific monster', () => {
		const game = new Game();
		const canHoldCard = sinon.stub().returns(true);
		const monster = { canHoldCard };
		const card = game.drawCard({ useless: 'option' }, monster);

		expect(card).to.be.instanceOf(BaseCard);
		expect(canHoldCard.called).to.equal(true);
	});

	describe('save/restore round-trip', () => {
		before(async () => {
			await engineReady;
		});

		it('restores a game with a character whose monster cards all have play() methods', async () => {
			const game = new Game({ roomId: 'restore-test' });

			const Basilisk = (await import('./monsters/basilisk.js')).default;
			const { HitCard } = await import('./cards/hit.js');
			const { HealCard } = await import('./cards/heal.js');
			const { FleeCard } = await import('./cards/flee.js');
			const Beastmaster = (await import('./characters/beastmaster.js')).default;

			const cards = [new HitCard(), new HitCard(), new HealCard(), new FleeCard()];
			const monster = new Basilisk({ name: 'Fang' });
			monster.cards = cards;

			const character = new Beastmaster({ name: 'Tester' });
			character.addMonster(monster);
			game.characters['test-user'] = character;

			// Serialize
			const serialized = JSON.stringify(game);
			expect(serialized).to.be.a('string');

			// Restore
			const restoredGame = restoreGame(serialized);
			const restoredCharacter = restoredGame.characters['test-user'];
			expect(restoredCharacter, 'character should be restored').to.exist;

			const restoredMonster = restoredCharacter.monsters[0];
			expect(restoredMonster, 'monster should be restored').to.exist;
			expect(restoredMonster.cards.length, 'cards should be restored').to.be.above(0);

			for (let i = 0; i < restoredMonster.cards.length; i++) {
				const card = restoredMonster.cards[i];
				expect(
					typeof card?.play,
					`card[${i}] (${card?.name ?? card?.constructor?.name}) should have play() — got ${typeof card?.play}`
				).to.equal('function');
			}
		});

		it('restored monster cards have play() methods (not plain objects)', async () => {
			const game = new Game({ roomId: 'restore-instance-test' });

			const Basilisk = (await import('./monsters/basilisk.js')).default;
			const { HitCard } = await import('./cards/hit.js');
			const Beastmaster = (await import('./characters/beastmaster.js')).default;

			const monster = new Basilisk({ name: 'Scales' });
			monster.cards = [new HitCard(), new HitCard(), new HitCard()];
			const character = new Beastmaster({ name: 'Hero' });
			character.addMonster(monster);
			game.characters['user-2'] = character;

			const restoredGame = restoreGame(JSON.stringify(game));
			const restoredMonster = restoredGame.characters['user-2']?.monsters[0];

			for (const card of restoredMonster.cards) {
				expect(
					typeof card?.play,
					`restored card "${card?.name}" should have play(), not be a plain object`
				).to.equal('function');
			}
		});
	});

	describe('shop', () => {
		before(async () => {
			await engineReady;
		});

		it('generates a shop lazily on first access', () => {
			const game = new Game({ roomId: 'shop-lazy-test' });

			const shop = game.shop;

			expect(shop.name).to.be.a('string');
			expect(shop.items).to.be.an('array');
		});

		it('returns the same shop on repeated access before it closes', () => {
			const game = new Game({ roomId: 'shop-stable-test' });

			const first = game.shop;
			const second = game.shop;

			expect(second).to.equal(first);
		});

		it('round-trips the shop through save/restore, including closingTime and stock', () => {
			const game = new Game({ roomId: 'shop-restore-test' });
			const shop = game.shop;

			const serialized = JSON.stringify(game);
			const restoredGame = restoreGame(serialized);

			expect(restoredGame.shop.name).to.equal(shop.name);
			expect(restoredGame.shop.adjective).to.equal(shop.adjective);
			expect(restoredGame.shop.closingTime).to.be.instanceOf(Date);
			expect(restoredGame.shop.closingTime.getTime()).to.equal(shop.closingTime.getTime());
			expect(restoredGame.shop.items.length).to.equal(shop.items.length);
		});

		it('gives each room its own independent shop', () => {
			const roomA = new Game({ roomId: 'shop-room-a' });
			const roomB = new Game({ roomId: 'shop-room-b' });

			// Buying out room A's shop must never affect room B's.
			const shopA = roomA.shop;
			roomA.commitShop({ ...shopA, items: [] });

			expect(roomA.shop.items).to.have.lengthOf(0);
			expect(roomB.shop.items.length).to.be.above(0);
		});

		it('regenerates a fresh shop once the stored one has passed its closing time', () => {
			const clock = sinon.useFakeTimers({ toFake: ['Date'] });

			try {
				const game = new Game({ roomId: 'shop-refresh-test' });
				const original = game.shop;

				clock.tick(original.closingTime.getTime() - Date.now() + 1);

				const refreshed = game.shop;
				expect(refreshed).to.not.equal(original);
				expect(refreshed.closingTime.getTime()).to.be.above(original.closingTime.getTime());
			} finally {
				clock.restore();
			}
		});
	});

	describe('getCharacter Player-name auto-update', () => {
		it('updates givenName when existing character has placeholder "Player" name', async () => {
			const game = new Game();
			const channel = sinon.stub().resolves('0');

			// getCharacter will call createCharacter which uses the provided name as default
			// without prompting — char will be created with givenName 'Player'
			const char1 = await game.getCharacter({ channel, id: 'user-1', name: 'Player' });
			expect((char1 as any).givenName).to.equal('Player');

			// Second call with the real name resolved server-side
			const char2 = await game.getCharacter({ channel, id: 'user-1', name: 'RealName' });

			expect(char2).to.equal(char1); // same object returned
			// startCase splits camelCase: 'RealName' → 'Real Name'
			expect((char2 as any).givenName).to.equal('Real Name');
		});

		it('does not overwrite a custom character name with the real display name', async () => {
			const game = new Game();
			const channel = sinon.stub().resolves('0');

			// Create char with placeholder name
			const char1 = await game.getCharacter({ channel, id: 'user-2', name: 'Player' });
			// User explicitly renamed their character via editSelf — update via setOptions
			(char1 as any).setOptions({ name: 'CustomHero' });
			expect((char1 as any).givenName).to.equal('Custom Hero');

			const char2 = await game.getCharacter({ channel, id: 'user-2', name: 'RealName' });
			// 'Custom Hero' !== 'Player', so no override should happen
			expect((char2 as any).givenName).to.equal('Custom Hero'); // unchanged
		});

		it('emits stateChange when a brand-new character is created, so a save is scheduled', async () => {
			// Regression: `game.characters[id] = character` is a direct mutation of
			// the options-backed characters map, bypassing setOptions() — no
			// stateChange fired from the assignment itself. The new character's own
			// constructor does emit a global stateChange, but at that point it isn't
			// in game.characters yet, so the room-scoped guard (added alongside this
			// fix) would not attribute it to this game either way. Without the
			// explicit emit added to getCharacter, a freshly created character could
			// be silently lost if the server restarted before anything else in the
			// room changed.
			const clock = sinon.useFakeTimers({ shouldClearNativeTimers: true });
			const game = new Game();
			const saveStateStub = sinon.stub();
			const channel = sinon.stub().resolves('0');

			try {
				game.saveState = saveStateStub;

				await game.getCharacter({ channel, id: 'user-3', name: 'Player' });

			clock.tick(31_000);
			expect(saveStateStub.calledOnce).to.equal(true);
		} finally {
			game.saveState = undefined;
			clock.restore();
		}
	});
	});

	describe('boss summon pending — serialization/restore (Findings 1 & 4)', () => {
		it('refunds pending summons on restore when no encounter began', () => {
			const userId = 'user-refund';
			const ts = Date.now();

			// Simulate a game that had a pending summon but no fight started
			const game = new Game({
				bossSummons: { [userId]: [ts] },
				bossSummonsPending: { [userId]: [ts] },
			});

			// Constructor calls _refundPendingBossSummons — pending should be cleared
			// and the charge refunded
			expect((game as any).bossSummons[userId]).to.be.undefined;
			expect(Object.keys((game as any).bossSummonsPending).length).to.equal(0);
			game.dispose();
		});

		it('does not refund if bossSummonsPending is absent (backward compat)', () => {
			const userId = 'user-compat';
			const ts = Date.now();

			// Old game state with no bossSummonsPending field
			const game = new Game({
				bossSummons: { [userId]: [ts] },
				// no bossSummonsPending
			});

			// Charge must be preserved — nothing to refund
			expect((game as any).bossSummons[userId]).to.deep.equal([ts]);
			game.dispose();
		});

		it('finalization is durable via stateStore.save (production path): save is called at persistState() time, before the debounce window, with cleared bossSummonsPending', async () => {
			// Companion to the stateSaveFunc test below. The server attaches a StateStore
			// (PostgresStateStore) rather than a stateSaveFunc callback. stateStore.save() is
			// called immediately inside persistState() — not via setImmediate like stateSaveFunc —
			// so the durability guarantee holds on the production code path too.
			// See docs/roadmap/10b-bugs-fixed.md #39 (stateStore.save follow-up).
			const userId = 'user-durable-store';
			const ts = Date.now();
			const roomId = 'test-room-durability';

			const savedStates: Array<{ roomId: string; state: string }> = [];
			const mockStore = {
				save: async (rid: string, state: string) => { savedStates.push({ roomId: rid, state }); },
				load: async () => null,
			};

			const game = new Game({
				roomId,
				bossSummons: { [userId]: [ts] },
				bossSummonsPending: { [userId]: [ts] },
			});

			// After construction, refund already ran (pending from before restart).
			// Re-add the pending entry as if a fresh summon just occurred:
			(game as any).optionsStore = {
				...(game as any).optionsStore,
				bossSummons: { [userId]: [ts] },
				bossSummonsPending: { [userId]: [ts] },
			};

			// Wire the production-shaped stateStore (not the saveState / stateSaveFunc path)
			game.stateStore = mockStore;

			// Simulate fightBegins — the boss-summon finalizer subscribes to this event
			game.eventBus.publish({
				type: 'ring.fight',
				scope: 'public',
				text: 'Fight begins',
				payload: { eventName: 'fightBegins' },
			});

			// stateStore.save() is called synchronously by persistState() (no setImmediate).
			// The async save body runs synchronously up to its first await (which doesn't
			// exist in the mock), so savedStates is populated before publish() returns.
			expect(savedStates.length, 'stateStore.save must be called at persistState() time').to.be.above(0);

			const lastSaved = savedStates[savedStates.length - 1]!;
			expect(lastSaved.roomId).to.equal(roomId);

			const decoded = JSON.parse(
				zlib.gunzipSync(Buffer.from(lastSaved.state, 'base64')).toString()
			);
			const pendingInSave = decoded?.options?.bossSummonsPending;
			const pendingEntries = pendingInSave ? Object.keys(pendingInSave) : [];
			expect(pendingEntries.length, 'stateStore save must have empty bossSummonsPending').to.equal(0);

			// Restoring from this save must NOT refund the charge
			const restoredGame = restoreGame(lastSaved.state);
			expect(
				(restoredGame as any).bossSummons[userId],
				'charge must be preserved after restore — it was genuinely spent'
			).to.deep.equal([ts]);

			game.stateStore = undefined;
			game.dispose();
			restoredGame.dispose();
		});

		it('finalization is durable: clearing pending saves at next event loop tick, before debounce, so a restart cannot refund an already-used charge', async () => {
			// Critical (Finding 1): the in-memory clear of bossSummonsPending on
			// fightBegins was not persisted immediately; only the 30s debounce would
			// flush it. A restart before the debounce left the pending entry in the
			// saved state, so the next restore would incorrectly refund the charge.
			//
			// Fix: when fightBegins fires, write to optionsStore directly (no
			// stateChange) then call persistState() immediately. persistState() flushes
			// via setImmediate (one event loop tick) rather than the 30s debounce.
			const userId = 'user-durable';
			const ts = Date.now();

			const saves: string[] = [];
			const game = new Game({
				bossSummons: { [userId]: [ts] },
				bossSummonsPending: { [userId]: [ts] },
			});
			// After construction the refund has already run (pending from before restart).
			// Now simulate a NEW summon and check finalization durability.
			// Re-add the pending entry as if a fresh summon just occurred:
			(game as any).optionsStore = {
				...(game as any).optionsStore,
				bossSummons: { [userId]: [ts] },
				bossSummonsPending: { [userId]: [ts] },
			};

			// Wire a save function that captures serialized state
			game.saveState = (state: string) => saves.push(state);

			// Simulate a fightBegins event — this should schedule a save immediately
			// (not wait for the 30s debounce). persistState() uses setImmediate, so
			// the callback fires at the next event loop tick, not synchronously.
			game.eventBus.publish({
				type: 'ring.fight',
				scope: 'public',
				text: 'Fight begins',
				payload: { eventName: 'fightBegins' },
			});

			// Yield to let the setImmediate callback fire
			await new Promise<void>(resolve => setImmediate(resolve));

			// The finalization must have saved BEFORE the debounce window (30s)
			expect(saves.length, 'persistState must fire at next event-loop tick, not via 30s debounce').to.be.above(0);

			// The saved state must NOT contain bossSummonsPending with the charge
			const lastSave = saves[saves.length - 1]!;
			const decoded = JSON.parse(
				zlib.gunzipSync(Buffer.from(lastSave, 'base64')).toString()
			);
			const pendingInSave = decoded?.options?.bossSummonsPending;
			const pendingEntries = pendingInSave ? Object.keys(pendingInSave) : [];
			expect(pendingEntries.length, 'saved state must have empty bossSummonsPending').to.equal(0);

			// Restoring from this save must NOT refund the charge
			const restoredGame = restoreGame(lastSave);
			expect(
				(restoredGame as any).bossSummons[userId],
				'charge must be preserved after restore — it was genuinely spent'
			).to.deep.equal([ts]);

			game.saveState = undefined;
			game.dispose();
			restoredGame.dispose();
		});
	});
});
