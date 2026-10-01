 'use client';
import {useId,useRef,useState} from 'react';
import type {Location} from '@loadlink/core';
import {MapPin} from 'lucide-react';
import {api} from '../../lib/api';
import {Input} from './input';

export function LocationInput({id,value,onChange}:{id:string;value:string;onChange:(value:string)=>void}){
 const listId=useId();const sequence=useRef(0);const [items,setItems]=useState<Location[]>([]);const [open,setOpen]=useState(false);const [active,setActive]=useState(-1);
 async function suggest(query:string){const request=++sequence.current;setActive(-1);if(!query.trim()){setItems([]);return;}try{const result=await api<{locations:Location[]}>('/locations?q='+encodeURIComponent(query));if(request===sequence.current)setItems(result.locations);}catch{if(request===sequence.current)setItems([]);}}
 function choose(item:Location){sequence.current++;onChange(item.name);setOpen(false);setActive(-1);}
 return <span className="location-control"><Input id={id} aria-label={id==='from'?'From':'To'} value={value} required autoComplete="off" role="combobox" aria-autocomplete="list" aria-expanded={open&&items.length>0} aria-controls={listId} aria-activedescendant={open&&active>=0?listId+'-'+active:undefined} onFocus={()=>{setOpen(true);void suggest(value);}} onBlur={()=>setOpen(false)} onChange={event=>{onChange(event.target.value);setOpen(true);void suggest(event.target.value);}} onKeyDown={event=>{if(event.key==='Escape'){sequence.current++;setOpen(false);}else if(items.length&&(event.key==='ArrowDown'||event.key==='ArrowUp')){event.preventDefault();setOpen(true);setActive(current=>event.key==='ArrowDown'?(current+1)%items.length:(current-1+items.length)%items.length);}else if(event.key==='Enter'&&open&&active>=0){event.preventDefault();choose(items[active]);}}}/>{open&&items.length>0&&<span id={listId} className="location-options" role="listbox">{items.map((item,index)=><span key={item.country+'-'+item.name} id={listId+'-'+index} role="option" aria-selected={active===index} className={active===index?'active':''} onMouseDown={event=>event.preventDefault()} onClick={()=>choose(item)}><MapPin size={16} aria-hidden="true"/><span>{item.name}</span><small>{item.country}</small></span>)}</span>}</span>;
}
