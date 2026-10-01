type ApiEnvironment = Partial<Pick<NodeJS.ProcessEnv, 'API_URL' | 'APP_URL' | 'NODE_ENV' | 'RAILWAY_PUBLIC_DOMAIN'>>;

export function apiOrigin(env: ApiEnvironment = process.env): string {
  if (!env.API_URL && env.NODE_ENV === 'production') {
    throw new Error('API_URL is required in production and must point to the backend service.');
  }
  const url = new URL(env.API_URL ?? 'http://127.0.0.1:3001');
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password ||
      url.search || url.hash || url.pathname !== '/') {
    throw new Error('API_URL must be an HTTP(S) origin without credentials or a path.');
  }
  const appOrigin = env.APP_URL ? new URL(env.APP_URL).origin : undefined;
  if (url.origin === appOrigin || url.hostname === env.RAILWAY_PUBLIC_DOMAIN) {
    throw new Error('API_URL points to the frontend, which causes a recursive proxy loop. Use the backend service address.');
  }
  return url.origin;
}
