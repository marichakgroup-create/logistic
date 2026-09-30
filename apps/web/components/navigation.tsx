'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Search, Bookmark, UserRound } from 'lucide-react';
const items = [{ href:'/find',name:'Find',icon:Search },{ href:'/trips',name:'Trips',icon:Bookmark },{ href:'/account',name:'Account',icon:UserRound }];
export function Navigation() {
  const pathname = usePathname();
  return <nav className="navigation" aria-label="Main navigation">{items.map(item => <Link key={item.href} href={item.href} className={pathname.startsWith(item.href)?'nav-link active':'nav-link'} aria-current={pathname.startsWith(item.href)?'page':undefined}><item.icon size={20}/><span>{item.name}</span></Link>)}</nav>;
}
