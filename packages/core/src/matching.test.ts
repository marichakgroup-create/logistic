import { describe, expect, it } from 'vitest';
import { defaultMatchOpts, evaluateAddons, type MatchOrder, type MatchTrip, type PlannedRoute, type RoutePlanner, type TripStop } from './matching';
import type { VehicleInput } from './account';

const at=(minutes:number)=>new Date(Date.parse('2026-10-01T08:00:00Z')+minutes*60_000).toISOString();
const vehicle:VehicleInput={name:'Van',payloadKg:1000,cargoM3:10,lengthCm:300,widthCm:180,heightCm:190};
function order(id='addon',changes:Partial<MatchOrder>={}):MatchOrder{return{id,status:'open',pickup:{lat:52,lon:13},delivery:{lat:53,lon:14},pickupFrom:at(0),pickupTo:at(240),deliveryFrom:at(0),deliveryTo:at(600),weightKg:300,volumeM3:2,lengthCm:100,widthCm:100,heightCm:100,priceEur:200,alongPickup:.2,alongDelivery:.8,...changes};}
const main=order('main',{priceEur:500,alongPickup:0,alongDelivery:1});
function trip(changes:Partial<MatchTrip>={}):MatchTrip{return{departAt:at(0),stops:[],baseKm:100,baseMinutes:100,addonIds:[],...changes};}
function planner(make:(stops:TripStop[])=>PlannedRoute):RoutePlanner{return{plan:async routes=>routes.map(make)};}
const route=(stops:TripStop[],changes:Partial<PlannedRoute>={}):PlannedRoute=>({km:110,minutes:60,polyline:'x',legsMinutes:Array(Math.max(0,stops.length-1)).fill(30),...changes});

