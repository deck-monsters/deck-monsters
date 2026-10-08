import { useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { useAuth } from '../lib/auth-context.js';
import { trpc } from '../lib/trpc.js';
import { RingFeedContext } from './useRingFeed.js';
import { FIGHT_ON_RING_POLL_MS, QUIET_RING_POLL_MS } from './useFightOnRing.js';

/**
 * The getting-started guide's one source of truth. The Console and the Workshop both read
 * it, so a step cannot be right in one place and stale in the other, and dismissing the
 * guide in one hides it in both (roadmap 39, batch 3, C3).
 *
 * Phases, in the order a new player meets them:
 * - `spawn`       no monster yet.
 * - `waiting`     a monster in the ring, no fight fought yet (wins over equip/send: the
 *                 player is already waiting on a fight, whatever another monster's deck is).
 * - `equip`       a living monster outside the ring whose deck is not full.
 * - `send`        a living monster outside the ring with a full deck, none in the ring.
 * - `fallen`      a monster has fallen after the first fight.
 * - `change_card` the first fight is over, nothing has fallen; ends when the player changes
 *                 a card on any monster (see `deckSignature`) or dismisses.
 * - `hidden`      dismissed, done, or an established player.
 */
export type GuidedPhase = 'spawn' | 'equip' | 'send' | 'waiting' | 'fallen' | 'change_card' | 'hidden';

export interface GuidedMonster {
	name: string;
	dead: boolean;
	inRing: boolean;
	/** In a running fight now (the inventory's `inEncounter`). Optional: older callers omit it. */
	inEncounter?: boolean;
	cards: string[];
	cardSlots: number;
	battles: { total: number };
}

export interface GuidedStep {
	phase: GuidedPhase;
	/** The monster the step is about; empty when there is none (`spawn`, `hidden`). */
	name: string;
	/** That monster's deck size, for the equip step. */
	slots: number;
}

const HIDDEN: GuidedStep = { phase: 'hidden', name: '', slots: 0 };

const hasFought = (monsters: GuidedMonster[]) => monsters.some((m) => m.battles.total > 0);

/** Pure: which step the guide is on. `complete` is the dismissed/done/established flag. */
export function guidedStep(monsters: GuidedMonster[], complete: boolean, fought = hasFought(monsters)): GuidedStep {
	if (complete) return HIDDEN;
	if (monsters.length === 0) return { phase: 'spawn', name: '', slots: 0 };

	if (fought) {
		/*
		 * Every dead monster in the inventory can be revived: a permanently destroyed one is
		 * dropped from the character (`Ring.handleLoser`'s `dropMonster`) and so never
		 * appears here, and `revivesAt` is null for any fallen monster whose revival has not
		 * been started yet, so it cannot be the test. Fallen wins over change_card: reviving
		 * is what lets the player fight again.
		 */
		const fallen = monsters.find((m) => m.dead);
		if (fallen) return { phase: 'fallen', name: fallen.name, slots: fallen.cardSlots };
		// `fought` is sticky (see the hook), so the monster that fought may have been buried.
		const subject = monsters.find((m) => m.battles.total > 0) ?? monsters[0]!;
		return { phase: 'change_card', name: subject.name, slots: subject.cardSlots };
	}

	const inRing = monsters.find((m) => m.inRing);
	if (inRing) return { phase: 'waiting', name: inRing.name, slots: inRing.cardSlots };

	const unequipped = monsters.find((m) => !m.dead && !m.inRing && m.cards.length < m.cardSlots);
	if (unequipped) return { phase: 'equip', name: unequipped.name, slots: unequipped.cardSlots };

	// Equipped, not in the ring (a send is refused for a short deck, hence equip came first).
	const ready = monsters.find((m) => !m.dead && !m.inRing);
	if (ready) return { phase: 'send', name: ready.name, slots: ready.cardSlots };

	// Only fallen monsters and no fight yet: nothing the guide can usefully say.
	return HIDDEN;
}

/**
 * Pure: has this player been here before? Decided once, from the first inventory load
 * (see `useGuidedStart`). `hasOutcomeHistory` is a past win, loss, draw, flight or
 * permanent death in the room's console history.
 */
export function isEstablishedPlayer(monsters: GuidedMonster[], hasOutcomeHistory: boolean): boolean {
	return hasFought(monsters) || hasOutcomeHistory || monsters.length > 1;
}

/** Each monster's deck as one string per name, ignoring order (a reorder is not a change). */
export type DeckSnapshot = Record<string, string>;

export function deckSnapshot(monsters: GuidedMonster[]): DeckSnapshot {
	return Object.fromEntries(monsters.map((m) => [m.name, [...m.cards].sort().join('|')]));
}

/**
 * Pure: did a card change on any monster present in both snapshots? Only shared monsters
 * count, so training or burying a monster does not read as the player changing a card.
 * Monsters are matched by name; the inventory has no other stable id.
 */
export function deckChanged(baseline: DeckSnapshot, monsters: GuidedMonster[]): boolean {
	const now = deckSnapshot(monsters);
	return Object.keys(baseline).some((name) => name in now && now[name] !== baseline[name]);
}

const OUTCOME_EVENT_TYPES = new Set(['ring.win', 'ring.loss', 'ring.draw', 'ring.fled', 'ring.permaDeath']);

/* ---- shared state ---------------------------------------------------------------- */

/*
 * Per user AND room: each room decides "established" on its own first load, and a dismissal
 * in one room does not hide the guide in another. The older per-user key
 * (`ftuxComplete:${userId}`, plain `ftuxComplete` with no user) is still honoured as
 * complete in every room, so nobody who already dismissed the guide sees it again.
 */
const scopeOf = (userId: string | undefined, roomId: string | undefined) => `${userId ?? ''}:${roomId ?? ''}`;
const completeKey = (userId: string | undefined, roomId: string | undefined) =>
	userId ? `ftuxComplete:${userId}:${roomId ?? ''}` : `ftuxComplete::${roomId ?? ''}`;
const legacyCompleteKeys = (userId: string | undefined) =>
	userId ? [`ftuxComplete:${userId}`, 'ftuxComplete'] : ['ftuxComplete'];
// "This player was new when the guide first loaded". Without it, a new player's first
// fight followed by a reload would look like an established player and end the guide.
const startedKey = (userId: string | undefined, roomId: string | undefined) =>
	`ftuxStarted:${userId ?? ''}:${roomId ?? ''}`;
const isCompleteInStorage = (userId: string | undefined, roomId: string | undefined) =>
	[completeKey(userId, roomId), ...legacyCompleteKeys(userId)].some(readFlag);

function readFlag(key: string): boolean {
	try {
		return typeof localStorage !== 'undefined' && localStorage.getItem(key) === 'true';
	} catch {
		return false;
	}
}

function writeFlag(key: string): void {
	try {
		if (typeof localStorage !== 'undefined') localStorage.setItem(key, 'true');
	} catch {
		// Storage can be blocked; the in-memory state below still hides the guide this session.
	}
}

// Per-user state both surfaces share. In memory because it only has to outlive a render
// of either surface; the durable parts (complete, started) live in local storage.
interface Shared {
	complete: boolean;
	decided: boolean;
	// A fight has been seen; sticky so burying the only monster that fought cannot rewind the guide.
	fought: boolean;
	baseline: DeckSnapshot | null;
}
const shared = new Map<string, Shared>();
const listeners = new Set<() => void>();
let version = 0;

function sharedFor(userId: string | undefined, roomId: string | undefined): Shared {
	const key = scopeOf(userId, roomId);
	let entry = shared.get(key);
	if (!entry) {
		entry = { complete: isCompleteInStorage(userId, roomId), decided: false, fought: false, baseline: null };
		shared.set(key, entry);
	}
	return entry;
}

function update(userId: string | undefined, roomId: string | undefined, patch: Partial<Shared>): void {
	Object.assign(sharedFor(userId, roomId), patch);
	version += 1;
	listeners.forEach((listener) => listener());
}

function complete(userId: string | undefined, roomId: string | undefined): void {
	writeFlag(completeKey(userId, roomId));
	update(userId, roomId, { complete: true });
}

function subscribe(listener: () => void): () => void {
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
}

/** Test seam: forget the in-memory state (local storage is the test's to clear). */
export function resetGuidedStartForTests(): void {
	shared.clear();
	version += 1;
}

type InventoryMonster = Partial<GuidedMonster> & { name: string };

export function useGuidedStart(roomId: string | undefined): GuidedStep & { fightComing: boolean; fightOn: boolean; dismiss: () => void } {
	const { user } = useAuth();
	const userId = user?.id;
	useSyncExternalStore(subscribe, () => version, () => version);

	const inventory = trpc.game.myInventory.useQuery({ roomId: roomId ?? '' }, { enabled: !!roomId, staleTime: 30_000 });
	const history = trpc.game.consoleHistory.useQuery({ roomId: roomId ?? '' }, { enabled: !!roomId });

	const monsters = useMemo<GuidedMonster[] | undefined>(() => {
		const rows = inventory.data?.monsters as InventoryMonster[] | undefined;
		if (!rows) return undefined;
		return rows.map((m) => ({
			name: m.name,
			dead: Boolean(m.dead),
			inRing: Boolean(m.inRing),
			inEncounter: Boolean(m.inEncounter),
			cards: m.cards ?? [],
			cardSlots: m.cardSlots ?? 0,
			battles: { total: m.battles?.total ?? 0 },
		}));
	}, [inventory.data]);
	// A failed history query leaves the guide hidden: without it a veteran could not be told
	// from a new player, and showing the guide to a veteran is worse than not showing it.
	const historyReady = history.data !== undefined;
	const hasOutcomeHistory = useMemo(
		() => (history.data ?? []).some((ev) => OUTCOME_EVENT_TYPES.has(ev.type)),
		[history.data],
	);

	const { complete: isComplete, decided, fought, baseline } = sharedFor(userId, roomId);
	// Until the first load settles the guide stays hidden: showing a step to a player
	// who is about to be classed as established would flash it for nothing.
	const loaded = monsters !== undefined && historyReady;
	const step = loaded && decided ? guidedStep(monsters, isComplete, fought || hasFought(monsters)) : HIDDEN;
	const phase = step.phase;

	// Same room-scoped query, cache entry and cadence as `useFightOnRing`/RingPane. It only
	// decides whether the `waiting` step still suggests summoning a boss.
	const ringState = trpc.game.ringState.useQuery(
		{ roomId: roomId ?? '' },
		{
			// Only the `waiting` step reads it; everyone else would poll for nothing.
			enabled: !!roomId && phase === 'waiting',
			refetchInterval: (query: { state: { data?: { inEncounter?: boolean } } }) =>
				query.state.data?.inEncounter ? FIGHT_ON_RING_POLL_MS : QUIET_RING_POLL_MS,
		},
	);

	useEffect(() => {
		if (!loaded || isComplete) return;
		if (!decided) {
			/*
			 * "Established" is decided once, here, from the first load. Re-testing it on
			 * every inventory change used to end the guide the moment a new player's first
			 * fight made `battles > 0`, so no step could ever follow the first fight.
			 */
			if (!readFlag(startedKey(userId, roomId)) && isEstablishedPlayer(monsters, hasOutcomeHistory)) {
				complete(userId, roomId);
				return;
			}
			writeFlag(startedKey(userId, roomId));
			update(userId, roomId, { decided: true });
			return;
		}
		if (!fought && hasFought(monsters)) {
			update(userId, roomId, { fought: true });
			return;
		}
		// The change_card step ends when a deck changes. The baseline is taken as the step
		// begins and re-taken while a monster is fallen (a card change then is not an answer).
		if (phase === 'change_card') {
			if (baseline === null) update(userId, roomId, { baseline: deckSnapshot(monsters) });
			else if (deckChanged(baseline, monsters)) complete(userId, roomId);
		} else if (baseline !== null && phase !== 'hidden') {
			update(userId, roomId, { baseline: null });
		}
	}, [loaded, isComplete, decided, fought, baseline, userId, roomId, monsters, hasOutcomeHistory, phase]);

	// The live ring.state push, read from the feed the Console and the Workshop already sit
	// under. Null context (the standalone Workshop route) just means no live source here.
	const ringFeed = useContext(RingFeedContext);
	// Tagged with its room and arrival time: a push from another room is not this room's, and
	// a push newer than the last inventory fetch outranks that fetch's `inEncounter`.
	const [liveState, setLive] = useState<{ roomId: string | undefined; at: number; names: Set<string> } | null>(null);
	const live = liveState && liveState.roomId === roomId ? liveState : null;
	useEffect(() => {
		if (!ringFeed) return;
		return ringFeed.subscribe((tracked) => {
			const event = tracked.data;
			let state: { inEncounter?: boolean; contestants?: Array<{ name?: string; dead?: boolean; fled?: boolean; userId?: string | null }> } | undefined;
			if (event.type === 'ring.state') state = event.payload as typeof state;
			else if (event.type === 'handshake') state = (event.payload as { ringState?: typeof state }).ringState;
			if (!state) return;
			const names = new Set(
				state.inEncounter
					? (state.contestants ?? []).filter((c) => !c.dead && !c.fled && c.name && c.userId === userId).map((c) => c.name!)
					: [],
			);
			setLive({ roomId, at: Date.now(), names });
		});
	}, [ringFeed, userId, roomId]);

	const dismiss = useCallback(() => complete(userId, roomId), [userId, roomId]);
	// The player's own monster is `waiting` in the ring, so a second contestant (a player's
	// monster or a boss) means a fight is counting down or already on.
	const ringData = ringState.data as { inEncounter?: boolean; contestants?: unknown[] } | undefined;
	/*
	 * Walk-fixes check (roadmap 44 K6): `fightOn` used to be the `waiting`-only poll, so a
	 * one-round first fight ended unseen and `change_card` told a fighting monster to change a
	 * card. It is now true whenever the guide's own monster is in a fight, from whichever source
	 * is freshest: the live `ring.state` push (instant), the inventory's per-monster
	 * `inEncounter` (no extra request), or the `waiting` poll. A fallen monster is never
	 * "fighting", whatever the ring is doing. A fled one is not either: the live snapshot
	 * is what knows they left, and the guide must not keep saying they are fighting.
	 */
	const subject = monsters?.find((m) => m.name === step.name);
	const subjectFighting =
		phase !== 'fallen' && phase !== 'spawn' && phase !== 'hidden'
		&& (live && live.at > inventory.dataUpdatedAt
			? live.names.has(step.name)
			// The newer source decides alone. An inventory refreshed after the last live push is
			// authoritative even when it says "not fighting": ORing in the older push kept the
			// guide on "is fighting" after a missed end-of-fight push (Codex on #423).
			: subject
				? subject.inEncounter === true
				: (live?.names.has(step.name) ?? false));
	const fightOn = subjectFighting || (phase === 'waiting' && ringData?.inEncounter === true);
	const fightComing = !fightOn && (ringData?.contestants?.length ?? 0) > 1;
	return { ...step, fightComing, fightOn, dismiss };
}
