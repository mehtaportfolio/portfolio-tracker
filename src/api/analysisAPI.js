import { BACKEND_URL } from "../config/apiConfig.js";
import { getAuthHeaders } from "../utils/authUtils.jsx";

const API_URL = BACKEND_URL;

export async function fetchAnalysisDashboard(priceSource = 'stock_master', token) {
  try {
    const params = new URLSearchParams({ priceSource });
    const headers = await getAuthHeaders(token);
    const response = await fetch(`${API_URL}/api/analysis/dashboard?${params}`, { headers });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const cacheStatus = response.headers.get('X-Cache');
    if (cacheStatus) {
      console.log(`[Analysis Dashboard API] Cache: ${cacheStatus}`);
    }

    return data;
  } catch (error) {
    console.error('[Analysis Dashboard API] Failed to fetch:', error);
    throw error;
  }
}

export async function fetchAnalysisAccountDashboard(priceSource = 'stock_master', token) {
  try {
    const params = new URLSearchParams();
    params.append('priceSource', priceSource);
    
    const headers = await getAuthHeaders(token);
    const response = await fetch(`${API_URL}/api/analysis/account-dashboard?${params}`, { headers });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const cacheStatus = response.headers.get('X-Cache');
    if (cacheStatus) {
      console.log(`[Analysis Account Dashboard API] Cache: ${cacheStatus}`);
    }

    return data;
  } catch (error) {
    console.error('[Analysis Account Dashboard API] Failed to fetch:', error);
    throw error;
  }
}

export async function fetchAnalysisSummary(priceSource = 'stock_master', token) {
  try {
    const params = new URLSearchParams({ priceSource });
    const headers = await getAuthHeaders(token);
    const response = await fetch(`${API_URL}/api/analysis/summary?${params}`, { headers });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const cacheStatus = response.headers.get('X-Cache');
    if (cacheStatus) {
      console.log(`[Analysis Summary API] Cache: ${cacheStatus}`);
    }

    return data;
  } catch (error) {
    console.error('[Analysis Summary API] Failed to fetch:', error);
    throw error;
  }
}

export async function fetchAnalysisFreeStocks(priceSource = 'stock_master', token) {
  try {
    const params = new URLSearchParams({ priceSource });
    const headers = await getAuthHeaders(token);
    const response = await fetch(`${API_URL}/api/analysis/free-stocks?${params}`, { headers });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const cacheStatus = response.headers.get('X-Cache');
    if (cacheStatus) {
      console.log(`[Analysis Free Stocks API] Cache: ${cacheStatus}`);
    }

    return data;
  } catch (error) {
    console.error('[Analysis Free Stocks API] Failed to fetch:', error);
    throw error;
  }
}

export async function fetchTodayTopGainersLosersDayChange(priceSource = 'stock_master', token) {
  try {
    const params = new URLSearchParams({ priceSource });
    const headers = await getAuthHeaders(token);
    const response = await fetch(`${API_URL}/api/analysis/today-top-gainers-losers-daychange?${params}`, { headers });


    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('[Today Top Gainers/Losers DayChange API] Failed to fetch:', error);
    throw error;
  }
}

export async function fetchTopMutualFunds(sortBy = 'absReturnPct', sortDirection = 'desc', token) {

  try {
    const params = new URLSearchParams({
      sortBy,
      sortDirection,
    });
    const headers = await getAuthHeaders(token);
    const response = await fetch(`${API_URL}/api/analysis/top-mutual-funds?${params}`, { headers });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const cacheStatus = response.headers.get('X-Cache');
    if (cacheStatus) {
      console.log(`[Top Mutual Funds API] Cache: ${cacheStatus}`);
    }

    return data;
  } catch (error) {
    console.error('[Top Mutual Funds API] Failed to fetch:', error);
    throw error;
  }
}

// Fetch today's top gainers/losers for the current user.
// Expected to return:
// {
//   gainersAbs: [{name, profit, percent, marketValue, invested}],
//   gainersPct: [...],
//   losersAbs: [...],
//   losersPct: [...]
// }
// (Removed: fetchTodayTopGainersLosers)
// Today top gainers/losers are already available from fetchAnalysisDashboard.

export async function fetchChargesData(priceSource = 'stock_master', token) {
  try {
    const params = new URLSearchParams({ priceSource });
    const headers = await getAuthHeaders(token);
    const response = await fetch(`${API_URL}/api/stock/portfolio?${params}`, {
      headers
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch charges: ${response.statusText}`);
    }

    const data = await response.json();
    return data.chargesData || [];
  } catch (error) {
    console.error('[Charges API] Failed to fetch:', error);
    throw error;
  }
}

export async function fetchStockCMP(stockName, priceSource = 'stock_master', token) {
  try {
    const params = new URLSearchParams({ stockName, priceSource });
    const headers = await getAuthHeaders(token);
    const response = await fetch(`${API_URL}/api/stock/cmp?${params}`, {
      headers
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return data.cmp || null;
  } catch (error) {
    console.error(`[Stock CMP API] Failed to fetch CMP for ${stockName}:`, error);
    return null;
  }
}

export async function bulkUpdateStockAccountType(stockName, accountType, token) {
  try {
    const headers = await getAuthHeaders(token);
    const response = await fetch(`${API_URL}/api/stock/bulk-update-account`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ stockName, accountType }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('[Bulk Update API] Failed:', error);
    throw error;
  }
}

export async function fetchStockAccounts(token) {
  try {
    const headers = await getAuthHeaders(token);
    const response = await fetch(`${API_URL}/api/stock/accounts`, {
      headers
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `API error: ${response.status}`);
    }

    const result = await response.json();
    return result.data || [];
  } catch (error) {
    console.error('[Fetch Accounts API] Failed:', error);
    throw error;
  }
}

export async function addStockTransaction(transaction, token) {
  try {
    const headers = await getAuthHeaders(token);
    const response = await fetch(`${API_URL}/api/stock/transaction`, {
      method: 'POST',
      headers,
      body: JSON.stringify(transaction),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('[Add Transaction API] Failed:', error);
    throw error;
  }
}

export async function updateStockTransaction(id, updates, token) {
  try {
    const headers = await getAuthHeaders(token);
    const response = await fetch(`${API_URL}/api/stock/transaction/${id}`, {
      method: 'PUT',
      headers,
      body: JSON.stringify(updates),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('[Update Transaction API] Failed:', error);
    throw error;
  }
}

export async function deleteStockTransaction(id, token) {
  try {
    const headers = await getAuthHeaders(token);
    const response = await fetch(`${API_URL}/api/stock/transaction/${id}`, {
      method: 'DELETE',
      headers
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('[Delete Transaction API] Failed:', error);
    throw error;
  }
}

export async function sellStockTransaction(id, sellDetails, token) {
  try {
    const headers = await getAuthHeaders(token);
    const response = await fetch(`${API_URL}/api/stock/transaction/sell/${id}`, {
      method: 'POST',
      headers,
      body: JSON.stringify(sellDetails),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || `API error: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('[Sell Transaction API] Failed:', error);
    throw error;
  }
}

