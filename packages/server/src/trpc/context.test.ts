import { expect } from 'chai';
import { SignJWT, generateKeyPair, exportJWK, createLocalJWKSet } from 'jose';

import { createContext, _setJWKSOverride } from './context.js';

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

describe('trpc/context.ts', () => {
	let privateKey: CryptoKey;
	let localJWKS: ReturnType<typeof createLocalJWKSet>;

	const originalSupabaseUrl = process.env['SUPABASE_URL'];
	const originalServiceToken = process.env['CONNECTOR_SERVICE_TOKEN'];

	before(async () => {
		const pair = await generateKeyPair('RS256');
		privateKey = pair.privateKey;

		const jwk = await exportJWK(pair.publicKey);
		localJWKS = createLocalJWKSet({
			keys: [{ ...jwk, kid: 'test-key', alg: 'RS256' }],
		});
		// Inject a local JWKS so tests never make HTTP calls
		_setJWKSOverride(localJWKS as Parameters<typeof _setJWKSOverride>[0]);
	});

	after(() => {
		_setJWKSOverride(null);
	});

	beforeEach(() => {
		process.env['SUPABASE_URL'] = 'https://test.supabase.co';
		delete process.env['CONNECTOR_SERVICE_TOKEN'];
	});

	afterEach(() => {
		if (originalSupabaseUrl === undefined) {
			delete process.env['SUPABASE_URL'];
		} else {
			process.env['SUPABASE_URL'] = originalSupabaseUrl;
		}
		if (originalServiceToken === undefined) {
			delete process.env['CONNECTOR_SERVICE_TOKEN'];
		} else {
			process.env['CONNECTOR_SERVICE_TOKEN'] = originalServiceToken;
		}
	});

	async function signJwt(sub: string): Promise<string> {
		return new SignJWT({ sub })
			.setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
			.setIssuedAt()
			.setExpirationTime('1h')
			.sign(privateKey);
	}

	describe('userId extraction', () => {
		it('returns null userId when no token is present', async () => {
			const ctx = await createContext(makeCtxOpts(makeReq({})));
			expect(ctx.userId).to.be.null;
		});

		it('extracts userId from Authorization Bearer header', async () => {
			const token = await signJwt('user-abc');
			const ctx = await createContext(
				makeCtxOpts(makeReq({ authorization: `Bearer ${token}` }))
			);
			expect(ctx.userId).to.equal('user-abc');
		});

		it('extracts userId from ?token= query param (WebSocket fallback)', async () => {
			const token = await signJwt('user-ws');
			const ctx = await createContext(
				makeCtxOpts(makeReq({ queryToken: token }))
			);
			expect(ctx.userId).to.equal('user-ws');
		});

		it('prefers Authorization header over query param when both are present', async () => {
			const headerToken = await signJwt('user-header');
			const queryToken = await signJwt('user-query');
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

		it('returns null userId when SUPABASE_URL is not configured', async () => {
			_setJWKSOverride(null);
			delete process.env['SUPABASE_URL'];

			const token = await signJwt('user-abc');
			const ctx = await createContext(
				makeCtxOpts(makeReq({ authorization: `Bearer ${token}` }))
			);
			expect(ctx.userId).to.be.null;

			_setJWKSOverride(localJWKS as Parameters<typeof _setJWKSOverride>[0]);
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
