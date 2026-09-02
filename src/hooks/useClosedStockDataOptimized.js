/**
 * Optimized Hook: useClosedStockDataOptimized
 * Fetches closed stock holdings from backend instead of direct Supabase queries
 * Used by: Closed.js
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigation } from '../context/NavigationContext.jsx';
import { useMode } from '../context/ModeContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { API_URL as CONFIG_API_URL } from '../config/apiConfig.js';

const API_URL = CONFIG_API_URL;

export function useClosedStockDataOptimized() {
  const [stocks, setStocks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { dashboardRefresh } = useNavigation();
  const { mode, priceSource } = useMode();
  const { session } = useAuth();
  const isTrialMode = mode === 'trial';

  const fetchClosedStockData = useCallback(async () => {
    if (isTrialMode) {
      setStocks([]);
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
      const response = await fetch(`${API_URL}/stock/closed?priceSource=${priceSource}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch closed stock data: ${response.statusText}`);
      }

      const data = await response.json();
      setStocks(data.holdings || []);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching closed stock data:', err);
      setError(err.message);
      setLoading(false);
    }
  }, [isTrialMode, priceSource, session]);

  useEffect(() => {
    fetchClosedStockData();
  }, [dashboardRefresh, fetchClosedStockData, priceSource]);

  const refresh = () => fetchClosedStockData();

  return {
    stocks,
    loading,
    error,
    refresh,
    fetchClosedStockData,
  };
}