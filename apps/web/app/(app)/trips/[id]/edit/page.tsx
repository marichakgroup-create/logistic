import type {TripDetail,Vehicle,OrderCard} from '@loadlink/core';
import Link from 'next/link';
import {serverApi} from '../../../../../lib/server-api';
import {BuilderClient} from '../../../../../components/builder-client';
export const metadata={title:'Find add-ons'};
export default async function EditTrip({params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 const [{trip},{vehicles}]=await Promise.all([serverApi<{trip:TripDetail}>('/trips/'+id),serverApi<{vehicles:Vehicle[]}>('/vehicles')]);
 const vehicle=vehicles.find(value=>value.id===trip.vehicleId);
 const main=trip.routePlan?.orders.find(order=>order.id===trip.orders.find(value=>value.role==='main')?.orderId);
 if(!vehicle||!main||main.weightKg===null||!['planned','booked'].includes(trip.status)||Date.parse(trip.startAt)<=Date.now())return <section className="page-intro"><h1>This trip cannot be edited</h1><p>Load changes are available before planned departure. Completed trips keep their saved route.</p><Link href={'/trips/'+id}>Back to trip</Link></section>;
 const card:OrderCard={id:main.id,pickupAddress:main.pickupAddress??'Pickup',deliveryAddress:main.deliveryAddress??'Delivery',pickupCountry:null,deliveryCountry:null,pickupFrom:main.pickupFrom,pickupTo:main.pickupTo,deliveryFrom:main.deliveryFrom,deliveryTo:main.deliveryTo,weightKg:main.weightKg,volumeM3:main.volumeM3,priceEur:main.priceEur,distanceKm:null,syncedAt:trip.startAt,dimensionsUnknown:false};
 return <BuilderClient main={card} vehicle={vehicle} editing={trip}/>;
}
