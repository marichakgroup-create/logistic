import {Worker,Queue} from 'bullmq';
import {Pool} from 'pg';
import {resolve} from 'node:path';
import {AddonMatchingService,CachedRouting,FixtureRouting,GoogleRouting,LegRoutePlanner,LocalEmailSender,NotificationService,OsrmRouting,PostgresRouteCache,ResendEmailSender,FixtureSource,syncOrders,ServiceError} from '@loadlink/services';
import type {AddonQuery,AddonResult} from '@loadlink/core';
const redis=new URL(process.env.REDIS_URL??'redis://localhost:6379');
const connection={host:redis.hostname,port:Number(redis.port||6379),password:redis.password||undefined};
const pool=new Pool({connectionString:process.env.DATABASE_URL});
const appUrl=(process.env.APP_URL??'http://localhost:3000').replace(/\/$/,'');
const emailProvider=process.env.EMAIL_PROVIDER??(process.env.NODE_ENV==='production'?'resend':'local');
if(emailProvider==='resend'&&(!process.env.EMAIL_API_KEY||!process.env.EMAIL_FROM))throw new Error('EMAIL_API_KEY and EMAIL_FROM are required for Resend');
const sender=emailProvider==='resend'?new ResendEmailSender(process.env.EMAIL_API_KEY!,process.env.EMAIL_FROM!):new LocalEmailSender(process.env.EMAIL_OUTBOX_DIR??resolve('../../.local/mail'));
const notifications=new NotificationService(pool,sender,appUrl);
const sourceName=process.env.ORDER_SOURCE??'fixture';
if(sourceName!=='fixture')throw new Error('Feed adapter requires an agreed feed contract');
const queue=new Queue('sync-orders',{connection});
await queue.upsertJobScheduler('periodic-sync',{every:60000},{name:'sync',data:{}});
await queue.add('sync',{});
const worker=new Worker('sync-orders',async()=>{const source=new FixtureSource(process.env.FIXTURE_EPOCH?new Date(process.env.FIXTURE_EPOCH):undefined);const result=await syncOrders(pool,source,sourceName);const delivery=await notifications.deliverPending();process.stdout.write(JSON.stringify({event:'sync_completed',...result,notifications:delivery})+'\n');},{connection,concurrency:1});
worker.on('failed',(_job,error)=>process.stderr.write(JSON.stringify({event:'sync_failed',message:error.message})+'\n'));
if(process.env.NODE_ENV==='production'&&process.env.ROUTING_MODE==='fixture')throw new Error('Fixture routing is development-only');
const fixtureRouting=new FixtureRouting();
const routing=process.env.ROUTING_MODE==='fixture'
 ?fixtureRouting
 :new CachedRouting(new OsrmRouting(process.env.OSRM_URL??'http://localhost:5000'),new GoogleRouting(process.env.GOOGLE_ROUTES_KEY??''),new PostgresRouteCache(pool));
const matcher=new AddonMatchingService(pool,new LegRoutePlanner(routing));
type MatchJob={userId:string;mainOrderId:string;query:AddonQuery;planOnly?:boolean};
const matchWorker=new Worker<MatchJob,AddonResult>('match-orders',async job=>{
 let result:AddonResult;
 try{result=await matcher.match(job.data.userId,job.data.mainOrderId,job.data.query,job.data.planOnly,async progress=>{await job.updateProgress(progress);});}catch(error){if(error instanceof ServiceError)throw new Error(JSON.stringify({code:error.code,message:error.message,status:error.status}));throw error;}
 process.stdout.write(JSON.stringify({event:'match_completed',jobId:job.id,suggestions:result.suggestions.length,partial:result.partial})+'\n');return result;
},{connection,concurrency:2});
matchWorker.on('failed',(job,error)=>process.stderr.write(JSON.stringify({event:'match_failed',jobId:job?.id,message:error.message})+'\n'));
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,async()=>{await matchWorker.close();await worker.close();await queue.close();await pool.end();process.exit(0);});
