'use client';
import Link from 'next/link';
import {ArrowRight,CalendarDays} from 'lucide-react';
import {useState,type TouchEvent} from 'react';
import type {TripListItem} from '@loadlink/core';
import {api} from '../lib/api';
import {euro,number} from '../lib/format';

const tabs=[['planned','Planned'],['booked','Booked'],['done','Done']] as const;
export function TripsClient({initial,status}:{initial:TripListItem[];status:TripListItem['status']}){
 const [trips,setTrips]=useState(initial);const [revealed,setRevealed]=useState('');const [confirming,setConfirming]=useState('');const [busy,setBusy]=useState('');const [error,setError]=useState('');const [touchStart,setTouchStart]=useState(0);
 const visible=trips.filter(trip=>trip.status===status);
 function swipeStart(event:TouchEvent){setTouchStart(event.changedTouches[0]?.clientX??0);}
 function swipeEnd(event:TouchEvent,id:string){const end=event.changedTouches[0]?.clientX??touchStart;if(touchStart-end>56)setRevealed(id);if(end-touchStart>40)setRevealed('');}
 async function cancel(id:string){setBusy(id);setError('');try{await api('/trips/'+id,{method:'PATCH',body:JSON.stringify({})});setTrips(current=>current.filter(trip=>trip.id!==id));setConfirming('');setRevealed('');}catch(error){setError(error instanceof Error?error.message:'Could not cancel this trip.');}finally{setBusy('');}}
 return <>
  <section className="page-intro trips-intro"><h1>Trips</h1><p>Keep planned work, bookings and completed routes in one clear timeline.</p></section>
  <section className="content-sheet trips-sheet">
   <div className="trips-workspace"><aside className="trip-status-panel"><p className="section-label">TRIP STATUS</p><nav className="trip-tabs" aria-label="Trip status">{tabs.map(([value,label])=><Link key={value} href={'/trips?status='+value} className={status===value?'active':''} aria-current={status===value?'page':undefined}><span><i/>{label}</span><b>{trips.filter(trip=>trip.status===value).length}</b></Link>)}</nav></aside>
   <div className="trip-workspace-main"><header className="trip-workspace-head"><div><p className="section-label">{status.toUpperCase()} TRIPS</p><h2>{status==='planned'?'Ready to organise':status==='booked'?'Confirmed work':'Completed routes'}</h2></div><span>{visible.length} {visible.length===1?'trip':'trips'}</span></header>
   {error&&<p className="error-message" role="alert">{error}</p>}
   {visible.length===0?<div className="trips-empty"><span className="empty-route" aria-hidden="true"><i/><b/><i/></span><p className="section-label">{status.toUpperCase()}</p><h2>{status==='planned'?'No trips planned yet':status==='booked'?'No booked trips yet':'No completed trips yet'}</h2><p>{status==='planned'?'Choose a main load in Find and build your first route.':'Trips will move here automatically as their status changes.'}</p>{status==='planned'&&<Link href="/find" className="button button-primary">Find a route <ArrowRight size={19}/></Link>}</div>:
   <div className="trip-list">{visible.map(trip=><article key={trip.id} className={'trip-list-row '+(revealed===trip.id?'revealed':'')} onTouchStart={swipeStart} onTouchEnd={event=>swipeEnd(event,trip.id)}>
    {trip.status==='planned'&&<button type="button" className="trip-cancel-reveal" onClick={()=>setConfirming(trip.id)} aria-label="Cancel trip">Cancel</button>}
    <div className="trip-list-card">
     <Link href={'/trips/'+trip.id} className="trip-card-link">
      <div className="trip-card-top"><span className={'plain-status '+trip.status}><i/>{trip.status}</span><strong>{euro(trip.totalRevenue)}</strong></div>
      <div className="trip-card-route"><span className="mini-route" aria-hidden="true"><i/><b/><i/></span><div><h2>{trip.pickupAddress}</h2><h2>{trip.deliveryAddress}</h2></div></div>
      <div className="trip-card-meta"><span><CalendarDays size={14}/>{formatDate(trip.startAt)}</span><span>{trip.totalKm===null?'Distance pending':number(trip.totalKm)+' km'}</span><span>{trip.orderCount} {trip.orderCount===1?'load':'loads'}</span><ArrowRight size={17}/></div>
     </Link>
     {trip.status==='planned'&&<button type="button" className="trip-cancel-text" onClick={()=>setConfirming(trip.id)}>Cancel trip</button>}
    </div>
    {confirming===trip.id&&<div className="cancel-confirm" role="alertdialog" aria-labelledby={'cancel-title-'+trip.id}><div><p className="section-label">PLEASE CONFIRM</p><h3 id={'cancel-title-'+trip.id}>Cancel this trip?</h3><p>The trip will leave Planned. Your source orders stay on trans.eu.</p></div><div><button type="button" onClick={()=>setConfirming('')}>Keep trip</button><button type="button" onClick={()=>cancel(trip.id)} disabled={busy===trip.id}>{busy===trip.id?'Cancelling…':'Cancel trip'}</button></div></div>}
   </article>)}</div>}</div></div>
  </section>
 </>;
}
function formatDate(value:string){return new Intl.DateTimeFormat('en-GB',{weekday:'short',day:'numeric',month:'short'}).format(new Date(value));}
