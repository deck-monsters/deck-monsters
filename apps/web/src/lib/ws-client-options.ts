import type { createWSClient } from '@trpc/client';

/**
 * The options the app's WebSocket client is built with, kept in this file (no React, no
 * `import.meta.env`) so the server's real-transport suite
 * (`packages/server/src/trpc/ring-feed-transport.pg.test.ts`) builds its client from the very
 * same numbers. Change a value here and that suite exercises the change. See
 * docs/reference/feed-lab.md ("The real-transport suite").
 */
type WsClientOptions = Parameters<typeof createWSClient>[0];

export function ringFeedWsClientOptions(url: () => string): WsClientOptions {
  return {
    url,
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
     * layer down). The feed lab replaces this client with a scripted transport, so no browser
     * test exercises it; the server's real-transport suite does (docs/reference/feed-lab.md).
     */
    keepAlive: {
      enabled: true,
      intervalMs: 8_000,
      pongTimeoutMs: 10_000,
    },
  };
}
