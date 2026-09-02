/**
 * Optimized Hook: useStockDataOptimized
 * Fetches open stock holdings from backend instead of direct Supabase queries
 * Used by: Holdings.js
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigation } from '../context/NavigationContext.jsx';
import { useMode } from '../context/ModeContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { BACKEND_URL } from '../config/apiConfig.js';

const API_URL = BACKEND_URL;

export function useStockDataOptimized() {
  const [stocks, setStocks] = useState([]);
  const [summary, setSummary] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { dashboardRefresh } = useNavigation();
  const { mode, priceSource } = useMode();
  const { session } = useAuth();
  const isTrialMode = mode === 'trial';

  const fetchStockData = useCallback(async () => {
    
    if (isTrialMode) {
      setStocks([]);
      setSummary({});
      setLoading(false);
      setError(null);
      return;
    }

    if (!session?.access_token) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ priceSource });
      const url = `${API_URL}/api/stock/open?${params}`;
  
      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch stock data: ${response.statusText}`);
      }

      const data = await response.json();
      setStocks(data.holdings || []);
      setSummary(data.summary || {});
      setLoading(false);
    } catch (err) {
      console.error('[Hook] Error fetching stock data:', err);
      setError(err.message);
      setLoading(false);
    }
  }, [isTrialMode, priceSource, session]);

  useEffect(() => {
    fetchStockData();
  }, [dashboardRefresh, fetchStockData, priceSource]);

  const refresh = () => fetchStockData();

  return {
    stocks,
    summary,
    loading,
    error,
    refresh,
    fetchStockData,
  };
}