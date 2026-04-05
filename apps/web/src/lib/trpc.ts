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
  // WebSocket connections cannot send HTTP headers. The server accepts the JWT
  // as a ?token= query param on the upgrade request instead. Force a reconnect
  // so the new URL (with or without the token) is picked up immediately.
  if (wsClient) {
    try {
      wsClient.connection?.ws.close();
    } catch {
      // ignore — connection may already be closed
    }
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
