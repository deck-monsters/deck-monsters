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
export function setTRPCToken(token: string | null): void {
  _token = token;
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

let wsClient: ReturnType<typeof createWSClient> | null = null;

function getWsClient() {
  if (!wsClient) {
    wsClient = createWSClient({
      url: () => getWsUrl() + '/trpc',
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
