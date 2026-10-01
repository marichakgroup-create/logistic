import { describe, expect, it } from 'vitest';
import { apiOrigin } from './api-origin';

describe('backend origin', () => {
  it('rejects a Railway frontend destination before proxying requests', () => {
    expect(() => apiOrigin({ API_URL: 'https://web.up.railway.app', RAILWAY_PUBLIC_DOMAIN: 'web.up.railway.app' })).toThrow('recursive proxy loop');
    expect(() => apiOrigin({ API_URL: 'https://web.example/', APP_URL: 'https://web.example' })).toThrow('recursive proxy loop');
  });
  it('requires an explicit backend in production', () => {
    expect(() => apiOrigin({ NODE_ENV: 'production' })).toThrow('API_URL is required');
  });
  it('accepts private backend networking and normalizes the trailing slash', () => {
    expect(apiOrigin({ API_URL: 'http://api.railway.internal:3001/', NODE_ENV: 'production' })).toBe('http://api.railway.internal:3001');
    expect(apiOrigin({ APP_URL: 'http://127.0.0.1:3000' })).toBe('http://127.0.0.1:3001');
  });
  it.each(['file:///tmp/api', 'https://api.example/v1', 'https://user:password@api.example', 'https://api.example/?key=secret'])('rejects invalid backend origins: %s', API_URL => {
    expect(() => apiOrigin({ API_URL })).toThrow('HTTP(S) origin');
  });
});
