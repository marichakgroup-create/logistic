import type {Metadata} from 'next';
import type {TripDetail} from '@loadlink/core';
import {TripDetailClient} from '../../../../components/trip-detail-client';
import {serverApi} from '../../../../lib/server-api';

export const metadata:Metadata={title:'Trip'};
export default async function TripPage({params}:{params:Promise<{id:string}>}){const {id}=await params;const {trip}=await serverApi<{trip:TripDetail}>('/trips/'+id);return <TripDetailClient initial={trip}/>;}
