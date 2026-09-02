import { BACKEND_URL } from "../config/apiConfig.js";

const API_URL = BACKEND_URL;

/**
 * Clears the backend in-memory cache
 */
export async function clearBackendCache() {
  try {
    const response = await fetch(`${API_URL}/api/cache/clear`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to clear cache: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('[Cache API] Error clearing cache:', error);
    throw error;
  }
}
