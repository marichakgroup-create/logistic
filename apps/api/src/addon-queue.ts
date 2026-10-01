import {createHash,randomUUID} from 'node:crypto';
import type {Pool} from 'pg';
import {z} from 'zod';
import {Queue,QueueEvents,type JobsOptions} from 'bullmq';
import type {AddonQuery,AddonResult} from '@loadlink/core';
import {ServiceError,VehicleService,readMatchOrders,matchFingerprint} from '@loadlink/services';

export type AddonJob={userId:string;mainOrderId:string;query:AddonQuery;planOnly?:boolean};
export interface AddonDispatcher{get(data:AddonJob,options?:{fresh?:boolean}):Promise<AddonResult>;}
const cacheMs=5*60_000;
const waitMs=3_750;

export class BullAddonDispatcher implements AddonDispatcher{
 private queue:Queue<AddonJob,AddonResult>;private events:QueueEvents;
 constructor(connection:{host:string;port:number;password?:string},private pool:Pool){
  this.queue=new Queue('match-orders',{connection});this.events=new QueueEvents('match-orders',{connection});
 }
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
  const id=request.fresh?'save-'+randomUUID():'addons-v3-'+hash;
  if(request.fresh)data={...data,planOnly:true};
  let job=await this.queue.getJob(id);
  if(job){
   const state=await job.getState();
   if(state==='completed'&&job.finishedOn&&Date.now()-job.finishedOn<cacheMs)return job.returnvalue;
   if(state==='completed'||state==='failed'){await job.remove();job=undefined;}
  }
  const options:JobsOptions={jobId:id,removeOnComplete:{age:360,count:1000},removeOnFail:{age:60,count:1000}};
  job??=await this.queue.add('match',data,options);
  let timer:ReturnType<typeof setTimeout>|undefined;
  const outcome=await Promise.race([
   job.waitUntilFinished(this.events).then(value=>({kind:'done' as const,value})).catch(error=>({kind:'failed' as const,error})),
   new Promise<{kind:'timeout'}>(resolve=>{timer=setTimeout(()=>resolve({kind:'timeout'}),request.fresh?12_000:waitMs);})
  ]);
  if(timer)clearTimeout(timer);
  if(outcome.kind==='done')return outcome.value;
  if(outcome.kind==='failed'){
   const message=outcome.error instanceof Error?outcome.error.message:'';
   try{const parsed=z.object({code:z.string(),message:z.string(),status:z.number().int()}).parse(JSON.parse(message));throw new ServiceError(parsed.code,parsed.message,parsed.status);}catch(error){if(error instanceof ServiceError)throw error;}
   throw new ServiceError('ROUTING_UNAVAILABLE','Route matching is temporarily unavailable. Please retry.',503);
  }
  if(request.fresh)throw new ServiceError('MATCH_PENDING','The trip is still being calculated. Please retry saving.',503);
  return{suggestions:[],rejected:[],partial:true,updatedAt:null};
 }
 async close(){await this.events.close();await this.queue.close();}
}
