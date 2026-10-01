import {createHash} from 'node:crypto';
import type {Pool} from 'pg';
import type {AddonQuery,AddonResult} from '@loadlink/core';
import {ServiceError,VehicleService,readMatchOrders,matchFingerprint, type AddonMatchingService} from '@loadlink/services';

export type AddonJob={userId:string;mainOrderId:string;query:AddonQuery};
export interface AddonDispatcher{get(data:AddonJob,options?:{fresh?:boolean}):Promise<AddonResult>;}
type Entry={result?:AddonResult;progress?:AddonResult;expires:number;promise:Promise<AddonResult>};

/** Disposable result cache. Durable routes and trip validation stay in Postgres. */
export class DirectAddonDispatcher implements AddonDispatcher {
 private entries=new Map<string,Entry>();
 private running=new Set<Promise<AddonResult>>();
 constructor(private pool:Pool,private matcher:Pick<AddonMatchingService,'match'>){}
 async get(data:AddonJob,request:{fresh?:boolean}={}):Promise<AddonResult>{
  if(data.query.tripId){
   const trip=await this.pool.query('SELECT id FROM trips WHERE id=$1 AND user_id=$2 AND main_order_id=$3 AND vehicle_id=$4',[data.query.tripId,data.userId,data.mainOrderId,data.query.vehicleId]);
   if(!trip.rows[0])throw new ServiceError('TRIP_NOT_FOUND','Trip not found.',404);
   if(!data.query.addonOrderIds.length){
    const selected=await this.pool.query<{order_id:string}>("SELECT order_id FROM trip_orders WHERE trip_id=$1 AND role='addon' AND status NOT IN('dropped','lost') ORDER BY seq",[data.query.tripId]);
    data={...data,query:{...data.query,addonOrderIds:selected.rows.map(row=>row.order_id)}};
   }
  }
  const vehicle=await new VehicleService(this.pool).getOwned(data.userId,data.query.vehicleId);
  const orders=await readMatchOrders(this.pool,[data.mainOrderId,...data.query.addonOrderIds]);
  const hash=createHash('sha256').update(JSON.stringify({userId:data.userId,main:data.mainOrderId,query:data.query,input:matchFingerprint(orders,vehicle)})).digest('hex');

  for(const [key,entry] of this.entries)if(entry.expires<Date.now())this.entries.delete(key);
  let entry=request.fresh?undefined:this.entries.get(hash);
  if(!entry){
   if(this.running.size>=2)throw new ServiceError('MATCH_BUSY','Route matching is busy. Please retry.',503);
   entry={expires:Infinity,promise:Promise.resolve({suggestions:[],rejected:[],partial:true,updatedAt:null})};
   const current=entry;
   const work=this.matcher.match(data.userId,data.mainOrderId,data.query,request.fresh,async progress=>{current.progress=progress;});
   current.promise=work.then(result=>{current.result=result;current.expires=Date.now()+300000;return result;});
   this.running.add(current.promise);
   void current.promise.then(()=>this.running.delete(current.promise),()=>{this.running.delete(current.promise);if(this.entries.get(hash)===current)this.entries.delete(hash);});
   if(!request.fresh){
    if(this.entries.size>=100){const oldest=[...this.entries].find(([,value])=>value.result);if(oldest)this.entries.delete(oldest[0]);}
    this.entries.set(hash,current);
   }
  }
  if(entry.result)return entry.result;
  let timer:ReturnType<typeof setTimeout>|undefined;
  try{
   const result=await Promise.race([entry.promise,new Promise<null>(resolve=>{timer=setTimeout(()=>resolve(null),request.fresh?12000:3750);})]);
   if(result)return result;
   if(request.fresh)throw new ServiceError('MATCH_PENDING','The trip is still being calculated. Please retry saving.',503);
   return{...(entry.progress??{suggestions:[],rejected:[],updatedAt:null}),partial:true,pending:true};
  }finally{if(timer)clearTimeout(timer);}
 }
 async close(){await Promise.allSettled(this.running);this.entries.clear();}
}
