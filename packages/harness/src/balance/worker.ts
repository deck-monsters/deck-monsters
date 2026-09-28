/**
 * Worker thread for the balance runner: one engine per thread, so `simulate()`'s global
 * state (the seeded `Math.random`, the harness env switches) never crosses units running
 * in parallel. Receives units, posts results.
 */
import '../sim-env.js';
import '../set-env.js';
import { parentPort } from 'node:worker_threads';
import { runUnit, type Unit, type UnitResult } from './units.js';

parentPort?.on('message', async (unit: Unit) => {
	let result: UnitResult;
	try {
		result = await runUnit(unit);
	} catch (err) {
		result = {
			id: unit.id,
			...(unit.group !== undefined ? { group: unit.group } : {}),
			fights: 0,
			sides: [],
			rotations: [],
			ms: 0,
			error: err instanceof Error ? `${err.message}\n${err.stack ?? ''}` : String(err),
		};
	}
	parentPort?.postMessage(result);
});
