import Fastify from 'fastify';
import cors from '@fastify/cors';
import ws from '@fastify/websocket';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import { collectDefaultMetrics } from 'prom-client';
import { db } from './db/index.js';
import { RoomManager } from './room-manager.js';
import { createRouter } from './trpc/router.js';
import { createContext } from './trpc/context.js';
import { registry } from './metrics/index.js';
import { createLogger } from './logger.js';

const PORT = parseInt(process.env['PORT'] ?? '3000', 10);
const HOST = process.env['HOST'] ?? '0.0.0.0';
const LOG_LEVEL = process.env['LOG_LEVEL'] ?? 'info';

// Comma-separated list of allowed origins, e.g. "https://app.example.com,http://localhost:5173"
const CORS_ORIGINS = (process.env['CORS_ORIGINS'] ?? 'http://localhost:5173')
	.split(',')
	.map((o) => o.trim())
	.filter(Boolean);

// Collect Node.js process metrics (event loop lag, GC, memory, file descriptors).
collectDefaultMetrics({ register: registry });

const METRICS_TOKEN = process.env['METRICS_TOKEN'];
const log = createLogger('server');

async function start(): Promise<void> {
	// LOG_LEVEL controls both our structured logger and Fastify's built-in Pino logger
	// so HTTP request logs honour the same threshold as application logs.
	const fastify = Fastify({
		logger: { level: LOG_LEVEL },
	});

	log.debug('server starting', {
		port: PORT,
		host: HOST,
		logLevel: LOG_LEVEL,
		corsOrigins: CORS_ORIGINS,
		metricsTokenSet: !!METRICS_TOKEN,
		buildVersion: process.env['BUILD_VERSION'] ?? 'dev',
	});

	await fastify.register(cors, {
		origin: CORS_ORIGINS,
		credentials: true,
	});

	await fastify.register(ws);

	const roomManager = new RoomManager(db, fastify.log.error.bind(fastify.log));

	const SWEEP_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
	setInterval(() => {
		log.debug('idle room sweep triggered');
		roomManager.sweepIdleRooms().catch((err: unknown) => {
			fastify.log.error(err, 'sweepIdleRooms failed');
		});
	}, SWEEP_INTERVAL_MS).unref();

	const router = createRouter(roomManager);

	await fastify.register(fastifyTRPCPlugin, {
		prefix: '/trpc',
		useWSS: true,
		trpcOptions: {
			router,
			createContext,
		},
	});

	fastify.get('/health', async () => ({ status: 'ok', timestamp: new Date().toISOString() }));

	fastify.get('/metrics', async (req, reply) => {
		if (METRICS_TOKEN) {
			const auth = (req.headers['authorization'] as string | undefined) ?? '';
			if (auth !== `Bearer ${METRICS_TOKEN}`) {
				reply.code(401).header('WWW-Authenticate', 'Bearer').send('Unauthorized');
				return;
			}
		}
		const output = await registry.metrics();
		reply.header('Content-Type', registry.contentType);
		return output;
	});

	await fastify.listen({ port: PORT, host: HOST });
	log.info('server listening', { url: `http://${HOST}:${PORT}` });
}

start().catch((err: unknown) => {
	console.error(err);
	process.exit(1);
});
