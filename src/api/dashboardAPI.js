import { getAuthHeaders } from "../utils/authUtils.jsx";
import { BACKEND_URL } from "../config/apiConfig.js";

const API_URL = BACKEND_URL;

export async function fetchDashboardData(priceSource = 'stock_master', token) {
  try {
    const url = new URL(`${API_URL}/api/dashboard/asset-allocation`);
    url.searchParams.append('priceSource', priceSource);
    
    console.log(`[Dashboard API] Fetching with priceSource: "${priceSource}"`);
    
    const headers = await getAuthHeaders(token);
    const response = await fetch(url.toString(), { headers });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    const data = await response.json();
    
    // Log cache status for debugging
    const cacheStatus = response.headers.get('X-Cache');
    if (cacheStatus) {
      console.log(`[Dashboard API] Cache: ${cacheStatus}`);
    }
    
    return data;
  } catch (error) {
    console.error('[Dashboard API] Failed to fetch:', error);
    throw error;
  }
}

export async function fetchLivePriceDetails(token) {
  try {
    const headers = await getAuthHeaders(token);
    const response = await fetch(`${API_URL}/api/dashboard/live-price-details`, {
      headers
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('[Dashboard API] Failed to fetch live price details:', error);
    throw error;
  }
}

export async function fetchInvestmentGrowth(priceSource = 'stock_master', token) {
  try {
    const headers = await getAuthHeaders(token);
    const url = new URL(`${API_URL}/api/dashboard/investment-growth`);
    url.searchParams.append('priceSource', priceSource);

    const response = await fetch(url.toString(), {
      headers
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('[Dashboard API] Failed to fetch investment growth:', error);
    throw error;
  }
}
