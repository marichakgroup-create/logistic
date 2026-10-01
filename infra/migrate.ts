import {Pool} from 'pg';
import {drizzle} from 'drizzle-orm/node-postgres';
import {migrate} from 'drizzle-orm/node-postgres/migrator';
async function main() {
 const pool = new Pool({connectionString:process.env.DATABASE_URL});
 if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required for migrations');
 const client=await pool.connect();
 try {await client.query("SELECT pg_advisory_lock(hashtext('loadlink-migrations'))");await migrate(drizzle(client), {migrationsFolder:'infra/migrations'});} finally {await client.query("SELECT pg_advisory_unlock(hashtext('loadlink-migrations'))");client.release();await pool.end();}
}
void main().catch(error=>{process.stderr.write(`${error instanceof Error?error.message:'Migration failed'}\n`);process.exitCode=1;});
