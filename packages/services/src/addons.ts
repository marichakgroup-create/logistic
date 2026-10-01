import type {Pool} from 'pg';
import {addonQuerySchema,evaluateAddons,type AddonResult,type MatchOrder,type MatchTrip,type PlannedRoute,type RoutePlanner,type RoutingProvider,type TripStop} from '@loadlink/core';
import {VehicleService} from './vehicles';
import {ServiceError} from './errors';

import {defaultMatchOpts,capacity,timeline,dimensionsFit,type Point,type TripPlan,type Vehicle} from '@loadlink/core';
import {matchColumns,matchOrder,matchFingerprint,type MatchRow} from './matching-data';
import {readPlanningOrders,readTripContext} from './trip-context';
const candidateLimit=100;

function stops(value:MatchOrder):TripStop[]{return[
 {orderId:value.id,kind:'pickup',point:value.pickup,windowFrom:value.pickupFrom,windowTo:value.pickupTo,weightKg:value.weightKg,volumeM3:value.volumeM3},
 {orderId:value.id,kind:'delivery',point:value.delivery,windowFrom:value.deliveryFrom,windowTo:value.deliveryTo,weightKg:value.weightKg,volumeM3:value.volumeM3}
];}
function pointKey(a:{lat:number;lon:number},b:{lat:number;lon:number}){return `${a.lat},${a.lon}>${b.lat},${b.lon}`;}

/** Builds exact route totals from reusable point-to-point legs. */
export class LegRoutePlanner implements RoutePlanner{
 constructor(private routing:RoutingProvider){}
 async plan(routes:TripStop[][]):Promise<PlannedRoute[]>{
  const pairs=new Map<string,{from:TripStop['point'];to:TripStop['point']}>();
  for(const route of routes)for(let i=1;i<route.length;i++)if(pointKey(route[i-1].point,route[i].point)!==pointKey(route[i].point,route[i].point))pairs.set(pointKey(route[i-1].point,route[i].point),{from:route[i-1].point,to:route[i].point});
  const pending=[...pairs];
  const entries:Array<readonly [string,Awaited<ReturnType<RoutingProvider['route']>>]>=[];
  let cursor=0;
  await Promise.all(Array.from({length:Math.min(8,pending.length)},async()=>{
   while(cursor<pending.length){const [key,pair]=pending[cursor++];entries.push([key,await this.routing.route([pair.from,pair.to])]);}
  }));
  const legs=new Map(entries.map(([key,route])=>[key,{...route,geometry:decodePolyline(route.polyline)}]));
  return routes.map(route=>{
   const values=route.slice(1).map((stop,index)=>pointKey(route[index].point,stop.point)===pointKey(stop.point,stop.point)?{polyline:'',km:0,minutes:0,geometry:[] as Point[]}:legs.get(pointKey(route[index].point,stop.point))!);
   return{polyline:'',geometry:values.map(item=>item.geometry),km:values.reduce((sum,item)=>sum+item.km,0),minutes:values.reduce((sum,item)=>sum+item.minutes,0),legsMinutes:values.map(item=>item.minutes)};
  });
 }
}

