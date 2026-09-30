'use client';
import Link from 'next/link';
import {ArrowLeft,ArrowUpRight,Check} from 'lucide-react';
import {useState} from 'react';
import type {TripDetail,TripOrderItem} from '@loadlink/core';
import {api} from '../lib/api';
import {euro,number} from '../lib/format';

export function TripDetailClient({initial}:{initial:TripDetail}){
 const [trip,setTrip]=useState(initial);const [busy,setBusy]=useState('');const [error,setError]=useState('');
 async function mark(order:TripOrderItem,status:'booked'|'dropped'){setBusy(order.tripOrderId);setError('');try{setTrip((await api<{trip:TripDetail}>('/trip-orders/'+order.tripOrderId,{method:'PATCH',body:JSON.stringify({status})})).trip);}catch(error){setError(error instanceof Error?error.message:'Could not update booking.');}finally{setBusy('');}}
 const main=trip.orders.find(order=>order.role==='main')??trip.orders[0];
 return <>
  <section className="trip-hero"><div className="builder-top"><Link href="/trips" className="back-link"><ArrowLeft size={17}/>All trips</Link><span className={'plain-status '+trip.status}><i/>{trip.status}</span></div><div className="trip-head"><div><p className="hero-meta">{main.pickupAddress} → {main.deliveryAddress}</p><strong>{euro(trip.totalRevenue)}</strong><p>{trip.vehicleName} · {trip.totalKm===null?'Distance pending':number(trip.totalKm)+' km'}</p></div><div><span>DETOUR</span><strong>+{number(trip.detourKm)} km</strong></div></div></section>
  <section className="content-sheet trip-sheet"><div className="trip-title"><div><p className="section-label">STEP 3 · BOOK YOUR LOADS</p><h1>Trip plan</h1><p>Open each load on trans.eu, book it there, then mark it here.</p></div><span>{trip.orders.filter(order=>order.status==='booked').length} / {trip.orders.length} booked</span></div>{error&&<p className="error-message">{error}</p>}
   <div className="trip-timeline">{trip.orders.map((order,index)=><OrderStop key={order.tripOrderId} order={order} last={index===trip.orders.length-1} busy={busy===order.tripOrderId} onMark={()=>mark(order,'booked')}/>)}</div>
   {main&&<a className="button button-primary trip-primary" href={main.transEuUrl} target="_blank" rel="noreferrer">Open main load on trans.eu <ArrowUpRight size={19}/></a>}
  </section>
 </>;
}
function OrderStop({order,last,busy,onMark}:{order:TripOrderItem;last:boolean;busy:boolean;onMark:()=>void}){
 return <article className={order.status==='booked'?'trip-stop booked':'trip-stop'}><div className="stop-line" aria-hidden="true"><i/>{!last&&<b/>}</div><div className="stop-copy"><div><span>{order.role==='main'?'MAIN LOAD':'ADD-ON'}</span><span className={'plain-status '+order.status}><i/>{order.status}</span></div><h2>{order.pickupAddress} → {order.deliveryAddress}</h2><p>{new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(new Date(order.pickupFrom))} · {order.weightKg===null?'Weight unknown':number(order.weightKg)+' kg'}</p><a href={order.transEuUrl} target="_blank" rel="noreferrer">Open on trans.eu <ArrowUpRight size={14}/></a></div>{order.status==='booked'?<span className="booked-check"><Check size={18}/></span>:<button type="button" onClick={onMark} disabled={busy}>{busy?'Saving…':'Mark booked'}</button>}</article>;
}
