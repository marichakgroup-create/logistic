import { createHmac, randomBytes } from 'node:crypto';
import type { Pool } from 'pg';
import { emailSchema, type SessionUser } from '@loadlink/core';
import type { EmailSender } from './email';
import { ServiceError } from './errors';

export const SESSION_SECONDS = 30 * 24 * 60 * 60;
export class AuthService {
  constructor(private pool: Pool, private sender: EmailSender, private secret: string, private appUrl: string) {
    if (secret.length < 32) throw new Error('SESSION_SECRET must contain at least 32 characters');
  }
  hash(token: string) { return createHmac('sha256', this.secret).update(token).digest('hex'); }

  async requestLink(rawEmail: string) {
    const email = emailSchema.parse(rawEmail);
    const token = randomBytes(32).toString('hex');
    const hash = this.hash(token);
    const db = await this.pool.connect();
    try {
      await db.query('BEGIN');
      await db.query('SELECT pg_advisory_xact_lock(hashtext($1))', [`auth:${email}`]);
      const count = await db.query<{ count: string }>(
        "SELECT count(*) FROM auth_requests WHERE email=$1 AND requested_at>now()-interval '1 hour'", [email]);
      if (Number(count.rows[0].count) >= 5) throw new ServiceError('RATE_LIMITED', 'Too many links requested. Try again later.', 429);
      await db.query('INSERT INTO auth_requests(email) VALUES($1)', [email]);
      await db.query("INSERT INTO magic_links(token_hash,email,expires_at) VALUES($1,$2,now()+interval '15 minutes')", [hash, email]);
      await db.query('COMMIT');
    } catch (error) { await db.query('ROLLBACK'); throw error; }
    finally { db.release(); }
    try { await this.sender.sendMagicLink(email, `${this.appUrl}/v1/auth/callback?token=${token}`); }
    catch {
      await this.pool.query('DELETE FROM magic_links WHERE token_hash=$1', [hash]);
      throw new ServiceError('EMAIL_UNAVAILABLE', 'Email delivery is unavailable. Please retry.', 503);
    }
  }

  async consumeLink(token: string): Promise<{ sessionToken: string; user: SessionUser; hasVehicle: boolean }> {
    if (!/^[a-f0-9]{64}$/.test(token)) throw this.invalidLink();
    const db = await this.pool.connect();
    try {
      await db.query('BEGIN');
      const link = await db.query<{ email: string }>(
        'UPDATE magic_links SET used_at=now() WHERE token_hash=$1 AND used_at IS NULL AND expires_at>now() RETURNING email', [this.hash(token)]);
      if (!link.rows[0]) throw this.invalidLink();
      const userResult = await db.query<UserRow>(
        "INSERT INTO users(email,trial_ends_at) VALUES($1,now()+interval '14 days') ON CONFLICT(email) DO UPDATE SET email=EXCLUDED.email RETURNING id,email,plan,plan_status,trial_ends_at", [link.rows[0].email]);
      const user = userFromRow(userResult.rows[0]);
      const sessionToken = randomBytes(32).toString('hex');
      await db.query("INSERT INTO sessions(token_hash,user_id,expires_at) VALUES($1,$2,now()+interval '30 days')", [this.hash(sessionToken), user.id]);
      const vehicles = await db.query('SELECT id FROM vehicles WHERE user_id=$1 AND is_default', [user.id]);
      await db.query('COMMIT');
      return { sessionToken, user, hasVehicle: vehicles.rowCount !== 0 };
    } catch (error) { await db.query('ROLLBACK'); throw error; }
    finally { db.release(); }
  }

  async authenticate(token: string | undefined): Promise<SessionUser> {
    if (!token || !/^[a-f0-9]{64}$/.test(token)) throw this.unauthorized();
    const result = await this.pool.query<UserRow>(
      `SELECT u.id,u.email,u.plan,u.plan_status,u.trial_ends_at FROM sessions s
       JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>now()`, [this.hash(token)]);
    if (!result.rows[0]) throw this.unauthorized();
    return userFromRow(result.rows[0]);
  }
  async logout(token: string) { await this.pool.query('DELETE FROM sessions WHERE token_hash=$1', [this.hash(token)]); }
  private invalidLink() { return new ServiceError('INVALID_LINK', 'This link has expired or already been used. Request a new link.', 401); }
  private unauthorized() { return new ServiceError('UNAUTHORIZED', 'Please sign in to continue.', 401); }
}
type UserRow = { id: string; email: string; plan: string; plan_status: string; trial_ends_at: Date | null };
function userFromRow(row: UserRow): SessionUser {
  return { id: row.id, email: row.email, plan: row.plan, planStatus: row.plan_status, trialEndsAt: row.trial_ends_at?.toISOString() ?? null };
}

export async function enforceRequestLimit(pool: Pool, key: string, maximum = 60) {
  const result = await pool.query<{ count: number }>(
    `INSERT INTO request_limits(key) VALUES($1) ON CONFLICT(key) DO UPDATE SET
     count=CASE WHEN request_limits.window_start<=now()-interval '1 minute' THEN 1 ELSE request_limits.count+1 END,
     window_start=CASE WHEN request_limits.window_start<=now()-interval '1 minute' THEN now() ELSE request_limits.window_start END
     RETURNING count`, [key]);
  if (result.rows[0].count > maximum) throw new ServiceError('RATE_LIMITED', 'Too many requests. Please wait a minute.', 429);
}
