import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';
import { jwtVerify, createRemoteJWKSet } from 'jose';

export interface Context {
	userId: string | null;
	serviceTokenValid: boolean;
}

export async function createContext({ req }: CreateFastifyContextOptions): Promise<Context> {
	const connectorServiceToken = process.env['CONNECTOR_SERVICE_TOKEN'];
	const serviceTokenValid =
		!!connectorServiceToken &&
		req.headers['x-service-token'] === connectorServiceToken;

	const jwtSecret = process.env['SUPABASE_JWT_SECRET'];
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
		if (!jwtSecret) {
			throw new Error('SUPABASE_JWT_SECRET is not configured');
		}

		const secret = new TextEncoder().encode(jwtSecret);
		const { payload } = await jwtVerify(rawToken, secret);
		const sub = payload.sub;

		return { userId: typeof sub === 'string' ? sub : null, serviceTokenValid };
	} catch {
		return { userId: null, serviceTokenValid };
	}
}

// Re-export for use by createRemoteJWKSet (Supabase JWKS endpoint) if needed in future.
export { createRemoteJWKSet };
