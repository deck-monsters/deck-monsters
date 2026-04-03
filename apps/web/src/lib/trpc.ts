import { createTRPCReact } from '@trpc/react-query';
import {
  createWSClient,
  wsLink,
  httpBatchLink,
  splitLink,
  type TRPCLink,
} from '@trpc/client';
import type { AppRouter } from '@deck-monsters/server/types';
import { getAccessToken } from './supabase.js';

export type { AppRouter };

export const trpc = createTRPCReact<AppRouter>();

function getServerUrl(): string {
  return import.meta.env['VITE_SERVER_URL'] as string ?? '';
}

function getWsUrl(): string {
  const base = getServerUrl();
  if (base.startsWith('https://')) return base.replace('https://', 'wss://');
  if (base.startsWith('http://')) return base.replace('http://', 'ws://');
  // Same origin — use relative ws path
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

async function headers() {
  const token = await getAccessToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
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
