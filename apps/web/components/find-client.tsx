'use client';
import { useEffect, useState, type FormEvent } from 'react';
import { ArrowRight, CalendarDays, ChevronDown, MapPin, PackageOpen, Route } from 'lucide-react';
import type { Location, OrderCard, SearchResult, Vehicle } from '@loadlink/core';
import { api } from '../lib/api';
import { euro, euroRate, flag, number, tomorrow, updatedText } from '../lib/format';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Input } from './ui/input';

type Sort='rate'|'price'|'pickup';
export function FindClient({vehicle}:{vehicle:Vehicle}) {
  const [from,setFrom]=useState('Berlin'); const [to,setTo]=useState('Warsaw');
  const [date,setDate]=useState(tomorrow()); const [sort,setSort]=useState<Sort>('rate');
  const [result,setResult]=useState<SearchResult|null>(null); const [error,setError]=useState('');
  const [loading,setLoading]=useState(false); const [locations,setLocations]=useState<Location[]>([]);
  async function load(selectedSort:Sort) {
    setLoading(true);setError('');
    try {const params=new URLSearchParams({from,to,date,vehicleId:vehicle.id,sort:selectedSort});setResult(await api<SearchResult>(`/orders?${params}`));}
    catch(error){setError(error instanceof Error?error.message:'Could not load orders.');}
    finally{setLoading(false);}
  }
  async function search(event:FormEvent) { event.preventDefault(); await load(sort); }
  useEffect(()=>{void load('rate');},[]); // Initial useful result; later changes are explicit.
  async function suggest(value:string) {
    if(value.length<1){setLocations([]);return;}
    try{setLocations((await api<{locations:Location[]}>(`/locations?q=${encodeURIComponent(value)}`)).locations);}catch{setLocations([]);}
  }
  return <>
    <section className="page-intro"><p className="eyebrow">FIND YOUR MAIN LOAD</p><h1>Where are you heading?</h1><p>Start with one route. We’ll find what fits your van.</p></section>
    <Card className="search-card"><form onSubmit={search}>
      <div className="route-fields"><label htmlFor="from"><span>From</span><div className="input-icon"><MapPin size={18}/><Input id="from" list="locations" value={from} onChange={e=>{setFrom(e.target.value);void suggest(e.target.value);}} required/></div></label><span className="route-arrow"><ArrowRight size={20}/></span><label htmlFor="to"><span>To</span><div className="input-icon"><MapPin size={18}/><Input id="to" list="locations" value={to} onChange={e=>{setTo(e.target.value);void suggest(e.target.value);}} required/></div></label></div>
      <datalist id="locations">{locations.map(location=><option key={`${location.country}-${location.name}`} value={location.name}>{flag(location.country)} {location.name}</option>)}</datalist>
      <label htmlFor="date"><span>Date</span><div className="input-icon"><CalendarDays size={18}/><Input id="date" type="date" value={date} onChange={e=>setDate(e.target.value)} required/></div></label>
      <Button type="submit" disabled={loading} className="search-button">{loading?'Finding…':'Find orders'}<ArrowRight size={18}/></Button>
    </form></Card>
    {error&&<p className="error-message" role="alert">{error}</p>}
    {loading&&!result&&<div className="skeleton-list" aria-label="Loading orders"><i/><i/><i/></div>}
      {result&&<section className="results" aria-live="polite"><div className="results-head"><div><h2>{result.orders.length} routes</h2><p>{updatedText(result.updatedAt)}</p></div><label className="sort-label" htmlFor="sort">Sort<span className="select-wrap"><select id="sort" value={sort} onChange={e=>{const next=e.target.value as Sort;setSort(next);void load(next);}}><option value="rate">€/km</option><option value="price">Price</option><option value="pickup">Pickup</option></select><ChevronDown size={15}/></span></label></div>
      {result.orders.length===0?<Card className="empty-state"><PackageOpen size={30}/><h2>No fitting orders yet</h2><p>Try another route or date.</p></Card>:<div className="order-list">{result.orders.map(order=><Order key={order.id} order={order}/>)}</div>}
    </section>}
  </>;
}
function Order({order}:{order:OrderCard}) {
  const rate=order.priceEur!==null&&order.distanceKm?order.priceEur/order.distanceKm:null;
  return <Card className="order-card"><div className="order-route"><span className="route-mark"><Route size={20}/></span><div><h3>{flag(order.pickupCountry)} {order.pickupAddress} <span>→</span> {flag(order.deliveryCountry)} {order.deliveryAddress}</h3><p>{new Intl.DateTimeFormat('en-GB',{weekday:'short',day:'numeric',month:'short'}).format(new Date(order.pickupFrom))}</p></div><span className="fit-badge">Fits your van</span></div><div className="order-numbers"><strong>{order.priceEur===null?'Price unknown':euro(order.priceEur)}</strong><span>{order.distanceKm===null?'Distance unknown':`${number(order.distanceKm)} km`}</span><span>{rate===null?'Rate unknown':`${euroRate(rate)}/km`}</span></div><div className="order-cargo"><span>{number(order.weightKg)} kg</span><span>{order.volumeM3===null?'Volume unknown':`${number(order.volumeM3)} m³`}</span>{order.dimensionsUnknown&&<span>Dimensions unknown</span>}</div></Card>;
}
