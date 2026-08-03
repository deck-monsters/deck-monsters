import { randomUUID } from 'node:crypto';
import { PromptCancelledError, isCommandRefusal } from '@deck-monsters/engine';

/**
 * Connector-local active interactive flows, keyed by `roomId:userId`.
 * Mirrors the web router's `activeFlows` ownership-token pattern so Discord
 * slash and free-text paths share one coordinator instead of duplicated maps.
 */
export const discordActiveFlows = new Map<string, string>();

export const busyFlowMessage =
	'A command is already in progress — answer the current prompt first, or wait for it to finish.';

export class DiscordFlowBusyError extends Error {
	constructor(message = busyFlowMessage) {
		super(message);
		this.name = 'DiscordFlowBusyError';
	}
}

export function discordFlowKey(roomId: string, userId: string): string {
	return `${roomId}:${userId}`;
}

export function tryAcquireDiscordFlow(
	roomId: string,
	userId: string
): { ok: true; token: string } | { ok: false; message: string } {
	const key = discordFlowKey(roomId, userId);
	if (discordActiveFlows.has(key)) {
		return { ok: false, message: busyFlowMessage };
	}
	const token = randomUUID();
	discordActiveFlows.set(key, token);
	return { ok: true, token };
}

export function releaseDiscordFlow(roomId: string, userId: string, token: string): void {
	const key = discordFlowKey(roomId, userId);
	if (discordActiveFlows.get(key) === token) {
		discordActiveFlows.delete(key);
	}
}

type RoomManagerLike = {
	runSerializedEngineWork: (
		laneKey: string,
		fn: () => Promise<unknown>
	) => Promise<unknown>;
};

/**
 * Acquire the per-user flow lock, run `action` inside
 * `runSerializedEngineWork(`${roomId}:${userId}`)`, and release ownership-safely.
 *
 * The Discord request may await this (interaction constraints). Prompt answers
 * must still arrive outside the lane (collectors / respondToPrompt) so they can
 * unblock the waiting action — do not serialize answer delivery on this lane.
 */
export async function runDiscordCommandAction(opts: {
	roomManager: RoomManagerLike;
	roomId: string;
	userId: string;
	action: () => Promise<unknown>;
}): Promise<void> {
	const acquired = tryAcquireDiscordFlow(opts.roomId, opts.userId);
	if (!acquired.ok) {
		throw new DiscordFlowBusyError(acquired.message);
	}

	try {
		await opts.roomManager.runSerializedEngineWork(
			`${opts.roomId}:${opts.userId}`,
			opts.action
		);
	} finally {
		releaseDiscordFlow(opts.roomId, opts.userId, acquired.token);
	}
}

/** Expected aborts: cancel sentinel translation, prompt timeout, busy, refusals. */
export function isExpectedDiscordFlowAbort(err: unknown): boolean {
	if (err instanceof DiscordFlowBusyError || (err instanceof Error && err.name === 'DiscordFlowBusyError')) {
		return true;
	}
	if (err instanceof PromptCancelledError || (err instanceof Error && err.name === 'PromptCancelledError')) {
		return true;
	}
	if (isCommandRefusal(err)) {
		return true;
	}
	const msg = err instanceof Error ? err.message : String(err);
	return msg.includes('Prompt timed out');
}
