/**
 * The feed lab (`/lab`, `/lab/:fixture`): the REAL room UI (AppShell + Terminal, so the real
 * Ring and Console panes, the feed list, and feed hooks) running with no server, fed by a scripted
 * `LabTransport` that replays a recorded fixture. A Playwright suite drives it through
 * `window.__feedLab`; a human on a phone can drive it with the control strip and URL
 * parameters (`?play=1&speed=4&history=120&theme=millefleur&controls=0`).
 *
 * Isolation: this route sits outside `RequireAuth`, and everything the room tree reads from
 * context is replaced here: a fake auth value, and its own `trpc.Provider` +
 * `QueryClientProvider` built on a link that never leaves the page. See `lab-link.ts`.
 * Nested providers override the app's outer ones (main.tsx), which only initialise: the outer
 * AuthProvider reads Supabase's local session store and the outer tRPC client opens its
 * WebSocket lazily, i.e. only when something subscribes through it, which nothing in the lab does.
 *
 * It is a separate lazy chunk (App.tsx), so none of this ships in the main bundle.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { Session, User } from '@supabase/supabase-js';
import AppShell from '../components/AppShell.js';
import Terminal from '../components/Terminal.js';
import { AuthContext, type AuthContextValue } from '../lib/auth-context.js';
import { trpc } from '../lib/trpc.js';
import { THEMES, useTheme } from '../hooks/useTheme.js';
import { devFixture, LAB_ROOM_ID } from './dev-fixture.js';
import { createLabLink } from './lab-link.js';
import {
  LabTransport,
  type ConnectionLogEntry,
  type LabFixture,
  type LabState,
} from './lab-transport.js';

export interface FeedLabApi {
  fixtures(): string[];
  open(name: string, opts?: { historyCount?: number; latencyMs?: number }): Promise<void>;
  /** Resolves when the lab opened from the URL has mounted. */
  ready(): Promise<void>;
  play(opts?: { speed?: number }): void;
  pause(): void;
  push(n: number): void;
  remaining(): number;
  published(): number;
  done(): boolean;
  drop(opts?: { downMs?: number }): void;
  stall(): void;
  resume(): void;
  setLatency(ms: number): void;
  connectionLog(): ConnectionLogEntry[];
  setTheme(id: string): void;
  state(): LabState;
  deliveredIds(): string[];
  deliveries(): Array<{ id: string; via: 'history' | 'replay' | 'live' }>;
  timings(): unknown;
}

declare global {
  interface Window {
    __feedLab?: FeedLabApi;
  }
}

const fixtureModules = import.meta.glob('./fixtures/*.json', { import: 'default' }) as Record<
  string,
  () => Promise<LabFixture>
>;

function recordedNames(): string[] {
  return Object.keys(fixtureModules)
    .map((path) => /([^/]+)\.json$/.exec(path)?.[1] ?? path)
    .sort();
}

const DEV_NAME = 'dev';

function listFixtures(): string[] {
  return [...recordedNames(), DEV_NAME];
}

async function loadFixture(name: string): Promise<LabFixture> {
  if (name === DEV_NAME) return devFixture();
  const loader = fixtureModules[`./fixtures/${name}.json`];
  if (!loader) throw new Error(`[lab] unknown fixture "${name}" (have: ${listFixtures().join(', ')})`);
  return loader();
}

interface Run {
  id: number;
  fixture: LabFixture;
  transport: LabTransport;
  queryClient: QueryClient;
  client: ReturnType<typeof trpc.createClient>;
}

