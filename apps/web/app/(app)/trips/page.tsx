import type {Metadata} from 'next';
import type {TripListItem} from '@loadlink/core';
import {TripsClient} from '../../../components/trips-client';
import {serverApi} from '../../../lib/server-api';

export const metadata:Metadata={title:'Trips'};
type TripStatus=TripListItem['status'];
const visibleStatuses:TripStatus[]=['planned','booked','done'];

export default async function TripsPage({searchParams}:{searchParams:Promise<{status?:string}>}){
 const query=await searchParams;
 const status=visibleStatuses.includes(query.status as TripStatus)?query.status as TripStatus:'planned';
 const data=await serverApi<{trips:TripListItem[]}>('/trips');
 return <TripsClient key={status} initial={data.trips} status={status}/>;
}
