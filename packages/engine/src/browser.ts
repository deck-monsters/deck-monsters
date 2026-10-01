/**
 * Browser-safe exports from the engine.
 *
 * This module contains ONLY pure-data exports that have no Node.js
 * dependencies (no node:events, node:zlib, node:crypto, fs, etc.).
 * Vite aliases @deck-monsters/engine to this file for the web app build.
 *
 * Server-side code continues to import from the full index.ts via the
 * compiled dist/ output.
 */
export { COMMAND_CATALOG, CATEGORY_LABELS, formatCommandList } from './commands/catalog.js';
// Pure constant: the guided start's "You can summon N bosses a day." reads it so the copy cannot drift from the quota.
export { BOSS_SUMMON_LIMIT } from './helpers/boss-summons.js';
export type { CommandEntry, CommandCategory } from './commands/catalog.js';
// One matcher for `dm`: the server resolves with it and the Console previews with it.
export { matchRecipient } from './helpers/match-recipient.js';
export type { RecipientCandidate, RecipientMatch } from './helpers/match-recipient.js';
export {
	CARD_REFUSAL_REASON_TEXT,
	cardRefusalReason,
	cardRefusalSentence,
	equipResultMessage,
	isCardRefusalReason,
} from './characters/helpers/equip-message.js';
export type { CardRefusalReason } from './characters/helpers/equip-message.js';
