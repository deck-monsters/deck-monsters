/**
 * The mega boss: a rare, announced boss event (owner, 2026-09-27; plan
 * docs/roadmap/32-pass-c-mega-boss-and-balance.md, rules in
 * docs/architecture/boss-encounters.md §8).
 *
 * - About once a day per room, at a random time. The time is kept in the room's saved state
 *   (the host persists it), so a restart or deploy does not push it back a day.
 * - Announced 30 minutes ahead, reminded at 10 and 2 minutes, with a countdown in ring state.
 * - Unseen until it arrives: its stats are fitted then, to the humans actually in the ring,
 *   so they win about one fight in five (the owner chose ~20%). `fitMegaBoss` holds the rule;
 *   `sim:mega` in the harness measures it.
 * - It carries relics (stat boosts) and brings lesser minions, weak but a distraction.
 * - Beating it pays every challenger still standing bonus coins, XP, and a rare card.
 * - With no more than one human in the ring when it is due, it is called off with a line of
 *   scorn, and a regular boss comes instead.
 */
import { random } from '../helpers/random.js';
import { randomContestant } from '../helpers/bosses.js';
import { getXpCapForLevel, type Contestant } from './index.js';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** Between one mega boss and the next: about a day, at a random time. */
export const MEGA_BOSS_MIN_INTERVAL_MS = 20 * HOUR;
export const MEGA_BOSS_MAX_INTERVAL_MS = 28 * HOUR;
/** The first announcement, and the reminders after it, as time left before it arrives. */
export const MEGA_BOSS_ANNOUNCE_MS = 30 * MINUTE;
export const MEGA_BOSS_REMINDERS_MS = [10 * MINUTE, 2 * MINUTE] as const;
/** When it is due mid-fight, it waits for the fight to end, checking this often. */
export const MEGA_BOSS_RETRY_MS = 30_000;
/** A restart this long after the due time still brings it; longer, and it is rescheduled. */
export const MEGA_BOSS_LATE_GRACE_MS = 10 * MINUTE;
/** Fewer humans than this, and it is called off for a regular boss. */
export const MEGA_BOSS_MIN_HUMANS = 2;

/** Levels above the strongest human. */
export const MEGA_BOSS_LEVEL_BONUS = 2;
/**
 * The mega boss's HP, as a share of the humans' combined max HP:
 * `BASE + PER_HUMAN × humans + PER_LEVEL × strongest human's level`. A single share (1.2)
 * averaged the owner's 20% but left two level 1s at 3% and three level 10s at 53%: more
 * humans and higher levels deal damage faster than HP alone keeps up with. Tuned with
 * `sim:mega`; the runs are in the plan's evidence table.
 */
export const MEGA_BOSS_HP_BASE = 0.25;
export const MEGA_BOSS_HP_PER_HUMAN = 0.15;
export const MEGA_BOSS_HP_PER_LEVEL = 0.11;

export const megaBossHpShare = (humans: number, strongestLevel: number): number =>
	MEGA_BOSS_HP_BASE + MEGA_BOSS_HP_PER_HUMAN * humans + MEGA_BOSS_HP_PER_LEVEL * strongestLevel;
/** Lesser minions that come with it, and their HP as a share of their max. */
export const MEGA_BOSS_MINIONS = 2;
export const MEGA_MINION_HP_SHARE = 1 / 3;

/** The relics it wears: permanent stat boosts on a boss that is discarded after the fight. */
export const MEGA_BOSS_RELICS: ReadonlyArray<{ name: string; attr: 'ac' | 'str' | 'int'; amount: number }> = [
	{ name: 'a crown of black iron', attr: 'ac', amount: 2 },
	{ name: 'a war-horn of the old kings', attr: 'str', amount: 2 },
];

/** Paid to every challenger still standing when it falls. */
export const MEGA_BOSS_REWARD_COINS = 25;
export const MEGA_BOSS_REWARD_XP = 25;

export interface MegaBossFit {
	level: number;
	maxHp: number;
	minionLevel: number;
}

/**
 * Its stats, from the humans in the ring when it arrives: two levels above the strongest,
 * HP a share of their combined HP (`megaBossHpShare`), and minions at the weakest human's
 * level.
 */
