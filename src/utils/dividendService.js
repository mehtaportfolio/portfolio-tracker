// src/utils/dividendService.js
import { getAuthHeaders } from "./authUtils.jsx";
import { invalidateBulkCache } from "./supabasePagination.js";

import { BACKEND_URL } from "../config/apiConfig.js";

const API_BASE = BACKEND_URL;

export const runDividendAutomation = async () => {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/dividend/automate`, {
      method: "POST",
      headers,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to run dividend automation");
    }

    invalidateBulkCache();
    return await response.json();
  } catch (error) {
    console.error("⚠️ Failed to run dividend automation:", error);
    throw error;
  }
};

/**
 * @deprecated Use runDividendAutomation instead
 */
export const syncDividendsFromCorporateActions = async () => {
  console.warn("syncDividendsFromCorporateActions is deprecated. Use runDividendAutomation.");
  const res = await runDividendAutomation();
  return res.syncedCount;
};

/**
 * @deprecated Use runDividendAutomation instead
 */
export const applyActiveDividends = async () => {
  console.warn("applyActiveDividends is deprecated. Use runDividendAutomation.");
  const res = await runDividendAutomation();
  return res.appliedCount;
};

export const invalidateBackendCache = async () => {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/stock/invalidate-cache`, {
      method: 'POST',
      headers,
    });
    if (response.ok) {
      console.log('✅ Backend cache invalidated');
    }
  } catch (error) {
    console.error('⚠️ Failed to invalidate cache:', error);
  }
};
