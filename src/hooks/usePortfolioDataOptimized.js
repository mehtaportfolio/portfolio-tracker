/**
 * Optimized Hook: usePortfolioDataOptimized
 * Fetches portfolio data from backend instead of direct Supabase queries
 * Used by: Portfolio.js
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigation } from '../context/NavigationContext.jsx';
import { useMode } from '../context/ModeContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { API_URL as CONFIG_API_URL } from '../config/apiConfig.js';

const API_URL = CONFIG_API_URL;

export function usePortfolioDataOptimized() {
  const [openStats, setOpenStats] = useState({});
  const [closedStats, setClosedStats] = useState({});
  const [openSummary, setOpenSummary] = useState([]);
  const [openTransactions, setOpenTransactions] = useState([]);
  const [closedTransactions, setClosedTransactions] = useState([]);
  const [chargesData, setChargesData] = useState([]);
  const [masterMap, setMasterMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { dashboardRefresh } = useNavigation();
  const { mode, priceSource } = useMode();
  const { session } = useAuth();
  const isTrialMode = mode === 'trial';

  const fetchPortfolioData = useCallback(async () => {
    if (isTrialMode) {
      setOpenStats({});
      setClosedStats({});
      setOpenSummary([]);
      setOpenTransactions([]);
      setClosedTransactions([]);
      setChargesData([]);
      setMasterMap({});
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
      const response = await fetch(`${API_URL}/stock/portfolio?priceSource=${priceSource}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch portfolio data: ${response.statusText}`);
      }

      const data = await response.json();

      setOpenStats(data.openStats || {});
      setClosedStats(data.closedStats || {});
      setOpenSummary(data.openSummary || data.activeSummary || []);
      setOpenTransactions(data.openTxns || data.openTransactions || []);
      setClosedTransactions(data.closedTxns || data.closedTransactions || []);
      setChargesData(data.chargesData || data.charges || []);
      setMasterMap(data.masterMap || {});
      setLoading(false);
    } catch (err) {
      console.error('Error fetching portfolio data:', err);
      setError(err.message);
      setLoading(false);
    }
  }, [isTrialMode, priceSource, session]);

  useEffect(() => {
    fetchPortfolioData();
  }, [dashboardRefresh, fetchPortfolioData, priceSource]);

  const refresh = () => fetchPortfolioData();

  return {
    openStats,
    closedStats,
    openSummary,
    openTransactions,
    closedTransactions,
    chargesData,
    masterMap,
    loading,
    error,
    refresh,
    fetchPortfolioData,
  };
}