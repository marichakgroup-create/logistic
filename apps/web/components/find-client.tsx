'use client';
import {useEffect,useRef,useState,type FormEvent} from 'react';
import {ArrowRight,PackageOpen} from 'lucide-react';
import Link from 'next/link';
import type {OrderCard,SearchResult,Vehicle} from '@loadlink/core';
import {api} from '../lib/api';
import {euro,euroRate,number,tomorrow,updatedText} from '../lib/format';
import {Button} from './ui/button';
import {Card} from './ui/card';
import {LocationInput} from './ui/location-input';
import {Select} from './ui/select';
import {DatePicker} from './ui/date-picker';

type Sort='rate'|'price'|'pickup';
export function FindClient({vehicle,welcome=false}:{vehicle:Vehicle;welcome?:boolean}){
 const [from,setFrom]=useState('Berlin');const [to,setTo]=useState('Warsaw');
 const [date,setDate]=useState(tomorrow());const [sort,setSort]=useState<Sort>('rate');
 const [result,setResult]=useState<SearchResult|null>(null);const [error,setError]=useState('');
 const [loading,setLoading]=useState(false);
 const requestSequence=useRef(0);
 const [activeSearch,setActiveSearch]=useState({from,to,date,sort});
 async function load(selectedSort:Sort,cursor?:string){const request=++requestSequence.current;setLoading(true);setError('');const search=cursor?activeSearch:{from,to,date,sort:selectedSort};try{const params=new URLSearchParams({...search,vehicleId:vehicle.id});if(cursor)params.set('cursor',cursor);const next=await api<SearchResult>(`/orders?${params}`);if(request!==requestSequence.current)return;setActiveSearch(search);setResult(current=>cursor&&current?{...next,orders:[...current.orders,...next.orders]}:next);}catch(error){if(request===requestSequence.current)setError(error instanceof Error?error.message:'Could not load orders.');}finally{if(request===requestSequence.current)setLoading(false);}}
 async function search(event:FormEvent){event.preventDefault();await load(sort);}
 useEffect(()=>{void load('rate');},[]);
 return <>
  <section className="screen-hero find-hero">
   <div className="find-title-row"><h1>{welcome?'Your van is ready.':'Find freight'}</h1><p className="hero-meta">{result?updatedText(result.updatedAt):'READY TO SEARCH'}</p></div>
   <p className="find-guidance">{welcome?'Start with a route you already plan to drive.':'Search your planned route, then choose the main load.'}</p>
   <form className="route-form" onSubmit={search}>
    <div className="route-form-line" aria-hidden="true"><i/><b/><i/></div>
    <div className="route-inputs">
     <label htmlFor="from"><span>From</span><LocationInput id="from" value={from} onChange={setFrom}/></label>
     <label htmlFor="to"><span>To</span><LocationInput id="to" value={to} onChange={setTo}/></label>
    </div>
    <DatePicker value={date} onChange={setDate}/>
    <Button type="submit" disabled={loading} className="search-button">{loading?'Finding…':'Find routes'}<ArrowRight size={20}/></Button>
   </form>
  </section>
  <section className="content-sheet">
   {error&&<p className="error-message" role="alert">{error}</p>}
   {loading&&!result&&<div className="skeleton-list" aria-label="Loading orders"><i/><i/><i/></div>}
   {result&&<section className="results" aria-live="polite">
    <div className="results-head"><div><h2>{result.orders.length} fitting {result.orders.length===1?'route':'routes'}</h2><p className="results-help">Choose your main load to build a trip.</p></div><label className="sort-label" htmlFor="sort"><span className="sr-only">Sort</span><Select id="sort" value={sort} onChange={next=>{setSort(next as Sort);void load(next as Sort);}} options={[{value:"rate",label:"Best value"},{value:"price",label:"Highest price"},{value:"pickup",label:"Pickup time"}]}/></label></div>
    {result.orders.length===0?<Card className="empty-state"><PackageOpen size={30}/><h2>No fitting routes yet</h2><p>Try another route or date.</p></Card>:<div className="order-list">{result.orders.map((order,index)=><Order key={order.id} order={order} featured={index===0}/>)}</div>}
    {result.nextCursor&&<button className="load-more" type="button" disabled={loading} onClick={()=>load(activeSearch.sort,result.nextCursor!)}>{loading?'Loading routes…':'Show more routes'}</button>}
   </section>}
  </section>
 </>;
}
function Order({order,featured}:{order:OrderCard;featured:boolean}){
 const rate=order.priceEur!==null&&order.distanceKm?order.priceEur/order.distanceKm:null;
 return <Link href={`/find/${order.id}`} className="order-link" aria-label={`Build a trip from ${order.pickupAddress} to ${order.deliveryAddress}`}><Card className={featured?'order-card featured':'order-card'}>
  <div className="order-main"><div className="mini-route" aria-hidden="true"><i/><b/><i/></div><div className="order-cities"><h3><span className="country-code">{order.pickupCountry??'—'}</span>{order.pickupAddress}</h3><h3><span className="country-code">{order.deliveryCountry??'—'}</span>{order.deliveryAddress}</h3></div><div className="order-price"><strong>{order.priceEur===null?'—':euro(order.priceEur)}</strong><span>{rate===null?'Rate unknown':`${euroRate(rate)}/km`}</span></div></div>
  <div className="order-data"><span>{order.distanceKm===null?'Distance unknown':`${number(order.distanceKm)} km`}</span><span>{number(order.weightKg)} kg</span><span>{order.volumeM3===null?'Volume unknown':`${number(order.volumeM3)} m³`}</span></div>
  <div className="order-windows"><span><b>Pickup</b>{windowText(order.pickupFrom,order.pickupTo)}</span><span><b>Delivery</b>{windowText(order.deliveryFrom,order.deliveryTo)}</span></div>
  <div className="order-status"><i/>Fits your van · {new Intl.DateTimeFormat('en-GB',{weekday:'short',day:'numeric',month:'short'}).format(new Date(order.pickupFrom))}</div>
  <span className="order-action">Build trip <ArrowRight size={16}/></span>
 </Card></Link>;
}

function windowText(from:string,to:string){const format=new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'});return format.format(new Date(from))+' – '+format.format(new Date(to));}
