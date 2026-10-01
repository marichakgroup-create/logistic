export class ApiError extends Error {
  constructor(public code: string, message: string, public status: number) { super(message); }
}
export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/v1${path}`, {
    ...init, credentials: 'same-origin', cache: 'no-store',
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  });
  if (response.status===401) { window.location.assign('/login'); throw new ApiError('UNAUTHORIZED','Your session has ended. Please sign in again.',401); }
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new ApiError(data?.error?.code ?? 'SERVICE_UNAVAILABLE', data?.error?.message ?? 'Service unavailable. Please retry.', response.status);
  }
  return response.json() as Promise<T>;
}
