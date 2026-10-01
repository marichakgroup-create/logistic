import type {Metadata} from 'next';
import type {Vehicle,MyOrder} from '@loadlink/core';
import Link from 'next/link';
import {redirect} from 'next/navigation';
import {FindClient} from '../../../components/find-client';
import {MyOrders} from '../../../components/my-orders';
import {serverApi} from '../../../lib/server-api';
export const metadata:Metadata={title:'Orders'};
export default async function FindPage({searchParams}:{searchParams:Promise<{welcome?:string;view?:string}>}){
 const [data,query]=await Promise.all([serverApi<{vehicles:Vehicle[]}>('/vehicles'),searchParams]);
 if(!data.vehicles[0])redirect('/onboarding');
 const mine=query.view==='mine';
 const saved=mine?await serverApi<{orders:MyOrder[]}>('/my-orders'):null;
 return <><nav className="order-tabs" aria-label="Orders"><Link href="/find" aria-current={!mine?'page':undefined}>Available</Link><Link href="/find?view=mine" aria-current={mine?'page':undefined}>My orders</Link></nav>{mine?<MyOrders orders={saved!.orders}/>:<FindClient vehicle={data.vehicles[0]} welcome={query.welcome==='1'}/>}</>;
}
