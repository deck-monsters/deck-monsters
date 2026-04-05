import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';
import { jwtVerify, createRemoteJWKSet } from 'jose';

export interface Context {
	userId: string | null;
	serviceTokenValid: boolean;
}

// Module-level JWKS cache — jose handles HTTP caching internally.
let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
let cachedUrl: string | null = null;
let jwksOverride: ReturnType<typeof createRemoteJWKSet> | null = null;

function getJWKS(): ReturnType<typeof createRemoteJWKSet> | null {
	if (jwksOverride !== null) return jwksOverride;
	const supabaseUrl = process.env['SUPABASE_URL'];
	if (!supabaseUrl) return null;
	const url = new URL('/auth/v1/jwks', supabaseUrl).toString();
	if (url !== cachedUrl) {
		jwks = createRemoteJWKSet(new URL(url));
		cachedUrl = url;
	}
	return jwks;
}

// For testing only — inject a local JWKS to avoid HTTP calls.
export function _setJWKSOverride(override: ReturnType<typeof createRemoteJWKSet> | null): void {
	jwksOverride = override;
}

export async function createContext({ req }: CreateFastifyContextOptions): Promise<Context> {
	const connectorServiceToken = process.env['CONNECTOR_SERVICE_TOKEN'];
	const serviceTokenValid =
		!!connectorServiceToken &&
		req.headers['x-service-token'] === connectorServiceToken;

	const authHeader = req.headers.authorization;

	// For WebSocket browser clients, Authorization headers aren't settable — accept
	// a token query parameter as a fallback on the HTTP upgrade request.
	const rawToken =
		authHeader?.startsWith('Bearer ') ? authHeader.slice(7)
		: typeof req.query === 'object' &&
		  typeof (req.query as Record<string, unknown>)['token'] === 'string'
		? (req.query as Record<string, string>)['token']
		: null;

	if (!rawToken) {
		return { userId: null, serviceTokenValid };
	}

	try {
		const keySet = getJWKS();
		if (!keySet) {
			throw new Error('SUPABASE_URL is not configured');
		}

		const { payload } = await jwtVerify(rawToken, keySet, {
			// Supabase JWTs set aud: "authenticated" — jose v5 requires explicit
			// audience verification when the aud claim is present.
			audience: 'authenticated',
		});
		const sub = payload.sub;

		return { userId: typeof sub === 'string' ? sub : null, serviceTokenValid };
	} catch (err) {
		console.error('[auth] JWT verification failed:', err instanceof Error ? err.message : err);
		return { userId: null, serviceTokenValid };
	}
}
