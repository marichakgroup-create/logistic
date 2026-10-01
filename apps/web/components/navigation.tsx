'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, Bookmark, UserRound } from 'lucide-react';
const items = [{ href:'/find',name:'Find',note:'Search freight',icon:Search },{ href:'/trips',name:'Trips',note:'Manage routes',icon:Bookmark },{ href:'/account',name:'Account',note:'Vehicle & plan',icon:UserRound }];
export function Navigation() {
  const pathname = usePathname();
  return <nav className="navigation" aria-label="Main navigation">{items.map(item => <Link key={item.href} href={item.href} title={item.note} className={pathname.startsWith(item.href)?'nav-link active':'nav-link'} aria-current={pathname.startsWith(item.href)?'page':undefined}><item.icon size={20} aria-hidden="true"/><span><strong>{item.name}</strong></span></Link>)}</nav>;
}
