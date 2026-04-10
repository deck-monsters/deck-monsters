import { and, asc, desc, eq, gte, inArray, lte, lt, or, sql } from 'drizzle-orm';

import type { Db } from './db/index.js';
import {
	fightSummaries,
	profiles,
	roomEvents,
	roomMonsterStats,
	roomPlayerStats,
	roomMembers,
} from './db/schema.js';
import type { GameEvent } from '@deck-monsters/engine';
import { dbRowToGameEvent } from './db/game-event-map.js';

export type LeaderboardSort = 'xp' | 'wins' | 'winRate' | 'coins';

export function formatRoomPlayerLeaderboard(title: string, rows: Awaited<ReturnType<typeof queryRoomPlayers>>): string {
	const lines = rows.map((r, i) => {
		const wr = Math.round(r.winRate * 100);
		return `${i + 1}. ${r.displayName}   ${r.xp} XP   ${r.wins}W ${r.losses}L ${wr}%`;
	});
	return `*${title}*\n\n\`\`\`\n${lines.join('\n') || '(no data yet)'}\n\`\`\`\n`;
}

export function formatRoomMonsterLeaderboard(
	title: string,
	rows: Awaited<ReturnType<typeof queryRoomMonsters>>,
	streakByMonsterId?: Map<string, number>
): string {
	const lines = rows.map((r, i) => {
		const wr = Math.round(r.winRate * 100);
		const owner = r.ownerName ? ` (${r.ownerName})` : '';
		const streak = streakByMonsterId?.get(r.monsterId);
		const streakStr = streak !== undefined && streak > 0 ? `   streak ${streak}` : '';
		return `${i + 1}. ${r.displayName}${owner}   ${r.monsterType}   ${r.xp} XP L${r.level}   ${r.wins}W ${r.losses}L ${wr}%${streakStr}`;
	});
	return `*${title}*\n\n\`\`\`\n${lines.join('\n') || '(no data yet)'}\n\`\`\`\n`;
}

export function formatGlobalPlayerLeaderboard(title: string, rows: Awaited<ReturnType<typeof queryGlobalPlayers>>): string {
	const lines = rows.map((r, i) => {
		const wr = Math.round(r.winRate * 100);
		return `${i + 1}. ${r.displayName}   ${r.xp} XP   ${r.wins}W ${r.losses}L ${wr}%   rooms: ${r.roomCount}`;
	});
	return `*${title}*\n\n\`\`\`\n${lines.join('\n') || '(no data yet)'}\n\`\`\`\n`;
}

export function formatGlobalMonsterLeaderboard(title: string, rows: Awaited<ReturnType<typeof queryGlobalMonsters>>): string {
	const lines = rows.map((r, i) => {
		const wr = Math.round(r.winRate * 100);
		const owner = r.ownerName ? ` (${r.ownerName})` : '';
		return `${i + 1}. ${r.displayName}${owner}   ${r.monsterType}   ${r.xp} XP L${r.level}   ${r.wins}W ${r.losses}L ${wr}%`;
	});
	return `*${title}*\n\n\`\`\`\n${lines.join('\n') || '(no data yet)'}\n\`\`\`\n`;
}

function winRateExpr() {
	return sql<number>`case when (${roomPlayerStats.wins} + ${roomPlayerStats.losses}) > 0
		then ${roomPlayerStats.wins}::float / (${roomPlayerStats.wins} + ${roomPlayerStats.losses})
		else 0 end`;
}

function monsterWinRateExpr() {
	return sql<number>`case when (${roomMonsterStats.wins} + ${roomMonsterStats.losses}) > 0
		then ${roomMonsterStats.wins}::float / (${roomMonsterStats.wins} + ${roomMonsterStats.losses})
		else 0 end`;
}

export async function queryRoomPlayers(
	db: Db,
	roomId: string,
	sortBy: LeaderboardSort,
	limit: number
): Promise<
	Array<{
		displayName: string;
		xp: number;
		wins: number;
		losses: number;
		draws: number;
		winRate: number;
		coinsEarned: number;
	}>
