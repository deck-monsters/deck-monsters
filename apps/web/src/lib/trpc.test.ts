import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createWSClientMock: vi.fn(),
  wsLinkMock: vi.fn(),
  httpBatchLinkMock: vi.fn(),
  splitLinkMock: vi.fn(),
  createClientMock: vi.fn(),
}));

vi.mock('@trpc/client', () => ({
  createWSClient: mocks.createWSClientMock,
  wsLink: mocks.wsLinkMock,
  httpBatchLink: mocks.httpBatchLinkMock,
  splitLink: mocks.splitLinkMock,
}));

vi.mock('@trpc/react-query', () => ({
  createTRPCReact: () => ({
    createClient: mocks.createClientMock,
  }),
}));

import { createTRPCClient, reconnectWsClient, setTRPCToken } from './trpc.js';

describe('lib/trpc', () => {
  beforeEach(() => {
    mocks.createWSClientMock.mockReset();
    mocks.wsLinkMock.mockReset();
    mocks.httpBatchLinkMock.mockReset();
    mocks.splitLinkMock.mockReset();
    mocks.createClientMock.mockReset();
    reconnectWsClient();

    mocks.createWSClientMock.mockImplementation(() => ({
      close: vi.fn(),
    }));
    mocks.wsLinkMock.mockReturnValue({ type: 'ws-link' });
    mocks.httpBatchLinkMock.mockReturnValue({ type: 'http-link' });
    mocks.splitLinkMock.mockImplementation((opts) => opts.true);
    mocks.createClientMock.mockReturnValue({ ok: true });
    setTRPCToken(null);
  });

  it('recreates the websocket client after reconnect', () => {
    setTRPCToken('token-one');
    createTRPCClient();

    expect(mocks.createWSClientMock).toHaveBeenCalledTimes(1);

    const firstClient = mocks.createWSClientMock.mock.results[0]?.value as { close: ReturnType<typeof vi.fn> };
    reconnectWsClient();

    expect(firstClient.close).toHaveBeenCalledTimes(1);

    setTRPCToken('token-two');
    createTRPCClient();

    expect(mocks.createWSClientMock).toHaveBeenCalledTimes(2);
    const secondUrlFactory = mocks.createWSClientMock.mock.calls[1]?.[0]?.url as () => string;
    expect(secondUrlFactory()).toContain('token-two');
  });
});
