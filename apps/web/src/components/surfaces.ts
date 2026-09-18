import { createElement, type ReactElement, type ReactNode } from 'react';
import RingPane from './RingPane.js';
import ConsolePane from './ConsolePane.js';
import WorkshopPanel from './WorkshopPanel.js';
import FightLogPanel from './FightLogPanel.js';
import LeaderboardPanel from './LeaderboardPanel.js';

/**
 * The set of surfaces `Terminal` can place into a pane slot (or, on a narrow screen, show
 * as the single active tab). See `docs/roadmap/20-workspace-layout.md` §3.1a.
 *
 * Adding a surface later (fights, leaderboard — see §5 Phase 5) means adding one entry
 * here; the tab bar, both `PaneSelector`s and the keyboard shortcuts all read this table
 * rather than hard-coding a surface list of their own.
 *
 * Navigation contract (#137): tabs, selectors, shortcuts and in-app deep links reveal a
 * surface in the workspace. `route` is only for the explicitly labelled full-page action
 * (or a URL entered directly); adding a route must not turn ordinary surface selection
 * into navigation.
 */
export type SurfaceId = 'ring' | 'console' | 'workshop' | 'fights' | 'leaderboard';

export interface SurfaceRenderProps {
  roomId: string;
  isActive: boolean;
  headerActions?: ReactNode;
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
    render: ({ roomId, isActive, headerActions }) => createElement(RingPane, { roomId, isActive, headerActions }),
  },
  {
    id: 'console',
    label: 'Console',
    route: undefined,
    render: ({ roomId, isActive, headerActions }) => createElement(ConsolePane, { roomId, isActive, headerActions }),
  },
  {
    id: 'workshop',
    label: 'Workshop',
    route: (roomId) => `/room/${roomId}/workshop`,
    render: ({ roomId, headerActions }) => createElement(WorkshopPanel, { roomId, headerActions }),
  },
  {
    id: 'fights',
    label: 'Fights',
    route: (roomId) => `/room/${roomId}/fights`,
    render: ({ roomId, headerActions }) => createElement(FightLogPanel, { roomId, headerActions }),
  },
  {
    id: 'leaderboard',
    label: 'Leaders',
    route: (roomId) => `/room/${roomId}/leaderboard`,
    render: ({ roomId, headerActions }) => createElement(LeaderboardPanel, { roomId, initialScope: 'room', headerActions }),
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
