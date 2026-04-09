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

const PORT = parseInt(process.env['PORT'] ?? '3000', 10);
const HOST = process.env['HOST'] ?? '0.0.0.0';

// Comma-separated list of allowed origins, e.g. "https://app.example.com,http://localhost:5173"
const CORS_ORIGINS = (process.env['CORS_ORIGINS'] ?? 'http://localhost:5173')
	.split(',')
	.map((o) => o.trim())
	.filter(Boolean);

// Collect Node.js process metrics (event loop lag, GC, memory, file descriptors).
collectDefaultMetrics({ register: registry });

const METRICS_TOKEN = process.env['METRICS_TOKEN'];

async function start(): Promise<void> {
	const fastify = Fastify({
		logger: true,
	});

	await fastify.register(cors, {
		origin: CORS_ORIGINS,
		credentials: true,
	});

	await fastify.register(ws);

	const roomManager = new RoomManager(db, fastify.log.error.bind(fastify.log));

	const SWEEP_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
	setInterval(() => {
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
	fastify.log.info(`Server listening at http://${HOST}:${PORT}`);
}

start().catch((err: unknown) => {
	console.error(err);
	process.exit(1);
});