> {
	const orderBy =
		sortBy === 'wins'
			? desc(roomPlayerStats.wins)
			: sortBy === 'coins'
				? desc(roomPlayerStats.coinsEarned)
				: sortBy === 'winRate'
					? desc(winRateExpr())
					: desc(roomPlayerStats.xp);

	const rows = await db
		.select({
			displayName: profiles.displayName,
			xp: roomPlayerStats.xp,
			wins: roomPlayerStats.wins,
			losses: roomPlayerStats.losses,
			draws: roomPlayerStats.draws,
			coinsEarned: roomPlayerStats.coinsEarned,
			winRate: winRateExpr().as('wr'),
		})
		.from(roomPlayerStats)
		.innerJoin(profiles, eq(roomPlayerStats.userId, profiles.id))
		.where(eq(roomPlayerStats.roomId, roomId))
		.orderBy(orderBy)
		.limit(limit);

	return rows.map((r) => ({
		displayName: r.displayName,
		xp: r.xp,
		wins: r.wins,
		losses: r.losses,
		draws: r.draws,
		coinsEarned: r.coinsEarned,
		winRate: Number(r.winRate),
	}));
}

export async function queryRoomMonsters(
	db: Db,
	roomId: string,
	sortBy: LeaderboardSort,
	limit: number
): Promise<
	Array<{
		monsterId: string;
		displayName: string;
		monsterType: string;
		ownerName: string | null;
		xp: number;
		level: number;
		wins: number;
		losses: number;
		draws: number;
		winRate: number;
	}>
> {
	const orderBy =
		sortBy === 'wins'
			? desc(roomMonsterStats.wins)
			: sortBy === 'coins'
				? desc(roomMonsterStats.xp)
				: sortBy === 'winRate'
					? desc(monsterWinRateExpr())
					: desc(roomMonsterStats.xp);

	const rows = await db
		.select({
			monsterId: roomMonsterStats.monsterId,
			displayName: roomMonsterStats.displayName,
			monsterType: roomMonsterStats.monsterType,
			ownerId: roomMonsterStats.ownerUserId,
			xp: roomMonsterStats.xp,
			level: roomMonsterStats.level,
			wins: roomMonsterStats.wins,
			losses: roomMonsterStats.losses,
			draws: roomMonsterStats.draws,
			winRate: monsterWinRateExpr().as('mwr'),
		})
		.from(roomMonsterStats)
		.where(eq(roomMonsterStats.roomId, roomId))
		.orderBy(orderBy)
		.limit(limit);

	const ownerIds = [...new Set(rows.map((r) => r.ownerId).filter(Boolean))] as string[];
	const names = new Map<string, string>();
	if (ownerIds.length > 0) {
		const profs = await db
			.select({ id: profiles.id, displayName: profiles.displayName })
			.from(profiles)
			.where(inArray(profiles.id, ownerIds));
		for (const p of profs) names.set(p.id, p.displayName);
	}

	return rows.map((r) => ({
		monsterId: r.monsterId,
		displayName: r.displayName,
		monsterType: r.monsterType,
		ownerName: r.ownerId ? (names.get(r.ownerId) ?? null) : null,
		xp: r.xp,
		level: r.level,
		wins: r.wins,
		losses: r.losses,
		draws: r.draws,
		winRate: Number(r.winRate),
	}));
}

export async function queryGlobalPlayers(
	db: Db,
	sortBy: LeaderboardSort,
	limit: number
): Promise<
	Array<{
		displayName: string;
		xp: number;
		wins: number;
		losses: number;
		draws: number;
		winRate: number;
		coinsEarned: number;
		roomCount: number;
	}>
> {
	const orderBy =
		sortBy === 'wins'
			? 'tw desc'
			: sortBy === 'coins'
				? 'tc desc'
				: sortBy === 'winRate'
					? 'gwr desc'
					: 'txp desc';

	const rows = await db.execute(sql`
		select
			p.display_name as "displayName",
			agg.txp::int as xp,
			agg.tw::int as wins,
			agg.tl::int as losses,
			agg.td::int as draws,
			agg.tc::int as "coinsEarned",
			agg.rc::int as "roomCount",
			agg.gwr::float8 as "winRate"
		from (
			select
				user_id,
				sum(xp)::bigint as txp,
				sum(wins)::bigint as tw,
				sum(losses)::bigint as tl,
				sum(draws)::bigint as td,
				sum(coins_earned)::bigint as tc,
				count(distinct room_id)::bigint as rc,
				case
					when sum(wins + losses) > 0 then sum(wins)::float / sum(wins + losses)
					else 0
				end as gwr
			from room_player_stats
			group by user_id
		) agg
		inner join profiles p on p.id = agg.user_id
		order by ${sql.raw(orderBy)}
		limit ${limit}
	`);

	const out = rows.rows as Array<{
		displayName: string;
		xp: number;
		wins: number;
		losses: number;
		draws: number;
		coinsEarned: number;
		roomCount: number;
		winRate: number;
	}>;

	return out.map((r) => ({
		displayName: r.displayName,
		xp: Number(r.xp),
		wins: Number(r.wins),
		losses: Number(r.losses),
		draws: Number(r.draws),
		coinsEarned: Number(r.coinsEarned),
		roomCount: Number(r.roomCount),
		winRate: Number(r.winRate),
	}));
}

