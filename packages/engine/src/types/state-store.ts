/** The plain-object form of a saved room: what `JSON.parse(JSON.stringify(game))` yields. */
export type SerializedGame = { name: string; options: Record<string, unknown> };

export interface StateStore {
	save(roomId: string, state: SerializedGame): Promise<void>;
	/** A legacy store may still return the base64-gzip or JSON string; `restoreGame` takes either. */
	load(roomId: string): Promise<SerializedGame | string | null>;
}
