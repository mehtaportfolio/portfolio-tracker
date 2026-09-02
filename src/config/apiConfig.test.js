import { describe, it, expect } from 'vitest';
import { resolveApiConfig } from './apiConfig.js';

describe('resolveApiConfig', () => {
  it('falls back to the current origin when no backend env is provided', () => {
    const config = resolveApiConfig({}, 'https://portfolio-tracker.vercel.app');

    expect(config.BACKEND_URL).toBe('https://portfolio-tracker.vercel.app');
    expect(config.API_URL).toBe('https://portfolio-tracker.vercel.app/api');
  });

  it('prefers an explicit backend URL from env if present', () => {
    const config = resolveApiConfig({ VITE_BACKEND_URL: 'https://backend.example.com' }, 'https://portfolio-tracker.vercel.app');

    expect(config.BACKEND_URL).toBe('https://backend.example.com');
    expect(config.API_URL).toBe('https://backend.example.com/api');
  });
});
