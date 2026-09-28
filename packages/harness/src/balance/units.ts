/**
 * Work units for the standalone balance runner (roadmap 34, "The runner").
 *
 * A unit is one cell of an experiment: two or more sides, a fight count, and a seed. Its
 * result depends only on the unit and the commit, so a unit rerun anywhere gives the same
 * line, and results from several machines or chunks merge.
 *
 * Turn order: `simulate()` plays sides in the order listed (the harness fixes turn order,
 * where the game shuffles it), and the first mover's edge is large (51-65% in Hit mirrors).
 * So a unit plays every rotation of its sides on the same seed and credits each side by
 * identity: the edge cancels exactly instead of on average (seat-swapped pairs).
 */
import { simulate, type SimMonsterSpec, type SimResult } from '../simulate.js';

export type SideSpec = Omit<SimMonsterSpec, 'team'>;

export interface Unit {
	/** Unique within a plan; the resume key. */
	id: string;
	/** What reports aggregate by (for example `Jinn|L10|likely`). */
	group?: string;
	sides: SideSpec[];
	/** Fights per seat rotation. */
	fights: number;
	seed: number;
	/** Play every rotation of the sides (default true). */
	rotate?: boolean;
	/** Free-form labels a planner wants back in the result. */
	tags?: Record<string, string | number>;
	/** Record excitement (rounds, rare rolls, turnarounds); see `ExcitementTally`. */
	excitement?: boolean;
}

/**
 * Fight-level excitement summed over a unit (roadmap 35 task 1). Turnarounds count decisive
 * fights whose winner fell at least 25 (or 50) points of HP fraction behind its best opponent
 * at some point: the comebacks and the "please get a Loki" moments the guardrails protect.
 */
export interface ExcitementTally {
	fights: number;
	decisive: number;
	rounds: number;
	loki: number;
	luck: number;
	turnaround25: number;
	turnaround50: number;
}

export interface Plan {
	name: string;
	/** Commit the plan was written against; the runner records the commit it ran on. */
	commit?: string;
	profile?: 'quick' | 'full' | string;
	units: Unit[];
}

export interface SideTally {
	wins: number;
	draws: number;
	losses: number;
	/** Expected score: (wins + draws / 2) / fights. */
	score: number;
}

export interface UnitResult {
	id: string;
	group?: string;
	tags?: Record<string, string | number>;
	fights: number;
	sides: SideTally[];
	/** Per rotation, side 0's score, for paired analysis and the initiative edge. */
	rotations: Array<{ firstSide: number; fights: number; scores: number[] }>;
	ms: number;
	error?: string;
	/** When the unit asked for it. */
	excitement?: ExcitementTally;
}

const label = (position: number): string => `Sim ${position + 1}`;

/** Run one unit in this process. */
export async function runUnit(unit: Unit): Promise<UnitResult> {
	const started = Date.now();
	const n = unit.sides.length;
	const rotations = unit.rotate === false ? [0] : Array.from({ length: n }, (_, r) => r);
	const totals = unit.sides.map(() => ({ wins: 0, draws: 0, losses: 0 }));
	const perRotation: UnitResult['rotations'] = [];
	const excitement: ExcitementTally = { fights: 0, decisive: 0, rounds: 0, loki: 0, luck: 0, turnaround25: 0, turnaround50: 0 };

	for (const r of rotations) {
		// order[position] = side index; position 0 moves first.
		const order = Array.from({ length: n }, (_, p) => (p + r) % n);
		const res: SimResult = await simulate({
			monsters: order.map(side => unit.sides[side]!),
			fights: unit.fights,
			seed: unit.seed,
			roomId: `batch-${unit.id}-r${r}`,
			...(unit.excitement ? { trackExcitement: true } : {}),
		});
		for (const f of res.excitement ?? []) {
			excitement.fights += 1;
			excitement.rounds += f.rounds;
			excitement.loki += f.loki;
			excitement.luck += f.luck;
			if (f.winnerLowestLead !== undefined) {
				excitement.decisive += 1;
				if (f.winnerLowestLead <= -0.25) excitement.turnaround25 += 1;
				if (f.winnerLowestLead <= -0.5) excitement.turnaround50 += 1;
			}
		}
		// A fight the engine cancelled (an internal error `ring.fight()` swallowed) still gets an
		// empty `winnersByFight` entry, which would score as a draw. Fail the unit instead, so it
		// is not persisted as finished and runs again on resume (a Codex review of #408).
		if (res.cancelledFights > 0) {
			throw new Error(`${res.cancelledFights} of ${res.fights} fights were cancelled by the engine (rotation ${r})`);
		}
		const scores = unit.sides.map(() => 0);
		for (const winners of res.winnersByFight) {
			const draw = winners.length === 0;
			order.forEach((side, position) => {
				if (draw) {
					totals[side]!.draws += 1;
					scores[side]! += 0.5;
				} else if (winners.includes(label(position))) {
					totals[side]!.wins += 1;
					scores[side]! += 1;
				} else {
					totals[side]!.losses += 1;
				}
			});
		}
		perRotation.push({ firstSide: order[0]!, fights: res.fights, scores: scores.map(s => s / Math.max(1, res.fights)) });
	}

	const fights = perRotation.reduce((acc, r) => acc + r.fights, 0);
	return {
		id: unit.id,
		...(unit.group !== undefined ? { group: unit.group } : {}),
		...(unit.tags !== undefined ? { tags: unit.tags } : {}),
		fights,
		sides: totals.map(t => ({ ...t, score: fights ? (t.wins + t.draws / 2) / fights : NaN })),
		rotations: perRotation,
		ms: Date.now() - started,
		...(unit.excitement ? { excitement } : {}),
	};
}