describe('matching pipeline',()=>{
 it('rejects an add-on pointing behind the route',async()=>{const candidate=order('wrong',{alongPickup:.8,alongDelivery:.2});const result=await evaluateAddons(main,trip(),vehicle,[candidate],planner(route));expect(result.rejected).toEqual([{order:candidate,reason:'DIRECTION'}]);});
 it('uses a per-leg load profile so sequential loads can share capacity',async()=>{
  const first=order('first',{weightKg:700});const stops:[TripStop,TripStop]=[
   {orderId:'first',kind:'pickup',point:first.pickup,windowFrom:at(0),windowTo:at(200),weightKg:700,volumeM3:2},
   {orderId:'first',kind:'delivery',point:first.delivery,windowFrom:at(0),windowTo:at(300),weightKg:700,volumeM3:2},
  ];
  const candidate=order('second',{weightKg:700});
  const result=await evaluateAddons(main,trip({stops}),vehicle,[candidate],planner(sequence=>route(sequence,{km:sequence.findIndex(s=>s.orderId==='second'&&s.kind==='pickup')>sequence.findIndex(s=>s.orderId==='first'&&s.kind==='delivery')?105:200})),{timeBuffer:0});
  expect(result.suggestions).toHaveLength(1);expect(result.suggestions[0].loadPctKg).toBe(70);
 });
 it('rejects 96% load because capacity is limited to 95%',async()=>{const candidate=order('heavy',{weightKg:960});const result=await evaluateAddons(main,trip(),vehicle,[candidate],planner(route));expect(result.rejected[0].reason).toBe('CAPACITY_KG');});
 it('rejects missing weight and marks missing volume yellow',async()=>{
  const missingWeight=order('weight',{weightKg:null});const missingVolume=order('volume',{volumeM3:null});const result=await evaluateAddons(main,trip(),vehicle,[missingWeight,missingVolume],planner(route),{timeBuffer:0});
  expect(result.rejected.find(item=>item.order.id==='weight')?.reason).toBe('MISSING_WEIGHT');expect(result.suggestions[0].fit).toBe('yellow');expect(result.suggestions[0].loadPctM3).toBeNull();
 });
 it('checks cargo dimensions',async()=>{const candidate=order('long',{lengthCm:301});const result=await evaluateAddons(main,trip(),vehicle,[candidate],planner(route));expect(result.rejected[0].reason).toBe('DIMENSIONS');});
 it('waits for an early window and rejects a one-minute miss',async()=>{
  const early=order('early',{pickupFrom:at(60),pickupTo:at(120),deliveryFrom:at(120),deliveryTo:at(180)});
  const accepted=await evaluateAddons(main,trip(),vehicle,[early],planner(stops=>route(stops,{minutes:30,legsMinutes:[30]})),{timeBuffer:0,stopMinutes:30});
  expect(accepted.suggestions[0].newEndTime).toBe(at(150));
  const late=order('late',{pickupTo:at(60),deliveryTo:at(59)});const rejected=await evaluateAddons(main,trip(),vehicle,[late],planner(stops=>route(stops,{minutes:30,legsMinutes:[30]})),{timeBuffer:0,stopMinutes:30});
  expect(rejected.rejected[0].reason).toBe('TIME_WINDOW');
 });
 it('accepts detour at the boundary and rejects one kilometre above it',async()=>{
  const accepted=await evaluateAddons(main,trip(),vehicle,[order('equal')],planner(stops=>route(stops,{km:115})),{timeBuffer:0});
  const rejected=await evaluateAddons(main,trip(),vehicle,[order('over')],planner(stops=>route(stops,{km:116})),{timeBuffer:0});
  expect(accepted.suggestions[0].detourKm).toBe(15);expect(rejected.rejected[0].reason).toBe('DETOUR');
 });
 it('enforces the four add-on cap',async()=>{const result=await evaluateAddons(main,trip({addonIds:['1','2','3','4']}),vehicle,[order()],planner(route));expect(result.suggestions).toHaveLength(0);});
 it('enforces the nine-hour buffered driving limit',async()=>{const result=await evaluateAddons(main,trip(),vehicle,[order()],planner(stops=>route(stops,{minutes:541,legsMinutes:[541]})),{timeBuffer:0});expect(result.rejected[0].reason).toBe('DRIVER_HOURS');});
 it('scores revenue minus detour cost and sorts descending',async()=>{const low=order('low',{priceEur:100});const high=order('high',{priceEur:250});const result=await evaluateAddons(main,trip(),vehicle,[low,high],planner(route),{timeBuffer:0,costPerKm:.5});expect(result.suggestions.map(item=>item.order.id)).toEqual(['high','low']);expect(result.suggestions[0].score).toBe(245);});
 it('drops non-positive scores and marks known load above 85% yellow',async()=>{const unprofitable=order('loss',{priceEur:1});const nearLimit=order('tight',{weightKg:900});const result=await evaluateAddons(main,trip(),vehicle,[unprofitable,nearLimit],planner(stops=>route(stops,{km:110})),{timeBuffer:0,costPerKm:1});expect(result.suggestions.map(item=>item.order.id)).toEqual(['tight']);expect(result.suggestions[0].fit).toBe('yellow');});
 it('batches insertions per candidate so work can stop between candidates',async()=>{let calls=0;let planned=0;const batched:RoutePlanner={plan:async routes=>{calls++;planned+=routes.length;return routes.map(stops=>route(stops))}};await evaluateAddons(main,trip(),vehicle,[order('a'),order('b')],batched,{timeBuffer:0});expect(calls).toBe(2);expect(planned).toBe(2);});
 it('shares service time for consecutive stops at the same point',async()=>{const shared=order('shared',{pickup:{lat:52,lon:13},delivery:{lat:52,lon:13},deliveryTo:at(31)});const result=await evaluateAddons(main,trip(),vehicle,[shared],planner(stops=>route(stops,{minutes:0,legsMinutes:[0]})),{timeBuffer:0,stopMinutes:30});expect(result.suggestions[0].newEndTime).toBe(at(30));});
 it('keeps default matching limits stable',()=>{expect(defaultMatchOpts).toMatchObject({bufferKm:25,maxDetourPct:.15,maxDetourKm:40,costPerKm:.45,stopMinutes:30,timeBuffer:.15,maxAddons:4,capacityFactor:.95});});
});
