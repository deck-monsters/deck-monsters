import { beforeEach, describe, expect, it, vi } from 'vitest';

const createWSClientMock = vi.fn();
const wsLinkMock = vi.fn();
const httpBatchLinkMock = vi.fn();
const splitLinkMock = vi.fn();
const createClientMock = vi.fn();

vi.mock('@trpc/client', () => ({
  createWSClient: createWSClientMock,
  wsLink: wsLinkMock,
  httpBatchLink: httpBatchLinkMock,
  splitLink: splitLinkMock,
}));

vi.mock('@trpc/react-query', () => ({
  createTRPCReact: () => ({
    createClient: createClientMock,
  }),
}));

import { createTRPCClient, reconnectWsClient, setTRPCToken } from './trpc.js';

describe('lib/trpc', () => {
  beforeEach(() => {
    createWSClientMock.mockReset();
    wsLinkMock.mockReset();
    httpBatchLinkMock.mockReset();
    splitLinkMock.mockReset();
    createClientMock.mockReset();
    reconnectWsClient();

    createWSClientMock.mockImplementation(() => ({
      close: vi.fn(),
    }));
    wsLinkMock.mockReturnValue({ type: 'ws-link' });
    httpBatchLinkMock.mockReturnValue({ type: 'http-link' });
    splitLinkMock.mockImplementation((opts) => opts.true);
    createClientMock.mockReturnValue({ ok: true });
    setTRPCToken(null);
  });

  it('recreates the websocket client after reconnect', () => {
    setTRPCToken('token-one');
    createTRPCClient();

    expect(createWSClientMock).toHaveBeenCalledTimes(1);

    const firstClient = createWSClientMock.mock.results[0]?.value as { close: ReturnType<typeof vi.fn> };
    reconnectWsClient();

    expect(firstClient.close).toHaveBeenCalledTimes(1);

    setTRPCToken('token-two');
    createTRPCClient();

    expect(createWSClientMock).toHaveBeenCalledTimes(2);
    const secondUrlFactory = createWSClientMock.mock.calls[1]?.[0]?.url as () => string;
    expect(secondUrlFactory()).toContain('token-two');
  });
});
