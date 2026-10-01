import {resolve} from 'node:path';
import next from 'next';
import type {Request,Response,NextFunction} from 'express';
import {Pool} from 'pg';
import {AddonMatchingService,CachedRouting,FixtureRouting,GoogleRouting,LegRoutePlanner,DisabledEmailSender,LocalEmailSender,NotificationService,OsrmRouting,PostgresRouteCache,ResendEmailSender,FixtureSource,syncOrders} from '@loadlink/services';
import {createApp} from './app';
import {DirectAddonDispatcher} from './addon-dispatcher';
import {startBackground} from './background';

const production=process.env.NODE_ENV==='production';
const port=Number(process.env.PORT??3000);
const appUrl=(process.env.APP_URL??(process.env.RAILWAY_PUBLIC_DOMAIN?`https://${process.env.RAILWAY_PUBLIC_DOMAIN}`:`http://localhost:${port}`)).replace(/\/$/,'');
if(production&&!appUrl.startsWith('https://'))throw new Error('Production APP_URL must use HTTPS');
if(!process.env.DATABASE_URL)throw new Error('DATABASE_URL is required');
const secret=process.env.SESSION_SECRET??(production?'':'loadlink-development-secret-change-before-production');
if(secret.length<32)throw new Error('SESSION_SECRET must contain at least 32 characters');
const provider=process.env.EMAIL_PROVIDER??(production?'disabled':'local');
if(!['local','resend','disabled'].includes(provider))throw new Error('Unknown EMAIL_PROVIDER');
if(production&&provider==='local')throw new Error('Local email is development-only');
if(provider==='resend'&&(!process.env.EMAIL_API_KEY||!process.env.EMAIL_FROM))throw new Error('EMAIL_API_KEY and EMAIL_FROM are required for Resend');
const sender=provider==='disabled'?new DisabledEmailSender():provider==='local'?new LocalEmailSender(process.env.EMAIL_OUTBOX_DIR??resolve('.local/mail')):new ResendEmailSender(process.env.EMAIL_API_KEY!,process.env.EMAIL_FROM!);
if((process.env.ORDER_SOURCE??'fixture')!=='fixture')throw new Error('Feed adapter requires an agreed feed contract');
if(production&&process.env.ROUTING_MODE==='fixture')throw new Error('Fixture routing is development-only');
const pool=new Pool({connectionString:process.env.DATABASE_URL,connectionTimeoutMillis:10000,statement_timeout:15000});
pool.on('error',error=>process.stderr.write(JSON.stringify({event:'database_error',message:error.message})+'\n'));
const google=new GoogleRouting(process.env.GOOGLE_ROUTES_KEY??'');
const routing=process.env.ROUTING_MODE==='fixture'?new FixtureRouting():new CachedRouting(process.env.OSRM_URL?new OsrmRouting(process.env.OSRM_URL):google,google,new PostgresRouteCache(pool));
const addons=new DirectAddonDispatcher(pool,new AddonMatchingService(pool,new LegRoutePlanner(routing)));
const app=await createApp(pool,sender,{appUrl,sessionSecret:secret,production,googleClientId:process.env.GOOGLE_CLIENT_ID,googleClientSecret:process.env.GOOGLE_CLIENT_SECRET},addons);
const web=next({dev:!production,dir:resolve('apps/web'),hostname:'0.0.0.0',port,webpack:true});
await web.prepare();
const handle=web.getRequestHandler();
// Register before Nest routes: /v1 belongs to the API; all other paths belong to Next.
app.use((request:Request,response:Response,nextMiddleware:NextFunction)=>{
 if(request.path==='/v1'||request.path.startsWith('/v1/'))return nextMiddleware();
 void handle(request,response).catch(nextMiddleware);
});
await app.listen(port,'0.0.0.0');
const notifications=new NotificationService(pool,sender,appUrl);
const stopBackground=startBackground(async()=>{
 const source=new FixtureSource(process.env.FIXTURE_EPOCH?new Date(process.env.FIXTURE_EPOCH):undefined);
 const result=await syncOrders(pool,source,'fixture');
 const delivery=provider==='disabled'?null:await notifications.deliverPending();
 process.stdout.write(JSON.stringify({event:'sync_completed',...result,notifications:delivery})+'\n');
});
let closing=false;
for(const signal of ['SIGTERM','SIGINT'])process.on(signal,async()=>{
 if(closing)return;closing=true;
 const deadline=setTimeout(()=>process.exit(1),25000);deadline.unref();
 await Promise.all([app.close(),stopBackground(),addons.close()]);
 await web.close();await pool.end();clearTimeout(deadline);process.exit(0);
});
