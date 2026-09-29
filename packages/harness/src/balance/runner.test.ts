import { expect } from 'chai';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { runPlan, readResults, RESULTS_FILE } from './runner.js';
import { runUnit, type Plan } from './units.js';

/**
 * The standalone runner (roadmap 34 task 1): results append per unit, a rerun skips what is
 * done, a unit's result depends only on the unit, and seat rotations credit sides by
 * identity. Workers are 0 here (in-process), since test files run under tsx.
 */
describe('balance/runner', () => {
	const plan: Plan = {
		name: 'runner test',
		units: [0, 1, 2].map(i => ({
			id: `u${i}`,
			group: 'g',
			sides: [
				{ type: 'Gladiator' as const, level: 1, deck: ['Hit', 'Hit', 'Hit', 'Hit'] },
				{ type: 'Minotaur' as const, level: 1, deck: ['Hit', 'Hit', 'Hit', 'Hit'] },
			],
			fights: 3,
			seed: 100 + i,
		})),
	};

	it('appends one line per unit and skips finished units on a rerun', async () => {
		const dir = mkdtempSync(join(tmpdir(), 'balance-runner-'));
		try {
			const first = await runPlan(plan, { outDir: dir, workers: 0, range: { from: 0, to: 2 } });
			expect(first.done).to.equal(2);
			const second = await runPlan(plan, { outDir: dir, workers: 0 });
			expect(second.skipped).to.equal(2);
			expect(second.done).to.equal(1);
			const ids = readResults(dir).map(r => r.id);
			expect(ids).to.have.members(['u0', 'u1', 'u2']);
			expect(new Set(ids).size).to.equal(ids.length);
			// A crash mid-write leaves a torn last line; readers ignore it.
			expect(readFileSync(join(dir, RESULTS_FILE), 'utf8').trim().split('\n')).to.have.length(3);
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it('refuses a directory that holds another plan', async () => {
		const dir = mkdtempSync(join(tmpdir(), 'balance-runner-'));
		try {
			await runPlan(plan, { outDir: dir, workers: 0, range: { from: 0, to: 1 } });
			let error: unknown;
			try {
				await runPlan({ ...plan, units: plan.units.slice(1) }, { outDir: dir, workers: 0 });
			} catch (err) {
				error = err;
			}
			expect(String(error)).to.include('different plan');
		} finally {
			rmSync(dir, { recursive: true, force: true });
		}
	});

	it('gives the same result for the same unit, and plays every seat order', async () => {
		const a = await runUnit(plan.units[0]!);
		const b = await runUnit(plan.units[0]!);
		expect(a.sides).to.deep.equal(b.sides);
		expect(a.rotations.map(r => r.firstSide)).to.deep.equal([0, 1]);
		expect(a.fights).to.equal(6);
		const total = a.sides[0]!.wins + a.sides[0]!.draws + a.sides[0]!.losses;
		expect(total).to.equal(6);
		expect(a.sides[0]!.wins).to.equal(a.sides[1]!.losses);
	});

	it('scores a team win for every member of the team, fallen or not', async () => {
		const result = await runUnit({
			id: 'teams',
			sides: [
				{ type: 'Gladiator', level: 3, deck: ['Hit', 'Hit', 'Hit', 'Hit'], team: 'north' },
				{ type: 'Minotaur', level: 3, deck: ['Hit', 'Hit', 'Hit', 'Hit'], team: 'north' },
				{ type: 'Basilisk', level: 3, deck: ['Hit', 'Hit', 'Hit', 'Hit'], team: 'south' },
				{ type: 'Jinn', level: 3, deck: ['Hit', 'Hit', 'Hit', 'Hit'], team: 'south' },
			],
			fights: 4,
			seed: 7,
		});
		const [a, b, c, d] = result.sides;
		// Teammates share every result, and the two teams' results mirror each other.
		expect(a).to.deep.equal(b);
		expect(c).to.deep.equal(d);
		expect(a!.wins).to.equal(c!.losses);
		expect(a!.draws).to.equal(c!.draws);
		expect(a!.wins + a!.draws + a!.losses).to.equal(result.fights);
	});

	it('splits each side by whether a probe fired, and the split sums to the totals', async () => {
		const result = await runUnit({
			id: 'probes',
			sides: [
				{ type: 'Unicorn', level: 3, deck: ['Gloaming Rest', 'Hit', 'Hit', 'Hit', 'Hit', 'Hit', 'Hit', 'Hit', 'Hit'] },
				{ type: 'Minotaur', level: 3, deck: ['Hit', 'Hit', 'Hit', 'Hit', 'Hit', 'Hit', 'Hit', 'Hit', 'Hit'] },
			],
			fights: 20,
			seed: 11,
			probes: ['rest-completed'],
		});
		const split = result.split!['rest-completed']!;
		result.sides.forEach((side, i) => {
			for (const k of ['wins', 'draws', 'losses'] as const) {
				expect(split.with[i]![k] + split.without[i]![k]).to.equal(side[k]);
			}
		});
		// The Minotaur never rests; the Unicorn completes some rests in 40 fights.
		expect(split.with[1]!.wins + split.with[1]!.draws + split.with[1]!.losses).to.equal(0);
		expect(split.with[0]!.wins + split.with[0]!.draws + split.with[0]!.losses).to.be.greaterThan(0);
	});

	it('refuses an unknown probe', async () => {
		let error: unknown;
		try {
			await runUnit({ ...plan.units[0]!, id: 'bad-probe', probes: ['no-such-probe'] });
		} catch (err) {
			error = err;
		}
		expect(String(error)).to.include('Unknown probe');
	});
});
