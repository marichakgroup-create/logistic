import { describe, expect, it, vi } from 'vitest';
import type { Pool } from 'pg';
import { AuthService } from './auth';
import type { EmailSender } from './email';
import { ServiceError } from './errors';

function testAuth(query: ReturnType<typeof vi.fn>, sender?: EmailSender) {
  const release=vi.fn();
  const pool={connect:async()=>({query,release}),query} as unknown as Pool;
  const email=sender??{sendMagicLink:vi.fn(async()=>undefined)};
  return {service:new AuthService(pool,email,'a'.repeat(32),'http://localhost:3000'),release,email};
}
describe('magic-link authentication',()=>{
  it('stores only a hash and sends a 15-minute single-use link',async()=>{
    const query=vi.fn(async(sql:string,...args:unknown[])=>{void args;return sql.startsWith('SELECT count')?{rows:[{count:'0'}],rowCount:1}:{rows:[],rowCount:1};});
    const {service,email}=testAuth(query);
    await service.requestLink(' USER@Example.COM ');
    const insert=query.mock.calls.find(([sql])=>sql.startsWith('INSERT INTO magic_links')) as [string,unknown[]];
    expect(insert[1][0]).toMatch(/^[a-f0-9]{64}$/);
    expect(insert[1][1]).toBe('user@example.com');
    expect(insert[0]).toContain("interval '15 minutes'");
    const url=new URL(vi.mocked(email.sendMagicLink).mock.calls[0][1]);
    expect(url.searchParams.get('token')).toMatch(/^[a-f0-9]{64}$/);
    expect(url.searchParams.get('token')).not.toBe(insert[1][0]);
  });
  it('enforces five links per email per hour',async()=>{
    const query=vi.fn(async(sql:string,...args:unknown[])=>{void args;return sql.startsWith('SELECT count')?{rows:[{count:'5'}],rowCount:1}:{rows:[],rowCount:1};});
    const {service}=testAuth(query);
    await expect(service.requestLink('user@example.com')).rejects.toMatchObject({code:'RATE_LIMITED',status:429});
    expect(query).toHaveBeenCalledWith('ROLLBACK');
  });
  it('invalidates the database token if email delivery fails',async()=>{
    const query=vi.fn(async(sql:string,...args:unknown[])=>{void args;return sql.startsWith('SELECT count')?{rows:[{count:'0'}],rowCount:1}:{rows:[],rowCount:1};});
    const {service}=testAuth(query,{sendMagicLink:async()=>{throw new Error('down')}});
    await expect(service.requestLink('user@example.com')).rejects.toBeInstanceOf(ServiceError);
    expect(query.mock.calls.some(([sql])=>(sql as string).startsWith('DELETE FROM magic_links'))).toBe(true);
  });
  it('rejects malformed callback tokens before querying',async()=>{
    const query=vi.fn();const {service}=testAuth(query);
    await expect(service.consumeLink('not-a-token')).rejects.toMatchObject({code:'INVALID_LINK'});
    expect(query).not.toHaveBeenCalled();
  });
  it('creates a normalized development session without sending email',async()=>{
    const query=vi.fn(async(sql:string)=>{
      if(sql.startsWith('INSERT INTO users'))return{rows:[{id:'user-1',email:'test@example.com',plan:'trial',plan_status:'active',trial_ends_at:null}],rowCount:1};
      if(sql.startsWith('SELECT id FROM vehicles'))return{rows:[],rowCount:0};
      return{rows:[],rowCount:1};
    });
    const {service,email}=testAuth(query);const result=await service.createDevelopmentSession(' TEST@Example.com ');
    expect(result.user.email).toBe('test@example.com');expect(result.sessionToken).toMatch(/^[a-f0-9]{64}$/);expect(result.hasVehicle).toBe(false);
    expect(email.sendMagicLink).not.toHaveBeenCalled();
  });
});
