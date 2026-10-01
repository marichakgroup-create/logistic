import {afterEach,describe,expect,it,vi} from 'vitest';
import type {Pool} from 'pg';
import type {AddonResult} from '@loadlink/core';
import {DirectAddonDispatcher} from './addon-dispatcher';
vi.mock('@loadlink/services',async importOriginal=>{
 const actual=await importOriginal<typeof import('@loadlink/services')>();
 return{...actual,VehicleService:class{async getOwned(){return{};}},readMatchOrders:async()=>[],matchFingerprint:()=> 'fingerprint'};
});
const data={userId:'user',mainOrderId:'main',query:{vehicleId:'van',bufferKm:25,addonOrderIds:[]}};
const result:AddonResult={suggestions:[],rejected:[],partial:false,updatedAt:null};
afterEach(()=>vi.useRealTimers());
describe('direct matching',()=>{
 it('shares concurrent work, caches results, and bypasses cache for saves',async()=>{
  const match=vi.fn().mockResolvedValue(result);const dispatcher=new DirectAddonDispatcher({} as Pool,{match});
  await Promise.all([dispatcher.get(data),dispatcher.get(data)]);expect(match).toHaveBeenCalledTimes(1);
  await dispatcher.get(data);expect(match).toHaveBeenCalledTimes(1);
  await dispatcher.get(data,{fresh:true});expect(match).toHaveBeenCalledTimes(2);expect(match.mock.calls[1][3]).toBe(true);
  await dispatcher.close();
 });
 it('returns pending work for polling and eventually returns its result',async()=>{
  vi.useFakeTimers();let finish!:(value:AddonResult)=>void;
  const match=vi.fn(()=>new Promise<AddonResult>(resolve=>{finish=resolve;}));
  const dispatcher=new DirectAddonDispatcher({} as Pool,{match});const pending=dispatcher.get(data);
  await vi.advanceTimersByTimeAsync(3750);expect(await pending).toMatchObject({pending:true,partial:true});
  finish(result);expect(await dispatcher.get(data)).toEqual(result);expect(match).toHaveBeenCalledTimes(1);
  await dispatcher.close();
 });
 it('evicts failures so a later request can retry',async()=>{
  const match=vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(result);
  const dispatcher=new DirectAddonDispatcher({} as Pool,{match});
  await expect(dispatcher.get(data)).rejects.toThrow('offline');expect(await dispatcher.get(data)).toEqual(result);
 });
 it('expires completed cache entries after five minutes',async()=>{
  vi.useFakeTimers();const match=vi.fn().mockResolvedValue(result);const dispatcher=new DirectAddonDispatcher({} as Pool,{match});
  await dispatcher.get(data);await vi.advanceTimersByTimeAsync(300001);await dispatcher.get(data);expect(match).toHaveBeenCalledTimes(2);
 });
});
