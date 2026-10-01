/**
 * `msg` / `message` / `m` and `dm` (roadmap 41). Room chat lives in the web server, which
 * catches these lines before the engine ever sees them (`game.command` in
 * server/src/trpc/router.ts). This handler is for every connector without chat — today,
 * Discord — so a player who types one gets a clear answer instead of "unrecognised command",
 * and so the command catalogue's rule that every entry reaches a handler holds.
 */
export const CHAT_FALLBACK_TEXT = "Room chat is in the web app's Chat tab. Here on Discord, talk in the channel.";

// Not `m`: the web's open-question routing asks the real dispatcher whether a line is a
// command, and a handler that claimed `m …` made an answer like "m Jones" read as one ("is a
// command, not a card"), against the rule that `m` stays an answer while a question is open
// (Cursor's live check, 41a). The server still catches `m …` as chat outside questions.
const CHAT_REGEX = /^(?:msg|message|dm)(?:\s+.*)?$/i;

function chatAction({ channel }: any): Promise<unknown> {
	return channel({ announce: CHAT_FALLBACK_TEXT });
}

export const chatHandler = {
	matcher: CHAT_REGEX,
	action: chatAction,
};

export default chatHandler;
