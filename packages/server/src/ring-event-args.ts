type RingAddContestant = {
	isBoss?: boolean;
	monster?: { givenName?: string };
	character?: { name?: string };
	userId?: string;
};

type RingAddPayload = { contestant?: RingAddContestant };

function asRingAddPayload(value: unknown): RingAddPayload | undefined {
	if (!value || typeof value !== 'object') return undefined;
	if (!('contestant' in value)) return undefined;
	return value as RingAddPayload;
}

/**
 * Ring add listeners may receive either:
 *  - BaseClass emitter args: (className, instance, { contestant })
 *  - direct args from mocks/tests: ({ contestant })
 */
export function extractRingAddContestant(args: unknown[]): RingAddContestant | undefined {
	if (args.length <= 0) return undefined;

	// Preferred: BaseClass payload position.
	const baseClassPayload = asRingAddPayload(args[2]);
	if (baseClassPayload?.contestant) return baseClassPayload.contestant;

	// Compatibility: direct payload as first arg.
	const directPayload = asRingAddPayload(args[0]);
	return directPayload?.contestant;
}
