import type { GameEvent } from '@deck-monsters/engine';

type DbRoomEvent = {
	id: number;
	roomId: string;
	type: string;
	scope: string;
	targetUserId: string | null;
	payload: unknown;
	text: string;
	eventId: string | null;
	createdAt: Date;
};

function timestampFromEventId(eventId: string | null): number | undefined {
	if (!eventId) return undefined;
	const [prefix] = eventId.split('-', 1);
	if (!prefix) return undefined;
	const ts = Number.parseInt(prefix, 10);
	if (!Number.isFinite(ts)) return undefined;
	if (ts <= 0) return undefined;
	return ts;
}

export function dbRowToGameEvent(row: DbRoomEvent): GameEvent {
	const eventTimestamp = timestampFromEventId(row.eventId) ?? row.createdAt.getTime();
	return {
		id: row.eventId ?? `hist:${row.id}`,
		roomId: row.roomId,
		timestamp: eventTimestamp,
		type: row.type as GameEvent['type'],
		scope: row.scope as GameEvent['scope'],
		targetUserId: row.targetUserId ?? undefined,
		payload: (row.payload ?? {}) as Record<string, unknown>,
		text: row.text,
	};
}
