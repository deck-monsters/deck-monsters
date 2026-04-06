/**
 * Re-exports for consumers that need the AppRouter type (e.g. the web app).
 * Import as: import type { AppRouter } from '@deck-monsters/server/types'
 */
export type { AppRouter } from './trpc/router.js';
export type { GameEvent, EventType, EventScope } from '@deck-monsters/engine';
