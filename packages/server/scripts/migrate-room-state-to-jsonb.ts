/**
 * Roadmap 37 task 5: convert rooms.state_blob (gzip+base64) into rooms.state (jsonb).
 * Run with: DATABASE_URL=... pnpm exec tsx scripts/migrate-room-state-to-jsonb.ts [flags]
 *
 *   --dry-run       decode, repair and count; write nothing
 *   --room <id>     one room only
 *
 * After roadmap 37 release 2 this only converts stragglers (`state` null, blob present).
 * `--from-blob` was removed: blobs are no longer written, so they are stale.
 */
import { db, pool } from '../src/db/index.js';
import { backfillRoomState, parseBackfillArgs, safeReason } from '../src/room-state-backfill.js';

const USAGE = 'usage: migrate-room-state-to-jsonb.ts [--dry-run] [--room <id>]';

async function main(): Promise<number> {
	const parsed = parseBackfillArgs(process.argv.slice(2));
	if ('error' in parsed) {
		console.error(`${parsed.error}\n${USAGE}`);
		return 2;
	}
	const { dryRun, roomId } = parsed;

	const report = await backfillRoomState(db, { dryRun, roomId, log: line => console.log(line) });
	console.log(`${dryRun ? '[dry run] ' : ''}converted: ${report.converted}`);
	console.log(`already converted: ${report.alreadyConverted}`);
	console.log(`empty: ${report.empty}`);
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
