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
import { backfillRoomState } from '../src/room-state-backfill.js';

async function main(): Promise<number> {
	const args = process.argv.slice(2);
	const dryRun = args.includes('--dry-run');
	const fromBlob = args.includes('--from-blob');
	const roomIdx = args.indexOf('--room');
	const roomId = roomIdx >= 0 ? args[roomIdx + 1] : undefined;
	if (roomIdx >= 0 && (!roomId || roomId.startsWith('--'))) {
		console.error('--room needs a room id');
		return 2;
	}
	if (fromBlob && !args.includes('--i-stopped-the-service')) {
		// The old release writes only state_blob; a live writer during the rewrite could land a
		// blob after we read it and be lost from `state`.
		console.error('--from-blob rewrites state from state_blob and bumps state_version. The old release must not be writing while it runs: stop the service first, then pass --i-stopped-the-service.');
		return 2;
	}

	const report = await backfillRoomState(db, { dryRun, roomId, fromBlob, log: line => console.log(line) });
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
	.then(async code => {
		await pool.end();
		process.exit(code);
	})
	.catch(async err => {
		console.error(err);
		await pool.end().catch(() => {});
		process.exit(1);
	});
