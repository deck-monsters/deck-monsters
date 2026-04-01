import pg from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';

import * as schema from './schema.js';

const { Pool } = pg;

const connectionString = process.env['DATABASE_URL'];
if (!connectionString) {
	throw new Error('DATABASE_URL environment variable is required');
}

export const pool = new Pool({ connectionString });

export const db = drizzle(pool, { schema });

export type Db = typeof db;
