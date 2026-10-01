import {defineRailway, github, project, service} from 'railway/iac';

// Own only LoadLink services; existing Redis and unrelated services stay outside this partial.
export const partial = 'loadlink';

export default defineRailway(ctx => {
 const source=github('marichakgroup-create/logistic', {branch:'main'});
 const email={EMAIL_PROVIDER:'resend',EMAIL_API_KEY:ctx.shared.EMAIL_API_KEY,EMAIL_FROM:ctx.shared.EMAIL_FROM};
 const backend={NODE_ENV:'production',DATABASE_URL:ctx.shared.DATABASE_URL,REDIS_URL:'${{Redis.REDIS_URL}}',APP_URL:'https://${{logistic.RAILWAY_PUBLIC_DOMAIN}}',...email};
 const build={builder:'DOCKERFILE' as const,dockerfilePath:'infra/Dockerfile.backend'};
 const api=service('api',{
  source,build,start:'npm run start:api',preDeploy:'npm run migrate',healthcheck:'/v1/health',healthcheckTimeout:120,
  env:{...backend,HOST:'::',PORT:'3001',SESSION_SECRET:ctx.shared.SESSION_SECRET},
  deploy:{restartPolicyType:'ON_FAILURE',restartPolicyMaxRetries:5},
 });
 const worker=service('worker',{
  source,build,start:'npm run start:worker',
  env:{...backend,ORDER_SOURCE:'fixture',ROUTING_MODE:'osrm',OSRM_URL:ctx.shared.OSRM_URL,GOOGLE_ROUTES_KEY:ctx.shared.GOOGLE_ROUTES_KEY},
  deploy:{restartPolicyType:'ON_FAILURE',restartPolicyMaxRetries:5},
 });
 const web=service('logistic',{
  source,build:{builder:'RAILPACK',buildCommand:'npm run build:web'},start:'npm start',healthcheck:'/login',
  env:{NODE_ENV:'production',API_URL:'http://${{api.RAILWAY_PRIVATE_DOMAIN}}:3001'},
 });
 return project(ctx.projectName??'courteous-connection',{resources:[web,api,worker]});
});
