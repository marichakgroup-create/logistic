import type {Pool} from 'pg';
import type {MatchOrder,TripPlan} from '@loadlink/core';
import {ServiceError} from './errors';
import {readMatchOrders} from './matching-data';

type Database=Pick<Pool,'query'>;
export type TripContext={id:string;main_order_id:string;vehicle_id:string;status:string;revision:number;route_plan:TripPlan;confirmed:Map<string,MatchOrder>};
export async function readTripContext(db:Database,userId:string,tripId:string,lock=false):Promise<TripContext>{
 const result=await db.query<Omit<TripContext,'confirmed'>>(`SELECT id,main_order_id,vehicle_id,status,revision,route_plan FROM trips WHERE id=$1 AND user_id=$2 ${lock?'FOR UPDATE':''}`,[tripId,userId]);
 const trip=result.rows[0];
 if(!trip)throw new ServiceError('TRIP_NOT_FOUND','Trip not found.',404);
 if(!['planned','booked'].includes(trip.status))throw new ServiceError('TRIP_NOT_EDITABLE','This trip is no longer editable.',409);
 if(!trip.route_plan)throw new ServiceError('MATCH_CHANGED','This older trip has no saved route. Please create a new plan.',409);
 if(Date.parse(trip.route_plan.departAt)<=Date.now())throw new ServiceError('TRIP_STARTED','This trip has reached its planned departure. Adding loads in transit is not available yet.',409);
 const booked=await db.query<{order_id:string;confirmed_order:MatchOrder|null}>("SELECT order_id,confirmed_order FROM trip_orders WHERE trip_id=$1 AND status='booked'",[tripId]);
 const confirmed=new Map<string,MatchOrder>();
 for(const row of booked.rows){
  const saved=row.confirmed_order??trip.route_plan.orders.find(order=>order.id===row.order_id);
  if(!saved)throw new ServiceError('MATCH_CHANGED','A confirmed load has no saved conditions. Review this trip.',409);
  confirmed.set(row.order_id,{...saved,status:'open'});
 }
 return{...trip,confirmed};
}
export function assertTripSelection(context:TripContext,ids:string[]){
 if(ids[0]!==context.main_order_id||[...context.confirmed.keys()].some(id=>!ids.includes(id)))
  throw new ServiceError('CONFIRMED_LOAD','Confirmed loads must stay in this trip.',409);
}
export async function readPlanningOrders(db:Database,ids:string[],context?:TripContext,lock=false){
 if(context)assertTripSelection(context,ids);
 const freshIds=ids.filter(id=>!context?.confirmed.has(id));
 const fresh=freshIds.length?await readMatchOrders(db,freshIds,lock):[];
 const byId=new Map(fresh.map(order=>[order.id,order]));
 return ids.map(id=>context?.confirmed.get(id)??byId.get(id)!);
}
