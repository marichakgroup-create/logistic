import {z} from 'zod';
import type { Point, Route } from './index';
import type { VehicleInput } from './account';

export type StopKind='pickup'|'delivery';
export type TripStop={orderId:string;kind:StopKind;point:Point;windowFrom:string;windowTo:string;weightKg:number|null;volumeM3:number|null};
export type MatchOrder={id:string;status:'open'|'closed'|'expired';pickup:Point;delivery:Point;pickupAddress?:string;deliveryAddress?:string;pickupFrom:string;pickupTo:string;deliveryFrom:string;deliveryTo:string;weightKg:number|null;volumeM3:number|null;lengthCm:number|null;widthCm:number|null;heightCm:number|null;priceEur:number|null;alongPickup:number;alongDelivery:number};
export type MatchTrip={departAt:string;stops:TripStop[];baseKm:number;baseMinutes:number;initialKm?:number;addonIds:string[]};
export type MatchOpts={bufferKm:number;maxDetourPct:number;maxDetourKm:number;costPerKm:number;stopMinutes:number;timeBuffer:number;maxAddons:number;capacityFactor:number};
export const defaultMatchOpts:MatchOpts={bufferKm:25,maxDetourPct:.15,maxDetourKm:40,costPerKm:.45,stopMinutes:30,timeBuffer:.15,maxAddons:4,capacityFactor:.95};
export type RejectReason='CAPACITY_KG'|'CAPACITY_M3'|'DIMENSIONS'|'DETOUR'|'TIME_WINDOW'|'DIRECTION'|'DRIVER_HOURS'|'MISSING_WEIGHT'|'NO_PRICE'|'TRIP_FULL';
export type Suggestion={order:MatchOrder;addedRevenue:number;detourKm:number;detourMin:number;loadPctKg:number;loadPctM3:number|null;fit:'green'|'yellow';score:number;newEndTime:string;stops:TripStop[]};
export type Rejected={order:MatchOrder;reason:RejectReason};
export type MatchResult={suggestions:Suggestion[];rejected:Rejected[];partial?:boolean};
export type MatchProgress={shouldStop:()=>boolean;publish:(result:MatchResult)=>Promise<void>};
export const addonQuerySchema=z.object({
 vehicleId:z.string().uuid(),
 bufferKm:z.coerce.number().int().min(5).max(100).default(25),
 tripId:z.string().uuid().optional(),
 addonOrderIds:z.preprocess(value=>typeof value==='string'?(value?value.split(','):[]):value,z.array(z.string().uuid()).max(4)).default([])
}).refine(value=>new Set(value.addonOrderIds).size===value.addonOrderIds.length,'Duplicate add-on orders');
export type AddonQuery=z.infer<typeof addonQuerySchema>;
export type StopTiming={arrivalAt:string;departureAt:string;onboardKg:number;onboardM3:number|null};
export type TripPlan={orders:MatchOrder[];inputFingerprint:string;stops:TripStop[];timings:StopTiming[];departAt:string;endAt:string;totalKm:number;detourKm:number;totalMinutes:number;totalRevenue:number;loadPctKg:number;loadPctM3:number|null;geometry:Point[][];mainGeometry:Point[][]};
export type AddonResult=MatchResult&{pending?:boolean;partial:boolean;updatedAt:string|null;trip?:TripPlan};
export type PlannedRoute=Route&{legsMinutes:number[];geometry?:Point[][]};
export interface RoutePlanner{plan(routes:TripStop[][]):Promise<PlannedRoute[]>}

const msMinute=60_000;
function stop(order:MatchOrder,kind:StopKind):TripStop{return kind==='pickup'?{orderId:order.id,kind,point:order.pickup,windowFrom:order.pickupFrom,windowTo:order.pickupTo,weightKg:order.weightKg,volumeM3:order.volumeM3}:{orderId:order.id,kind,point:order.delivery,windowFrom:order.deliveryFrom,windowTo:order.deliveryTo,weightKg:order.weightKg,volumeM3:order.volumeM3};}
function insertions(stops:TripStop[],order:MatchOrder){const result:TripStop[][]=[];for(let pickup=0;pickup<=stops.length;pickup++)for(let delivery=pickup+1;delivery<=stops.length+1;delivery++){const next=[...stops];next.splice(pickup,0,stop(order,'pickup'));next.splice(delivery,0,stop(order,'delivery'));result.push(next);}return result;}
function samePoint(a:Point,b:Point){return a.lat===b.lat&&a.lon===b.lon;}
export function dimensionsFit(order:MatchOrder,vehicle:VehicleInput){return !((order.lengthCm!==null&&vehicle.lengthCm!==null&&order.lengthCm>vehicle.lengthCm)||(order.widthCm!==null&&vehicle.widthCm!==null&&order.widthCm>vehicle.widthCm)||(order.heightCm!==null&&vehicle.heightCm!==null&&order.heightCm>vehicle.heightCm));}

