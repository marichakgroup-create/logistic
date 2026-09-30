import type { Metadata } from 'next';
import { Bookmark } from 'lucide-react';
import { Card } from '../../../components/ui/card';
export const metadata: Metadata={title:'Trips'};
export default function TripsPage(){return <><section className="page-intro"><p className="eyebrow">MY TRIPS</p><h1>Trips</h1><p>Saved routes and booking progress.</p></section><section className="content-sheet"><Card className="empty-state"><Bookmark size={30}/><h2>No saved trips yet</h2><p>Choose a route in Find to build your first trip.</p></Card></section></>}
