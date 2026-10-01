 'use client';
import {useId,useRef,useState} from 'react';
import {CalendarDays,ChevronLeft,ChevronRight} from 'lucide-react';

function iso(date:Date){return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;}
export function DatePicker({value,onChange}:{value:string;onChange:(value:string)=>void}){
 const id=useId();const panel=useRef<HTMLDivElement>(null);const trigger=useRef<HTMLButtonElement>(null);
 const selected=new Date(value+'T12:00:00');
 const [month,setMonth]=useState(()=>new Date(selected.getFullYear(),selected.getMonth(),1));
 const first=(month.getDay()+6)%7;const count=new Date(month.getFullYear(),month.getMonth()+1,0).getDate();
 function choose(date:Date){onChange(iso(date));panel.current?.hidePopover();trigger.current?.focus();}
 return <div className="date-picker"><span className="control-label">Pickup date</span><button ref={trigger} type="button" className="control-trigger" popoverTarget={id} onClick={()=>setMonth(new Date(selected.getFullYear(),selected.getMonth(),1))} aria-label={'Pickup date: '+selected.toDateString()}><CalendarDays size={18}/>{new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric'}).format(selected)}</button><input type="hidden" name="date" value={value}/><div id={id} ref={panel} popover="auto" className="control-popover calendar-popover"><div className="calendar-head"><button type="button" aria-label="Previous month" onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()-1,1))}><ChevronLeft size={18}/></button><strong aria-live="polite">{new Intl.DateTimeFormat('en-GB',{month:'long',year:'numeric'}).format(month)}</strong><button type="button" aria-label="Next month" onClick={()=>setMonth(new Date(month.getFullYear(),month.getMonth()+1,1))}><ChevronRight size={18}/></button></div><div className="calendar-grid">{['Mo','Tu','We','Th','Fr','Sa','Su'].map(day=><span key={day}>{day}</span>)}{Array.from({length:first},(_,i)=><span key={'blank'+i}/>)}{Array.from({length:count},(_,i)=>{const date=new Date(month.getFullYear(),month.getMonth(),i+1);return <button key={i} type="button" aria-label={date.toDateString()} aria-pressed={iso(date)===value} className={iso(date)===value?'selected':''} onClick={()=>choose(date)}>{i+1}</button>;})}</div><div className="calendar-shortcuts"><button type="button" onClick={()=>choose(new Date())}>Today</button><button type="button" onClick={()=>{const next=new Date();next.setDate(next.getDate()+1);choose(next);}}>Tomorrow</button></div></div></div>;
}