export class AddonMatchingService{
 private vehicles:VehicleService;
 constructor(private pool:Pool,private planner:RoutePlanner){this.vehicles=new VehicleService(pool);}
 async match(userId:string,mainOrderId:string,rawQuery:unknown,planOnly=false,publish?:(result:AddonResult)=>Promise<void>):Promise<AddonResult>{
  const deadline=Date.now()+3500;
  const query=addonQuerySchema.parse(rawQuery);const vehicle=await this.vehicles.getOwned(userId,query.vehicleId);
  const addonIds=query.addonOrderIds;
  const context=query.tripId?await readTripContext(this.pool,userId,query.tripId):undefined;
  if(context&&(context.main_order_id!==mainOrderId||context.vehicle_id!==query.vehicleId))throw new ServiceError('TRIP_NOT_FOUND','Trip not found.',404);
  if(addonIds.includes(mainOrderId))throw new ServiceError('INVALID_INPUT','The main load cannot also be an add-on.',400);
  const orders=await readPlanningOrders(this.pool,[mainOrderId,...addonIds],context);const main=orders[0];
  if(orders.some(order=>!dimensionsFit(order,vehicle)))throw new ServiceError('CAPACITY_EXCEEDED','The main load does not fit your van.',409);
  const mainStops=stops(main);const [initial]=await this.planner.plan([mainStops]);
  const trip:MatchTrip={departAt:new Date(Math.max(Date.now(),Date.parse(main.pickupFrom))).toISOString(),stops:mainStops,baseKm:initial.km,baseMinutes:initial.minutes,initialKm:initial.km,addonIds:[]};
  let currentRoute=initial;
  if(context){
   const selected=new Map(orders.map(order=>[order.id,order]));
   trip.stops=context.route_plan.stops.filter(stop=>selected.has(stop.orderId)).map(stop=>stops(selected.get(stop.orderId)!).find(value=>value.kind===stop.kind)!);
   trip.addonIds=orders.slice(1).filter(order=>context.route_plan.orders.some(saved=>saved.id===order.id)).map(order=>order.id);
   [currentRoute]=await this.planner.plan([trip.stops]);trip.baseKm=currentRoute.km;trip.baseMinutes=currentRoute.minutes;
  }
  for(const selected of orders.slice(1).filter(order=>!trip.addonIds.includes(order.id))){
   const candidates=await this.candidates(trip,currentRoute,query.bufferKm,[mainOrderId,...trip.addonIds],selected.id);
   const result=await evaluateAddons(main,trip,vehicle,candidates.orders,this.planner,{bufferKm:query.bufferKm});
   const chosen=result.suggestions.find(item=>item.order.id===selected.id);
   if(!chosen)throw new ServiceError('MATCH_CHANGED','A selected load no longer fits. Remove it and recalculate.',409);
   trip.stops=chosen.stops;trip.addonIds.push(selected.id);
   [currentRoute]=await this.planner.plan([trip.stops]);trip.baseKm=currentRoute.km;trip.baseMinutes=currentRoute.minutes;
  }
  const plan=this.plan(orders,vehicle,trip,currentRoute,initial);
  if(context)plan.tripRevision=context.revision;
  if(planOnly)return{suggestions:[],rejected:[],trip:plan,partial:false,updatedAt:new Date().toISOString()};
  const updatedAt=new Date().toISOString();
  await publish?.({suggestions:[],rejected:[],trip:plan,partial:true,updatedAt});
  const pool=await this.candidates(trip,currentRoute,query.bufferKm,[mainOrderId,...trip.addonIds]);
  const result=await evaluateAddons(main,trip,vehicle,pool.orders,this.planner,{bufferKm:query.bufferKm},{shouldStop:()=>Date.now()>=deadline,publish:async result=>{await publish?.({...result,trip:plan,partial:true,updatedAt});}});
  return{...result,trip:plan,partial:Boolean(result.partial)||pool.total>candidateLimit,updatedAt:new Date().toISOString()};
 }
 private plan(orders:MatchOrder[],vehicle:Vehicle,trip:MatchTrip,route:PlannedRoute,mainRoute:PlannedRoute):TripPlan{
  if(route.km-mainRoute.km>Math.min(mainRoute.km*defaultMatchOpts.maxDetourPct,defaultMatchOpts.maxDetourKm))throw new ServiceError('DETOUR','The selected loads exceed the detour limit. Remove an unconfirmed load and recalculate.',409);
  const load=capacity(trip.stops,vehicle,defaultMatchOpts.capacityFactor);
  if('reason'in load)throw new ServiceError('CAPACITY_EXCEEDED','The selected loads exceed safe capacity.',409);
  const time=timeline(trip.stops,route,trip.departAt,defaultMatchOpts);
  if('reason'in time)throw new ServiceError(time.reason,time.reason==='DRIVER_HOURS'?'This route exceeds the driving limit for a single-day trip. Choose a shorter route.':'The planned arrival misses a pickup or delivery window. Choose another load or departure date.',409);
  return{orders,inputFingerprint:matchFingerprint(orders,vehicle),stops:trip.stops,timings:time.timings,departAt:trip.departAt,endAt:new Date(time.endTime).toISOString(),totalKm:route.km,detourKm:Math.max(0,route.km-mainRoute.km),totalMinutes:route.minutes,totalRevenue:orders.reduce((sum,order)=>sum+(order.priceEur??0),0),...load,geometry:route.geometry??[],mainGeometry:mainRoute.geometry??[]};
 }
 private async candidates(trip:MatchTrip,route:PlannedRoute,bufferKm:number,exclude:string[],onlyId?:string):Promise<{orders:MatchOrder[];total:number}>{
  const routed=route.geometry?.flat()??[];const points=routed.length>=2?routed:trip.stops.map(stop=>stop.point);
  const line=JSON.stringify({type:'LineString',coordinates:points.map(point=>[point.lon,point.lat])});
  const end=trip.stops.reduce((latest,stop)=>Math.max(latest,Date.parse(stop.windowTo)),Date.parse(trip.departAt));
  const result=await this.pool.query<MatchRow&{total_count:string}>(`WITH corridor AS (SELECT ST_SetSRID(ST_GeomFromGeoJSON($1),4326) line), candidates AS (
   SELECT o.*,ST_LineLocatePoint(c.line,ST_ClosestPoint(c.line,o.pickup_geo::geometry)) along_pickup,
    ST_LineLocatePoint(c.line,ST_ClosestPoint(c.line,o.delivery_geo::geometry)) along_delivery
   FROM orders o CROSS JOIN corridor c WHERE NOT(o.id=ANY($2::uuid[])) AND o.status='open' AND o.pickup_to>now()
    AND o.pickup_to >= $3::timestamptz AND o.pickup_from <= $4::timestamptz
    AND ST_DWithin(o.pickup_geo,c.line::geography,$5*1000) AND ST_DWithin(o.delivery_geo,c.line::geography,$5*1000)
    AND ($7::uuid IS NULL OR o.id=$7::uuid)
  ) SELECT ${matchColumns},along_pickup,along_delivery,count(*) OVER() total_count FROM candidates
   ORDER BY price_eur DESC NULLS LAST,id LIMIT $6`,[line,exclude,trip.departAt,new Date(end).toISOString(),bufferKm,candidateLimit,onlyId??null]);
  return{orders:result.rows.map(matchOrder),total:Number(result.rows[0]?.total_count??0)};
 }
}

function decodePolyline(encoded:string):Point[]{
 const points:Point[]=[];let index=0,lat=0,lon=0;
 function delta(){let result=0,shift=0,byte:number;do{if(index>=encoded.length||shift>30)throw new Error('Invalid routing geometry');byte=encoded.charCodeAt(index++)-63;if(byte<0||byte>63)throw new Error('Invalid routing geometry');result|=(byte&31)<<shift;shift+=5;}while(byte>=32);return result&1?~(result>>1):result>>1;}
 while(index<encoded.length){lat+=delta();lon+=delta();points.push({lat:lat/1e5,lon:lon/1e5});}
 return points;
}
