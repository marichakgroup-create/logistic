'use client';
import {useState} from 'react';
import {usePathname} from 'next/navigation';
import {PanelLeft,ChevronRight} from 'lucide-react';
import {Brand} from './brand';
import {Navigation} from './navigation';

export function WorkspaceShell({email,children}:{email:string;children:React.ReactNode}){
 const [collapsed,setCollapsed]=useState(false);
 const pathname=usePathname();
 const area=pathname.startsWith('/trips')?'Trips':pathname.startsWith('/account')?'Account':'Find';
 const detail=pathname.startsWith('/find/')?'Build trip':pathname.startsWith('/trips/')?'Trip details':null;
 return <div className={'app-frame'+(collapsed?' sidebar-collapsed':'')}>
  <a className="skip-link" href="#workspace-content">Skip to content</a>
  <aside className="app-sidebar"><div className="sidebar-brand"><Brand/><button className="shell-icon-button sidebar-collapse" onClick={()=>setCollapsed(true)} aria-label="Collapse sidebar"><PanelLeft size={18}/></button></div><p className="sidebar-label">Workspace</p><Navigation/><div className="sidebar-foot"><span>{email.slice(0,1).toUpperCase()}</span><div><strong>Your workspace</strong><small>{email}</small></div></div></aside>
  <div className="workspace-body"><header className="workspace-bar"><div>{collapsed&&<button className="shell-icon-button" onClick={()=>setCollapsed(false)} aria-label="Expand sidebar"><PanelLeft size={18}/></button>}<span>{area}</span>{detail&&<><ChevronRight size={14} aria-hidden="true"/><strong>{detail}</strong></>}</div><span className="workspace-bar-note">Freight planning, simplified</span></header><main id="workspace-content" className="app-main" tabIndex={-1}>{children}</main></div>
 </div>;
}
