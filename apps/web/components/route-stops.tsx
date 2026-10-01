import type {TripPlan} from '@loadlink/core';
import {number} from '../lib/format';
export function RouteStops({plan,saved=false,inline=false}:{plan:TripPlan;saved?:boolean;inline?:boolean}){
 const stops=<ol>{plan.stops.map((stop,index)=>{
  const order=plan.orders.find(order=>order.id===stop.orderId);const timing=plan.timings[index];const slack=timing?Math.round((Date.parse(stop.windowTo)-Date.parse(timing.arrivalAt))/60000):null;
  return <li key={stop.orderId+'-'+stop.kind}><span>{index+1}</span><div><strong>{stop.kind==='pickup'?'Pickup':'Delivery'} · {stop.kind==='pickup'?order?.pickupAddress:order?.deliveryAddress}</strong><p>{timing?new Intl.DateTimeFormat('en-GB',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(timing.arrivalAt)):'Time pending'} · {timing?number(timing.onboardKg)+' kg on board':'Load pending'}{timing?.onboardM3===null?' · Volume unknown':timing?' · '+number(timing.onboardM3)+' m³ on board':''}</p><p>{stop.kind==='pickup'?'Pickup window:':'Delivery window:'} {new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',day:'numeric',month:'short'}).format(new Date(stop.windowFrom))} – {new Intl.DateTimeFormat('en-GB',{hour:'2-digit',minute:'2-digit',day:'numeric',month:'short'}).format(new Date(stop.windowTo))}{slack!==null?` · ${slack} min spare`:""}</p></div></li>;
 })}</ol>;
 return inline?<div className="planned-stops route-stop-list">{stops}</div>:<details className="planned-stops"><summary>{saved?'Saved route stops':'Route stops'} · {plan.stops.length}</summary>{stops}</details>;
}
