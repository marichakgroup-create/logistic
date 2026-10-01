 'use client';
import Link from 'next/link';
export default function WorkspaceError({reset}:{reset:()=>void}){
 return <section className="page-intro"><h1>We could not load this page</h1><p>Your saved trips are safe. Retry, or sign in again if your session has ended.</p><button className="button button-primary" onClick={reset}>Try again</button><p><Link href="/login">Sign in again</Link> · <Link href="/find">Back to orders</Link></p></section>;
}
