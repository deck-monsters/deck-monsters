import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect } from 'chai';

import './set-env.js';
import { createTestGame } from '@deck-monsters/engine';
import { capturePublicFeed, formatPublicFeedLines } from './public-feed.js';
import { runRingTwoBosses } from './scenarios/ring-two-bosses.js';
import { runConcurrentLookMonsters } from './scenarios/concurrent-look-monsters.js';
import { parseMonstersArg } from './simulate.js';
import { engineReady } from '@deck-monsters/engine';

describe('@deck-monsters/harness', () => {
	before(async function () {
		this.timeout(60_000);
		await engineReady;
	});

	it('runs ring-two-bosses and records ordered public feed', async function () {
		this.timeout(60_000);

		const game = createTestGame('harness-test-room');
		const feed = capturePublicFeed(game.eventBus, 'harness-test');

		try {
			await runRingTwoBosses(game);

			expect(feed.events.length, 'should have public ring events').to.be.greaterThan(0);

			// Monotonic capture order matches seq
			for (let i = 0; i < feed.events.length; i++) {
				expect(feed.events[i]!.seq).to.equal(i);
			}

			const text = formatPublicFeedLines(feed);
			expect(text.length).to.be.greaterThan(100);
		} finally {
			feed.unsubscribe();
			game.dispose();
		}
	});

	it('parseMonstersArg parses Basilisk:5,Gladiator:10', () => {
		const m = parseMonstersArg('Basilisk:5,Gladiator:10');
		expect(m).to.deep.equal([
			{ type: 'Basilisk', level: 5 },
			{ type: 'Gladiator', level: 10 },
		]);
	});

	it('simulate is reproducible for the same seed (fresh Node process)', function () {
		this.timeout(120_000);

		const harnessRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
		const scriptPath = path.join(harnessRoot, 'dist', 'scripts', 'repro-sim-seed.js');

		const runOnce = (): string => {
			const r = spawnSync(process.execPath, [scriptPath], {
				cwd: harnessRoot,
				encoding: 'utf8',
			});
			if (r.status !== 0) {
				throw new Error(r.stderr || r.stdout || `child exited ${r.status}`);
			}
			return r.stdout.trim();
		};

		const out1 = runOnce();
		const out2 = runOnce();
		expect(out1).to.equal(out2);
	});

	it('concurrent-look-monsters completes with two characters (serialized like production)', async function () {
		this.timeout(30_000);

		const game = createTestGame('harness-concurrent-room');
		try {
			await runConcurrentLookMonsters(game);
			expect(game.characters['harness-user-a']?.givenName).to.equal('Alice');
			expect(game.characters['harness-user-b']?.givenName).to.equal('Bob');
		} finally {
			game.dispose();
		}
	});
});
