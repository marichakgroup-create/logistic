import {Pool} from 'pg';
import {drizzle} from 'drizzle-orm/node-postgres';
import {migrate} from 'drizzle-orm/node-postgres/migrator';
async function main() {
 const pool = new Pool({connectionString:process.env.DATABASE_URL});
 try {await migrate(drizzle(pool), {migrationsFolder:'infra/migrations'});} finally {await pool.end();}
}
void main().catch(error=>{process.stderr.write(`${error instanceof Error?error.message:'Migration failed'}\n`);process.exitCode=1;});
