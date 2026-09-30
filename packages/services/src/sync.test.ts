import {it,expect,vi} from 'vitest';
import type {Pool} from 'pg';
import {syncOrders} from './sync';
import {FixtureSource} from './fixtures';
function database(){
 const records=new Map<string,{status:string;misses:number}>();let cursor:string|null=null;
 const query=vi.fn(async(sql:string,args:unknown[]=[]):Promise<{rows:Record<string,unknown>[];rowCount:number}>=>{
 if(sql.startsWith('SELECT cursor'))return {rows:cursor?[{cursor}]:[],rowCount:0};
 if(sql.startsWith('INSERT INTO orders')){const id=args[0] as string;const prior=records.get(id);records.set(id,{status:args[1] as string,misses:prior?.misses??0});}
 if(sql.startsWith('SELECT trans_eu_id'))return {rows:[...records].filter(([,r])=>r.status==='open').map(([id])=>({trans_eu_id:id})),rowCount:0};
 if(sql.startsWith('UPDATE orders SET missed_syncs')){for(const [id,r] of records)if(r.status==='open')r.misses=(args[0] as string[]).includes(id)?r.misses+1:0;}
 if(sql.startsWith('UPDATE orders SET status')){let count=0;for(const r of records.values())if(r.status==='open'&&r.misses>=2){r.status='closed';count++;}return {rows:[],rowCount:count};}
 if(sql.startsWith('INSERT INTO sync_state'))cursor=args[1] as string;
 return {rows:[],rowCount:0};
 });
 const release=vi.fn();const pool={connect:async()=>({query,release})} as unknown as Pool;
 return {pool,query,release,records};
}
it('re-imports idempotently and closes only after two confirmed misses',async()=>{
 const db=database();const closed=new Set<string>();const source=new FixtureSource(undefined,closed);
 await syncOrders(db.pool,source,'fixture');await syncOrders(db.pool,source,'fixture');expect(db.records.size).toBe(200);
 closed.add('fixture-1');await syncOrders(db.pool,source,'fixture');expect(db.records.get('fixture-1')?.status).toBe('open');
 await syncOrders(db.pool,source,'fixture');expect(db.records.get('fixture-1')?.status).toBe('closed');
});
it('resets a single miss if availability returns',async()=>{const db=database();const closed=new Set<string>();const source=new FixtureSource(undefined,closed);await syncOrders(db.pool,source,'fixture');closed.add('fixture-1');await syncOrders(db.pool,source,'fixture');closed.clear();await syncOrders(db.pool,source,'fixture');expect(db.records.get('fixture-1')?.misses).toBe(0);});
it('rolls back and releases connection if feed fails',async()=>{const db=database();await expect(syncOrders(db.pool,{fetchSince:async()=>{throw new Error('feed down');},fetchClosedIds:async()=>[]},'fixture')).rejects.toThrow('feed down');expect(db.query).toHaveBeenCalledWith('ROLLBACK');expect(db.release).toHaveBeenCalledOnce();});
