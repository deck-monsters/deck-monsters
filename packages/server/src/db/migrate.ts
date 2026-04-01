/**
 * Migration runner — applies pending SQL migrations from supabase/migrations/
 * via drizzle-kit. Run with: pnpm db:migrate
 *
 * Note: Supabase CLI owns the DDL (supabase db push / supabase db reset).
 * This script is a convenience wrapper for non-Supabase environments.
 */
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { db, pool } from './index.js';

await migrate(db, { migrationsFolder: '../../supabase/migrations' });
console.log('Migrations applied successfully');
await pool.end();
