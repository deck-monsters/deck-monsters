import { createTRPCReact } from '@trpc/react-query';
import {
  createWSClient,
  wsLink,
  httpBatchLink,
  splitLink,
  type TRPCLink,
} from '@trpc/client';
import type { AppRouter } from '@deck-monsters/server/types';

export type { AppRouter };

export const trpc = createTRPCReact<AppRouter>();

// Kept in sync by AuthProvider via setTRPCToken — avoids calling getSession()
// asynchronously on every request, which can race against initial auth load.
let _token: string | null = null;
let wsClient: ReturnType<typeof createWSClient> | null = null;

export function setTRPCToken(token: string | null): void {
  _token = token;
  // No reconnect needed here. The wsClient uses lazy mode (connects only when
  // there are active subscriptions). Because all subscription-bearing views are
  // inside RequireAuth, the token is always set before the first connection is
  // attempted. Forcing a close here caused "WebSocket closed before established"
  // errors when onAuthStateChange fired multiple times during the OAuth flow.
}

export function reconnectWsClient(): void {
  if (wsClient) {
    wsClient.close();
    wsClient = null;
  }
}

function getServerUrl(): string {
  return import.meta.env['VITE_SERVER_URL'] as string ?? '';
}

function getWsUrl(): string {
  const base = getServerUrl();
  if (base.startsWith('https://')) return base.replace('https://', 'wss://');
  if (base.startsWith('http://')) return base.replace('http://', 'ws://');
  return `${window.location.protocol === 'https:' ? 'wss' : 'ws'}://${window.location.host}`;
}

function getWsClient() {
  if (!wsClient) {
    wsClient = createWSClient({
      url: () => {
        const base = getWsUrl() + '/trpc';
        // Include the JWT as a query param — the only way to authenticate a
        // WebSocket upgrade request (Authorization headers aren't settable).
        return _token ? `${base}?token=${encodeURIComponent(_token)}` : base;
      },
      // Only open the WebSocket when there are active subscriptions.
      // This guarantees the connection happens after RequireAuth has set the
      // token, so the very first upgrade request always carries the JWT.
      lazy: {
        enabled: true,
        closeMs: 30_000,
      },
      /*
       * Socket-level ping (baseline C1): the client sends "PING" when nothing has arrived for
       * `intervalMs` and closes the socket if no "PONG" comes back within `pongTimeoutMs`,
       * after which wsClient reconnects (its own backoff: 0 ms, then 2 s, 4 s, 8 s ... capped
       * at 30 s) and re-sends the subscription from the last tracked event id. The server
       * answers PING by default (tRPC's ws handler, `dangerouslyDisablePong` is off).
       *
       * What this adds over the feed's own heartbeat watchdog (`useRingFeed`): it is the only
       * thing that can notice a dead socket on a connection whose subscription is not due a
       * frame. The 10 s pong wait is deliberately generous: wsClient clears its pong timer only
       * on a PONG, and a phone frozen with a PING outstanding runs the overdue timer on thaw
       * before the queued PONG is dispatched, closing a healthy socket (the bug 127 race, one
       * layer down). The feed lab replaces this client with a scripted transport, so NO browser
       * test exercises it; it is covered by the server-side contract above and by reading
       * `@trpc/client`'s wsLink, not by the Playwright suite.
       */
      keepAlive: {
        enabled: true,
        intervalMs: 8_000,
        pongTimeoutMs: 10_000,
      },
    });
  }
  return wsClient;
}

function headers() {
  return _token ? { Authorization: `Bearer ${_token}` } : {};
}

export function createTRPCClient() {
  const links: TRPCLink<AppRouter>[] = [
    splitLink({
      condition: (op) => op.type === 'subscription',
      true: wsLink({ client: getWsClient() }),
      false: httpBatchLink({
        url: getServerUrl() + '/trpc',
        headers,
      }),
    }),
  ];
  return trpc.createClient({ links });
}
