import type {Pool} from 'pg';
import {addonQuerySchema,evaluateAddons,type AddonResult,type MatchOrder,type MatchTrip,type PlannedRoute,type RoutePlanner,type RoutingProvider,type TripStop} from '@loadlink/core';
import {VehicleService} from './vehicles';
import {ServiceError} from './errors';

type MatchRow={
 id:string;status:'open'|'closed'|'expired';pickup_addr:string;delivery_addr:string;pickup_lat:number;pickup_lon:number;delivery_lat:number;delivery_lon:number;
 pickup_from:Date;pickup_to:Date;delivery_from:Date;delivery_to:Date;weight_kg:number|null;volume_m3:string|null;
 length_cm:number|null;width_cm:number|null;height_cm:number|null;price_eur:string|null;along_pickup:number;along_delivery:number;
};
type MainRow=MatchRow&{candidate_count?:number};
const candidateLimit=40;

function order(row:MatchRow):MatchOrder{return{
 id:row.id,status:row.status,pickup:{lat:Number(row.pickup_lat),lon:Number(row.pickup_lon)},delivery:{lat:Number(row.delivery_lat),lon:Number(row.delivery_lon)},pickupAddress:row.pickup_addr,deliveryAddress:row.delivery_addr,
 pickupFrom:row.pickup_from.toISOString(),pickupTo:row.pickup_to.toISOString(),deliveryFrom:row.delivery_from.toISOString(),deliveryTo:row.delivery_to.toISOString(),
 weightKg:row.weight_kg,volumeM3:row.volume_m3===null?null:Number(row.volume_m3),lengthCm:row.length_cm,widthCm:row.width_cm,heightCm:row.height_cm,
 priceEur:row.price_eur===null?null:Number(row.price_eur),alongPickup:Number(row.along_pickup),alongDelivery:Number(row.along_delivery)
};}
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
  const entries=await Promise.all([...pairs].map(async([key,pair])=>[key,await this.routing.route([pair.from,pair.to])] as const));
  const legs=new Map(entries);
  return routes.map(route=>{
   const values=route.slice(1).map((stop,index)=>pointKey(route[index].point,stop.point)===pointKey(stop.point,stop.point)?{polyline:'',km:0,minutes:0}:legs.get(pointKey(route[index].point,stop.point))!);
   return{polyline:'',km:values.reduce((sum,item)=>sum+item.km,0),minutes:values.reduce((sum,item)=>sum+item.minutes,0),legsMinutes:values.map(item=>item.minutes)};
  });
 }
}

export class AddonMatchingService{
 private vehicles:VehicleService;
 constructor(private pool:Pool,private planner:RoutePlanner){this.vehicles=new VehicleService(pool);}
 async match(userId:string,mainOrderId:string,rawQuery:unknown):Promise<AddonResult>{
  const query=addonQuerySchema.parse(rawQuery);const vehicle=await this.vehicles.getOwned(userId,query.vehicleId);
  const mainResult=await this.pool.query<MainRow>(`SELECT id,status,pickup_addr,delivery_addr,ST_Y(pickup_geo::geometry) pickup_lat,ST_X(pickup_geo::geometry) pickup_lon,
   ST_Y(delivery_geo::geometry) delivery_lat,ST_X(delivery_geo::geometry) delivery_lon,pickup_from,pickup_to,delivery_from,delivery_to,
   weight_kg,volume_m3,length_cm,width_cm,height_cm,price_eur,0::float along_pickup,1::float along_delivery
   FROM orders WHERE id=$1 AND status='open' AND pickup_to>now()`,[mainOrderId]);
  if(!mainResult.rows[0])throw new ServiceError('ORDER_GONE','This order is no longer available.',404);
  const main=order(mainResult.rows[0]);
  const candidateResult=await this.pool.query<MatchRow&{total_count:string}>(`WITH main AS (
    SELECT COALESCE(route_line::geometry,ST_MakeLine(pickup_geo::geometry,delivery_geo::geometry)) line FROM orders WHERE id=$1
   ), candidates AS (
    SELECT o.*,m.line,ST_LineLocatePoint(m.line,ST_ClosestPoint(m.line,o.pickup_geo::geometry)) along_pickup,
     ST_LineLocatePoint(m.line,ST_ClosestPoint(m.line,o.delivery_geo::geometry)) along_delivery
    FROM orders o CROSS JOIN main m WHERE o.id<>$1 AND o.status='open' AND o.pickup_to>now()
     AND ST_DWithin(o.pickup_geo,m.line::geography,$2*1000) AND ST_DWithin(o.delivery_geo,m.line::geography,$2*1000)
   ) SELECT id,status,pickup_addr,delivery_addr,ST_Y(pickup_geo::geometry) pickup_lat,ST_X(pickup_geo::geometry) pickup_lon,
    ST_Y(delivery_geo::geometry) delivery_lat,ST_X(delivery_geo::geometry) delivery_lon,pickup_from,pickup_to,delivery_from,delivery_to,
    weight_kg,volume_m3,length_cm,width_cm,height_cm,price_eur,along_pickup,along_delivery,count(*) OVER() total_count
   FROM candidates ORDER BY along_pickup,price_eur DESC NULLS LAST LIMIT $3`,[mainOrderId,query.bufferKm,candidateLimit]);
  const pool=candidateResult.rows.map(order);const mainStops=stops(main);const [base]=await this.planner.plan([mainStops]);
  const trip:MatchTrip={departAt:new Date(Math.max(Date.now(),Date.parse(main.pickupFrom))).toISOString(),stops:mainStops,baseKm:base.km,baseMinutes:base.minutes,addonIds:[]};
  const result=await evaluateAddons(main,trip,vehicle,pool,this.planner,{bufferKm:query.bufferKm});
  return{...result,partial:Number(candidateResult.rows[0]?.total_count??0)>candidateLimit,updatedAt:new Date().toISOString()};
 }
}
