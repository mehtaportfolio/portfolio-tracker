import { useEffect, useState, useMemo } from 'react';
import { fetchDashboardData, fetchLivePriceDetails } from '../api/dashboardAPI.js';
import { useNavigation } from '../context/NavigationContext.jsx';
import { useMode } from '../context/ModeContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useLivePrices } from '../context/LivePriceContext.jsx';
import { useTrialMode } from './useTrialMode.js';

const DEFAULT_ASSET_ROWS = [
  'Stock',
  'ETF',
  'MF',
  'PPF',
  'FD',
  'NPS',
  'Bank',
  'EPF',
].map((assetType) => ({
  assetType,
  marketValue: 0,
  marketAllocation: 0,
  investedValue: 0,
  investedAllocation: 0,
  simpleProfit: 0,
  simpleProfitPercent: 0,
}));

export function useAssetRowsOptimized() {
  const [baseRows, setBaseRows] = useState(DEFAULT_ASSET_ROWS);
  const [stockDetails, setStockDetails] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { dashboardRefresh, assetsRefresh } = useNavigation();
  const { mode, priceSource } = useMode();
  const { session } = useAuth();
  const token = session?.access_token;
  const { livePrices } = useLivePrices();
  const { trialValue } = useTrialMode();
  const isTrialMode = mode === 'trial';

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      if (isTrialMode) {
        setBaseRows(DEFAULT_ASSET_ROWS);
        setLoading(false);
        setError('');
        return;
      }

      if (!token) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const dashboardData = await fetchDashboardData(priceSource, token);

        if (!isMounted) return;

        const payload = dashboardData?.data ?? dashboardData;
        const assetRows = Array.isArray(payload?.rows)
          ? payload.rows
          : Array.isArray(dashboardData?.assetRows)
          ? dashboardData.assetRows
          : [];

        setBaseRows(assetRows.length ? assetRows : DEFAULT_ASSET_ROWS);
        setError('');
      } catch (err) {
        if (!isMounted) return;
        
        console.error('[useAssetRowsOptimized] Error:', err);
        setError(err.message || 'Failed to load dashboard data');
        setBaseRows(DEFAULT_ASSET_ROWS);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadData();

    return () => {
      isMounted = false;
    };
  }, [dashboardRefresh, assetsRefresh, isTrialMode, priceSource, token]);

  useEffect(() => {
    if (priceSource !== 'live' || isTrialMode || !token) return;

    const loadStockDetails = async () => {
      try {
        const result = await fetchLivePriceDetails(token);
        if (result.success) {
          setStockDetails(result.data || []);
        }
      } catch (err) {
        console.error("[useAssetRowsOptimized] Error fetching stock details:", err);
      }
    };

    loadStockDetails();
  }, [priceSource, isTrialMode, token]);

  const { rows, summary } = useMemo(() => {
    const rowsList = Array.isArray(baseRows) ? baseRows : [];
    
    let totalMarketValue = 0;
    let totalInvestedValue = 0;
    let finalRows = rowsList;

    if (priceSource === 'live' && stockDetails.length > 0 && !isTrialMode) {
      let liveStockMV = 0;
      let liveStockIV = 0;
      let liveEtfMV = 0;
      let liveEtfIV = 0;

      stockDetails.forEach(t => {
        const qty = Number(t.quantity) || 0;
        const buy = Number(t.buy_price) || 0;
        const iv = qty * buy;
        
        const livePrice = livePrices[t.symbol_ao] || t.lcp || 0;
        const mv = qty * livePrice;

        const isETF = (t.equity_type || "").toLowerCase() === "etf" || 
                      String(t.account_type || "").toUpperCase() === "ETF" ||
                      ['ETF', 'BEES', 'NIFTYBEES', 'JUNIORBEES', 'BANKBEES', 'GOLDBEES'].some(p => String(t.stock_name || '').toUpperCase().includes(p));
        
        if (isETF) {
          liveEtfIV += iv;
          liveEtfMV += mv;
        } else {
          liveStockIV += iv;
          liveStockMV += mv;
        }
      });

      finalRows = rowsList.map(row => {
        if (row.assetType === 'Stock') {
          const simpleProfit = liveStockMV - liveStockIV;
          return {
            ...row,
            marketValue: liveStockMV,
            investedValue: liveStockIV,
            simpleProfit,
            simpleProfitPercent: liveStockIV > 1e-8 ? (simpleProfit / liveStockIV) * 100 : 0
          };
        } else if (row.assetType === 'ETF') {
          const simpleProfit = liveEtfMV - liveEtfIV;
          return {
            ...row,
            marketValue: liveEtfMV,
            investedValue: liveEtfIV,
            simpleProfit,
            simpleProfitPercent: liveEtfIV > 1e-8 ? (simpleProfit / liveEtfIV) * 100 : 0
          };
        }
        return row;
      });
    }

    finalRows.forEach(row => {
      totalMarketValue += Number(row.marketValue) || 0;
      totalInvestedValue += Number(row.investedValue) || 0;

    });

    const finalMV = trialValue(totalMarketValue, 0);
    const finalIV = trialValue(totalInvestedValue, 0);

    const profit = finalMV - finalIV;
    const profitPercent = finalIV > 1e-8 ? (profit / finalIV) * 100 : 0;

    const fullyEnrichedRows = finalRows.map(row => ({
      ...row,
      marketAllocation: finalMV > 1e-8 ? (Number(row.marketValue) / finalMV) * 100 : 0,
      investedAllocation: finalIV > 1e-8 ? (Number(row.investedValue) / finalIV) * 100 : 0
    }));

    return {
      rows: fullyEnrichedRows,
      summary: {
        totalMarketValue: finalMV,
        totalInvestedValue: finalIV,

        profit: trialValue(profit, 0),
        profitPercent: trialValue(profitPercent, 0),
      }
    };
  }, [baseRows, priceSource, stockDetails, livePrices, isTrialMode, trialValue]);

  return { rows, summary, loading, error };
}

export default useAssetRowsOptimized;
