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

export function dbRowToGameEvent(row: DbRoomEvent): GameEvent {
	return {
		id: row.eventId ?? `hist:${row.id}`,
		roomId: row.roomId,
		timestamp: row.createdAt.getTime(),
		type: row.type as GameEvent['type'],
		scope: row.scope as GameEvent['scope'],
		targetUserId: row.targetUserId ?? undefined,
		payload: (row.payload ?? {}) as Record<string, unknown>,
		text: row.text,
	};
}