export async function queryGlobalMonsters(
	db: Db,
	sortBy: LeaderboardSort,
	limit: number
): Promise<
	Array<{
		displayName: string;
		monsterType: string;
		ownerName: string | null;
		xp: number;
		level: number;
		wins: number;
		losses: number;
		draws: number;
		winRate: number;
	}>
> {
	const orderBy =
		sortBy === 'wins'
			? 'tw desc'
			: sortBy === 'winRate'
				? 'gwr desc'
				: 'txp desc';

	const rows = await db.execute(sql`
		select
			gm.dn as "displayName",
			gm.mt as "monsterType",
			gm.oid as "ownerId",
			gm.txp::int as xp,
			gm.tlv::int as level,
			gm.tw::int as wins,
			gm.tl::int as losses,
			gm.td::int as draws,
			gm.gwr::float8 as "winRate"
		from (
			select
				monster_id,
				max(display_name) as dn,
				max(monster_type) as mt,
				max(owner_user_id) as oid,
				sum(xp)::bigint as txp,
				max(level)::bigint as tlv,
				sum(wins)::bigint as tw,
				sum(losses)::bigint as tl,
				sum(draws)::bigint as td,
				case
					when sum(wins + losses) > 0 then sum(wins)::float / sum(wins + losses)
					else 0
				end as gwr
			from room_monster_stats
			group by monster_id
		) gm
		order by ${sql.raw(orderBy)}
		limit ${limit}
	`);

	const raw = rows.rows as Array<{
		displayName: string;
		monsterType: string;
		ownerId: string | null;
		xp: number;
		level: number;
		wins: number;
		losses: number;
		draws: number;
		winRate: number;
	}>;

	const ownerIds = [...new Set(raw.map((r) => r.ownerId).filter(Boolean))] as string[];
	const names = new Map<string, string>();
	if (ownerIds.length > 0) {
		const profs = await db
			.select({ id: profiles.id, displayName: profiles.displayName })
			.from(profiles)
			.where(inArray(profiles.id, ownerIds));
		for (const p of profs) names.set(p.id, p.displayName);
	}

	return raw.map((r) => ({
		displayName: r.displayName,
		monsterType: r.monsterType,
		ownerName: r.ownerId ? (names.get(r.ownerId) ?? null) : null,
		xp: Number(r.xp),
		level: Number(r.level),
		wins: Number(r.wins),
		losses: Number(r.losses),
		draws: Number(r.draws),
		winRate: Number(r.winRate),
	}));
}

/** Shape of each participant object inside fight_summaries.participants. */
export type FightParticipant = {
	monsterId: string;
	monsterName: string;
	monsterType: string;
	ownerUserId: string;
	ownerDisplayName: string;
	outcome: 'win' | 'loss' | 'draw' | 'fled' | 'permaDeath';
	xpGained: number;
	level: number;
};

export type FightSummaryRow = {
	id: number;
	roomId: string;
	fightNumber: number;
	startedAt: Date;
	endedAt: Date;
	outcome: string;
	// 1v1 convenience fields — null for fights with 3+ contestants.
	winnerMonsterId: string | null;
	winnerMonsterName: string | null;
	winnerOwnerUserId: string | null;
	loserMonsterId: string | null;
	loserMonsterName: string | null;
	loserOwnerUserId: string | null;
	roundCount: number;
	winnerXpGained: number;
	loserXpGained: number;
	cardDropName: string | null;
	participants: FightParticipant[];
};

