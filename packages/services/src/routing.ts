import {createHash} from 'node:crypto';
import type {Pool} from 'pg';
import type {Point,Route,RoutingProvider} from '@loadlink/core';
import {z} from 'zod';
const routeSchema=z.object({polyline:z.string(),km:z.number().nonnegative(),minutes:z.number().nonnegative()});
export interface RouteCache {get(key:string):Promise<Route|null>;set(key:string,route:Route):Promise<void>;}
export class RoutingUnavailable extends Error {readonly code='ROUTING_UNAVAILABLE';constructor(){super('Routing unavailable. Please retry.');}}
export class CachedRouting implements RoutingProvider {
 private pending=new Map<string,Promise<Route>>();
 constructor(private primary:RoutingProvider,private fallback:RoutingProvider,private cache:RouteCache) {}
 async route(stops:Point[]) {
 if(stops.length<2||stops.some(p=>!Number.isFinite(p.lat)||!Number.isFinite(p.lon)||Math.abs(p.lat)>90||Math.abs(p.lon)>180)) throw new Error('Invalid route stops');
 const key=createHash('sha1').update(JSON.stringify(stops)).digest('hex');
 const cached=await this.cache.get(key);if(cached)return cached;
 const existing=this.pending.get(key);if(existing)return existing;
 const request=(async()=>{let route:Route;
 try{route=routeSchema.parse(await this.primary.route(stops));}catch{try{route=routeSchema.parse(await this.fallback.route(stops));}catch{throw new RoutingUnavailable();}}
 await this.cache.set(key,route);return route;})();
 this.pending.set(key,request);
 try{return await request;}finally{this.pending.delete(key);}
 }
}
export class PostgresRouteCache implements RouteCache {
 constructor(private pool:Pool){}
 async get(key:string):Promise<Route|null>{const result=await this.pool.query('SELECT polyline,km,minutes FROM route_cache WHERE key=$1',[key]);const r=result.rows[0];return r?{polyline:r.polyline,km:Number(r.km),minutes:Number(r.minutes)}:null;}
 async set(key:string,r:Route){await this.pool.query('INSERT INTO route_cache(key,polyline,km,minutes) VALUES($1,$2,$3,$4) ON CONFLICT(key) DO UPDATE SET polyline=EXCLUDED.polyline,km=EXCLUDED.km,minutes=EXCLUDED.minutes,created_at=now()',[key,r.polyline,r.km,Math.ceil(r.minutes)]);}
}
export class OsrmRouting implements RoutingProvider {
 constructor(private url:string){}
 async route(stops:Point[]):Promise<Route>{const response=await fetch(`${this.url}/route/v1/driving/${stops.map(p=>`${p.lon},${p.lat}`).join(';')}?overview=full&geometries=polyline`,{signal:AbortSignal.timeout(2500)});if(!response.ok)throw new Error('OSRM failed');const data=z.object({code:z.literal('Ok'),routes:z.array(z.object({geometry:z.string(),distance:z.number().nonnegative(),duration:z.number().nonnegative()})).min(1)}).parse(await response.json());const r=data.routes[0];return {polyline:r.geometry,km:r.distance/1000,minutes:r.duration/60};}
}
export class GoogleRouting implements RoutingProvider {
 constructor(private key:string){}
 async route(stops:Point[]):Promise<Route>{if(!this.key)throw new Error('Google routing key absent');const waypoint=(p:Point)=>({location:{latLng:{latitude:p.lat,longitude:p.lon}}});const response=await fetch('https://routes.googleapis.com/directions/v2:computeRoutes',{method:'POST',signal:AbortSignal.timeout(2500),headers:{'Content-Type':'application/json','X-Goog-Api-Key':this.key,'X-Goog-FieldMask':'routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline'},body:JSON.stringify({origin:waypoint(stops[0]),destination:waypoint(stops[stops.length-1]),intermediates:stops.slice(1,-1).map(waypoint),travelMode:'DRIVE'})});if(!response.ok)throw new Error('Google routing failed');const data=z.object({routes:z.array(z.object({distanceMeters:z.number().nonnegative(),duration:z.string().regex(/^\d+(\.\d+)?s$/),polyline:z.object({encodedPolyline:z.string()})})).min(1)}).parse(await response.json());const r=data.routes[0];return {polyline:r.polyline.encodedPolyline,km:r.distanceMeters/1000,minutes:parseFloat(r.duration)/60};}
}
export class FixtureRouting implements RoutingProvider {
 async route(stops:Point[]):Promise<Route>{
  let km=0;for(let index=1;index<stops.length;index++){const a=stops[index-1],b=stops[index];const lat=(value:number)=>value*Math.PI/180;
   const dLat=lat(b.lat-a.lat),dLon=lat(b.lon-a.lon);const h=Math.sin(dLat/2)**2+Math.cos(lat(a.lat))*Math.cos(lat(b.lat))*Math.sin(dLon/2)**2;
   km+=6371*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));}
  return{polyline:'',km:km*1.18,minutes:km*1.18/65*60};
 }
}
