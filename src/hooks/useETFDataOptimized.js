/**
 * Optimized Hook: useETFDataOptimized
 * Fetches ETF holdings from backend instead of direct Supabase queries
 * Used by: ETF.js
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigation } from '../context/NavigationContext.jsx';
import { useMode } from '../context/ModeContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { BACKEND_URL } from '../config/apiConfig.js';

const API_URL = BACKEND_URL;

export function useETFDataOptimized() {
  const [etfs, setETFs] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { dashboardRefresh } = useNavigation();
  const { mode, priceSource } = useMode();
  const { session } = useAuth();
  const isTrialMode = mode === 'trial';

  const fetchETFData = useCallback(async () => {
    if (isTrialMode) {
      setETFs([]);
      setSummary(null);
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
      const response = await fetch(`${API_URL}/api/stock/etf?priceSource=${priceSource}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch ETF data: ${response.statusText}`);
      }

      const data = await response.json();
      setETFs(data.holdings || []);
      setSummary(data.summary || null);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching ETF data:', err);
      setError(err.message);
      setLoading(false);
    }
  }, [isTrialMode, priceSource, session]);

  useEffect(() => {
    fetchETFData();
  }, [dashboardRefresh, fetchETFData]);

  const refresh = () => fetchETFData();

  return {
    etfs,
    summary,
    loading,
    error,
    refresh,
    fetchETFData,
  };
}