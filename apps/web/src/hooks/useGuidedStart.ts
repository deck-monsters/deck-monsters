import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { useAuth } from '../lib/auth-context.js';
import { trpc } from '../lib/trpc.js';

/**
 * The getting-started guide's one source of truth. The Console and the Workshop both read
 * it, so a step cannot be right in one place and stale in the other, and dismissing the
 * guide in one hides it in both (roadmap 39, batch 3, C3).
 *
 * Phases, in the order a new player meets them:
 * - `spawn`       no monster yet.
 * - `equip`       a living monster outside the ring whose deck is not full.
 * - `send`        a living monster outside the ring with a full deck, none in the ring.
 * - `waiting`     a monster in the ring, no fight fought yet.
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
export function guidedStep(monsters: GuidedMonster[], complete: boolean): GuidedStep {
	if (complete) return HIDDEN;
	if (monsters.length === 0) return { phase: 'spawn', name: '', slots: 0 };

	if (hasFought(monsters)) {
		// Fallen wins over change_card: reviving is what lets the player fight again.
		const fallen = monsters.find((m) => m.dead);
		if (fallen) return { phase: 'fallen', name: fallen.name, slots: fallen.cardSlots };
		const fought = monsters.find((m) => m.battles.total > 0)!;
		return { phase: 'change_card', name: fought.name, slots: fought.cardSlots };
	}

	const unequipped = monsters.find((m) => !m.dead && !m.inRing && m.cards.length < m.cardSlots);
	if (unequipped) return { phase: 'equip', name: unequipped.name, slots: unequipped.cardSlots };

	const inRing = monsters.find((m) => m.inRing);
	if (inRing) return { phase: 'waiting', name: inRing.name, slots: inRing.cardSlots };

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

/**
 * Pure: a fingerprint of every monster's deck, ignoring order, so that equipping,
 * unequipping or moving a card changes it and merely reordering within a deck does not.
 */
export function deckSignature(monsters: GuidedMonster[]): string {
	return monsters
		.map((m) => `${m.name}:${[...m.cards].sort().join('|')}`)
		.sort()
		.join('\n');
}

const OUTCOME_EVENT_TYPES = new Set(['ring.win', 'ring.loss', 'ring.draw', 'ring.fled', 'ring.permaDeath']);

/* ---- shared state ---------------------------------------------------------------- */

const completeKey = (userId: string | undefined) => (userId ? `ftuxComplete:${userId}` : 'ftuxComplete');
// "This player was new when the guide first loaded". Without it, a new player's first
// fight followed by a reload would look like an established player and end the guide.
const startedKey = (userId: string | undefined) => (userId ? `ftuxStarted:${userId}` : 'ftuxStarted');

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
	baseline: string | null;
}
const shared = new Map<string, Shared>();
const listeners = new Set<() => void>();
let version = 0;

function sharedFor(userId: string | undefined): Shared {
	const key = userId ?? '';
	let entry = shared.get(key);
	if (!entry) {
		entry = { complete: readFlag(completeKey(userId)), decided: false, baseline: null };
		shared.set(key, entry);
	}
	return entry;
}

function update(userId: string | undefined, patch: Partial<Shared>): void {
	Object.assign(sharedFor(userId), patch);
	version += 1;
	listeners.forEach((listener) => listener());
}

function complete(userId: string | undefined): void {
	writeFlag(completeKey(userId));
	update(userId, { complete: true });
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

export function useGuidedStart(roomId: string | undefined): GuidedStep & { dismiss: () => void } {
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
			cards: m.cards ?? [],
			cardSlots: m.cardSlots ?? 0,
			battles: { total: m.battles?.total ?? 0 },
		}));
	}, [inventory.data]);
	const historyReady = history.data !== undefined || history.isError;
	const hasOutcomeHistory = useMemo(
		() => (history.data ?? []).some((ev) => OUTCOME_EVENT_TYPES.has(ev.type)),
		[history.data],
	);

	const state = sharedFor(userId);
	const { complete: isComplete, decided, baseline } = state;
	// Until the first load settles the guide stays hidden: showing a step to a player
	// who is about to be classed as established would flash it for nothing.
	const loaded = monsters !== undefined && historyReady;
	const step = loaded && decided ? guidedStep(monsters, isComplete) : HIDDEN;
	const phase = step.phase;

	useEffect(() => {
		if (!loaded || isComplete) return;
		if (!decided) {
			/*
			 * "Established" is decided once, here, from the first load. Re-testing it on
			 * every inventory change used to end the guide the moment a new player's first
			 * fight made `battles > 0`, so no step could ever follow the first fight.
			 */
			if (!readFlag(startedKey(userId)) && isEstablishedPlayer(monsters, hasOutcomeHistory)) {
				complete(userId);
				return;
			}
			writeFlag(startedKey(userId));
			update(userId, { decided: true });
			return;
		}
		// The change_card step ends when a deck changes. The baseline is taken as the step
		// begins and re-taken while a monster is fallen (a card change then is not an answer).
		const signature = deckSignature(monsters);
		if (phase === 'change_card') {
			if (baseline === null) update(userId, { baseline: signature });
			else if (baseline !== signature) complete(userId);
		} else if (baseline !== null && phase !== 'hidden') {
			update(userId, { baseline: null });
		}
	}, [loaded, isComplete, decided, baseline, userId, monsters, hasOutcomeHistory, phase]);

	const dismiss = useCallback(() => complete(userId), [userId]);
	return { ...step, dismiss };
}
