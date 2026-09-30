'use client';
import { useState, type FormEvent } from 'react';
import { Mail, ArrowRight, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';
import { Button } from './ui/button';
import { Input } from './ui/input';

export function LoginForm({ invalid=false }: { invalid?:boolean }) {
  const [email,setEmail]=useState(''); const [sent,setSent]=useState(false);
  const [busy,setBusy]=useState(false); const [error,setError]=useState('');
  async function submit(event:FormEvent) {
    event.preventDefault();setBusy(true);setError('');
    try {await api('/auth/magic-link',{method:'POST',body:JSON.stringify({email})});setSent(true);}
    catch(error){setError(error instanceof Error?error.message:'Could not send link.');}
    finally{setBusy(false);}
  }
  if(sent)return <div className="check-inbox" role="status"><span className="round-icon"><Mail size={28}/></span><h1>Check your inbox</h1><p>We sent a sign-in link to <strong>{email}</strong>.</p><p className="muted">It works once and expires in 15 minutes.</p><Button variant="ghost" onClick={()=>setSent(false)}>Use a different email</Button></div>;
  return <form className="login-form" onSubmit={submit}>
    <p className="eyebrow">YOUR NEXT ROUTE STARTS HERE</p><h1>Less empty space.<br/>More on the way.</h1>
    <p className="lead">Find freight that fits your van.<br/>Build a better trip, one route at a time.</p>
    {invalid&&<p className="error-message" role="alert">This link has expired or already been used. Request a new one.</p>}
    <label htmlFor="email">Work email<Input id="email" name="email" type="email" autoComplete="email" placeholder="you@company.com" value={email} onChange={e=>setEmail(e.target.value)} required maxLength={254}/></label>
    {error&&<p className="error-message" role="alert">{error}</p>}
    <Button className="full-width" type="submit" disabled={busy}>{busy?'Sending…':'Send link'}<ArrowRight size={18}/></Button>
    <p className="secure-note"><ShieldCheck size={15}/> No password. Just a secure link.</p>
    <div className="trial-note"><span className="status-dot"/>14-day free trial <span>·</span> One van, one simpler workflow</div>
  </form>;
}