export function fitMegaBoss(humans: ReadonlyArray<{ level: number; maxHp: number }>): MegaBossFit {
	const levels = humans.map(human => human.level);
	const totalHp = humans.reduce((sum, human) => sum + human.maxHp, 0);
	const strongest = Math.max(...levels, 0);
	return {
		level: strongest + MEGA_BOSS_LEVEL_BONUS,
		maxHp: Math.max(1, Math.round(totalHp * megaBossHpShare(humans.length, strongest))),
		minionLevel: Math.max(0, Math.min(...levels)),
	};
}

/** A fresh boss at a level (XP drawn so it reads as that level). */
export function bossAtLevel(level: number): Contestant {
	return randomContestant({ xp: getXpCapForLevel(level) }) as unknown as Contestant;
}

/** Raise a boss to the fit: its HP (through `hpVariance`, which is unbounded), and relics. */
export function empowerMegaBoss(monster: any, fit: MegaBossFit): void {
	const extra = fit.maxHp - monster.maxHp;
	if (extra !== 0) monster.setOptions({ hpVariance: (monster.options.hpVariance ?? 0) + extra });
	monster.hp = monster.maxHp;
	for (const relic of MEGA_BOSS_RELICS) monster.setModifier(relic.attr, relic.amount, true);
}

/** A lesser minion's HP. */
export const megaMinionHp = (monster: any): number => Math.max(1, Math.floor(monster.maxHp * MEGA_MINION_HP_SHARE));

/** When the next one comes, from now. */
export const nextMegaBossAt = (now: number): number => now + random(MEGA_BOSS_MIN_INTERVAL_MS, MEGA_BOSS_MAX_INTERVAL_MS);

const minutesLeft = (ms: number): string => {
	const minutes = Math.max(1, Math.round(ms / MINUTE));
	return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
};

/** What the event needs from the room: its ring, persistence, and the rewards. */
export interface MegaBossHost {
	ring: {
		inEncounter: boolean;
		contestants: Contestant[];
		nextMegaBossAt: number | null;
		emit(event: string, ...args: unknown[]): void;
		publishState(): void;
		spawnBoss(options?: Record<string, unknown>): Contestant | undefined;
		addMegaBoss(boss: Contestant, minions: Contestant[]): boolean;
		on(event: string, fn: (...args: any[]) => void): (...args: any[]) => void;
		off(event: string, fn: (...args: any[]) => void): void;
	};
	/** The saved due time, or undefined when none is scheduled. */
	getScheduledAt(): number | undefined;
	/** Save the due time (undefined clears it). */
	setScheduledAt(at: number | undefined): void;
	/** Pay one challenger still standing when the mega boss falls. */
	rewardChallenger(contestant: Contestant): void;
	now?: () => number;
}

export class MegaBossEvent {
	private timer?: ReturnType<typeof setTimeout>;
	private disposed = false;

	constructor(private readonly host: MegaBossHost) {}

	private now(): number {
		return this.host.now?.() ?? Date.now();
	}

	/** Pick up the saved schedule, or make one, and arm the next step. */
	start(): void {
		const now = this.now();
		let at = this.host.getScheduledAt();
		if (at === undefined || now - at > MEGA_BOSS_LATE_GRACE_MS) {
			at = nextMegaBossAt(now);
			this.host.setScheduledAt(at);
		}
		// Inside the announcement window after a restart: tell the room again now.
		if (at - now <= MEGA_BOSS_ANNOUNCE_MS) this.announce(at, true);
		this.arm(at);
	}

	dispose(): void {
		this.disposed = true;
		clearTimeout(this.timer);
		this.timer = undefined;
	}

	/** Timers are one at a time: the next milestone (an announcement, a reminder, or the arrival). */
	private arm(at: number): void {
		clearTimeout(this.timer);
		if (this.disposed) return;
		const now = this.now();
		const left = at - now;
		const milestones = [MEGA_BOSS_ANNOUNCE_MS, ...MEGA_BOSS_REMINDERS_MS].filter(ms => ms < left);
		const next = milestones.length ? Math.max(...milestones) : 0;
		this.timer = setTimeout(() => {
			this.timer = undefined;
			if (next === 0) {
				this.arrive(at);
				return;
			}
			this.announce(at, false);
			this.arm(at);
		}, Math.max(0, left - next));
	}

