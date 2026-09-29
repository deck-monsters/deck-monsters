/**
 * Roadmap 37 task 5: convert rooms.state_blob (gzip+base64) into rooms.state (jsonb).
 * Run with: DATABASE_URL=... pnpm exec tsx scripts/migrate-room-state-to-jsonb.ts [flags]
 *
 *   --dry-run       decode, repair and count; write nothing
 *   --room <id>     one room only
 *   --from-blob     rollback roll-forward: rewrite `state` from `state_blob` even if set, and bump
 *                   state_version. Requires --i-stopped-the-service.
 */
import { db, pool } from '../src/db/index.js';
import { backfillRoomState, parseBackfillArgs, safeReason } from '../src/room-state-backfill.js';

const USAGE = 'usage: migrate-room-state-to-jsonb.ts [--dry-run] [--room <id>] [--from-blob --i-stopped-the-service]';

async function main(): Promise<number> {
	const parsed = parseBackfillArgs(process.argv.slice(2));
	if ('error' in parsed) {
		console.error(`${parsed.error}\n${USAGE}`);
		return 2;
	}
	const { dryRun, fromBlob, roomId, stoppedService } = parsed;
	if (fromBlob && !stoppedService) {
		// The old release writes only state_blob; a live writer during the rewrite could land a
		// blob after we read it and be lost from `state`.
		console.error('--from-blob rewrites state from state_blob and bumps state_version. The old release must not be writing while it runs: stop the service first, then pass --i-stopped-the-service.');
		return 2;
	}

	const report = await backfillRoomState(db, { dryRun, roomId, fromBlob, log: line => console.log(line) });
	console.log(`${dryRun ? '[dry run] ' : ''}converted: ${report.converted}`);
	console.log(`already converted: ${report.alreadyConverted}`);
	console.log(`empty: ${report.empty}`);
	console.log(`cleared stale state (blob null): ${report.clearedStale}`);
	console.log(`skipped (blob changed): ${report.skippedChanged.length}`);
	console.log(`failed: ${report.failed.length}`);
	for (const f of report.failed) console.log(`  ${f.roomId}: ${f.reason}`);
	console.log(`bytes: ${report.bytes}`);
	console.log(JSON.stringify(report));
	return report.failed.length > 0 || report.skippedChanged.length > 0 ? 1 : 0;
}

main()
	.catch(err => {
		// Message only: a raw error object can carry SQL params, i.e. player data.
		console.error(`unexpected error: ${safeReason(err)}`);
		return 1;
	})
	.then(async code => {
		// Ended exactly once; a shutdown error is logged but does not fail a finished run.
		await pool.end().catch(err => console.error(`pool shutdown: ${safeReason(err)}`));
		process.exit(code);
	});
