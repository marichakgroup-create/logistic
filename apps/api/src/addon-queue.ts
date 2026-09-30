import {Queue,QueueEvents,type JobsOptions} from 'bullmq';
import type {AddonQuery,AddonResult} from '@loadlink/core';
import {ServiceError} from '@loadlink/services';

export type AddonJob={userId:string;mainOrderId:string;query:AddonQuery};
export interface AddonDispatcher{get(data:AddonJob):Promise<AddonResult>;}
const cacheMs=5*60_000;
const waitMs=3_750;

export class BullAddonDispatcher implements AddonDispatcher{
 private queue:Queue<AddonJob,AddonResult>;private events:QueueEvents;
 constructor(connection:{host:string;port:number;password?:string}){
  this.queue=new Queue('match-orders',{connection});this.events=new QueueEvents('match-orders',{connection});
 }
 async get(data:AddonJob):Promise<AddonResult>{
  const id=`addons-${data.userId}-${data.mainOrderId}-${data.query.vehicleId}-${data.query.bufferKm}-${data.query.tripId??'new'}`;
  let job=await this.queue.getJob(id);
  if(job){
   const state=await job.getState();
   if(state==='completed'&&job.finishedOn&&Date.now()-job.finishedOn<cacheMs)return job.returnvalue;
   if(state==='completed'||state==='failed'){await job.remove();job=undefined;}
  }
  const options:JobsOptions={jobId:id,removeOnComplete:{age:360,count:1000},removeOnFail:{age:60,count:1000}};
  job??=await this.queue.add('match',data,options);
  const outcome=await Promise.race([
   job.waitUntilFinished(this.events).then(value=>({kind:'done' as const,value})).catch(error=>({kind:'failed' as const,error})),
   new Promise<{kind:'timeout'}>(resolve=>setTimeout(()=>resolve({kind:'timeout'}),waitMs))
  ]);
  if(outcome.kind==='done')return outcome.value;
  if(outcome.kind==='failed')throw new ServiceError('ROUTING_UNAVAILABLE','Route matching is temporarily unavailable. Please retry.',503);
  return{suggestions:[],rejected:[],partial:true,updatedAt:null};
 }
 async close(){await this.events.close();await this.queue.close();}
}
