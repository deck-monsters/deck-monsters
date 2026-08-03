import { createClient } from '@supabase/supabase-js';
import { eq, and } from 'drizzle-orm';
import { userConnectors } from '../db/schema.js';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type * as schema from '../db/schema.js';

type Db = NodePgDatabase<typeof schema>;

function getAdminClient() {
	const url = process.env['SUPABASE_URL'];
	const serviceRoleKey = process.env['SUPABASE_SECRET_KEY'];
	if (!url || !serviceRoleKey) {
		throw new Error('SUPABASE_URL and SUPABASE_SECRET_KEY are required');
	}
	return createClient(url, serviceRoleKey, {
		auth: { autoRefreshToken: false, persistSession: false },
	});
}

/**
 * Returns the canonical userId for a connector user, creating one if needed.
 *
 * On first call for a given (connectorType, externalId) pair:
 *   1. Creates a Supabase auth user (the handle_new_user trigger auto-creates the profile row).
 *   2. Inserts a user_connectors row linking the external ID to the new user.
 *
 * On subsequent calls, returns the existing userId without touching Supabase Auth.
 */
export async function ensureConnectorUser(
	connectorType: string,
	externalId: string,
	displayName: string,
	database?: Db
): Promise<string> {
	// Loading the server DB singleton at module evaluation time made every consumer of this
	// helper require DATABASE_URL just to import it. Connectors inject their DB; server callers
	// that omit it still resolve the singleton on first use.
	const resolvedDatabase = database ?? (await import('../db/index.js')).db;

	const [existing] = await resolvedDatabase
		.select({ userId: userConnectors.userId })
		.from(userConnectors)
		.where(
			and(
				eq(userConnectors.connectorType, connectorType),
				eq(userConnectors.externalId, externalId)
			)
		);

	if (existing) return existing.userId;

	const supabase = getAdminClient();
	const { data, error } = await supabase.auth.admin.createUser({
		user_metadata: { display_name: displayName, connector_type: connectorType },
		email_confirm: true,
	});

	if (error || !data.user) {
		throw new Error(`Supabase user creation failed: ${error?.message ?? 'unknown error'}`);
	}

	const userId = data.user.id;

	await resolvedDatabase.insert(userConnectors).values({ userId, connectorType, externalId });

	return userId;
}
