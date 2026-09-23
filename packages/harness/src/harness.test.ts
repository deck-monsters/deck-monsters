import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect } from 'chai';

import './set-env.js';
import { createTestGame } from '@deck-monsters/engine';
import { capturePublicFeed, formatPublicFeedLines } from './public-feed.js';
import { runRingTwoBosses } from './scenarios/ring-two-bosses.js';
import { runConcurrentLookMonsters } from './scenarios/concurrent-look-monsters.js';
import { parseMonstersArg, simulate, simulateNewPlayerProgression } from './simulate.js';
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

	it('concurrent-look-monsters completes with two characters (per-user lanes like production)', async function () {
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

	// Small N: enough fights that this level-5 mirror matchup reliably produces at least one
	// 'win' and one 'loss' bucket under the fixed seed below (checked against a real run), but
	// small enough to keep this fast — see roadmap 11 "Economy telemetry".
	const ECONOMY_FIGHTS = 80;
	const ECONOMY_SEED = 12345;
	const economyConfig = {
		monsters: [
			{ type: 'Basilisk' as const, level: 5 },
			{ type: 'Gladiator' as const, level: 5 },
		],
		fights: ECONOMY_FIGHTS,
		seed: ECONOMY_SEED,
	};

	it('simulate() populates coinsByOutcome and xpPerMonster with non-negative samples', async function () {
		this.timeout(30_000);

		const res = await simulate({ ...economyConfig, roomId: 'harness-economy-fields' });

		const observedOutcomes = Object.keys(res.coinsByOutcome);
		expect(observedOutcomes.length, 'expected at least one outcome bucket').to.be.greaterThan(0);
		for (const stats of Object.values(res.coinsByOutcome)) {
			expect(stats!.count).to.be.greaterThan(0);
			expect(stats!.mean).to.be.at.least(0);
			expect(stats!.min).to.be.at.least(0);
			expect(stats!.max).to.be.at.least(stats!.min);
		}

		// Every contestant in every fight contributes one XP sample (2 per fight here).
		expect(res.xpPerMonster.count).to.equal(ECONOMY_FIGHTS * 2);
		expect(res.xpPerMonster.mean).to.be.at.least(0);
		expect(res.xpPerMonster.min).to.be.at.least(0);
	});

	it('simulate() pays a win more coins than a loss (same fixed-seed run)', async function () {
		this.timeout(30_000);

		const res = await simulate({ ...economyConfig, roomId: 'harness-economy-win-vs-loss' });

		const win = res.coinsByOutcome.win;
		const loss = res.coinsByOutcome.loss;
		expect(win, 'expected at least one win in this fixed-seed run').to.exist;
		expect(loss, 'expected at least one loss in this fixed-seed run').to.exist;
		expect(win!.mean).to.be.greaterThan(loss!.mean);
	});

	it('simulate() economy fields are reproducible for the same seed', async function () {
		this.timeout(30_000);

		const first = await simulate({ ...economyConfig, roomId: 'harness-economy-repro-a' });
		const second = await simulate({ ...economyConfig, roomId: 'harness-economy-repro-b' });

		expect(second.coinsByOutcome).to.deep.equal(first.coinsByOutcome);
		expect(second.xpPerMonster).to.deep.equal(first.xpPerMonster);
	});

	it('simulateNewPlayerProgression() checkpoints coins/XP that grow monotonically', async function () {
		this.timeout(30_000);

		const checkpoints = await simulateNewPlayerProgression({
			playerType: 'Gladiator',
			opponentType: 'Basilisk',
			opponentLevel: 1,
			checkpoints: [1, 3, 8],
			seed: 4242,
			roomId: 'harness-newplayer-fields',
		});

		expect(checkpoints.map(c => c.afterFights)).to.deep.equal([1, 3, 8]);
		let prev = { coins: -1, characterXp: -1, monsterXpGained: -1, wins: -1, losses: -1 };
		for (const cp of checkpoints) {
			expect(cp.coins).to.be.at.least(0);
			expect(cp.characterXp).to.be.at.least(0);
			expect(cp.monsterXpGained).to.be.at.least(0);
			// Cumulative totals threaded across fights never go backwards.
			expect(cp.coins).to.be.at.least(prev.coins);
			expect(cp.characterXp).to.be.at.least(prev.characterXp);
			expect(cp.monsterXpGained).to.be.at.least(prev.monsterXpGained);
			expect(cp.wins).to.be.at.least(prev.wins);
			expect(cp.losses).to.be.at.least(prev.losses);
			expect(cp.wins + cp.losses).to.be.at.most(cp.afterFights);
			prev = cp;
		}
	});

	it('simulateNewPlayerProgression() is reproducible for the same seed', async function () {
		this.timeout(30_000);

		const config = {
			playerType: 'Gladiator' as const,
			opponentType: 'Basilisk' as const,
			opponentLevel: 1,
			checkpoints: [1, 3, 8],
			seed: 4242,
		};
		const first = await simulateNewPlayerProgression({ ...config, roomId: 'harness-newplayer-repro-a' });
		const second = await simulateNewPlayerProgression({ ...config, roomId: 'harness-newplayer-repro-b' });

		expect(second).to.deep.equal(first);
	});
});
