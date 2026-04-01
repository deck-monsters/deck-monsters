export interface StateStore {
	save(roomId: string, state: string): Promise<void>;
	load(roomId: string): Promise<string | null>;
}