export async function queryRecentFights(
	db: Db,
	roomId: string,
	limit: number,
	before?: Date
): Promise<FightSummaryRow[]> {
	const cond = before
		? and(eq(fightSummaries.roomId, roomId), lt(fightSummaries.endedAt, before))
		: eq(fightSummaries.roomId, roomId);

	return db
		.select()
		.from(fightSummaries)
		.where(cond)
		.orderBy(desc(fightSummaries.endedAt))
		.limit(limit) as Promise<FightSummaryRow[]>;
}

export async function queryFightByNumber(
	db: Db,
	roomId: string,
	fightNumber: number
): Promise<(FightSummaryRow & { startedAt: Date; endedAt: Date }) | undefined> {
	const rows = await db
		.select()
		.from(fightSummaries)
		.where(and(eq(fightSummaries.roomId, roomId), eq(fightSummaries.fightNumber, fightNumber)))
		.limit(1);
	return rows[0] as (FightSummaryRow & { startedAt: Date; endedAt: Date }) | undefined;
}

export async function queryMonsterFightHistory(
	db: Db,
	roomId: string,
	monsterId: string,
	limit: number
): Promise<FightSummaryRow[]> {
	// Use JSONB containment to find all fights where this monster appeared as a
	// participant, regardless of how many contestants there were. This covers both
	// 1v1 fights (where winnerMonsterId / loserMonsterId are set) and multi-monster
	// fights (where those columns are null but participants[] always has everyone).
	return db
		.select()
		.from(fightSummaries)
		.where(
			and(
				eq(fightSummaries.roomId, roomId),
				sql`${fightSummaries.participants} @> ${JSON.stringify([{ monsterId }])}::jsonb`
			)
		)
		.orderBy(desc(fightSummaries.endedAt))
		.limit(limit) as Promise<FightSummaryRow[]>;
}

export async function queryFightsSince(db: Db, roomId: string, since: Date): Promise<FightSummaryRow[]> {
	return db
		.select()
		.from(fightSummaries)
		.where(and(eq(fightSummaries.roomId, roomId), gte(fightSummaries.endedAt, since)))
		.orderBy(fightSummaries.endedAt) as Promise<FightSummaryRow[]>;
}

export async function getMemberLastSeen(
	db: Db,
	roomId: string,
	userId: string
): Promise<Date | null> {
	const rows = await db
		.select({ lastSeenAt: roomMembers.lastSeenAt })
		.from(roomMembers)
		.where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, userId)))
		.limit(1);
	return rows[0]?.lastSeenAt ?? null;
}

export async function touchMemberLastSeen(db: Db, roomId: string, userId: string): Promise<void> {
	await db
		.update(roomMembers)
		.set({ lastSeenAt: new Date() })
		.where(and(eq(roomMembers.roomId, roomId), eq(roomMembers.userId, userId)));
}

export function formatSinceLabel(d: Date): string {
	const ms = Date.now() - d.getTime();
	const mins = Math.round(ms / 60000);
	if (mins < 120) return `${mins} minutes ago`;
	const hrs = Math.floor(mins / 60);
	return `${hrs} hour${hrs === 1 ? '' : 's'} ago`;
}

