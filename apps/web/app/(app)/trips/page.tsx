import type { Metadata } from 'next';
import { Bookmark } from 'lucide-react';
import { Card } from '../../../components/ui/card';
export const metadata: Metadata={title:'Trips'};
export default function TripsPage(){return <><section className="page-intro"><p className="eyebrow">MY TRIPS</p><h1>Trips</h1></section><Card className="empty-state"><Bookmark size={30}/><h2>No saved trips yet</h2><p>Choose an order in Find to start building your first trip.</p></Card></>}
