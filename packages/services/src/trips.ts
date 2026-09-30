import type {Pool,PoolClient} from 'pg';
import {tripCreateSchema,type CreatedTrip,type Suggestion,type TripDetail,type TripListItem,type TripOrderItem} from '@loadlink/core';
import {ServiceError} from './errors';

type VehicleRow={payload_kg:number;cargo_m3:string;length_cm:number|null;width_cm:number|null;height_cm:number|null};
type SaveOrderRow={id:string;status:string;pickup_from:Date;pickup_to:Date;delivery_to:Date;weight_kg:number|null;volume_m3:string|null;length_cm:number|null;width_cm:number|null;height_cm:number|null;price_eur:string|null;distance_km:number|null};
export class TripService{
 constructor(private pool:Pool){}
 async create(userId:string,raw:unknown,validated:Suggestion[]):Promise<CreatedTrip>{
  const input=tripCreateSchema.parse(raw);const allowed=new Set(validated.map(item=>item.order.id));
  if(input.addonOrderIds.some(id=>!allowed.has(id)))throw new ServiceError('MATCH_CHANGED','One or more add-ons no longer fit this trip.',409);
  const db=await this.pool.connect();
  try{
   await db.query('BEGIN');
   const vehicleResult=await db.query<VehicleRow>('SELECT payload_kg,cargo_m3,length_cm,width_cm,height_cm FROM vehicles WHERE id=$1 AND user_id=$2 FOR SHARE',[input.vehicleId,userId]);
   const vehicle=vehicleResult.rows[0];if(!vehicle)throw new ServiceError('VEHICLE_NOT_FOUND','Vehicle not found.',404);
   const ids=[input.mainOrderId,...input.addonOrderIds];
   const orderResult=await db.query<SaveOrderRow>('SELECT id,status,pickup_from,pickup_to,delivery_to,weight_kg,volume_m3,length_cm,width_cm,height_cm,price_eur,distance_km FROM orders WHERE id=ANY($1::uuid[]) FOR SHARE',[ids]);
   if(orderResult.rows.length!==ids.length||orderResult.rows.some(order=>order.status!=='open'||order.pickup_to.getTime()<=Date.now()))throw new ServiceError('ORDER_GONE','One or more orders are no longer available.',409);
   const orders=new Map(orderResult.rows.map(order=>[order.id,order]));const ordered=ids.map(id=>orders.get(id)!);
   const kg=ordered.reduce((sum,order)=>sum+(order.weight_kg??Number.POSITIVE_INFINITY),0);
   const knownVolume=ordered.reduce((sum,order)=>sum+(order.volume_m3===null?0:Number(order.volume_m3)),0);
   if(kg>vehicle.payload_kg*.95||knownVolume>Number(vehicle.cargo_m3)*.95||ordered.some(order=>!dimensionsFit(order,vehicle)))throw new ServiceError('CAPACITY_EXCEEDED','The selected orders no longer fit your van.',409);
   const detourKm=validated.filter(item=>input.addonOrderIds.includes(item.order.id)).reduce((sum,item)=>sum+item.detourKm,0);
   const totalRevenue=ordered.reduce((sum,order)=>sum+Number(order.price_eur??0),0);
   const main=orders.get(input.mainOrderId)!;const totalKm=main.distance_km===null?null:Math.round(main.distance_km+detourKm);
   const endAt=new Date(Math.max(...ordered.map(order=>order.delivery_to.getTime())));
   const trip=await db.query<{id:string}>('INSERT INTO trips(user_id,vehicle_id,main_order_id,total_km,total_revenue,detour_km,start_at,end_at) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id',[userId,input.vehicleId,input.mainOrderId,totalKm,totalRevenue,Math.round(detourKm),main.pickup_from,endAt]);
   await insertTripOrders(db,trip.rows[0].id,input.mainOrderId,input.addonOrderIds);
   await db.query("INSERT INTO events(user_id,type,payload) VALUES($1,'trip_saved',$2)",[userId,JSON.stringify({tripId:trip.rows[0].id,orderCount:ids.length})]);
   await db.query('COMMIT');
   return{id:trip.rows[0].id,status:'planned',totalKm,totalRevenue,detourKm,startAt:main.pickup_from.toISOString(),endAt:endAt.toISOString()};
  }catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();}
 }
 async detail(userId:string,id:string):Promise<TripDetail>{
  await this.pool.query("UPDATE trips SET status='done' WHERE id=$1 AND user_id=$2 AND status='booked' AND end_at<now()",[id,userId]);
  const tripResult=await this.pool.query<{id:string;status:TripDetail['status'];total_km:number|null;total_revenue:string;detour_km:number|null;start_at:Date;end_at:Date;vehicle_name:string}>(
   'SELECT t.id,t.status,t.total_km,t.total_revenue,t.detour_km,t.start_at,t.end_at,v.name vehicle_name FROM trips t JOIN vehicles v ON v.id=t.vehicle_id WHERE t.id=$1 AND t.user_id=$2',[id,userId]);
  const row=tripResult.rows[0];if(!row)throw new ServiceError('TRIP_NOT_FOUND','Trip not found.',404);
  const orderResult=await this.pool.query<{trip_order_id:string;order_id:string;role:TripOrderItem['role'];status:TripOrderItem['status'];pickup_addr:string;delivery_addr:string;pickup_from:Date;delivery_to:Date;price_eur:string|null;weight_kg:number|null;volume_m3:string|null;trans_eu_url:string}>(
   'SELECT x.id trip_order_id,o.id order_id,x.role,x.status,o.pickup_addr,o.delivery_addr,o.pickup_from,o.delivery_to,o.price_eur,o.weight_kg,o.volume_m3,o.trans_eu_url FROM trip_orders x JOIN orders o ON o.id=x.order_id WHERE x.trip_id=$1 ORDER BY x.seq',[id]);
  return{id:row.id,status:row.status,totalKm:row.total_km,totalRevenue:Number(row.total_revenue),detourKm:Number(row.detour_km??0),startAt:row.start_at.toISOString(),endAt:row.end_at.toISOString(),vehicleName:row.vehicle_name,orders:orderResult.rows.map(order=>({tripOrderId:order.trip_order_id,orderId:order.order_id,role:order.role,status:order.status,pickupAddress:order.pickup_addr,deliveryAddress:order.delivery_addr,pickupFrom:order.pickup_from.toISOString(),deliveryTo:order.delivery_to.toISOString(),priceEur:order.price_eur===null?null:Number(order.price_eur),weightKg:order.weight_kg,volumeM3:order.volume_m3===null?null:Number(order.volume_m3),transEuUrl:order.trans_eu_url}))};
 }
 async list(userId:string,status?:TripListItem['status']):Promise<TripListItem[]>{
  await this.pool.query("UPDATE trips SET status='done' WHERE user_id=$1 AND status='booked' AND end_at<now()",[userId]);
  const result=await this.pool.query<{id:string;status:TripListItem['status'];pickup_addr:string;delivery_addr:string;total_km:number|null;total_revenue:string;start_at:Date;end_at:Date;order_count:string}>(
   'SELECT t.id,t.status,o.pickup_addr,o.delivery_addr,t.total_km,t.total_revenue,t.start_at,t.end_at,count(x.id) order_count FROM trips t JOIN orders o ON o.id=t.main_order_id JOIN trip_orders x ON x.trip_id=t.id WHERE t.user_id=$1 AND ($2::text IS NULL OR t.status=$2) GROUP BY t.id,o.pickup_addr,o.delivery_addr ORDER BY t.start_at DESC',[userId,status??null]);
  return result.rows.map(row=>({id:row.id,status:row.status,pickupAddress:row.pickup_addr,deliveryAddress:row.delivery_addr,totalKm:row.total_km,totalRevenue:Number(row.total_revenue),startAt:row.start_at.toISOString(),endAt:row.end_at.toISOString(),orderCount:Number(row.order_count)}));
 }
 async cancel(userId:string,id:string){
  const db=await this.pool.connect();
  try{await db.query('BEGIN');const result=await db.query("UPDATE trips SET status='cancelled' WHERE id=$1 AND user_id=$2 AND status='planned' RETURNING id",[id,userId]);
   if(!result.rows[0])throw new ServiceError('TRIP_NOT_CANCELLABLE','Only a planned trip can be cancelled.',409);
   await db.query("UPDATE trip_orders SET status='dropped' WHERE trip_id=$1",[id]);
   await db.query("INSERT INTO events(user_id,type,payload) VALUES($1,'trip_cancelled',$2)",[userId,JSON.stringify({tripId:id})]);
   await db.query('COMMIT');return{id};
  }catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();}
 }
 async mark(userId:string,tripOrderId:string,status:'booked'|'dropped'):Promise<TripDetail>{
  const db=await this.pool.connect();let tripId:string;
  try{await db.query('BEGIN');const updated=await db.query<{trip_id:string}>(
   'UPDATE trip_orders x SET status=$1,booked_at=CASE WHEN $1=\'booked\' THEN now() ELSE booked_at END WHERE x.id=$2 AND EXISTS(SELECT 1 FROM trips t WHERE t.id=x.trip_id AND t.user_id=$3) RETURNING trip_id',[status,tripOrderId,userId]);
   if(!updated.rows[0])throw new ServiceError('TRIP_ORDER_NOT_FOUND','Trip order not found.',404);tripId=updated.rows[0].trip_id;
   await db.query("UPDATE trips t SET status=CASE WHEN NOT EXISTS(SELECT 1 FROM trip_orders x WHERE x.trip_id=t.id AND x.status<>'dropped') THEN 'cancelled' WHEN NOT EXISTS(SELECT 1 FROM trip_orders x WHERE x.trip_id=t.id AND x.status NOT IN('booked','dropped')) THEN 'booked' ELSE 'planned' END WHERE t.id=$1",[tripId]);
   await db.query("INSERT INTO events(user_id,type,payload) VALUES($1,$2,$3)",[userId,status==='booked'?'marked_booked':'addon_dropped',JSON.stringify({tripId,tripOrderId})]);await db.query('COMMIT');
  }catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();}
  return this.detail(userId,tripId!);
 }
}
function dimensionsFit(order:SaveOrderRow,vehicle:VehicleRow){
 return !((order.length_cm!==null&&vehicle.length_cm!==null&&order.length_cm>vehicle.length_cm)||(order.width_cm!==null&&vehicle.width_cm!==null&&order.width_cm>vehicle.width_cm)||(order.height_cm!==null&&vehicle.height_cm!==null&&order.height_cm>vehicle.height_cm));
}
async function insertTripOrders(db:PoolClient,tripId:string,mainId:string,addonIds:string[]){
 const entries=[{id:mainId,role:'main'},...addonIds.map(id=>({id,role:'addon'}))];
 for(let index=0;index<entries.length;index++)await db.query('INSERT INTO trip_orders(trip_id,order_id,role,seq) VALUES($1,$2,$3,$4)',[tripId,entries[index].id,entries[index].role,index]);
}