function nextFrame(): Promise<void> {
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

/** Resolve once the room tree has subscribed and a pane has asked for its history. */
async function whenMounted(run: Run, isCurrent: () => boolean): Promise<void> {
  const deadline = Date.now() + 8_000;
  for (;;) {
    // A newer open() (or StrictMode's second effect pass) disposed this run: nothing to wait for.
    if (!isCurrent()) return;
    // Either pane asking for its history means the room tree is up: a phone starts on the
    // Console tab, so the Ring may not be mounted at all.
    const { ring, console: consoleCalls } = run.transport.historyServed();
    if (run.transport.state().subscriptions > 0 && ring + consoleCalls > 0) break;
    if (Date.now() > deadline) {
      console.warn('[lab] timed out waiting for the room to mount');
      return;
    }
    await new Promise((r) => setTimeout(r, 16));
  }
  // Let React commit the history and the feed lay it out.
  await nextFrame();
  await nextFrame();
  await new Promise((r) => setTimeout(r, 100));
}

function fakeAuth(userId: string): AuthContextValue {
  const user = {
    id: userId,
    aud: 'authenticated',
    email: 'lab@example.invalid',
    app_metadata: {},
    user_metadata: {},
    created_at: '2000-01-01T00:00:00Z',
  } as User;
  const session = { access_token: 'lab', refresh_token: 'lab', token_type: 'bearer', expires_in: 3600, user } as Session;
  const noop = () => Promise.resolve();
  const noopMsg = () => Promise.resolve(null);
  return {
    session,
    user,
    loading: false,
    passwordRecovery: false,
    signInWithDiscord: noop,
    signInWithGoogle: noop,
    signInWithApple: noop,
    signInWithEmail: noopMsg,
    signUpWithEmail: noopMsg,
    sendPasswordResetEmail: noopMsg,
    updatePassword: noopMsg,
    signOut: noop,
  };
}

function LabTree({ run }: { run: Run }) {
  const auth = useMemo(() => fakeAuth(run.fixture.viewerUserId), [run.fixture.viewerUserId]);
  return (
    <AuthContext.Provider value={auth}>
      <trpc.Provider client={run.client} queryClient={run.queryClient}>
        <QueryClientProvider client={run.queryClient}>
          <AppShell roomName="Feed lab" roomId={LAB_ROOM_ID}>
            <Terminal roomId={LAB_ROOM_ID} />
          </AppShell>
        </QueryClientProvider>
      </trpc.Provider>
    </AuthContext.Provider>
  );
}

const SPEEDS = [1, 2, 4, 8, 16];

const stripStyle: React.CSSProperties = {
  flex: 'none',
  display: 'flex',
  flexWrap: 'wrap',
  alignItems: 'center',
  gap: '0.35rem',
  padding: '0.3rem 0.5rem',
  background: 'var(--color-bg)',
  color: 'var(--color-fg-dim)',
  borderBottom: '1px solid var(--color-border)',
  fontFamily: 'var(--font-ui)',
  fontSize: '0.72rem',
};

function LabControls({
  api,
  fixtureName,
  onPickFixture,
}: {
  api: FeedLabApi;
  fixtureName: string;
  onPickFixture: (name: string) => void;
}) {
  const [state, setState] = useState<LabState>(() => api.state());
  const [speed, setSpeed] = useState(1);
  useEffect(() => {
    const id = setInterval(() => setState(api.state()), 250);
    return () => clearInterval(id);
  }, [api]);
  const refresh = () => setState(api.state());

  return (
    <div style={stripStyle} data-testid="lab-controls">
      <select
        title="Which recorded fight to replay"
        aria-label="Fixture"
        value={fixtureName}
        onChange={(e) => onPickFixture(e.target.value)}
      >
        {api.fixtures().map((name) => (
          <option key={name} value={name}>{name}</option>
        ))}
      </select>
      <button
        className="btn"
        title={state.playing ? 'Pause the replay' : 'Replay the remaining events at their recorded pace'}
        onClick={() => {
          if (state.playing) api.pause();
          else api.play({ speed });
          refresh();
        }}
      >
        {state.playing ? 'Pause' : 'Play'}
      </button>
      <button
        className="btn"
        title="Publish the next 10 events at once, as a burst"
        onClick={() => {
          api.push(10);
          refresh();
        }}
      >
        Burst x10
      </button>
      <button
        className="btn"
        title="Drop the connection; the app should resubscribe and catch up"
        onClick={() => {
          api.drop();
          refresh();
        }}
      >
        Drop
      </button>
      <button
        className="btn"
        title={state.stalled ? 'End the stall (missed frames stay lost until a resubscribe)' : 'Go silent: stop delivering any frame, like a dead socket'}
        onClick={() => {
          if (state.stalled) api.resume();
          else api.stall();
          refresh();
        }}
      >
        {state.stalled ? 'Resume' : 'Stall'}
      </button>
      <select
        title="Replay speed"
        aria-label="Speed"
        value={speed}
        onChange={(e) => {
          const next = Number(e.target.value);
          setSpeed(next);
          if (state.playing) api.play({ speed: next });
        }}
      >
        {SPEEDS.map((s) => (
          <option key={s} value={s}>{`${s}x`}</option>
        ))}
      </select>
      <span data-testid="lab-status">
        {state.published}/{state.published + state.remaining}
        {' · '}
        {state.down ? 'down' : state.stalled ? 'stalled' : state.connected ? 'connected' : 'connecting'}
      </span>
    </div>
  );
}

export default function LabRoute() {
  const { fixture: fixtureParam } = useParams<{ fixture?: string }>();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const { setTheme } = useTheme();
  const setThemeRef = useRef(setTheme);
  setThemeRef.current = setTheme;

  const [run, setRun] = useState<Run | null>(null);
  const runRef = useRef<Run | null>(null);
  const runCounter = useRef(0);
  const readyRef = useRef<Promise<void>>(Promise.resolve());

  const controlsVisible = search.get('controls') !== '0';
  const activeName = run?.fixture.name ?? fixtureParam ?? DEV_NAME;

  const api = useMemo<FeedLabApi>(() => {
    const transport = () => runRef.current?.transport;
    const need = () => {
      const t = transport();
      if (!t) throw new Error('[lab] no fixture is open yet; await __feedLab.open(name) or ready()');
      return t;
    };

    const open: FeedLabApi['open'] = async (name, opts) => {
      const fixture = await loadFixture(name);
      runRef.current?.transport.dispose();
      const transportInstance = new LabTransport(fixture, {
        ...(opts?.historyCount !== undefined ? { historyCount: opts.historyCount } : {}),
        ...(opts?.latencyMs !== undefined ? { latencyMs: opts.latencyMs } : {}),
      });
      const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1 } } });
      const client = trpc.createClient({ links: [createLabLink(transportInstance)] });
      const next: Run = { id: ++runCounter.current, fixture, transport: transportInstance, queryClient, client };
      runRef.current = next;
      setRun(next);
      await whenMounted(next, () => runRef.current === next);
    };

    return {
      fixtures: listFixtures,
      open,
      ready: () => readyRef.current,
      play: (opts) => need().play(opts),
      pause: () => transport()?.pause(),
      push: (n) => void need().push(n),
      remaining: () => transport()?.remaining() ?? 0,
      published: () => transport()?.published() ?? 0,
      done: () => transport()?.done() ?? false,
      drop: (opts) => need().drop(opts),
      stall: () => need().stall(),
      resume: () => need().resume(),
      setLatency: (ms) => need().setLatency(ms),
      connectionLog: () => transport()?.connectionLog() ?? [],
      // The app's own theme mechanism (hooks/useTheme.ts), not a reimplementation.
      setTheme: (id) => {
        const theme = THEMES.find((t) => t.id === id);
        if (!theme) throw new Error(`[lab] unknown theme "${id}"`);
        setThemeRef.current(theme.id);
      },
      state: () =>
        transport()?.state() ?? {
          fixture: '',
          published: 0,
          remaining: 0,
          connected: false,
          subscriptions: 0,
          down: false,
          stalled: false,
          playing: false,
          speed: 1,
          latencyMs: 0,
        },
      deliveredIds: () => transport()?.deliveredIds() ?? [],
      deliveries: () => transport()?.deliveries() ?? [],
      timings: () => {
        const timings = (window as unknown as { __feedTimings?: { snapshot(): unknown } }).__feedTimings;
        return timings?.snapshot() ?? null;
      },
    };
  }, []);

  // Install the API for as long as the lab is mounted.
  useEffect(() => {
    window.__feedLab = api;
    return () => {
      if (window.__feedLab === api) delete window.__feedLab;
      runRef.current?.transport.dispose();
      runRef.current = null;
    };
  }, [api]);

  // Open the fixture named in the URL (and again whenever the URL's fixture changes). The
  // query string is read once per open: it is a way to start the lab, not a live binding.
  const searchRef = useRef(search);
  searchRef.current = search;
  useEffect(() => {
    const params = searchRef.current;
    const name = fixtureParam ?? DEV_NAME;
    let cancelled = false;
    const theme = params.get('theme');
    if (theme && THEMES.some((t) => t.id === theme)) api.setTheme(theme);
    const history = params.get('history');
    const latency = params.get('latency');
    const opening = api.open(name, {
      ...(history !== null && Number.isFinite(Number(history)) ? { historyCount: Number(history) } : {}),
      ...(latency !== null && Number.isFinite(Number(latency)) ? { latencyMs: Number(latency) } : {}),
    });
    readyRef.current = opening;
    void opening
      .then(() => {
        if (cancelled || params.get('play') !== '1') return;
        const speed = Number(params.get('speed'));
        api.play(Number.isFinite(speed) && speed > 0 ? { speed } : undefined);
      })
      .catch((err: unknown) => console.error(err));
    return () => {
      cancelled = true;
    };
  }, [api, fixtureParam]);

  const pickFixture = useCallback(
    (name: string) => {
      navigate(`/lab/${name}${window.location.search}`, { replace: true });
    },
    [navigate]
  );

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {controlsVisible && <LabControls api={api} fixtureName={activeName} onPickFixture={pickFixture} />}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {run && <LabTree key={run.id} run={run} />}
      </div>
    </div>
  );
}
