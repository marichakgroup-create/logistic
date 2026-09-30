import type { Metadata } from 'next';
import type { Vehicle } from '@loadlink/core';
import { redirect } from 'next/navigation';
import { FindClient } from '../../../components/find-client';
import { serverApi } from '../../../lib/server-api';
export const metadata: Metadata={title:'Find'};
export default async function FindPage(){const data=await serverApi<{vehicles:Vehicle[]}>('/vehicles');if(!data.vehicles[0])redirect('/onboarding');return <FindClient vehicle={data.vehicles[0]}/>;}
