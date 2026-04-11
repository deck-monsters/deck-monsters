/**
 * Lightweight structured logger that writes Pino-compatible JSON lines.
 * Controlled by the LOG_LEVEL environment variable (default: "info").
 *
 * Valid levels: trace | debug | info | warn | error | fatal | silent
 *
 * Usage in Railway: set LOG_LEVEL=debug in environment variables.
 * Locally:         LOG_LEVEL=debug pnpm dev
 *
 * Output format matches Pino so logs render correctly in Railway's log viewer
 * alongside Fastify's own HTTP request logs.
 */

const LEVELS = {
	trace: 10,
	debug: 20,
	info: 30,
	warn: 40,
	error: 50,
	fatal: 60,
	silent: Infinity,
} as const;

type LogLevelName = keyof typeof LEVELS;

const configuredLevel = (process.env['LOG_LEVEL'] ?? 'info').toLowerCase() as LogLevelName;
const minNumericLevel: number = LEVELS[configuredLevel] ?? LEVELS.info;

const PID = process.pid;

function write(
	numericLevel: number,
	levelName: LogLevelName,
	bindings: Record<string, unknown>,
	msg: string,
	extra?: Record<string, unknown>,
): void {
	if (numericLevel < minNumericLevel) return;

	const entry = JSON.stringify({
		level: numericLevel,
		time: Date.now(),
		pid: PID,
		...bindings,
		...extra,
		msg,
	});

	// error + fatal → stderr; everything else → stdout
	if (numericLevel >= LEVELS.error) {
		process.stderr.write(entry + '\n');
	} else {
		process.stdout.write(entry + '\n');
	}
}

export interface Logger {
	trace(msg: string, extra?: Record<string, unknown>): void;
	debug(msg: string, extra?: Record<string, unknown>): void;
	info(msg: string, extra?: Record<string, unknown>): void;
	warn(msg: string, extra?: Record<string, unknown>): void;
	error(msg: string, extra?: Record<string, unknown>): void;
	/** Create a child logger that inherits all bindings and adds more. */
	child(bindings: Record<string, unknown>): Logger;
}

export function createLogger(component: string, bindings: Record<string, unknown> = {}): Logger {
	const base: Record<string, unknown> = { component, ...bindings };

	return {
		trace: (msg, extra) => write(LEVELS.trace, 'trace', base, msg, extra),
		debug: (msg, extra) => write(LEVELS.debug, 'debug', base, msg, extra),
		info:  (msg, extra) => write(LEVELS.info,  'info',  base, msg, extra),
		warn:  (msg, extra) => write(LEVELS.warn,  'warn',  base, msg, extra),
		error: (msg, extra) => write(LEVELS.error, 'error', base, msg, extra),
		child: (extra) => createLogger(component, { ...bindings, ...extra }),
	};
}

/** Whether debug-level logging is active — useful for building expensive log payloads conditionally. */
export const isDebugEnabled = minNumericLevel <= LEVELS.debug;
export const isTraceEnabled = minNumericLevel <= LEVELS.trace;
