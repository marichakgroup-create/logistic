'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { LogOut } from 'lucide-react';
import { api } from '../lib/api';
import { Button } from './ui/button';
export function LogoutButton(){const router=useRouter();const[busy,setBusy]=useState(false);return <Button variant="ghost" disabled={busy} onClick={async()=>{setBusy(true);try{await api('/auth/logout',{method:'POST'});router.replace('/login');router.refresh();}finally{setBusy(false);}}}><LogOut size={18}/>{busy?'Signing out…':'Log out'}</Button>;}
