import {orderSchema, type OrderSource, type RawOrder} from '@loadlink/core';
export function normalize(raw:RawOrder) {return orderSchema.parse(raw);}
const cities = [
 {name:'Berlin',country:'DE',lat:52.52,lon:13.405},{name:'Warsaw',country:'PL',lat:52.23,lon:21.01},
 {name:'Prague',country:'CZ',lat:50.08,lon:14.44},{name:'Hamburg',country:'DE',lat:53.55,lon:9.99},
 {name:'Amsterdam',country:'NL',lat:52.37,lon:4.9},{name:'Paris',country:'FR',lat:48.86,lon:2.35},
 {name:'Vienna',country:'AT',lat:48.21,lon:16.37},{name:'Munich',country:'DE',lat:48.14,lon:11.58}
];
export function fixtureEpoch() {
 const date=new Date(); date.setUTCDate(date.getUTCDate()+1); date.setUTCHours(6,0,0,0); return date;
}
function fixtureDistance(a:{lat:number;lon:number},b:{lat:number;lon:number}) {
 const rad=(n:number)=>n*Math.PI/180;
 const h=Math.sin(rad(b.lat-a.lat)/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(rad(b.lon-a.lon)/2)**2;
 // Illustrative fixture road distance only; never used as a routing fallback.
 return Math.round(6371*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h))*1.22);
}
export class FixtureSource implements OrderSource {
 constructor(private epoch = fixtureEpoch(),private closed = new Set<string>()) {}
 async fetchSince(cursor:string|null) {
 const nextCursor=this.epoch.toISOString();
 if(cursor===nextCursor) return {orders:[],nextCursor};
 const orders = Array.from({length:200},(_,i)=>{
 const pickup=cities[i%cities.length],delivery=cities[(i%cities.length+1+Math.floor(i/8)%7)%cities.length];
 const time=(hours:number)=>new Date(this.epoch.getTime()+(Math.floor(i/40)*24+hours)*3600000).toISOString();
 return {id:`fixture-${i+1}`,status:this.closed.has(`fixture-${i+1}`)?'closed':'open',pickup:{lat:pickup.lat,lon:pickup.lon},delivery:{lat:delivery.lat,lon:delivery.lon},pickupAddress:pickup.name,deliveryAddress:delivery.name,pickupCountry:pickup.country,deliveryCountry:delivery.country,distanceKm:fixtureDistance(pickup,delivery),pickupFrom:time(0),pickupTo:time(3),deliveryFrom:time(5),deliveryTo:time(17),weightKg:200+(i*47)%1900,volumeM3:i%17===0?null:1+(i%90)/10,priceEur:180+(i*31)%1400,url:`https://platform.trans.eu/orders/fixture-${i+1}`};
 });
 return {orders,nextCursor};
 }
 async fetchClosedIds(ids:string[]) {return ids.filter(id=>this.closed.has(id));}
}
