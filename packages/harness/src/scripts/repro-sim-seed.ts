#!/usr/bin/env node
/**
 * Used by harness tests: print one JSON line of simulate() output then exit.
 * Run from package root: `node dist/scripts/repro-sim-seed.js`
 */
import './repro-seed-env.js';
import '../set-env.js';
import { engineReady } from '@deck-monsters/engine';
import { simulate } from '../simulate.js';

async function main(): Promise<void> {
	await engineReady;
	const result = await simulate({
		monsters: [
			{ type: 'Basilisk', level: 3 },
			{ type: 'Gladiator', level: 3 },
		],
		fights: 5,
		seed: 424242,
		roomId: 'harness-repro-cli',
	});
	// `slowestFightMs` is wall-clock time, the one field a seed cannot reproduce; leave it out of
	// the comparison the reproducibility test makes (roadmap 50 added it).
	const { slowestFightMs: _timing, ...reproducible } = result;
	process.stdout.write(`${JSON.stringify(reproducible)}\n`);
	process.exit(0);
}

main().catch(err => {
	console.error(err);
	process.exit(1);
});
