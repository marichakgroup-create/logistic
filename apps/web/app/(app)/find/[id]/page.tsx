import type {Metadata} from 'next';
import type {OrderCard,Vehicle} from '@loadlink/core';
import {redirect} from 'next/navigation';
import {BuilderClient} from '../../../../components/builder-client';
import {serverApi} from '../../../../lib/server-api';

export const metadata:Metadata={title:'Build trip'};
export default async function BuilderPage({params}:{params:Promise<{id:string}>}){
 const {id}=await params;const data=await serverApi<{vehicles:Vehicle[]}>('/vehicles');const vehicle=data.vehicles[0];
 if(!vehicle)redirect('/onboarding');
 const {order}=await serverApi<{order:OrderCard}>(`/orders/${id}?vehicleId=${vehicle.id}`);
 return <BuilderClient main={order} vehicle={vehicle}/>;
}