	private announce(at: number, restated: boolean): void {
		const left = at - this.now();
		const first = !restated && left > MEGA_BOSS_REMINDERS_MS[0];
		this.host.ring.nextMegaBossAt = at;
		this.host.ring.publishState();
		this.host.ring.emit('narration', {
			narration: first
				? `👹 A MEGA BOSS is coming. Something vast stirs beneath the ring, and it will climb out in ${minutesLeft(left)}. It will be fitted to whoever stands in the ring when it arrives, and it will take all of you together to bring it down. Gather your challengers.`
				: `👹 The mega boss arrives in ${minutesLeft(left)}. Bring a friend: it will not trouble itself with fewer than ${MEGA_BOSS_MIN_HUMANS} challengers.`,
		});
	}

	/** Due: wait out a fight in progress, then bring it (or call it off). */
	private arrive(at: number): void {
		if (this.disposed) return;
		const { ring } = this.host;
		if (ring.inEncounter) {
			this.timer = setTimeout(() => this.arrive(at), MEGA_BOSS_RETRY_MS);
			return;
		}

		ring.nextMegaBossAt = null;
		const next = nextMegaBossAt(this.now());
		this.host.setScheduledAt(next);

		const humans = ring.contestants.filter(contestant => !contestant.isBoss);
		if (humans.length < MEGA_BOSS_MIN_HUMANS) {
			ring.emit('narration', {
				narration: `👹 The mega boss looks over the ring, sees ${humans.length === 0 ? 'nobody at all' : 'one lonely challenger'}, and will not be insulted by so pitiful a showing. It sinks back into the dark, and sends a lesser boss in its place.`,
			});
			ring.publishState();
			ring.spawnBoss();
		} else {
			this.bring(humans);
		}
		this.arm(next);
	}

	private bring(humans: Contestant[]): void {
		const { ring } = this.host;
		const fit = fitMegaBoss(humans.map(({ monster }) => ({ level: monster.level, maxHp: monster.maxHp })));
		const boss = bossAtLevel(fit.level);
		empowerMegaBoss(boss.monster, fit);
		const minions = Array.from({ length: MEGA_BOSS_MINIONS }, () => {
			const minion = bossAtLevel(fit.minionLevel);
			minion.monster.hp = megaMinionHp(minion.monster);
			return minion;
		});

		const relics = MEGA_BOSS_RELICS.map(relic => relic.name).join(' and ');
		if (!ring.addMegaBoss(boss, minions)) return;
		const brought = ring.contestants.filter(contestant => contestant.mega && contestant.minion).length;
		ring.emit('narration', {
			narration: `👹 THE MEGA BOSS HAS COME. ${boss.monster.givenName} climbs out of the dark, wearing ${relics}${brought ? `, with ${brought} lesser ${brought === 1 ? 'minion' : 'minions'} scuttling at its heels` : ''}. Every challenger stands together until it falls.`,
		});

		// Pay out the moment it falls, to every challenger still standing then: after it the
		// challengers settle it among themselves, which would leave one survivor to collect.
		const { monster } = boss;
		let paid = false;
		const onDie = () => {
			if (paid) return;
			paid = true;
			const standing = ring.contestants.filter(
				contestant => !contestant.isBoss && !contestant.monster.dead && !contestant.monster.fled
			);
			ring.emit('narration', {
				narration: standing.length
					? `👹 The mega boss falls! Every challenger still standing earns ${MEGA_BOSS_REWARD_COINS} coins, ${MEGA_BOSS_REWARD_XP} XP, and a rare card.`
					: '👹 The mega boss falls, with nobody left standing to claim its hoard.',
			});
			for (const contestant of standing) this.host.rewardChallenger(contestant);
		};
		// `on` binds the listener and returns the bound copy, which is what `off` needs.
		const boundDie = monster.on('die', onDie);
		const boundConcludes = ring.on('fightConcludes', () => {
			monster.off('die', boundDie);
			ring.off('fightConcludes', boundConcludes);
		});
	}
}
