import type { CreateFastifyContextOptions } from '@trpc/server/adapters/fastify';
import { jwtVerify, createRemoteJWKSet } from 'jose';

export interface Context {
	userId: string | null;
}

const jwtSecret = process.env['SUPABASE_JWT_SECRET'];

export async function createContext({ req }: CreateFastifyContextOptions): Promise<Context> {
	const authHeader = req.headers.authorization;
	if (!authHeader?.startsWith('Bearer ')) {
		return { userId: null };
	}

	const token = authHeader.slice(7);

	try {
		if (!jwtSecret) {
			throw new Error('SUPABASE_JWT_SECRET is not configured');
		}

		const secret = new TextEncoder().encode(jwtSecret);
		const { payload } = await jwtVerify(token, secret);
		const sub = payload.sub;

		return { userId: typeof sub === 'string' ? sub : null };
	} catch {
		return { userId: null };
	}
}

// Re-export for use by createRemoteJWKSet (Supabase JWKS endpoint) if needed in future.
export { createRemoteJWKSet };
