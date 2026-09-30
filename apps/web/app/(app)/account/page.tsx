import type { Metadata } from 'next';
import type { SessionUser, Vehicle } from '@loadlink/core';
import { VehicleForm } from '../../../components/vehicle-form';
import { LogoutButton } from '../../../components/logout-button';
import { Card } from '../../../components/ui/card';
import { serverApi } from '../../../lib/server-api';
export const metadata: Metadata={title:'Account'};
export default async function AccountPage(){const [{user},{vehicles}]=await Promise.all([serverApi<{user:SessionUser}>('/auth/me'),serverApi<{vehicles:Vehicle[]}>('/vehicles')]);return <><section className="page-intro"><p className="eyebrow">ACCOUNT</p><h1>Your setup</h1><p>{user.email}</p></section><section className="content-sheet account-sheet"><Card className="account-card"><h2>Vehicle</h2>{vehicles[0]?<VehicleForm initial={vehicles[0]}/>:<p>Add your van to begin.</p>}</Card><Card className="account-row"><div><h2>Plan</h2><p>{user.plan==='trial'?'14-day free trial':'Standard plan'}</p></div><span className="status-pill">● {user.planStatus==='active'?'Active':user.planStatus.replace('_',' ')}</span></Card><div className="logout-row"><LogoutButton/></div></section></>}
