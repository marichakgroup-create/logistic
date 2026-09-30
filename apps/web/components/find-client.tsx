'use client';
import {useEffect,useState,type FormEvent} from 'react';
import {ArrowRight,CalendarDays,PackageOpen} from 'lucide-react';
import type {Location,OrderCard,SearchResult,Vehicle} from '@loadlink/core';
import {api} from '../lib/api';
import {euro,euroRate,flag,number,tomorrow,updatedText} from '../lib/format';
import {Button} from './ui/button';
import {Card} from './ui/card';
import {Input} from './ui/input';
import {Select} from './ui/select';

type Sort='rate'|'price'|'pickup';
export function FindClient({vehicle}:{vehicle:Vehicle}){
 const [from,setFrom]=useState('Berlin');const [to,setTo]=useState('Warsaw');
 const [date,setDate]=useState(tomorrow());const [sort,setSort]=useState<Sort>('rate');
 const [result,setResult]=useState<SearchResult|null>(null);const [error,setError]=useState('');
 const [loading,setLoading]=useState(false);const [locations,setLocations]=useState<Location[]>([]);
 async function load(selectedSort:Sort){setLoading(true);setError('');try{const params=new URLSearchParams({from,to,date,vehicleId:vehicle.id,sort:selectedSort});setResult(await api<SearchResult>(`/orders?${params}`));}catch(error){setError(error instanceof Error?error.message:'Could not load orders.');}finally{setLoading(false);}}
 async function search(event:FormEvent){event.preventDefault();await load(sort);}
 useEffect(()=>{void load('rate');},[]);
 async function suggest(value:string){if(value.length<1){setLocations([]);return;}try{setLocations((await api<{locations:Location[]}>(`/locations?q=${encodeURIComponent(value)}`)).locations);}catch{setLocations([]);}}
 return <>
  <section className="screen-hero find-hero">
   <p className="hero-meta">{result?updatedText(result.updatedAt):'READY TO SEARCH'}</p><h1>Where to?</h1>
   <form className="route-form" onSubmit={search}>
    <div className="route-form-line" aria-hidden="true"><i/><b/><i/></div>
    <div className="route-inputs">
     <label htmlFor="from"><span>From</span><Input id="from" list="locations" value={from} onChange={event=>{setFrom(event.target.value);void suggest(event.target.value);}} required/></label>
     <label htmlFor="to"><span>To</span><Input id="to" list="locations" value={to} onChange={event=>{setTo(event.target.value);void suggest(event.target.value);}} required/></label>
    </div>
    <datalist id="locations">{locations.map(location=><option key={`${location.country}-${location.name}`} value={location.name}>{flag(location.country)} {location.name}</option>)}</datalist>
    <label className="date-control" htmlFor="date"><CalendarDays size={17}/><span>Date</span><Input id="date" type="date" value={date} onChange={event=>setDate(event.target.value)} required/></label>
    <Button type="submit" disabled={loading} className="search-button">{loading?'Finding…':'Find routes'}<ArrowRight size={20}/></Button>
   </form>
  </section>
  <section className="content-sheet">
   {error&&<p className="error-message" role="alert">{error}</p>}
   {loading&&!result&&<div className="skeleton-list" aria-label="Loading orders"><i/><i/><i/></div>}
   {result&&<section className="results" aria-live="polite">
    <div className="results-head"><div><p className="section-label">ROUTES FOUND</p><h2>{result.orders.length} options</h2></div><label className="sort-label" htmlFor="sort"><span className="sr-only">Sort</span><Select id="sort" value={sort} onChange={event=>{const next=event.target.value as Sort;setSort(next);void load(next);}}><option value="rate">Best value</option><option value="price">Highest price</option><option value="pickup">Pickup time</option></Select></label></div>
    {result.orders.length===0?<Card className="empty-state"><PackageOpen size={30}/><h2>No fitting routes yet</h2><p>Try another route or date.</p></Card>:<div className="order-list">{result.orders.map((order,index)=><Order key={order.id} order={order} featured={index===0}/>)}</div>}
   </section>}
  </section>
 </>;
}
function Order({order,featured}:{order:OrderCard;featured:boolean}){
 const rate=order.priceEur!==null&&order.distanceKm?order.priceEur/order.distanceKm:null;
 return <Card className={featured?'order-card featured':'order-card'}>
  <div className="order-main"><div className="mini-route" aria-hidden="true"><i/><b/><i/></div><div className="order-cities"><h3><span className="country-code">{order.pickupCountry??'—'}</span>{order.pickupAddress}</h3><h3><span className="country-code">{order.deliveryCountry??'—'}</span>{order.deliveryAddress}</h3></div><div className="order-price"><strong>{order.priceEur===null?'—':euro(order.priceEur)}</strong><span>{rate===null?'Rate unknown':`${euroRate(rate)}/km`}</span></div></div>
  <div className="order-data"><span>{order.distanceKm===null?'Distance unknown':`${number(order.distanceKm)} km`}</span><span>{number(order.weightKg)} kg</span><span>{order.volumeM3===null?'Volume unknown':`${number(order.volumeM3)} m³`}</span></div>
  <div className="order-status"><i/>Fits your van · {new Intl.DateTimeFormat('en-GB',{weekday:'short',day:'numeric',month:'short'}).format(new Date(order.pickupFrom))}</div>
 </Card>;
}
