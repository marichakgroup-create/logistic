import {describe,expect,it,vi} from 'vitest';
import type {Pool} from 'pg';
import {NotificationService} from './notifications';

function harness(fail=false){
 let delivered=false;
 const query=vi.fn(async(sql:string)=>{
  if(sql.includes('FROM order_notifications')&&!delivered)return{rows:[{id:'notice-1',email:'driver@example.com',trip_id:'trip-1',pickup_addr:'Berlin',delivery_addr:'Warsaw'}],rowCount:1};
  if(sql.startsWith('UPDATE order_notifications SET sent_at'))delivered=true;
  return{rows:[],rowCount:0};
 });
 const client={query,release:vi.fn()};const pool={connect:async()=>client} as unknown as Pool;
 const sendOrderLost=fail?vi.fn(async()=>{throw new Error('mail down');}):vi.fn(async()=>undefined);
 return{service:new NotificationService(pool,{sendOrderLost},'https://loadlink.example'),sendOrderLost,query};
}

describe('lost order notifications',()=>{
 it('delivers a pending notice once and marks it sent',async()=>{const {service,sendOrderLost}=harness();await expect(service.deliverPending()).resolves.toEqual({sent:1,failed:0});await expect(service.deliverPending()).resolves.toEqual({sent:0,failed:0});expect(sendOrderLost).toHaveBeenCalledOnce();expect(sendOrderLost).toHaveBeenCalledWith('driver@example.com',expect.objectContaining({tripUrl:'https://loadlink.example/trips/trip-1'}));});
 it('records a failed attempt without losing the notice',async()=>{const {service,query}=harness(true);await expect(service.deliverPending()).resolves.toEqual({sent:0,failed:1});expect(query.mock.calls.some(([sql])=>(sql as string).startsWith('UPDATE order_notifications SET attempts'))).toBe(true);});
});
