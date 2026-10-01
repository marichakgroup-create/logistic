import { resolve } from 'node:path';
import { Pool } from 'pg';
import { LocalEmailSender, ResendEmailSender } from '@loadlink/services';
import { createApp } from './app';
import {BullAddonDispatcher} from './addon-queue';

const production = process.env.NODE_ENV === 'production';
const appUrl = (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '');
if (production && !appUrl.startsWith('https://')) throw new Error('Production APP_URL must use HTTPS');
const secret = process.env.SESSION_SECRET ?? (production ? '' : 'loadlink-development-secret-change-before-production');
const provider = process.env.EMAIL_PROVIDER ?? (production ? 'resend' : 'local');
if (!['local', 'resend'].includes(provider)) throw new Error('Unknown EMAIL_PROVIDER');
if (provider === 'resend' && (!process.env.EMAIL_API_KEY || !process.env.EMAIL_FROM))
  throw new Error('EMAIL_API_KEY and EMAIL_FROM are required for Resend');
const sender = provider === 'local'
  ? new LocalEmailSender(process.env.EMAIL_OUTBOX_DIR ?? resolve('../../.local/mail'))
  : new ResendEmailSender(process.env.EMAIL_API_KEY!, process.env.EMAIL_FROM!);
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const redis=new URL(process.env.REDIS_URL??'redis://localhost:6379');
const addons=new BullAddonDispatcher({host:redis.hostname,port:Number(redis.port||6379),password:redis.password||undefined},pool);
const app = await createApp(pool, sender, { appUrl, sessionSecret: secret, production },addons);
app.enableShutdownHooks();
for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, async () => { await app.close(); await addons.close(); await pool.end(); process.exit(0); });
await app.listen(Number(process.env.PORT ?? 3001), process.env.HOST ?? '127.0.0.1');
