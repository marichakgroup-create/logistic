import type {Pool} from 'pg';

export type LostOrderEmail={tripId:string;pickupAddress:string;deliveryAddress:string;tripUrl:string};
export interface OrderNotificationSender{sendOrderLost(email:string,data:LostOrderEmail):Promise<void>}
type PendingRow={id:string;email:string;trip_id:string;pickup_addr:string;delivery_addr:string};

export class NotificationService{
 constructor(private pool:Pool,private sender:OrderNotificationSender,private appUrl:string){}
 async deliverPending(limit=50){
  const db=await this.pool.connect();let sent=0,failed=0;
  try{await db.query('BEGIN');const pending=await db.query<PendingRow>(`SELECT n.id,u.email,t.id trip_id,o.pickup_addr,o.delivery_addr
   FROM order_notifications n JOIN users u ON u.id=n.user_id JOIN trip_orders x ON x.id=n.trip_order_id
   JOIN trips t ON t.id=x.trip_id JOIN orders o ON o.id=x.order_id
   WHERE n.sent_at IS NULL AND n.attempts<5 ORDER BY n.created_at LIMIT $1 FOR UPDATE OF n SKIP LOCKED`,[limit]);
   for(const row of pending.rows){try{await this.sender.sendOrderLost(row.email,{tripId:row.trip_id,pickupAddress:row.pickup_addr,deliveryAddress:row.delivery_addr,tripUrl:this.appUrl+'/trips/'+row.trip_id});await db.query('UPDATE order_notifications SET sent_at=now(),attempts=attempts+1,last_error=NULL WHERE id=$1',[row.id]);sent++;}catch(error){await db.query('UPDATE order_notifications SET attempts=attempts+1,last_error=$2 WHERE id=$1',[row.id,error instanceof Error?error.message:'Delivery failed']);failed++;}}
   await db.query('COMMIT');return{sent,failed};
  }catch(error){await db.query('ROLLBACK');throw error;}finally{db.release();}
 }
}
