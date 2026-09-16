import { createElement, type ReactElement } from 'react';
import RingPane from './RingPane.js';
import ConsolePane from './ConsolePane.js';
import WorkshopPanel from './WorkshopPanel.js';

/**
 * The set of surfaces `Terminal` can place into a pane slot (or, on a narrow screen, show
 * as the single active tab). See `docs/roadmap/20-workspace-layout.md` §3.1a.
 *
 * Adding a surface later (fights, leaderboard — see §5 Phase 5) means adding one entry
 * here; the tab bar, both `PaneSelector`s and the keyboard shortcuts all read this table
 * rather than hard-coding a surface list of their own.
 */
export type SurfaceId = 'ring' | 'console' | 'workshop';

export interface SurfaceRenderProps {
  roomId: string;
  isActive: boolean;
}

export interface SurfaceDefinition {
  id: SurfaceId;
  /** Short label for the tab bar and the pane selector. */
  label: string;
  /**
   * The surface's full-page route, for the pane header's "open full page" link (§3.1).
   * `undefined` when the surface has no route of its own — the ring and console are the
   * room route itself (`/room/:roomId` renders `Terminal`, not a dedicated ring/console
   * page), so there is nowhere else to link them.
   */
  route: ((roomId: string) => string) | undefined;
  /**
   * Renders the surface. A function rather than a bare component reference because each
   * surface takes a slightly different prop shape today (`WorkshopPanel` has no
   * `isActive` — it does not do the scroll-follow / tab-switch behaviour ring and console
   * do), and this keeps that difference contained to one place instead of leaking into
   * `Terminal`.
   */
  render: (props: SurfaceRenderProps) => ReactElement;
}

export const SURFACES: SurfaceDefinition[] = [
  {
    id: 'ring',
    label: 'The Ring',
    route: undefined,
    render: ({ roomId, isActive }) => createElement(RingPane, { roomId, isActive }),
  },
  {
    id: 'console',
    label: 'Console',
    route: undefined,
    render: ({ roomId, isActive }) => createElement(ConsolePane, { roomId, isActive }),
  },
  {
    id: 'workshop',
    label: 'Workshop',
    route: (roomId) => `/room/${roomId}/workshop`,
    render: ({ roomId }) => createElement(WorkshopPanel, { roomId }),
  },
];

export const DEFAULT_SLOTS: [SurfaceId, SurfaceId] = ['ring', 'console'];

const SURFACE_IDS = new Set<SurfaceId>(SURFACES.map((surface) => surface.id));

export function isSurfaceId(value: unknown): value is SurfaceId {
  return typeof value === 'string' && SURFACE_IDS.has(value as SurfaceId);
}

export function surfaceById(id: SurfaceId): SurfaceDefinition {
  const surface = SURFACES.find((candidate) => candidate.id === id);
  if (!surface) throw new Error(`Unknown surface id: ${id}`);
  return surface;
}
