import type { Metadata } from 'next';
import type { SessionUser, Vehicle } from '@loadlink/core';
import { VehicleForm } from '../../../components/vehicle-form';
import { LogoutButton } from '../../../components/logout-button';
import { Card } from '../../../components/ui/card';
import { serverApi } from '../../../lib/server-api';
export const metadata: Metadata={title:'Account'};
export default async function AccountPage(){const [{user},{vehicles}]=await Promise.all([serverApi<{user:SessionUser}>('/auth/me'),serverApi<{vehicles:Vehicle[]}>('/vehicles')]);return <><section className="page-intro"><h1>Account</h1><p>Your vehicle, workspace and plan.</p></section><section className="content-sheet account-sheet"><div className="account-workspace"><nav className="settings-menu" aria-label="Account sections"><a href="#vehicle">Vehicle</a><a href="#plan">Plan</a><a href="#session">Workspace</a></nav><div className="settings-content"><Card id="vehicle" className="account-card"><div className="settings-heading"><h2>Your vehicle</h2><p>Capacity is used to find freight that fits safely.</p></div>{vehicles[0]?<VehicleForm initial={vehicles[0]}/>:<p>Add your van to begin.</p>}</Card><Card id="plan" className="account-row"><div><h2>Plan</h2><p>{user.plan==='trial'?'14-day free trial':'Standard plan'}</p></div><span className="status-pill">● {user.planStatus==='active'?'Active':user.planStatus.replace('_',' ')}</span></Card><Card id="session" className="account-row"><div><h2>Workspace</h2><p>{user.email}</p></div><LogoutButton/></Card></div></div></section></>}
