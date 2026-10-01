import 'server-only';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { apiOrigin } from './api-origin';

export async function serverApi<T>(path: string): Promise<T> {
  const cookieStore = await cookies();
  const response = await fetch(`${apiOrigin()}/v1${path}`, {
    headers: { Cookie: cookieStore.toString() }, cache: 'no-store', signal: AbortSignal.timeout(10000),
  });
  if (response.status === 401) redirect('/login');
  if (!response.ok) throw new Error('Could not load data. Please try again.');
  return response.json() as Promise<T>;
}
