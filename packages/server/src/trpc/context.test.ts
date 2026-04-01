import { expect } from 'chai';
import { SignJWT } from 'jose';

import { createContext } from './context.js';

// Minimal fake Fastify request factory
function makeReq(opts: {
	authorization?: string;
	queryToken?: string;
	serviceToken?: string;
}) {
	return {
		headers: {
			authorization: opts.authorization,
			'x-service-token': opts.serviceToken,
		},
		query: opts.queryToken !== undefined ? { token: opts.queryToken } : {},
	};
}

// Build a fake CreateFastifyContextOptions (only req is used by createContext)
function makeCtxOpts(req: ReturnType<typeof makeReq>) {
	return { req } as unknown as Parameters<typeof createContext>[0];
}

async function signJwt(secret: string, sub: string): Promise<string> {
	return new SignJWT({ sub })
		.setProtectedHeader({ alg: 'HS256' })
		.setIssuedAt()
		.setExpirationTime('1h')
		.sign(new TextEncoder().encode(secret));
}

describe('trpc/context.ts', () => {
	const originalSecret = process.env['SUPABASE_JWT_SECRET'];
	const originalServiceToken = process.env['CONNECTOR_SERVICE_TOKEN'];
	const testSecret = 'test-jwt-secret-32-chars-long!!1';

	beforeEach(() => {
		process.env['SUPABASE_JWT_SECRET'] = testSecret;
		delete process.env['CONNECTOR_SERVICE_TOKEN'];
	});

	afterEach(() => {
		if (originalSecret === undefined) {
			delete process.env['SUPABASE_JWT_SECRET'];
		} else {
			process.env['SUPABASE_JWT_SECRET'] = originalSecret;
		}
		if (originalServiceToken === undefined) {
			delete process.env['CONNECTOR_SERVICE_TOKEN'];
		} else {
			process.env['CONNECTOR_SERVICE_TOKEN'] = originalServiceToken;
		}
	});

	describe('userId extraction', () => {
		it('returns null userId when no token is present', async () => {
			const ctx = await createContext(makeCtxOpts(makeReq({})));
			expect(ctx.userId).to.be.null;
		});

		it('extracts userId from Authorization Bearer header', async () => {
			const token = await signJwt(testSecret, 'user-abc');
			const ctx = await createContext(
				makeCtxOpts(makeReq({ authorization: `Bearer ${token}` }))
			);
			expect(ctx.userId).to.equal('user-abc');
		});

		it('extracts userId from ?token= query param (WebSocket fallback)', async () => {
			const token = await signJwt(testSecret, 'user-ws');
			const ctx = await createContext(
				makeCtxOpts(makeReq({ queryToken: token }))
			);
			expect(ctx.userId).to.equal('user-ws');
		});

		it('prefers Authorization header over query param when both are present', async () => {
			const headerToken = await signJwt(testSecret, 'user-header');
			const queryToken = await signJwt(testSecret, 'user-query');
			const ctx = await createContext(
				makeCtxOpts(
					makeReq({ authorization: `Bearer ${headerToken}`, queryToken })
				)
			);
			expect(ctx.userId).to.equal('user-header');
		});

		it('returns null userId for a malformed token', async () => {
			const ctx = await createContext(
				makeCtxOpts(makeReq({ authorization: 'Bearer not.a.valid.jwt' }))
			);
			expect(ctx.userId).to.be.null;
		});

		it('returns null userId when SUPABASE_JWT_SECRET is not configured', async () => {
			delete process.env['SUPABASE_JWT_SECRET'];
			const token = await signJwt(testSecret, 'user-abc');
			const ctx = await createContext(
				makeCtxOpts(makeReq({ authorization: `Bearer ${token}` }))
			);
			expect(ctx.userId).to.be.null;
		});
	});

	describe('serviceTokenValid', () => {
		it('is false when CONNECTOR_SERVICE_TOKEN is not set', async () => {
			const ctx = await createContext(
				makeCtxOpts(makeReq({ serviceToken: 'any-token' }))
			);
			expect(ctx.serviceTokenValid).to.be.false;
		});

		it('is false when x-service-token header is missing', async () => {
			process.env['CONNECTOR_SERVICE_TOKEN'] = 'secret';
			const ctx = await createContext(makeCtxOpts(makeReq({})));
			expect(ctx.serviceTokenValid).to.be.false;
		});

		it('is false when x-service-token does not match', async () => {
			process.env['CONNECTOR_SERVICE_TOKEN'] = 'secret';
			const ctx = await createContext(
				makeCtxOpts(makeReq({ serviceToken: 'wrong-secret' }))
			);
			expect(ctx.serviceTokenValid).to.be.false;
		});

		it('is true when x-service-token matches CONNECTOR_SERVICE_TOKEN', async () => {
			process.env['CONNECTOR_SERVICE_TOKEN'] = 'correct-secret';
			const ctx = await createContext(
				makeCtxOpts(makeReq({ serviceToken: 'correct-secret' }))
			);
			expect(ctx.serviceTokenValid).to.be.true;
		});
	});
});
