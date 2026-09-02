/**
 * Optimized Hook: useDashboardAssetAllocation
 * Fetches dashboard asset allocation data from backend instead of direct Supabase queries
 * Used by: Dashboard/Portfolio.js
 */

import { useState, useEffect, useCallback } from 'react';
import { useNavigation } from '../context/NavigationContext.jsx';
import { useMode } from '../context/ModeContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { API_URL as CONFIG_API_URL } from '../config/apiConfig.js';

const API_URL = CONFIG_API_URL;

export function useDashboardAssetAllocation() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [bankSavings, setBankSavings] = useState(0);
  const [bankDemat, setBankDemat] = useState(0);
  const [stockHoldings, setStockHoldings] = useState([]);
  const [overallTotals, setOverallTotals] = useState({
    marketValue: 0,
    invested: 0,
    profit: 0,
    profitPercent: 0,
    dayChange: 0,
    dayChangePercent: 0,
  });
  const [masked, setMasked] = useState(() => {
    try {
      return localStorage.getItem("dashboard_portfolio_mask") === "1";
    } catch {
      return false;
    }
  });
  const { dashboardRefresh } = useNavigation();
  const { mode, priceSource } = useMode();
  const { session } = useAuth();
  const token = session?.access_token;
  const isTrialMode = mode === 'trial';

  useEffect(() => {
    try {
      localStorage.setItem("dashboard_portfolio_mask", masked ? "1" : "0");
    } catch {}
  }, [masked]);

  const fetchAssetAllocation = useCallback(async () => {
    if (isTrialMode) {
      setRows([]);
      setBankSavings(0);
      setBankDemat(0);
      setOverallTotals({
        marketValue: 0,
        invested: 0,
        profit: 0,
        profitPercent: 0,
      });
      setLoading(false);
      setError(null);
      return;
    }

    if (!token) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const url = new URL(`${API_URL}/dashboard/asset-allocation`);
      url.searchParams.append('priceSource', priceSource);

      console.log(`[useDashboardAssetAllocation] Fetching with priceSource: "${priceSource}"`);

      const response = await fetch(url.toString(), {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch asset allocation: ${response.statusText}`);
      }

      const result = await response.json();
      const data = result.data;

      // Adapt backend response to match useAssetRows structure
      const adaptedRows = data.rows.map(row => ({
        assetType: row.assetType,
        marketValue: row.marketValue,
        marketAllocation: row.marketAllocation,
        investedValue: row.investedValue,
        investedAllocation: row.investedAllocation,
        simpleProfit: row.simpleProfit,
        simpleProfitPercent: row.simpleProfitPercent,
        dayChange: row.dayChange || 0,
      }));

      setRows(adaptedRows);
      setBankSavings(data.bankSavings || 0);
      setBankDemat(data.bankDemat || 0);
      setStockHoldings(data.stockHoldings || []);
      const prevMarketValue = data.summary.totalMarketValue - (data.summary.overallDayChange || 0);
      const overallDayChangePercent = prevMarketValue > 1e-8 ? ((data.summary.overallDayChange || 0) / prevMarketValue) * 100 : 0;

      setOverallTotals({
        marketValue: data.summary.totalMarketValue,
        invested: data.summary.totalInvestedValue,
        profit: data.summary.totalProfit,
        profitPercent: data.summary.profitPercent,
        dayChange: data.summary.overallDayChange || 0,
        dayChangePercent: overallDayChangePercent,
      });

      setLoading(false);
    } catch (err) {
      console.error('Error fetching asset allocation:', err);
      setError(err.message);
      setLoading(false);
    }
  }, [isTrialMode, priceSource, token]);

  useEffect(() => {
    fetchAssetAllocation();
  }, [dashboardRefresh, fetchAssetAllocation]);

  const refresh = () => fetchAssetAllocation();

  return {
    rows,
    loading,
    error,
    masked,
    setMasked,
    bankSavings,
    bankDemat,
    stockHoldings,
    overallTotals,
    refresh,
  };
}