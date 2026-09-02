export function resolveApiConfig(env = import.meta.env, origin = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3001') {
  const rawBackend = env.VITE_BACKEND_URL || env.VITE_API_URL || '';
  const normalizedBackend = rawBackend.replace(/\/+$/, '');
  const BACKEND_URL = normalizedBackend || origin;
  const API_URL = env.VITE_API_URL || `${BACKEND_URL.replace(/\/+$/, '')}/api`;

  return { BACKEND_URL, API_URL };
}

const { BACKEND_URL, API_URL } = resolveApiConfig();

// Helpful runtime logs when developing locally
console.log('BACKEND_URL =', BACKEND_URL);
console.log('API_URL =', API_URL);

export { API_URL, BACKEND_URL };