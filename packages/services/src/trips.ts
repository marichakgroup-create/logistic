import type {Pool,PoolClient} from 'pg';
import {tripCreateSchema,tripEditSchema,type MyOrder,type CreatedTrip,type Suggestion,type TripPlan,type TripDetail,type TripListItem,type TripOrderItem} from '@loadlink/core';
import {ServiceError} from './errors';
import {readMatchOrders,matchFingerprint} from './matching-data';
import {VehicleService} from './vehicles';
import {readTripContext,readPlanningOrders} from './trip-context';

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
 async update(userId:string,id:string,raw:unknown,plan:TripPlan|undefined):Promise<CreatedTrip>{
  const input=tripEditSchema.parse(raw);
  if(!plan)throw new ServiceError('MATCH_PENDING','Recalculate the trip before saving.',409);
  const db=await this.pool.connect();
  try{
   await db.query('BEGIN');
   const context=await readTripContext(db,userId,id,true);
   if(context.revision!==input.revision||plan.tripRevision!==input.revision)throw new ServiceError('TRIP_CHANGED','This trip changed in another window. Reload it before saving.',409);
   const ids=[context.main_order_id,...input.addonOrderIds];
   if(ids.length!==plan.orders.length||ids.some((value,index)=>value!==plan.orders[index]?.id))throw new ServiceError('MATCH_CHANGED','The calculated route does not match your selection.',409);
   const vehicle=await new VehicleService(db).getOwned(userId,context.vehicle_id,true);
   const orders=await readPlanningOrders(db,ids,context,true);
   if(matchFingerprint(orders,vehicle)!==plan.inputFingerprint)throw new ServiceError('MATCH_CHANGED','Load or vehicle conditions changed. Recalculate the route.',409);
   await db.query("UPDATE trip_orders SET status='dropped' WHERE trip_id=$1 AND NOT(order_id=ANY($2::uuid[])) AND status<>'booked'",[id,ids]);
   const sequence=plan.stops.filter(stop=>stop.kind==='pickup').map(stop=>stop.orderId);
   for(const [index,orderId] of sequence.entries())await db.query(`INSERT INTO trip_orders(trip_id,order_id,role,seq) VALUES($1,$2,$3,$4)
    ON CONFLICT(trip_id,order_id) DO UPDATE SET seq=EXCLUDED.seq,status=CASE WHEN trip_orders.status='booked' THEN 'booked' ELSE 'pending' END`,[id,orderId,orderId===context.main_order_id?'main':'addon',index]);
   await db.query(`UPDATE trips SET total_km=$2,total_revenue=$3,detour_km=$4,start_at=$5,end_at=$6,route_plan=$7::jsonb,revision=revision+1,
    status=CASE WHEN NOT EXISTS(SELECT 1 FROM trip_orders WHERE trip_id=$1 AND status NOT IN ('booked','dropped')) THEN 'booked' ELSE 'planned' END WHERE id=$1`,[id,Math.round(plan.totalKm),plan.totalRevenue,Math.round(plan.detourKm),plan.departAt,plan.endAt,JSON.stringify(plan)]);
   await db.query("INSERT INTO events(user_id,type,payload) VALUES($1,'trip_updated',$2)",[userId,JSON.stringify({tripId:id})]);
   await db.query('COMMIT');
   return{id,status:ids.every(orderId=>context.confirmed.has(orderId))?'booked':'planned',totalKm:Math.round(plan.totalKm),totalRevenue:plan.totalRevenue,detourKm:Math.round(plan.detourKm),startAt:plan.departAt,endAt:plan.endAt};
  }catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();}
 }
 async complete(userId:string,id:string){
  const result=await this.pool.query("UPDATE trips SET status='done',revision=revision+1 WHERE id=$1 AND user_id=$2 AND status='booked' RETURNING id",[id,userId]);
  if(!result.rows[0])throw new ServiceError('TRIP_NOT_COMPLETABLE','Confirm every load before completing this trip.',409);
  return this.detail(userId,id);
 }
 async myOrders(userId:string):Promise<MyOrder[]>{
  const result=await this.pool.query<{trip_id:string;trip_status:MyOrder['tripStatus'];order_id:string;role:MyOrder['role'];status:MyOrder['status'];pickup_addr:string;delivery_addr:string;pickup_from:Date;delivery_to:Date;price_eur:string|null;weight_kg:number|null;volume_m3:string|null;confirmed_order:TripPlan['orders'][number]|null}>(`SELECT t.id trip_id,t.status trip_status,x.order_id,x.role,x.status,x.confirmed_order,o.pickup_addr,o.delivery_addr,o.pickup_from,o.delivery_to,o.price_eur,o.weight_kg,o.volume_m3
   FROM trips t JOIN trip_orders x ON x.trip_id=t.id JOIN orders o ON o.id=x.order_id WHERE t.user_id=$1 AND t.status<>'cancelled' AND x.status<>'dropped' ORDER BY t.start_at DESC,x.seq LIMIT 200`,[userId]);
  return result.rows.map(row=>({tripId:row.trip_id,tripStatus:row.trip_status,orderId:row.order_id,role:row.role,status:row.status,pickupAddress:row.confirmed_order?.pickupAddress??row.pickup_addr,deliveryAddress:row.confirmed_order?.deliveryAddress??row.delivery_addr,pickupFrom:row.confirmed_order?.pickupFrom??row.pickup_from.toISOString(),deliveryTo:row.confirmed_order?.deliveryTo??row.delivery_to.toISOString(),priceEur:row.confirmed_order?row.confirmed_order.priceEur:row.price_eur===null?null:Number(row.price_eur),weightKg:row.confirmed_order?row.confirmed_order.weightKg:row.weight_kg,volumeM3:row.confirmed_order?row.confirmed_order.volumeM3:row.volume_m3===null?null:Number(row.volume_m3)}));
 }
 async detail(userId:string,id:string):Promise<TripDetail>{

  const tripResult=await this.pool.query<{id:string;vehicle_id:string;revision:number;status:TripDetail['status'];total_km:number|null;total_revenue:string;detour_km:number|null;start_at:Date;end_at:Date;vehicle_name:string;route_plan:TripPlan|null}>(
   'SELECT t.id,t.vehicle_id,t.revision,t.status,t.total_km,t.total_revenue,t.detour_km,t.start_at,t.end_at,v.name vehicle_name,t.route_plan FROM trips t JOIN vehicles v ON v.id=t.vehicle_id WHERE t.id=$1 AND t.user_id=$2',[id,userId]);
  const row=tripResult.rows[0];if(!row)throw new ServiceError('TRIP_NOT_FOUND','Trip not found.',404);
  const orderResult=await this.pool.query<{trip_order_id:string;order_id:string;role:TripOrderItem['role'];status:TripOrderItem['status'];pickup_addr:string;delivery_addr:string;pickup_from:Date;delivery_to:Date;price_eur:string|null;weight_kg:number|null;volume_m3:string|null;trans_eu_url:string;confirmed_order:TripPlan['orders'][number]|null}>(
   'SELECT x.id trip_order_id,o.id order_id,x.role,x.status,x.confirmed_order,o.pickup_addr,o.delivery_addr,o.pickup_from,o.delivery_to,o.price_eur,o.weight_kg,o.volume_m3,o.trans_eu_url FROM trip_orders x JOIN orders o ON o.id=x.order_id WHERE x.trip_id=$1 ORDER BY x.seq',[id]);
  return{id:row.id,vehicleId:row.vehicle_id,revision:row.revision,status:row.status,totalKm:row.total_km,totalRevenue:Number(row.total_revenue),detourKm:Number(row.detour_km??0),startAt:row.start_at.toISOString(),endAt:row.end_at.toISOString(),vehicleName:row.vehicle_name,routePlan:row.route_plan,orders:orderResult.rows.map(order=>({tripOrderId:order.trip_order_id,orderId:order.order_id,role:order.role,status:order.status,pickupAddress:order.confirmed_order?.pickupAddress??order.pickup_addr,deliveryAddress:order.confirmed_order?.deliveryAddress??order.delivery_addr,pickupFrom:order.confirmed_order?.pickupFrom??order.pickup_from.toISOString(),deliveryTo:order.confirmed_order?.deliveryTo??order.delivery_to.toISOString(),priceEur:order.confirmed_order?order.confirmed_order.priceEur:order.price_eur===null?null:Number(order.price_eur),weightKg:order.confirmed_order?order.confirmed_order.weightKg:order.weight_kg,volumeM3:order.confirmed_order?order.confirmed_order.volumeM3:order.volume_m3===null?null:Number(order.volume_m3),transEuUrl:order.trans_eu_url}))};
 }
 async list(userId:string,status?:TripListItem['status']):Promise<TripListItem[]>{

  const result=await this.pool.query<{id:string;status:TripListItem['status'];pickup_addr:string;delivery_addr:string;total_km:number|null;total_revenue:string;start_at:Date;end_at:Date;order_count:string}>(
   "SELECT t.id,t.status,o.pickup_addr,o.delivery_addr,t.total_km,t.total_revenue,t.start_at,t.end_at,count(x.id) FILTER (WHERE x.status<>'dropped') order_count FROM trips t JOIN orders o ON o.id=t.main_order_id JOIN trip_orders x ON x.trip_id=t.id WHERE t.user_id=$1 AND ($2::text IS NULL OR t.status=$2) GROUP BY t.id,o.pickup_addr,o.delivery_addr ORDER BY t.start_at DESC",[userId,status??null]);
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
  try{await db.query('BEGIN');await db.query('SELECT t.id FROM trips t JOIN trip_orders x ON x.trip_id=t.id WHERE x.id=$1 AND t.user_id=$2 FOR UPDATE OF t',[tripOrderId,userId]);const updated=await db.query<{trip_id:string}>(
   `UPDATE trip_orders x SET status=$1,booked_at=CASE WHEN $1='booked' THEN now() ELSE booked_at END,
    confirmed_order=CASE WHEN $1='booked' THEN COALESCE(x.confirmed_order,(SELECT value FROM jsonb_array_elements(t.route_plan->'orders') WHERE value->>'id'=x.order_id::text)) ELSE x.confirmed_order END
    FROM trips t WHERE x.id=$2 AND t.id=x.trip_id AND t.user_id=$3 AND t.status IN ('planned','booked')
    AND x.status NOT IN ('lost','dropped') AND ($1<>'dropped' OR (x.role<>'main' AND x.status<>'booked')) RETURNING x.trip_id`,[status,tripOrderId,userId]);
   if(!updated.rows[0])throw new ServiceError('TRIP_ORDER_NOT_FOUND','Trip order not found.',404);tripId=updated.rows[0].trip_id;
   await db.query("UPDATE trips t SET revision=revision+1,status=CASE WHEN NOT EXISTS(SELECT 1 FROM trip_orders x WHERE x.trip_id=t.id AND x.status<>'dropped') THEN 'cancelled' WHEN NOT EXISTS(SELECT 1 FROM trip_orders x WHERE x.trip_id=t.id AND x.status NOT IN('booked','dropped')) THEN 'booked' ELSE 'planned' END WHERE t.id=$1",[tripId]);
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
