import type { Metadata } from 'next';
import { Brand } from '../../components/brand';
import { LoginForm } from '../../components/login-form';
export const metadata: Metadata = { title: 'Sign in' };
export default async function LoginPage({ searchParams }: { searchParams: Promise<{error?:string}> }) {
  const params=await searchParams;
  return <main className="auth-page"><header><Brand/></header><div className="auth-layout"><LoginForm invalid={params.error==='invalid-link'}/><aside className="route-art" aria-hidden="true"><div className="route-line"><i/><i/><i/></div><p>BERLIN <span>→</span> WARSAW</p><strong>Pick one route.</strong><span>We show what fits on the way.</span></aside></div></main>;
}
