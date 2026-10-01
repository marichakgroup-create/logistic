import type {Pool,PoolClient} from 'pg';
import {tripCreateSchema,type CreatedTrip,type Suggestion,type TripPlan,type TripDetail,type TripListItem,type TripOrderItem} from '@loadlink/core';
import {ServiceError} from './errors';
import {readMatchOrders,matchFingerprint} from './matching-data';
import {VehicleService} from './vehicles';

export class TripService{
 constructor(private pool:Pool){}
 async create(userId:string,raw:unknown,verified:TripPlan|Suggestion[]|undefined):Promise<CreatedTrip>{
  const input=tripCreateSchema.parse(raw);
  if(!verified||Array.isArray(verified))throw new ServiceError('MATCH_PENDING','Recalculate the trip before saving.',409);
  const plan=verified;const ids=[input.mainOrderId,...input.addonOrderIds];
  if(ids.length!==plan.orders.length||ids.some((id,index)=>id!==plan.orders[index]?.id))throw new ServiceError('MATCH_CHANGED','The calculated route does not match the selected loads.',409);
  const db=await this.pool.connect();
  try{
   await db.query('BEGIN');
   const vehicle=await new VehicleService(db).getOwned(userId,input.vehicleId,true);
   const orders=await readMatchOrders(db,ids,true);
   if(matchFingerprint(orders,vehicle)!==plan.inputFingerprint)throw new ServiceError('MATCH_CHANGED','Order or vehicle details changed. Recalculate the trip.',409);
   const totalKm=Math.round(plan.totalKm),detourKm=Math.round(plan.detourKm);
   const trip=await db.query<{id:string}>(`INSERT INTO trips(user_id,vehicle_id,main_order_id,total_km,total_revenue,detour_km,start_at,end_at,route_plan)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb) RETURNING id`,[userId,input.vehicleId,input.mainOrderId,totalKm,plan.totalRevenue,detourKm,plan.departAt,plan.endAt,JSON.stringify(plan)]);
   const sequence=plan.stops.filter(stop=>stop.kind==='pickup').map(stop=>stop.orderId);
   await insertTripOrders(db,trip.rows[0].id,input.mainOrderId,sequence.filter(id=>id!==input.mainOrderId),sequence);
   await db.query("INSERT INTO events(user_id,type,payload) VALUES($1,'trip_saved',$2)",[userId,JSON.stringify({tripId:trip.rows[0].id,orderCount:ids.length})]);
   await db.query('COMMIT');
   return{id:trip.rows[0].id,status:'planned',totalKm,totalRevenue:plan.totalRevenue,detourKm,startAt:plan.departAt,endAt:plan.endAt};
  }catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();}
 }
 async detail(userId:string,id:string):Promise<TripDetail>{
  await this.pool.query("UPDATE trips SET status='done' WHERE id=$1 AND user_id=$2 AND status='booked' AND end_at<now()",[id,userId]);
  const tripResult=await this.pool.query<{id:string;status:TripDetail['status'];total_km:number|null;total_revenue:string;detour_km:number|null;start_at:Date;end_at:Date;vehicle_name:string;route_plan:TripPlan|null}>(
   'SELECT t.id,t.status,t.total_km,t.total_revenue,t.detour_km,t.start_at,t.end_at,v.name vehicle_name,t.route_plan FROM trips t JOIN vehicles v ON v.id=t.vehicle_id WHERE t.id=$1 AND t.user_id=$2',[id,userId]);
  const row=tripResult.rows[0];if(!row)throw new ServiceError('TRIP_NOT_FOUND','Trip not found.',404);
  const orderResult=await this.pool.query<{trip_order_id:string;order_id:string;role:TripOrderItem['role'];status:TripOrderItem['status'];pickup_addr:string;delivery_addr:string;pickup_from:Date;delivery_to:Date;price_eur:string|null;weight_kg:number|null;volume_m3:string|null;trans_eu_url:string}>(
   'SELECT x.id trip_order_id,o.id order_id,x.role,x.status,o.pickup_addr,o.delivery_addr,o.pickup_from,o.delivery_to,o.price_eur,o.weight_kg,o.volume_m3,o.trans_eu_url FROM trip_orders x JOIN orders o ON o.id=x.order_id WHERE x.trip_id=$1 ORDER BY x.seq',[id]);
  return{id:row.id,status:row.status,totalKm:row.total_km,totalRevenue:Number(row.total_revenue),detourKm:Number(row.detour_km??0),startAt:row.start_at.toISOString(),endAt:row.end_at.toISOString(),vehicleName:row.vehicle_name,routePlan:row.route_plan,orders:orderResult.rows.map(order=>({tripOrderId:order.trip_order_id,orderId:order.order_id,role:order.role,status:order.status,pickupAddress:order.pickup_addr,deliveryAddress:order.delivery_addr,pickupFrom:order.pickup_from.toISOString(),deliveryTo:order.delivery_to.toISOString(),priceEur:order.price_eur===null?null:Number(order.price_eur),weightKg:order.weight_kg,volumeM3:order.volume_m3===null?null:Number(order.volume_m3),transEuUrl:order.trans_eu_url}))};
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
async function insertTripOrders(db:PoolClient,tripId:string,mainId:string,addonIds:string[],sequence:string[]){
 const entries=sequence.map(id=>({id,role:id===mainId?'main':'addon'}));
 if(entries.length!==addonIds.length+1)throw new Error('Invalid stop sequence');
 for(let index=0;index<entries.length;index++)await db.query('INSERT INTO trip_orders(trip_id,order_id,role,seq) VALUES($1,$2,$3,$4)',[tripId,entries[index].id,entries[index].role,index]);
}
