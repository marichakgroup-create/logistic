 'use client';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {useRouter} from 'next/navigation';
import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,Clock3,MapPin,Package,Plus,Route,X} from 'lucide-react';
import type {AddonResult,CreatedTrip,MatchOrder,OrderCard,RejectReason,Suggestion,Vehicle,TripDetail} from '@loadlink/core';
import {api} from '../lib/api';
import {euro,number,updatedText} from '../lib/format';
import {Button} from './ui/button';
import {RouteStops} from './route-stops';

const RouteMap=dynamic(()=>import('./route-map'),{ssr:false,loading:()=> <div className="route-map-placeholder" aria-label="Loading route map"/>});
const reasons:Record<RejectReason,string>={CAPACITY_KG:'Too heavy',CAPACITY_M3:'Too bulky',DIMENSIONS:'Cargo dimensions do not fit',DETOUR:'Too far off route',TIME_WINDOW:'Misses time window',DIRECTION:'Wrong direction',DRIVER_HOURS:'Driving limit',MISSING_WEIGHT:'Weight unknown',NO_PRICE:'Price unknown',TRIP_FULL:'Trip is full'};

export function BuilderClient({main,vehicle,editing}:{main:OrderCard;vehicle:Vehicle;editing?:TripDetail}){
 const router=useRouter();const sequence=useRef(0);
 const [matches,setMatches]=useState<AddonResult|null>(null);const [added,setAdded]=useState<string[]>(editing?.orders.filter(order=>order.role==='addon'&&!['dropped','lost'].includes(order.status)).map(order=>order.orderId)??[]);
 const [error,setError]=useState('');const [loading,setLoading]=useState(true);const [revision,setRevision]=useState(0);
 const [searching,setSearching]=useState(false);
 const [saving,setSaving]=useState(false);const [saved,setSaved]=useState<CreatedTrip|null>(null);
 const [detailPanel,setDetailPanel]=useState<'route'|'rejected'>('route');
 useEffect(()=>{
  const request=++sequence.current;const controller=new AbortController();
  let timer:ReturnType<typeof setTimeout>|undefined;let attempts=0;
  setLoading(true);setSearching(false);setError('');setMatches(null);
  async function calculate(){
   try{
    const params=new URLSearchParams({vehicleId:vehicle.id,bufferKm:'25',addonOrderIds:added.join(',')});
    if(editing)params.set('tripId',editing.id);
    if(revision>0&&attempts===0)params.set('refresh','true');
    const next=await api<AddonResult>('/orders/'+main.id+'/addons?'+params,{signal:controller.signal});
    if(controller.signal.aborted||request!==sequence.current)return;
    setMatches(next);setLoading(false);
    const retry=Boolean(next.pending)&&++attempts<10;
    setSearching(retry);
    if(retry)timer=setTimeout(()=>{void calculate();},1500);
   }catch(error){
    if(!controller.signal.aborted&&request===sequence.current){setError(error instanceof Error?error.message:'Could not calculate the route.');setLoading(false);setSearching(false);}
   }
  }
  void calculate();return()=>{controller.abort();if(timer)clearTimeout(timer);};
 },[main.id,vehicle.id,added,revision,editing?.id]);
 const plan=matches?.trip;
 const calculated=Boolean(plan&&plan.orders.length===added.length+1&&plan.orders.slice(1).every((order,index)=>order.id===added[index]));
 const ready=calculated&&!loading&&!error;
 const revenue=plan?.totalRevenue??main.priceEur;
 function add(item:Suggestion){if(!ready||saving||saved||added.length>=4)return;setLoading(true);setAdded(current=>current.length<4&&!current.includes(item.order.id)?[...current,item.order.id]:current);}
 function remove(id:string){if(saving||saved)return;setLoading(true);setAdded(current=>current.filter(item=>item!==id));}
 async function save(){
  if(!ready)return;setSaving(true);setError('');
  try{const result=await api<{trip:CreatedTrip}>(editing?'/trips/'+editing.id:'/trips',{method:editing?'PUT':'POST',body:JSON.stringify(editing?{addonOrderIds:added,revision:editing.revision}:{vehicleId:vehicle.id,mainOrderId:main.id,addonOrderIds:added})});setSaved(result.trip);}
  catch(error){setError(error instanceof Error?error.message:'Could not save this trip.');}
  finally{setSaving(false);}
 }
 return <>
  <section className="builder-hero"><div className="builder-top"><Link href={editing?"/trips/"+editing.id:"/find"} className="back-link"><ArrowLeft size={17}/>{editing?"Back to trip":"Back to orders"}</Link><span>{vehicle.name}</span></div><div className="builder-summary"><div className="builder-route-heading"><p className="section-label">MAIN ORDER</p><h1>{main.pickupAddress}<span aria-hidden="true">→</span>{main.deliveryAddress}</h1></div><div className="builder-value"><span>Order value</span><strong>{main.priceEur===null?'Unknown':euro(main.priceEur)}</strong><small>{added.length?added.length+' add-on '+(added.length===1?'load':'loads'):'Main load selected'}</small></div><div className="builder-hero-facts"><span><Clock3 size={15}/>Pickup {dateTime(main.pickupFrom)}</span><span><Clock3 size={15}/>Deliver by {dateTime(main.deliveryTo)}</span><span><Package size={15}/>{number(main.weightKg)} kg · {main.volumeM3===null?'Volume unknown':number(main.volumeM3)+' m³'}</span></div></div></section>
  <section className="content-sheet builder-sheet">
   <div className="route-metrics" aria-live="polite" aria-busy={loading}><div><span>Total distance</span><strong>{plan?number(plan.totalKm)+' km':loading?'Calculating…':'Unavailable'}</strong></div><div><span>Detour</span><strong>{plan?'+'+number(plan.detourKm)+' km':'—'}</strong></div><div><span>Estimated finish</span><strong>{plan?dateTime(plan.endAt):'—'}</strong></div></div>
   <div className="load-gauges"><Gauge label="Payload" value={plan?.loadPctKg??null} unknownLabel={loading?"Calculating…":"Unavailable"}/><Gauge label="Cargo space" value={plan?.loadPctM3??null} unknownLabel={plan?'Volume unknown':loading?'Calculating…':'Unavailable'}/></div>
   {plan&&<RouteMap trip={plan} mainOrderId={main.id}/>}
   {error&&<div className="builder-error" role="alert"><p>{error}</p><button type="button" onClick={()=>setRevision(current=>current+1)} disabled={loading||saving}>Recalculate route</button></div>}
   {added.length>0&&<section className="selected-loads" aria-label="In your trip"><header><h2>In your trip</h2><span>{added.length} / 4 add-ons</span></header>{added.map(id=>{const order=plan?.orders.find(order=>order.id===id)??editing?.routePlan?.orders.find(order=>order.id===id)??matches?.suggestions.find(item=>item.order.id===id)?.order;const confirmed=editing?.orders.some(order=>order.orderId===id&&order.status==='booked');return <article className="selected-load" key={id}><div><span className="selected-label">{confirmed?'CONFIRMED ADD-ON':'ADDED TO ROUTE'}</span><strong>{order?routeName(order):'Calculating selected load…'}</strong><p>{order?`Pickup ${dateTime(order.pickupFrom)} · ${order.priceEur===null?'Value unknown':euro(order.priceEur)}`:'Route check in progress'}</p></div><button type="button" aria-label={'Remove '+(order?routeName(order):'selected load')} onClick={()=>remove(id)} disabled={saving||Boolean(saved)||confirmed}><X size={18}/>{confirmed?"Confirmed":"Remove"}</button></article>;})}</section>}
   <div className="builder-heading"><div><p className="section-label">ALONG THE WAY</p><h1>{added.length===4?'Trip is full':'Best available add-ons'}</h1><p>{loading?'Checking route, capacity and deadlines…':searching?'Checking more loads along your route…':matches?.updatedAt?`Ranked by extra income after detour cost · ${updatedText(matches.updatedAt)}`:'Ready matches appear here, ranked by extra income after detour cost.'}</p></div><span>{added.length} / 4 added</span></div>
   {loading&&<div className="skeleton-list builder-skeleton" aria-label="Calculating add-ons"><i/><i/></div>}
   {!loading&&ready&&added.length<4&&matches?.suggestions.length===0&&!matches.partial&&<div className="builder-empty"><h2>No fitting add-ons right now</h2><p>{added.length?'Remove an unconfirmed add-on to check another route, or save this trip.':'You can save the main route now and check for add-ons later.'}</p></div>}
   {!loading&&ready&&added.length<4&&<div className="addon-list">{matches?.suggestions.map((item,index)=><Addon key={item.order.id} item={item} rank={index+1} disabled={saving||Boolean(saved)} onAdd={()=>add(item)}/>)}</div>}
   {matches?.partial&&!loading&&<div className="partial-note"><p role="status">{searching?'Checking more loads. You can use the ready suggestions.':'The search is incomplete. Recalculate to check for more loads.'}</p>{!searching&&<button type="button" onClick={()=>setRevision(current=>current+1)} disabled={saving}>Check again</button>}</div>}
   <section className="builder-insights" aria-label="Route details"><div className="insight-tabs"><button type="button" className={detailPanel==='route'?'active':''} aria-pressed={detailPanel==='route'} onClick={()=>setDetailPanel('route')}><Route size={18}/><span><strong>Route stops · {plan?.stops.length??'—'}</strong><small>Pickup, delivery and time windows</small></span></button><button type="button" className={detailPanel==='rejected'?'active':''} aria-pressed={detailPanel==='rejected'} onClick={()=>setDetailPanel('rejected')}><Package size={18}/><span><strong>Orders that don’t fit · {matches?.rejected.length??0}</strong><small>See why they were excluded</small></span></button></div><div className="insight-content">{detailPanel==='route'?plan?<RouteStops plan={plan} inline/>:<p className="insight-empty">Route stops will appear after calculation.</p>:matches?.rejected.length?<div className="rejected-loads">{matches.rejected.map(item=><article key={item.order.id}><div><strong>{routeName(item.order)}</strong><p>{item.order.priceEur===null?'Price unknown':euro(item.order.priceEur)}</p></div><span>{reasons[item.reason]}</span></article>)}</div>:<p className="insight-empty">No excluded orders in the current route corridor.</p>}</div></section>
   <div className="builder-footer"><div><span>{saved?'Trip saved':loading?'Recalculating…':'Total route value'}</span><strong>{revenue===null?'Unknown':euro(revenue)}</strong><small>{plan?number(plan.totalKm)+' km · '+number(plan.loadPctKg)+'% peak payload':'Route calculation pending'}</small></div>{saved?<Button onClick={()=>router.push('/trips/'+saved.id)}>View trip</Button>:<Button onClick={save} disabled={!ready||saving}>{saving?'Saving…':editing?'Save changes':'Save trip'}</Button>}</div>
  </section>
 </>;
}
function Gauge({label,value,unknownLabel}:{label:string;value:number|null;unknownLabel:string}){
 const filled=value===null?0:Math.ceil(Math.max(0,Math.min(100,value))/10);
 return <div className={value!==null&&value>85?'load-gauge warn':'load-gauge'}><div><span>{label}</span><strong>{value===null?unknownLabel:Math.round(value)+'%'}</strong></div><ol aria-label={label+': '+(value===null?unknownLabel:Math.round(value)+' percent')} aria-busy={value===null&&unknownLabel==='Calculating…'}>{Array.from({length:10},(_,index)=><li key={index} className={index<filled?'filled':''}/>)}</ol></div>;
}
function Addon({item,rank,disabled,onAdd}:{item:Suggestion;rank:number;disabled:boolean;onAdd:()=>void}){
 return <article className="addon-row"><div className={'addon-branch '+item.fit} aria-hidden="true"><i/><b/></div><div className="addon-copy"><div className="addon-card-top"><span className="addon-rank">{rank===1?'BEST VALUE':'OPTION '+rank}</span><strong>+{euro(item.addedRevenue)}</strong></div><h2>{routeName(item.order)}</h2><div className="addon-facts"><span><MapPin size={14}/>+{number(item.detourKm)} km detour</span><span><Clock3 size={14}/>+{Math.round(item.detourMin)} min</span><span><Package size={14}/>{Math.round(item.loadPctKg)}% peak load</span></div><p className="addon-time">Pickup {dateTime(item.order.pickupFrom)} · Finish {dateTime(item.newEndTime)}</p><span className={'addon-fit '+item.fit}>{item.fit==='green'?'Comfortable fit':'Limited spare capacity'}{item.loadPctM3===null?' · volume unknown':''}</span></div><button type="button" onClick={onAdd} disabled={disabled} aria-label={'Add '+routeName(item.order)}><Plus size={17}/>Add</button></article>;
}
function routeName(order:MatchOrder){return (order.pickupAddress??'Pickup')+' → '+(order.deliveryAddress??'Delivery');}
function dateTime(value:string){return new Intl.DateTimeFormat('en-GB',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(value));}
