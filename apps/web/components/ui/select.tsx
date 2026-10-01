 'use client';
import {Check,ChevronDown} from 'lucide-react';
import {useId,useRef} from 'react';

export function Select({id,value,onChange,options}:{id:string;value:string;onChange:(value:string)=>void;options:{value:string;label:string}[]}){
 const menuId=useId();const menu=useRef<HTMLDivElement>(null);const trigger=useRef<HTMLButtonElement>(null);
 return <span className="custom-select"><button ref={trigger} id={id} type="button" popoverTarget={menuId} className="control-trigger" aria-label={'Sort: '+options.find(option=>option.value===value)?.label}>{options.find(option=>option.value===value)?.label}<ChevronDown size={16}/></button><div ref={menu} id={menuId} popover="auto" className="control-popover select-popover"><fieldset><legend>Sort routes</legend>{options.map(option=><label key={option.value} className="select-option"><input type="radio" name={menuId} value={option.value} checked={option.value===value} onChange={()=>{onChange(option.value);menu.current?.hidePopover();trigger.current?.focus();}}/>{option.label}{option.value===value&&<Check size={16}/>}</label>)}</fieldset></div></span>;
}
