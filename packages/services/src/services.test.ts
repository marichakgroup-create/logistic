import {describe,it,expect,vi} from 'vitest';
import {FixtureSource,normalize} from './fixtures';
import {CachedRouting,FixtureRouting,RoutingUnavailable,type RouteCache} from './routing';
import {LegRoutePlanner} from './addons';
import type {Route} from '@loadlink/core';
const stops=[{lat:52,lon:13},{lat:53,lon:14}];
const route={polyline:'abc',km:100,minutes:90};
function cache():RouteCache {const data=new Map<string,Route>();return {get:async k=>data.get(k)??null,set:async(k,r)=>{data.set(k,r);}};}
describe('fixture adapter',()=>{
 it('normalizes 200 stable EU orders with unknown volume preserved',async()=>{const source=new FixtureSource();const a=await source.fetchSince(null);const b=await source.fetchSince(null);expect(a).toEqual(b);expect(a.orders.map(normalize)).toHaveLength(200);expect(normalize(a.orders[0]).volumeM3).toBeNull();expect((await source.fetchSince(a.nextCursor)).orders).toEqual([]);});
 it('reports closure only for queried IDs',async()=>{const source=new FixtureSource(undefined,new Set(['fixture-1','fixture-3']));expect(await source.fetchClosedIds(['fixture-1','fixture-2'])).toEqual(['fixture-1']);});
 it('rejects malformed data, negative weight and invalid windows',async()=>{const {orders}=await new FixtureSource().fetchSince(null);const order=normalize(orders[0]);expect(()=>normalize({...order,weightKg:-1})).toThrow();expect(()=>normalize({...order,pickupTo:'2020-01-01T00:00:00Z'})).toThrow();expect(()=>normalize({})).toThrow();});
});
describe('cached routing',()=>{
 it('reuses ordered stops from persistent cache',async()=>{const primary={route:vi.fn(async()=>route)};const fallback={route:vi.fn(async()=>route)};const routing=new CachedRouting(primary,fallback,cache());await routing.route(stops);await routing.route(stops);expect(primary.route).toHaveBeenCalledTimes(1);expect(fallback.route).not.toHaveBeenCalled();await routing.route([...stops].reverse());expect(primary.route).toHaveBeenCalledTimes(2);});
 it('uses fallback when OSRM fails',async()=>{const fallback={route:vi.fn(async()=>route)};const routing=new CachedRouting({route:async()=>{throw new Error('down');}},fallback,cache());expect(await routing.route(stops)).toEqual(route);expect(fallback.route).toHaveBeenCalledOnce();});
 it('rejects when both providers fail and does not cache failures',async()=>{const primary={route:vi.fn(async()=>{throw new Error('down');})};const routing=new CachedRouting(primary,primary,cache());await expect(routing.route(stops)).rejects.toBeInstanceOf(RoutingUnavailable);await expect(routing.route(stops)).rejects.toBeInstanceOf(RoutingUnavailable);expect(primary.route).toHaveBeenCalledTimes(4);});
 it('coalesces simultaneous identical routes',async()=>{const primary={route:vi.fn(async()=>route)};const routing=new CachedRouting(primary,primary,cache());await Promise.all([routing.route(stops),routing.route(stops)]);expect(primary.route).toHaveBeenCalledOnce();});
});
describe('matching routing adapter',()=>{
 it('builds deterministic development routes without network access',async()=>{const routing=new FixtureRouting();const a=await routing.route(stops);const b=await routing.route(stops);expect(a).toEqual(b);expect(a.km).toBeGreaterThan(100);expect(a.minutes).toBeGreaterThan(0);});
 it('deduplicates legs and preserves zero-distance stops',async()=>{const route=vi.fn(async()=>({polyline:'',km:10,minutes:12}));const planner=new LegRoutePlanner({route});const point={lat:52,lon:13};const next={lat:53,lon:14};
  const stop=(p:typeof point)=>({orderId:'a',kind:'pickup' as const,point:p,windowFrom:'2026-01-01T00:00:00.000Z',windowTo:'2026-01-02T00:00:00.000Z',weightKg:1,volumeM3:1});
  const [planned]=await planner.plan([[stop(point),stop(point),stop(next)],[stop(point),stop(next)]]);expect(route).toHaveBeenCalledOnce();expect(planned.km).toBe(10);expect(planned.legsMinutes).toEqual([0,12]);
 });
});
