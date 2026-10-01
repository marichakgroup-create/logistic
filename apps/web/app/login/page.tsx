import type { Metadata } from 'next';
import { Brand } from '../../components/brand';
import { LoginForm } from '../../components/login-form';
export const metadata: Metadata = { title: 'Sign in' };
export default async function LoginPage({ searchParams }: { searchParams: Promise<{error?:string}> }) {
  const params=await searchParams;
  return <main className="auth-page"><header><Brand/><span className="login-header-note">FOR OWNER-OPERATORS</span></header><div className="auth-layout"><LoginForm invalid={params.error==='invalid-link'} localOutbox={process.env.NODE_ENV!=='production'} googleOnly={process.env.NODE_ENV==='production'} googleError={params.error?.startsWith('google-')}/><aside className="route-art" aria-label="Example of an improved route"><div className="route-visual-head"><p>YOUR ROUTE</p><strong>Berlin <span>→</span> Warsaw</strong></div><div className="route-line" aria-hidden="true"><i/><i/><i/></div><div className="route-benefit"><p>ALONG THE WAY</p><strong>+€210</strong><span>8 km detour · fits 78%</span></div></aside></div></main>;
}
