import {createHash} from 'node:crypto';
import type {Pool} from 'pg';
import type {MatchOrder,VehicleInput} from '@loadlink/core';
import {ServiceError} from './errors';

export type MatchDatabase=Pick<Pool,'query'>;
export type MatchRow={id:string;status:MatchOrder['status'];pickup_addr:string;delivery_addr:string;pickup_lat:number;pickup_lon:number;delivery_lat:number;delivery_lon:number;pickup_from:Date;pickup_to:Date;delivery_from:Date;delivery_to:Date;weight_kg:number|null;volume_m3:string|null;length_cm:number|null;width_cm:number|null;height_cm:number|null;price_eur:string|null;along_pickup?:number;along_delivery?:number};
export const matchColumns=`id,status,pickup_addr,delivery_addr,ST_Y(pickup_geo::geometry) pickup_lat,ST_X(pickup_geo::geometry) pickup_lon,
 ST_Y(delivery_geo::geometry) delivery_lat,ST_X(delivery_geo::geometry) delivery_lon,pickup_from,pickup_to,delivery_from,delivery_to,
 weight_kg,volume_m3,length_cm,width_cm,height_cm,price_eur`;
export function matchOrder(row:MatchRow):MatchOrder{return{
 id:row.id,status:row.status,pickup:{lat:Number(row.pickup_lat),lon:Number(row.pickup_lon)},delivery:{lat:Number(row.delivery_lat),lon:Number(row.delivery_lon)},pickupAddress:row.pickup_addr,deliveryAddress:row.delivery_addr,
 pickupFrom:row.pickup_from.toISOString(),pickupTo:row.pickup_to.toISOString(),deliveryFrom:row.delivery_from.toISOString(),deliveryTo:row.delivery_to.toISOString(),weightKg:row.weight_kg,volumeM3:row.volume_m3===null?null:Number(row.volume_m3),
 lengthCm:row.length_cm,widthCm:row.width_cm,heightCm:row.height_cm,priceEur:row.price_eur===null?null:Number(row.price_eur),alongPickup:Number(row.along_pickup??0),alongDelivery:Number(row.along_delivery??1)
};}
export async function readMatchOrders(db:MatchDatabase,ids:string[],lock=false):Promise<MatchOrder[]>{
 const result=await db.query<MatchRow>(`SELECT ${matchColumns} FROM orders WHERE id=ANY($1::uuid[]) ORDER BY id ${lock?'FOR SHARE':''}`,[ids]);
 const rows=new Map(result.rows.map(row=>[row.id,matchOrder(row)]));
 return ids.map(id=>{const order=rows.get(id);if(!order||order.status!=='open'||Date.parse(order.pickupTo)<=Date.now())throw new ServiceError('ORDER_GONE','One or more orders are no longer available.',409);return order;});
}
export function matchFingerprint(orders:MatchOrder[],vehicle:VehicleInput):string{
 const cargo=orders.map(({alongPickup,alongDelivery,...order})=>{void alongPickup;void alongDelivery;return order;});
 const van={name:vehicle.name,payloadKg:vehicle.payloadKg,cargoM3:vehicle.cargoM3,lengthCm:vehicle.lengthCm,widthCm:vehicle.widthCm,heightCm:vehicle.heightCm};
 return createHash('sha256').update(JSON.stringify({orders:cargo,vehicle:van})).digest('hex');
}
