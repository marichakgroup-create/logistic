'use client';
import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useEffect,useMemo,useState} from 'react';
import {ArrowLeft,Check,Plus} from 'lucide-react';
import type {AddonResult,CreatedTrip,OrderCard,Suggestion,Vehicle} from '@loadlink/core';
import {api} from '../lib/api';
import {euro,number} from '../lib/format';
import {Button} from './ui/button';

function clamp(value:number){return Math.max(0,Math.min(100,value));}
export function BuilderClient({main,vehicle}:{main:OrderCard;vehicle:Vehicle}){
 const router=useRouter();
 const [matches,setMatches]=useState<AddonResult|null>(null);const [added,setAdded]=useState<string[]>([]);const [error,setError]=useState('');
 const [saving,setSaving]=useState(false);const [saved,setSaved]=useState<CreatedTrip|null>(null);
 useEffect(()=>{const params=new URLSearchParams({vehicleId:vehicle.id,bufferKm:'25'});api<AddonResult>('/orders/'+main.id+'/addons?'+params).then(setMatches).catch(error=>setError(error instanceof Error?error.message:'Could not calculate add-ons.'));},[main.id,vehicle.id]);
 const selected=useMemo(()=>matches?.suggestions.filter(item=>added.includes(item.order.id))??[],[matches,added]);
 const revenue=(main.priceEur??0)+selected.reduce((sum,item)=>sum+item.addedRevenue,0);
 const kg=main.weightKg+selected.reduce((sum,item)=>sum+(item.order.weightKg??0),0);
 const knownVolumes=[main.volumeM3,...selected.map(item=>item.order.volumeM3)].filter((value):value is number=>value!==null);
 const volumeUnknown=knownVolumes.length!==selected.length+1;const volume=knownVolumes.reduce((sum,value)=>sum+value,0);
 const kgPct=clamp(kg/vehicle.payloadKg*100),volumePct=clamp(volume/vehicle.cargoM3*100);
 function toggle(item:Suggestion){setAdded(current=>current.includes(item.order.id)?current.filter(id=>id!==item.order.id):current.length<4?[...current,item.order.id]:current);}
 async function save(){setSaving(true);setError('');try{const result=await api<{trip:CreatedTrip}>('/trips',{method:'POST',body:JSON.stringify({vehicleId:vehicle.id,mainOrderId:main.id,addonOrderIds:added})});setSaved(result.trip);}catch(error){setError(error instanceof Error?error.message:'Could not save this trip.');}finally{setSaving(false);}}
 return <>
  <section className="builder-hero">
   <div className="builder-top"><Link href="/find" className="back-link"><ArrowLeft size={17}/>Back to routes</Link><span>STEP 2 OF 3</span></div>
   <div className="builder-summary"><div><p className="hero-meta">{main.pickupAddress} → {main.deliveryAddress}</p><strong>{euro(revenue)}</strong><p>{selected.length?'+'+euro(selected.reduce((sum,item)=>sum+item.addedRevenue,0))+' from add-ons':'Main load selected'}</p></div><div className="builder-route" aria-hidden="true"><i/><b/><em/></div></div>
  </section>
  <section className="content-sheet builder-sheet">
   <div className="load-gauges"><Gauge label="KG" value={kgPct}/><Gauge label="M³" value={volumePct} unknown={volumeUnknown}/></div>
   <div className="builder-heading"><div><p className="section-label">ALONG THE WAY</p><h1>Add freight that fits</h1><p>We checked capacity, direction, time windows and detour.</p></div><span>{added.length} / 4 added</span></div>
   {error&&<p className="error-message" role="alert">{error}</p>}
   {!matches&&!error&&<div className="builder-loading"><i/><span>Checking the route…</span></div>}
   {matches&&matches.suggestions.length===0&&<div className="builder-empty"><h2>No safe add-ons right now</h2><p>Your main load is still ready. Try another route or check again after the next order update.</p></div>}
   {matches&&matches.suggestions.length>0&&<div className="addon-list">{matches.suggestions.map(item=><Addon key={item.order.id} item={item} active={added.includes(item.order.id)} disabled={!added.includes(item.order.id)&&added.length>=4} onToggle={()=>toggle(item)}/>)}</div>}
   {matches?.partial&&<p className="partial-note">More orders are still being checked. These results are safe to use now.</p>}
   <div className="builder-footer"><div><span>{saved?'TRIP SAVED':'Total route value'}</span><strong>{euro(revenue)}</strong><small>{saved?'Your planned trip is ready.':number(main.distanceKm??0)+' km main route · '+number(kg)+' kg loaded'}</small></div>{saved?<Button onClick={()=>router.push('/trips/'+saved.id)}>View trip</Button>:<Button onClick={save} disabled={!matches||saving}>{saving?'Saving…':'Save trip'}</Button>}</div>
  </section>
 </>;
}
function Gauge({label,value,unknown=false}:{label:string;value:number;unknown?:boolean}){
 const filled=Math.ceil(value/10);const warn=value>85;
 return <div className={warn?'load-gauge warn':'load-gauge'}><div><span>{label}</span><strong>{unknown?'Known ':''}{Math.round(value)}%</strong></div><ol aria-label={label+' capacity '+Math.round(value)+' percent'}>{Array.from({length:10},(_,index)=><li key={index} className={index<filled?'filled':''}/>)}</ol></div>;
}
function Addon({item,active,disabled,onToggle}:{item:Suggestion;active:boolean;disabled:boolean;onToggle:()=>void}){
 return <article className={active?'addon-row active':'addon-row'}><div className="addon-branch" aria-hidden="true"><i/><b/></div><div className="addon-copy"><strong>+{euro(item.addedRevenue)}</strong><h2>{item.order.pickupAddress??'Pickup'} → {item.order.deliveryAddress??'Delivery'}</h2><p>+{number(item.detourKm)} km · fits {Math.round(Math.max(item.loadPctKg,item.loadPctM3??0))}%</p></div><button type="button" onClick={onToggle} disabled={disabled} aria-label={active?'Remove add-on':'Add freight'} aria-pressed={active}>{active?<Check size={22}/>:<Plus size={22}/>}</button></article>;
}
