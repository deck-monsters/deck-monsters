import { useEffect, useRef, useState } from 'react';
import type { GameEvent } from '@deck-monsters/server/types';

// Must match the PROTOCOL_VERSION constant in packages/server/src/trpc/router.ts
const CLIENT_PROTOCOL_VERSION = 1;
const CLIENT_BUILD_VERSION = import.meta.env['VITE_BUILD_VERSION'] as string ?? 'dev';

export type HandshakeStatus =
  | { status: 'pending' }
  | { status: 'ok'; buildVersion: string; serverTime: string }
  | { status: 'update-available'; serverBuildVersion: string }
  | { status: 'reloading' }
  | { status: 'version-mismatch'; serverProtocolVersion: number };

export function useHandshake() {
  const [handshakeStatus, setHandshakeStatus] = useState<HandshakeStatus>({ status: 'pending' });
  const reloadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (reloadTimerRef.current) clearTimeout(reloadTimerRef.current);
    };
  }, []);

  function handleHandshakeEvent(event: GameEvent): void {
    if (event.type !== 'handshake') return;

    const payload = event.payload as {
      protocolVersion: number;
      buildVersion: string;
      serverTime: string;
      yourUserId: string;
    };

    const serverProto = payload.protocolVersion;
    const serverBuild = payload.buildVersion;

    if (serverProto > CLIENT_PROTOCOL_VERSION) {
      // Server has a newer protocol — client must reload to get updated code
      setHandshakeStatus({ status: 'reloading' });
      reloadTimerRef.current = setTimeout(() => {
        window.location.reload();
      }, 2000);
      return;
    }

    if (serverProto < CLIENT_PROTOCOL_VERSION) {
      // Client is ahead of server — should not happen in normal deploy flows
      setHandshakeStatus({ status: 'version-mismatch', serverProtocolVersion: serverProto });
      return;
    }

    // Protocol versions match
    if (serverBuild !== CLIENT_BUILD_VERSION && CLIENT_BUILD_VERSION !== 'dev') {
      // A new deployment is available; show a soft notice
      setHandshakeStatus({ status: 'update-available', serverBuildVersion: serverBuild });
    } else {
      setHandshakeStatus({ status: 'ok', buildVersion: serverBuild, serverTime: payload.serverTime });
    }
  }

  return { handshakeStatus, handleHandshakeEvent };
}