export function capacity(stops:TripStop[],vehicle:VehicleInput,capacityFactor:number):{reason:'MISSING_WEIGHT'|'CAPACITY_KG'|'CAPACITY_M3'}|{loadPctKg:number;loadPctM3:number|null}{
 let kg=0,m3=0,maxKg=0,maxM3=0,unknownVolume=false;
 for(const current of stops){if(current.weightKg===null)return{reason:'MISSING_WEIGHT' as const};if(current.kind==='pickup'){kg+=current.weightKg;if(current.volumeM3===null)unknownVolume=true;else m3+=current.volumeM3;}else{kg-=current.weightKg;if(current.volumeM3!==null)m3-=current.volumeM3;}maxKg=Math.max(maxKg,kg);maxM3=Math.max(maxM3,m3);if(kg>vehicle.payloadKg*capacityFactor)return{reason:'CAPACITY_KG' as const};if(m3>vehicle.cargoM3*capacityFactor)return{reason:'CAPACITY_M3' as const};}
 return{loadPctKg:maxKg/vehicle.payloadKg*100,loadPctM3:unknownVolume?null:maxM3/vehicle.cargoM3*100};
}
function bufferedLeg(minutes:number,buffer:number){return minutes*(1+buffer);}
function driveLeg(time:number,minutes:number,sinceBreak:number){let remaining=minutes;let cursor=time;let current=sinceBreak;while(remaining>0){const available=270-current;if(remaining<=available){cursor+=remaining*msMinute;current+=remaining;remaining=0;}else{cursor+=available*msMinute;remaining-=available;cursor+=45*msMinute;current=0;}}return{time:cursor,sinceBreak:current};}
export function timeline(stops:TripStop[],route:PlannedRoute,departAt:string,opts:MatchOpts):{reason:'DRIVER_HOURS'|'TIME_WINDOW'}|{endTime:number;minSlack:number;timings:StopTiming[]}{
 if(route.legsMinutes.length!==Math.max(0,stops.length-1))throw new Error('Route planner returned invalid legs');
 const bufferedDriving=route.legsMinutes.reduce((sum,value)=>sum+bufferedLeg(value,opts.timeBuffer),0);
 if(bufferedDriving>540)return{reason:'DRIVER_HOURS' as const};
 let time=Date.parse(departAt),sinceBreak=0,minSlack=Infinity,kg=0,m3=0,unknown=0;const timings:StopTiming[]=[];
 for(let index=0;index<stops.length;index++){
  if(index>0){const driven=driveLeg(time,bufferedLeg(route.legsMinutes[index-1],opts.timeBuffer),sinceBreak);time=driven.time;sinceBreak=driven.sinceBreak;}
  const current=stops[index],from=Date.parse(current.windowFrom),to=Date.parse(current.windowTo);if(time<from)time=from;if(time>to)return{reason:'TIME_WINDOW' as const};minSlack=Math.min(minSlack,(to-time)/msMinute);
  const arrivalAt=new Date(time).toISOString();
  const sign=current.kind==='pickup'?1:-1;kg+=sign*(current.weightKg??0);if(current.volumeM3===null)unknown+=sign;else m3+=sign*current.volumeM3;
  const previous=stops[index-1];if(!previous||!samePoint(previous.point,current.point))time+=opts.stopMinutes*msMinute;
  timings.push({arrivalAt,departureAt:new Date(time).toISOString(),onboardKg:kg,onboardM3:unknown>0?null:m3});
 }
 if(time-Date.parse(departAt)>24*60*msMinute)return{reason:'DRIVER_HOURS'};
 return{endTime:time,minSlack,timings};
}
function precheck(order:MatchOrder,main:MatchOrder,vehicle:VehicleInput):RejectReason|null{
 if(order.id===main.id||order.status!=='open')return'DIRECTION';
 if(order.alongPickup>=order.alongDelivery)return'DIRECTION';
 if(order.weightKg===null)return'MISSING_WEIGHT';
 if(order.priceEur===null)return'NO_PRICE';
 if(!dimensionsFit(order,vehicle))return'DIMENSIONS';
 return null;
}

