import Fastify from 'fastify';
import ws from '@fastify/websocket';
import { fastifyTRPCPlugin } from '@trpc/server/adapters/fastify';
import { db } from './db/index.js';
import { RoomManager } from './room-manager.js';
import { createRouter } from './trpc/router.js';
import { createContext } from './trpc/context.js';

const PORT = parseInt(process.env['PORT'] ?? '3000', 10);
const HOST = process.env['HOST'] ?? '0.0.0.0';

async function start(): Promise<void> {
	const fastify = Fastify({
		logger: true,
	});

	await fastify.register(ws);

	const roomManager = new RoomManager(db);

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

	await fastify.listen({ port: PORT, host: HOST });
	fastify.log.info(`Server listening at http://${HOST}:${PORT}`);
}

start().catch((err: unknown) => {
	console.error(err);
	process.exit(1);
});
