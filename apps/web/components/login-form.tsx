'use client';
import { useState, type FormEvent } from 'react';
import { Mail, ArrowRight, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';
import { Button } from './ui/button';
import { Input } from './ui/input';

export function LoginForm({ invalid=false,localOutbox=false,googleOnly=false,googleError=false }: { invalid?:boolean;localOutbox?:boolean;googleOnly?:boolean;googleError?:boolean }) {
  const [email,setEmail]=useState(''); const [sent,setSent]=useState(false);
  const [busy,setBusy]=useState(false); const [error,setError]=useState('');
  async function submit(event:FormEvent) {
    event.preventDefault();setBusy(true);setError('');
    try {
      if(localOutbox){const result=await api<{hasVehicle:boolean}>('/auth/dev-login',{method:'POST',body:JSON.stringify({email})});window.location.assign(result.hasVehicle?'/find':'/onboarding');return;}
      await api('/auth/magic-link',{method:'POST',body:JSON.stringify({email})});setSent(true);
    }
    catch(error){setError(error instanceof Error?error.message:'Could not send link.');}
    finally{setBusy(false);}
  }
  if(sent)return <div className="check-inbox" role="status"><span className="round-icon"><Mail size={28}/></span><p className="eyebrow">LINK SENT</p><h1>Check your inbox</h1><p>We sent a secure sign-in link to <strong>{email}</strong>.</p><p className="muted">It works once and expires in 15 minutes.</p>{localOutbox&&<p className="dev-mail-note">Local mode: open the newest message in <code>.local/mail</code> and follow its <code>url</code>.</p>}<Button variant="ghost" onClick={()=>setSent(false)}>Use a different email</Button></div>;
  return <form className="login-form" onSubmit={submit}>
    <p className="eyebrow">LOADLINK FOR CARRIERS</p><h1>Fill the miles you already drive.</h1>
    <p className="lead">Choose your main load. We’ll find profitable freight that fits along the route.</p>
    {invalid&&<p className="error-message" role="alert">This link has expired or already been used. Request a new one.</p>}
    {googleOnly&&<Button className="full-width" type="button" onClick={()=>window.location.assign('/v1/auth/google')}>Continue with Google</Button>}
    {googleError&&<p className="error-message" role="alert">Google sign-in is unavailable or failed. Please try again later.</p>}
    {!googleOnly&&<label htmlFor="email">Email address<Input id="email" name="email" type="email" inputMode="email" autoComplete="email" placeholder="you@company.com" value={email} onChange={e=>setEmail(e.target.value)} required maxLength={254}/></label>}
    {error&&<p className="error-message" role="alert">{error}</p>}
    {!googleOnly&&<Button className="full-width" type="submit" disabled={busy}>{busy?'Signing in…':localOutbox?'Sign in':'Continue with email'}<ArrowRight size={18}/></Button>}
    <p className="secure-note"><ShieldCheck size={15}/> {googleOnly?'Secure sign-in with your Google account.':localOutbox?'Local test mode · no password required.':'No password. We send a one-time secure link.'}</p>
    <div className="trial-note"><span><i className="status-dot"/>14-day free trial</span><span>One van · Cancel anytime</span></div>
  </form>;
}
