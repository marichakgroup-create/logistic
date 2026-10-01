import {describe,expect,it,vi} from 'vitest';
import type {Pool} from 'pg';
import type {MatchOrder,TripPlan} from '@loadlink/core';
import {assertTripSelection,readPlanningOrders,readTripContext,type TripContext} from './trip-context';

const saved={id:'main',status:'open',weightKg:500} as MatchOrder;
const context:TripContext={id:'trip',main_order_id:'main',vehicle_id:'van',status:'booked',revision:2,route_plan:{departAt:'2099-01-01T00:00:00Z',orders:[saved]} as TripPlan,confirmed:new Map([['main',saved]])};
describe('editing saved trips',()=>{
 it('keeps confirmed loads and the main order in the selection',()=>{
  expect(()=>assertTripSelection(context,[])).toThrow('Confirmed loads');
  expect(()=>assertTripSelection({...context,confirmed:new Map([['addon',saved]])},['main'])).toThrow('Confirmed loads');
 });
 it('uses confirmed conditions without requiring an open source order',async()=>{
  const query=vi.fn();expect(await readPlanningOrders({query} as unknown as Pool,['main'],context)).toEqual([saved]);expect(query).not.toHaveBeenCalled();
 });
 it('checks ownership before reading confirmed orders',async()=>{
  const query=vi.fn().mockResolvedValue({rows:[]});
  await expect(readTripContext({query} as unknown as Pool,'owner','trip')).rejects.toMatchObject({code:'TRIP_NOT_FOUND'});
  expect(query).toHaveBeenCalledWith(expect.stringContaining('user_id=$2'),['trip','owner']);expect(query).toHaveBeenCalledTimes(1);
 });
 it('locks the trip and restores a confirmed snapshot',async()=>{
  const query=vi.fn().mockResolvedValueOnce({rows:[context]}).mockResolvedValueOnce({rows:[{order_id:'main',confirmed_order:{...saved,status:'closed'}}]});
  const result=await readTripContext({query} as unknown as Pool,'owner','trip',true);
  expect(result.confirmed.get('main')).toMatchObject({weightKg:500,status:'open'});
  expect(query.mock.calls[0][0]).toContain('FOR UPDATE');
 });
 it('rejects changes after departure',async()=>{
  const query=vi.fn().mockResolvedValue({rows:[{...context,route_plan:{...context.route_plan,departAt:'2000-01-01T00:00:00Z'}}]});
  await expect(readTripContext({query} as unknown as Pool,'owner','trip')).rejects.toMatchObject({code:'TRIP_STARTED'});
 });
});
