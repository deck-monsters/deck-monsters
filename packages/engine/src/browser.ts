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
export { COMMAND_CATALOG, formatCommandList } from './commands/catalog.js';
export type { CommandEntry, CommandCategory } from './commands/catalog.js';
