import { getAuthHeaders } from "./authUtils.jsx";
import { BACKEND_URL } from "../config/apiConfig.js";

/**
 * Utility for fetching and caching bulk data from the backend
 */

const API_BASE = BACKEND_URL;

let bulkCache = null;
let bulkPromise = null;

/**
 * Fetch multiple tables from the backend in one request
 */
export const fetchBulkData = async (supabase, tables) => {
  try {
    const headers = await getAuthHeaders();
    const response = await fetch(`${API_BASE}/api/assets/export`, {
      method: "POST",
      headers,
      body: JSON.stringify({ tables }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || "Failed to fetch bulk data");
    }

    return await response.json();
  } catch (error) {
    console.error("Error in fetchBulkData:", error);
    throw error;
  }
};

/**
 * Fetch all rows from a table (now uses bulk backend export internally)
 * @param {Object} supabase - Supabase client instance
 * @param {string} tableName - Name of the table to query
 * @returns {Promise<{data: Array, error: Error|null}>}
 */
export const fetchAllRows = async (supabase, tableName, options = {}) => {
  try {
    // For specific dashboard tables, we use the bulk fetch
    const supportedTables = [
      "stock_transactions", "mf_transactions", "bank_transactions",
      "epf_transactions", "ppf_transactions", "nps_transactions",
      "fund_master", "stock_master", "nps_pension_fund_master",
      "account_cashflows", "stock_mapping", "other_transactions"
    ];

    if (supportedTables.includes(tableName)) {
      if (bulkCache && bulkCache[tableName]) {
        return { data: bulkCache[tableName], error: null };
      }

      if (!bulkPromise) {
        bulkPromise = fetchBulkData(supabase, supportedTables).then(data => {
          bulkCache = data;
          return data;
        });
      }
      
      const data = await bulkPromise;
      return { data: data[tableName] || [], error: null };
    }

    // Fallback for other tables (to be migrated later)
    console.warn(`Direct fetch for ${tableName} - please migrate to backend endpoint`);
    const { data, error } = await supabase.from(tableName).select(options.select || "*");
    return { data, error };
  } catch (err) {
    return { data: null, error: err };
  }
};

/**
 * Fetch all rows with a simple filter (single condition)
 */
export const fetchWithFilter = async (supabase, tableName, column, operator, value, options = {}) => {
  const { data, error } = await fetchAllRows(supabase, tableName, options);
  if (error) return { data, error };
  
  // Filter client-side for now to maintain compatibility without adding complex backend filtering yet
  let filtered = data;
  if (operator === 'eq') filtered = data.filter(item => item[column] === value);
  else if (operator === 'in') filtered = data.filter(item => value.includes(item[column]));
  
  return { data: filtered, error: null };
};

/**
 * Reset the bulk cache (e.g. after a mutation)
 */
export const invalidateBulkCache = () => {
  bulkCache = null;
  bulkPromise = null;
};
