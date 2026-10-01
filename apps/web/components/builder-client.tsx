 'use client';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {useRouter} from 'next/navigation';
import {useEffect,useRef,useState} from 'react';
import {ArrowLeft,Plus,X} from 'lucide-react';
import type {AddonResult,CreatedTrip,MatchOrder,OrderCard,RejectReason,Suggestion,Vehicle} from '@loadlink/core';
import {api} from '../lib/api';
import {euro,number,updatedText} from '../lib/format';
import {Button} from './ui/button';
import {RouteStops} from './route-stops';

const RouteMap=dynamic(()=>import('./route-map'),{ssr:false,loading:()=> <div className="route-map-placeholder" aria-label="Loading route map"/>});
const reasons:Record<RejectReason,string>={CAPACITY_KG:'Too heavy',CAPACITY_M3:'Too bulky',DIMENSIONS:'Cargo dimensions do not fit',DETOUR:'Too far off route',TIME_WINDOW:'Misses time window',DIRECTION:'Wrong direction',DRIVER_HOURS:'Driving limit',MISSING_WEIGHT:'Weight unknown',NO_PRICE:'Price unknown',TRIP_FULL:'Trip is full'};

export function BuilderClient({main,vehicle}:{main:OrderCard;vehicle:Vehicle}){
 const router=useRouter();const sequence=useRef(0);
 const [matches,setMatches]=useState<AddonResult|null>(null);const [added,setAdded]=useState<string[]>([]);
 const [error,setError]=useState('');const [loading,setLoading]=useState(true);const [revision,setRevision]=useState(0);
 const [saving,setSaving]=useState(false);const [saved,setSaved]=useState<CreatedTrip|null>(null);
 useEffect(()=>{
  const request=++sequence.current;const controller=new AbortController();
  async function calculate(){
   setLoading(true);setError('');
   try{
    const params=new URLSearchParams({vehicleId:vehicle.id,bufferKm:'25',addonOrderIds:added.join(',')});
    const next=await api<AddonResult>('/orders/'+main.id+'/addons?'+params,{signal:controller.signal});
    if(request===sequence.current)setMatches(next);
   }catch(error){if(!controller.signal.aborted&&request===sequence.current)setError(error instanceof Error?error.message:'Could not calculate the route.');}
   finally{if(request===sequence.current)setLoading(false);}
  }
  void calculate();return()=>{controller.abort();};
 },[main.id,vehicle.id,added,revision]);
 const plan=matches?.trip;
 const calculated=Boolean(plan&&plan.orders.length===added.length+1&&plan.orders.slice(1).every((order,index)=>order.id===added[index]));
 const ready=calculated&&!loading&&!error;
 const revenue=plan?.totalRevenue??main.priceEur;
 function add(item:Suggestion){if(!ready||saving||saved||added.length>=4)return;setLoading(true);setAdded(current=>current.length<4&&!current.includes(item.order.id)?[...current,item.order.id]:current);}
 function remove(id:string){if(saving||saved)return;setLoading(true);setAdded(current=>current.filter(item=>item!==id));}
 async function save(){
  if(!ready)return;setSaving(true);setError('');
  try{const result=await api<{trip:CreatedTrip}>('/trips',{method:'POST',body:JSON.stringify({vehicleId:vehicle.id,mainOrderId:main.id,addonOrderIds:added})});setSaved(result.trip);}
  catch(error){setError(error instanceof Error?error.message:'Could not save this trip.');}
  finally{setSaving(false);}
 }
 return <>
  <section className="builder-hero"><div className="builder-top"><Link href="/find" className="back-link"><ArrowLeft size={17}/>Back to routes</Link><span>{vehicle.name}</span></div><div className="builder-summary"><div><p className="hero-meta">{main.pickupAddress} → {main.deliveryAddress}</p><strong>{revenue===null?'Value unknown':euro(revenue)}</strong><p>{added.length?added.length+' add-on '+(added.length===1?'load':'loads'):'Main load selected'}</p></div></div></section>
  <section className="content-sheet builder-sheet">
   <div className="route-metrics" aria-live="polite" aria-busy={loading}><div><span>Total distance</span><strong>{plan?number(plan.totalKm)+' km':'Calculating…'}</strong></div><div><span>Detour</span><strong>{plan?'+'+number(plan.detourKm)+' km':'—'}</strong></div><div><span>Estimated finish</span><strong>{plan?dateTime(plan.endAt):'—'}</strong></div></div>
   <div className="load-gauges"><Gauge label="Payload" value={plan?.loadPctKg??null} unknownLabel="Calculating…"/><Gauge label="Cargo space" value={plan?.loadPctM3??null} unknownLabel={plan?'Volume unknown':'Calculating…'}/></div>
   {plan&&<RouteMap trip={plan} mainOrderId={main.id}/>}
   {error&&<div className="builder-error" role="alert"><p>{error}</p><button type="button" onClick={()=>setRevision(current=>current+1)} disabled={loading||saving}>Recalculate route</button></div>}
   {added.length>0&&<section className="selected-loads" aria-label="In your trip"><header><h2>In your trip</h2><span>{added.length} / 4 add-ons</span></header>{added.map(id=>{const order=plan?.orders.find(order=>order.id===id)??matches?.suggestions.find(item=>item.order.id===id)?.order;return <article className="selected-load" key={id}><div><strong>{order?.priceEur==null?'Selected load':euro(order.priceEur)}</strong><p>{order?routeName(order):'Calculating selected load…'}</p></div><button type="button" aria-label={'Remove '+(order?routeName(order):'selected load')} onClick={()=>remove(id)} disabled={saving||Boolean(saved)}><X size={18}/>Remove</button></article>;})}</section>}
   <div className="builder-heading"><div><p className="section-label">ALONG THE WAY</p><h1>{added.length===4?'Trip is full':'Add freight that fits'}</h1><p>{loading?'Recalculating route, capacity and time windows…':matches?.updatedAt?updatedText(matches.updatedAt):'Choose loads along your route.'}</p></div><span>{added.length} / 4 added</span></div>
   {loading&&<div className="skeleton-list builder-skeleton" aria-label="Calculating add-ons"><i/><i/></div>}
   {!loading&&ready&&added.length<4&&matches?.suggestions.length===0&&!matches.partial&&<div className="builder-empty"><h2>No fitting add-ons right now</h2><p>You can save this route or remove a selected load to see other options.</p></div>}
   {!loading&&ready&&added.length<4&&<div className="addon-list">{matches?.suggestions.map(item=><Addon key={item.order.id} item={item} disabled={saving||Boolean(saved)} onAdd={()=>add(item)}/>)}</div>}
   {matches?.partial&&!loading&&<div className="partial-note"><p>The search is incomplete. Recalculate to check for more loads.</p><button type="button" onClick={()=>setRevision(current=>current+1)} disabled={saving}>Check again</button></div>}
   {!loading&&ready&&<details className="rejected-loads"><summary>Show orders that don’t fit{matches?.rejected.length?' ('+matches.rejected.length+')':''}</summary>{matches?.rejected.length?matches.rejected.map(item=><article key={item.order.id}><div><strong>{routeName(item.order)}</strong><p>{item.order.priceEur===null?'Price unknown':euro(item.order.priceEur)}</p></div><span>{reasons[item.reason]}</span></article>):<p>No rejected orders in the current route corridor.</p>}</details>}
   {plan&&<RouteStops plan={plan}/>}
   <div className="builder-footer"><div><span>{saved?'Trip saved':loading?'Recalculating…':'Total route value'}</span><strong>{revenue===null?'Unknown':euro(revenue)}</strong><small>{plan?number(plan.totalKm)+' km · '+number(plan.loadPctKg)+'% peak payload':'Route calculation pending'}</small></div>{saved?<Button onClick={()=>router.push('/trips/'+saved.id)}>View trip</Button>:<Button onClick={save} disabled={!ready||saving}>{saving?'Saving…':'Save trip'}</Button>}</div>
  </section>
 </>;
}
function Gauge({label,value,unknownLabel}:{label:string;value:number|null;unknownLabel:string}){
 const filled=value===null?0:Math.ceil(Math.max(0,Math.min(100,value))/10);
 return <div className={value!==null&&value>85?'load-gauge warn':'load-gauge'}><div><span>{label}</span><strong>{value===null?unknownLabel:Math.round(value)+'%'}</strong></div><ol aria-label={label+': '+(value===null?unknownLabel:Math.round(value)+' percent')} aria-busy={value===null&&unknownLabel==='Calculating…'}>{Array.from({length:10},(_,index)=><li key={index} className={index<filled?'filled':''}/>)}</ol></div>;
}
function Addon({item,disabled,onAdd}:{item:Suggestion;disabled:boolean;onAdd:()=>void}){
 return <article className="addon-row"><div className={'addon-branch '+item.fit} aria-hidden="true"><i/><b/></div><div className="addon-copy"><strong>+{euro(item.addedRevenue)}</strong><h2>{routeName(item.order)}</h2><p>+{number(item.detourKm)} km · {Math.round(item.loadPctKg)}% payload · {item.fit==='green'?'Fits comfortably':'Tight fit'}{item.loadPctM3===null?' · Volume unknown':''}</p><p className="addon-time">Pickup {dateTime(item.order.pickupFrom)} · Ends {dateTime(item.newEndTime)}</p></div><button type="button" onClick={onAdd} disabled={disabled} aria-label={'Add '+routeName(item.order)}><Plus size={20}/></button></article>;
}
function routeName(order:MatchOrder){return (order.pickupAddress??'Pickup')+' → '+(order.deliveryAddress??'Delivery');}
function dateTime(value:string){return new Intl.DateTimeFormat('en-GB',{weekday:'short',day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(value));}