export async function evaluateAddons(main:MatchOrder,trip:MatchTrip,vehicle:VehicleInput,pool:MatchOrder[],planner:RoutePlanner,partialOpts:Partial<MatchOpts>={},progress?:MatchProgress):Promise<MatchResult>{
 const opts={...defaultMatchOpts,...partialOpts};const rejected:Rejected[]=[];
 if(trip.addonIds.length>=opts.maxAddons)return{suggestions:[],rejected:pool.map(order=>({order,reason:'TRIP_FULL'}))};
 const candidates:MatchOrder[]=[];
 for(const order of pool){if(trip.addonIds.includes(order.id))continue;const reason=precheck(order,main,vehicle);if(reason)rejected.push({order,reason});else candidates.push(order);}
 const suggestions:Suggestion[]=[];
 let partial=false;
 for(const order of candidates){
  if(progress?.shouldStop()){partial=true;break;}
  const sequences=insertions(trip.stops,order);
  const routes=await planner.plan(sequences);
  if(routes.length!==sequences.length)throw new Error('Route planner returned incomplete batch');
  const initialKm=trip.initialKm??trip.baseKm;
  const detourLimit=Math.min(opts.maxDetourPct*initialKm,opts.maxDetourKm);
  let chosen:{route:PlannedRoute;stops:TripStop[];load:{loadPctKg:number;loadPctM3:number|null};time:{endTime:number;minSlack:number}}|null=null;
  let reason:RejectReason='DETOUR';
  const ranked=routes.map((route,index)=>({route,stops:sequences[index]})).sort((a,b)=>a.route.km-b.route.km);
  for(const option of ranked){
   if(Math.max(0,option.route.km-initialKm)>detourLimit)continue;
   const load=capacity(option.stops,vehicle,opts.capacityFactor);if('reason'in load){reason=load.reason;continue;}
   const time=timeline(option.stops,option.route,trip.departAt,opts);if('reason'in time){reason=time.reason;continue;}
   chosen={...option,load,time};break;
  }
  if(!chosen){rejected.push({order,reason});await progress?.publish({suggestions:[...suggestions].sort((a,b)=>b.score-a.score),rejected:[...rejected],partial:true});continue;}
  const {route,stops:chosenStops,load,time}=chosen;
  const detourKm=Math.max(0,route.km-trip.baseKm);
  const score=order.priceEur!-detourKm*opts.costPerKm;if(score<=0){rejected.push({order,reason:'DETOUR'});continue;}
  suggestions.push({order,addedRevenue:order.priceEur!,detourKm,detourMin:Math.max(0,route.minutes-trip.baseMinutes),loadPctKg:load.loadPctKg,loadPctM3:load.loadPctM3,fit:load.loadPctKg<=85&&load.loadPctM3!==null&&load.loadPctM3<=85&&time.minSlack>=30?'green':'yellow',score,newEndTime:new Date(time.endTime).toISOString(),stops:chosenStops});
  await progress?.publish({suggestions:[...suggestions].sort((a,b)=>b.score-a.score).slice(0,opts.maxAddons-trip.addonIds.length),rejected:[...rejected],partial:true});
 }
 const available=Math.max(0,opts.maxAddons-trip.addonIds.length);suggestions.sort((a,b)=>b.score-a.score);return{suggestions:suggestions.slice(0,available),rejected,partial};
}

export async function suggestAddons(main:MatchOrder,trip:MatchTrip,vehicle:VehicleInput,pool:MatchOrder[],planner:RoutePlanner,opts:Partial<MatchOpts>={}):Promise<Suggestion[]>{return(await evaluateAddons(main,trip,vehicle,pool,planner,opts)).suggestions;}
