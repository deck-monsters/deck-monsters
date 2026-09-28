/**
 * Reading a balance runner directory (roadmap 34). Kept free of the engine so a report can
 * read results without loading the game.
 */
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { UnitResult } from './units.js';

export const RESULTS_FILE = 'results.jsonl';
export const MANIFEST_FILE = 'manifest.json';
export const HEARTBEAT_FILE = 'heartbeat.json';

/** Ids of units already finished without error in a results file. */
export function finishedIds(outDir: string): Set<string> {
	const path = join(outDir, RESULTS_FILE);
	const done = new Set<string>();
	if (!existsSync(path)) return done;
	for (const line of readFileSync(path, 'utf8').split('\n')) {
		if (!line.trim()) continue;
		try {
			const result = JSON.parse(line) as UnitResult;
			if (!result.error) done.add(result.id);
		} catch {
			// A line cut off by a crash mid-write: ignore it; the unit runs again.
		}
	}
	return done;
}

/** Read every complete result line in a directory (partial runs included). */
export function readResults(outDir: string): UnitResult[] {
	const path = join(outDir, RESULTS_FILE);
	if (!existsSync(path)) return [];
	const results: UnitResult[] = [];
	for (const line of readFileSync(path, 'utf8').split('\n')) {
		if (!line.trim()) continue;
		try {
			results.push(JSON.parse(line) as UnitResult);
		} catch {
			// Truncated last line from a crash.
		}
	}
	return results;
}

