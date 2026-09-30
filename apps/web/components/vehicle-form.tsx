'use client';
import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Check, ChevronDown } from 'lucide-react';
import { vehicleInputSchema, vehiclePresets, type Vehicle, type VehicleInput } from '@loadlink/core';
import { api } from '../lib/api';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {Hint} from './ui/hint';

export function VehicleForm({ initial, onboarding=false }: { initial?:Vehicle; onboarding?:boolean }) {
  const router = useRouter();
  const [value,setValue] = useState<VehicleInput>(initial ?? vehiclePresets[0]);
  const [error,setError] = useState('');
  const [saved,setSaved] = useState(false);
  const [busy,setBusy] = useState(false);
  const [dimensions,setDimensions] = useState(!onboarding);
  function set<K extends keyof VehicleInput>(key:K, next:VehicleInput[K]) { setValue(v => ({ ...v,[key]:next })); setSaved(false); }
  async function submit(event:FormEvent) {
    event.preventDefault(); setError(''); setSaved(false);
    const parsed = vehicleInputSchema.safeParse(value);
    if (!parsed.success) { setError(parsed.error.issues[0].message); return; }
    setBusy(true);
    try { await api('/vehicles',{ method:'PUT',body:JSON.stringify(parsed.data) });
      if (onboarding) router.replace('/find'); else {setSaved(true);router.refresh();}
    } catch(error) { setError(error instanceof Error?error.message:'Could not save your van.'); }
    finally {setBusy(false);}
  }
  return <form onSubmit={submit} className="vehicle-form">
    <div className="vehicle-summary"><p>WORKING CAPACITY</p><div><strong>{value.name}</strong><span>{value.payloadKg.toLocaleString('en-GB')} kg payload · {value.cargoM3.toLocaleString('en-GB')} m³</span></div></div>
    <fieldset className="preset-fieldset"><legend>Choose a starting point</legend><div className="presets">{vehiclePresets.map(preset=><button type="button" key={preset.name} aria-pressed={value.name===preset.name} className={value.name===preset.name?'preset selected':'preset'} onClick={()=>{setValue({...preset});setSaved(false);}}>{preset.name}</button>)}</div></fieldset>
    <p className="muted small">Confirm these starting values against your van’s documents.</p>
    <label htmlFor="van-name">Van name<Input id="van-name" value={value.name} onChange={e=>set('name',e.target.value)} maxLength={60} required/></label>
    <div className="field-grid"><label htmlFor="payload"><span className="field-label">Payload <span className="unit">kg</span><Hint>Use the maximum cargo weight from your van documents.</Hint></span><Input id="payload" type="number" inputMode="numeric" min={100} max={2500} value={value.payloadKg} onChange={e=>set('payloadKg',Number(e.target.value))} required/></label>
      <label htmlFor="volume"><span className="field-label">Cargo space <span className="unit">m³</span><Hint>Usable cargo volume, excluding the cab and fixed equipment.</Hint></span><Input id="volume" type="number" inputMode="decimal" min={0.1} max={99.9} step={0.1} value={value.cargoM3} onChange={e=>set('cargoM3',Number(e.target.value))} required/></label></div>
    <button className="text-button" type="button" onClick={()=>setDimensions(v=>!v)} aria-expanded={dimensions}><span>{dimensions?'Hide':'Edit'} interior dimensions</span><ChevronDown size={17} aria-hidden="true"/></button>
    {dimensions&&<div className="dimension-grid">{(['lengthCm','widthCm','heightCm'] as const).map((key,i)=><label key={key} htmlFor={key}>{['Length','Width','Height'][i]} <span className="unit">cm</span><Input id={key} type="number" inputMode="numeric" min={1} max={key==='lengthCm'?1000:400} value={value[key]??''} placeholder="Unknown" onChange={e=>set(key,e.target.value===''?null:Number(e.target.value))}/></label>)}</div>}
    <div className="capacity-note"><Check size={16}/><p>We keep a 5% capacity buffer when finding orders.</p></div>
    {error&&<p className="error-message" role="alert">{error}</p>}{saved&&<p className="success-message" role="status">Your van is saved.</p>}
    <Button type="submit" className="full-width" disabled={busy}>{busy?'Saving…':onboarding?'Start':'Save van'}{!busy&&<ArrowRight size={18}/>}</Button>
  </form>;
}
