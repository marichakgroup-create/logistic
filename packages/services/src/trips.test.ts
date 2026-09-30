import {describe,expect,it,vi} from 'vitest';
import type {Pool} from 'pg';
import {TripService} from './trips';

const vehicleId='11111111-1111-4111-8111-111111111111';
const mainOrderId='22222222-2222-4222-8222-222222222222';
const userId='33333333-3333-4333-8333-333333333333';
const input={vehicleId,mainOrderId,addonOrderIds:[]};
function order(overrides:Record<string,unknown>={}){return{id:mainOrderId,status:'open',pickup_from:new Date(Date.now()+60_000),pickup_to:new Date(Date.now()+3_600_000),delivery_to:new Date(Date.now()+7_200_000),weight_kg:500,volume_m3:'4',length_cm:200,width_cm:150,height_cm:150,price_eur:'600',distance_km:300,...overrides};}
function service(row=order()){
 const query=vi.fn(async(sql:string)=>{
  if(sql.startsWith('SELECT payload_kg'))return{rows:[{payload_kg:1200,cargo_m3:'10',length_cm:300,width_cm:180,height_cm:180}],rowCount:1};
  if(sql.startsWith('SELECT id,status'))return{rows:[row],rowCount:1};
  if(sql.startsWith('INSERT INTO trips'))return{rows:[{id:'44444444-4444-4444-8444-444444444444'}],rowCount:1};
  return{rows:[],rowCount:1};
 });
 const client={query,release:vi.fn()};const pool={connect:async()=>client} as unknown as Pool;
 return{trips:new TripService(pool),query};
}
describe('trip saving',()=>{
 it('revalidates and saves a planned main-load trip',async()=>{const {trips,query}=service();const result=await trips.create(userId,input,[]);expect(result).toMatchObject({status:'planned',totalKm:300,totalRevenue:600});expect(query.mock.calls.some(([sql])=>(sql as string).startsWith('INSERT INTO trip_orders'))).toBe(true);});
 it('rejects a stale order with a stable code',async()=>{const {trips}=service(order({status:'closed'}));await expect(trips.create(userId,input,[])).rejects.toMatchObject({code:'ORDER_GONE',status:409});});
 it('rejects aggregate capacity overflow with a stable code',async()=>{const {trips}=service(order({weight_kg:1200}));await expect(trips.create(userId,input,[])).rejects.toMatchObject({code:'CAPACITY_EXCEEDED',status:409});});
});
describe('trip cancellation',()=>{
 it('cancels a planned trip and drops its saved orders atomically',async()=>{
  const query=vi.fn(async(sql:string)=>sql.startsWith("UPDATE trips SET status='cancelled'")?{rows:[{id:'44444444-4444-4444-8444-444444444444'}],rowCount:1}:{rows:[],rowCount:1});
  const client={query,release:vi.fn()};const pool={connect:async()=>client} as unknown as Pool;
  await expect(new TripService(pool).cancel(userId,'44444444-4444-4444-8444-444444444444')).resolves.toEqual({id:'44444444-4444-4444-8444-444444444444'});
  expect(query.mock.calls.map(([sql])=>sql)).toEqual(expect.arrayContaining(['BEGIN',expect.stringContaining("UPDATE trip_orders SET status='dropped'"),'COMMIT']));
 });
 it('keeps a stable error when the trip cannot be cancelled',async()=>{
  const query=vi.fn(async(sql:string)=>{void sql;return{rows:[],rowCount:0};});const client={query,release:vi.fn()};const pool={connect:async()=>client} as unknown as Pool;
  await expect(new TripService(pool).cancel(userId,'44444444-4444-4444-8444-444444444444')).rejects.toMatchObject({code:'TRIP_NOT_CANCELLABLE',status:409});
  expect(query.mock.calls.map(([sql])=>sql)).toContain('ROLLBACK');
 });
});
