import type { Config } from 'drizzle-kit';
import * as dotenv from 'dotenv';
dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is not set in .env');
}

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL,
  },
  // ✅ Limit introspection to public schema and ignore Supabase internals
  introspect: {
    schemaFilter: ['public'], // only introspect 'public' schema
  },
  tablesFilter: [
    // ignore Supabase system tables
    '!auth_*',
    '!storage_*',
    '!pg_*',
    '!supabase_*',
    '!libsql_wasm_func_table',
  ],
} satisfies Config;