function nameList(names: string[]): string {
	if (names.length === 0) return 'Unknown';
	if (names.length === 1) return names[0]!;
	if (names.length === 2) return `${names[0]} and ${names[1]}`;
	return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

function fightLine(s: FightSummaryRow): string {
	const ps = s.participants;
	let line = `Fight #${s.fightNumber} — `;

	if (s.outcome === 'draw') {
		// All participants drew — list everyone.
		const names = ps.length > 0 ? ps.map(p => p.monsterName) : [s.winnerMonsterName ?? 'Unknown', s.loserMonsterName ?? 'Unknown'];
		line += `Draw between ${nameList(names)}`;
	} else if (s.outcome === 'fled') {
		// Someone fled — show who survived vs who fled.
		const fled = ps.filter(p => p.outcome === 'fled').map(p => p.monsterName);
		const survived = ps.filter(p => p.outcome === 'win').map(p => p.monsterName);
		if (fled.length > 0 && ps.length > 0) {
			line += survived.length > 0
				? `${nameList(fled)} fled from ${nameList(survived)}`
				: `${nameList(fled)} fled`;
		} else {
			line += `${s.winnerMonsterName ?? 'Unknown'} fled from ${s.loserMonsterName ?? 'Unknown'}`;
		}
	} else {
		// win or permaDeath — one or more winners, one or more losers.
		const winners = ps.length > 0 ? ps.filter(p => p.outcome === 'win').map(p => p.monsterName) : [];
		const losers = ps.length > 0 ? ps.filter(p => p.outcome === 'loss' || p.outcome === 'permaDeath').map(p => p.monsterName) : [];
		const perished = ps.length > 0 ? ps.filter(p => p.outcome === 'permaDeath').map(p => p.monsterName) : [];
		const w = winners.length > 0 ? nameList(winners) : s.winnerMonsterName ?? 'Unknown';
		const l = losers.length > 0 ? nameList(losers) : s.loserMonsterName ?? 'Unknown';
		line += `${w} defeated ${l} in ${s.roundCount} round(s)`;
		if (perished.length > 0) line += `  ☠ ${nameList(perished)} perished`;
	}

	if (s.cardDropName) line += ` (card drop: ${s.cardDropName})`;
	return line;
}

export function buildCatchUpText(
	summaries: FightSummaryRow[],
	sinceLabel: string,
	streakLines?: string[]
): { fightCount: number; textSummary: string } {
	if (summaries.length === 0) {
		return { fightCount: 0, textSummary: 'No fights since you were last here.' };
	}

	const lines: string[] = [`Since you were last here (${sinceLabel}):\n`];
	for (const s of summaries) {
		lines.push(fightLine(s));
	}

	if (streakLines && streakLines.length > 0) {
		lines.push('');
		for (const sl of streakLines) lines.push(sl);
	}

	return { fightCount: summaries.length, textSummary: lines.join('\n') };
}

export const STREAK_MIN = 3;
const STREAK_LOOKBACK = 80;

/** Count consecutive wins for `monsterId` from most recent fights (fights ordered endedAt DESC). */
export function winStreakFromRecentFights(fights: FightSummaryRow[], monsterId: string): number {
	let n = 0;
	for (const f of fights) {
		const p = f.participants?.find((x) => x.monsterId === monsterId);
		if (!p) continue;
		if (p.outcome === 'win') n += 1;
		else break;
	}
	return n;
}

/** Unique monster IDs that appear in these summaries (any outcome). */
export function monsterIdsFromSummaries(summaries: FightSummaryRow[]): string[] {
	const s = new Set<string>();
	for (const row of summaries) {
		for (const p of row.participants ?? []) {
			if (p.monsterId) s.add(p.monsterId);
		}
	}
	return [...s];
}

/**
 * Compute current consecutive-win streaks for the given monsters in a room.
 *
 * Fetches the last `STREAK_LOOKBACK` fights once, then counts consecutive wins
 * per monster in memory. When `minStreak > 0` only monsters that meet the
 * threshold are included in the returned map; callers that need all values
 * (including zero) should pass `minStreak = 0` (the default).
 */
export async function computeMonsterWinStreaks(
	db: Db,
	roomId: string,
	monsterIds: string[],
	minStreak = 0
): Promise<Map<string, number>> {
	const out = new Map<string, number>();
	if (monsterIds.length === 0) return out;
	const recent = await queryRecentFights(db, roomId, STREAK_LOOKBACK);
	for (const mid of monsterIds) {
		const streak = winStreakFromRecentFights(recent, mid);
		if (streak >= minStreak) out.set(mid, streak);
	}
	return out;
}

export function formatCatchUpStreakLines(
	streaks: Map<string, number>,
	summaries: FightSummaryRow[]
): string[] {
	if (streaks.size === 0) return [];
	const nameById = new Map<string, string>();
	for (const row of summaries) {
		for (const p of row.participants ?? []) {
			if (p.monsterId && !nameById.has(p.monsterId)) {
				nameById.set(p.monsterId, p.monsterName);
			}
		}
	}
	const lines: string[] = [];
	for (const [mid, n] of streaks) {
		const name = nameById.get(mid) ?? 'A monster';
		lines.push(`${name} is on a ${n}-fight winning streak.`);
	}
	return lines;
}

export async function loadFightEventsForSummary(
	db: Db,
	roomId: string,
	startedAt: Date,
	endedAt: Date
): Promise<GameEvent[]> {
	const rows = await db
		.select()
		.from(roomEvents)
		.where(
			and(
				eq(roomEvents.roomId, roomId),
				gte(roomEvents.createdAt, startedAt),
				lte(roomEvents.createdAt, endedAt)
			)
		)
		.orderBy(asc(roomEvents.id));
	return rows.map(dbRowToGameEvent);
}
