import { useEffect, useState } from 'react';
import { fetchAnalysisAccountDashboard } from '../api/analysisAPI.js';
import { useNavigation } from '../context/NavigationContext.jsx';
import { useMode } from '../context/ModeContext.jsx';

const DEFAULT_ACCOUNT_TOTALS = new Map();

export function useAnalysisAccountTotals() {
  const [accountTotals, setAccountTotals] = useState(DEFAULT_ACCOUNT_TOTALS);
  const [summary, setSummary] = useState({ invested: 0, marketValue: 0, dayChange: 0, dayChangePercent: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { dashboardRefresh } = useNavigation();
  const { mode, priceSource } = useMode();
  const isTrialMode = mode === 'trial';

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      if (isTrialMode) {
        setAccountTotals(DEFAULT_ACCOUNT_TOTALS);
        setLoading(false);
        setError('');
        return;
      }

      setLoading(true);
      setError('');

      try {
        const response = await fetchAnalysisAccountDashboard(priceSource);

        if (!isMounted) return;
        const { success, data } = response || {};

        if (!success) {
          throw new Error('Failed to load account analysis data');
        }

        const accountWise = data?.accountWise || [];
        const totalsMap = new Map();

        accountWise.forEach((account) => {
          const accountName = account.accountName || account.account_name || 'UNKNOWN';
          const invested = Number(account.totalInvested ?? account.total_invested) || 0;
          const marketValue = Number(account.totalMarketValue ?? account.total_market_value) || 0;

          const stocksBreakdown = account.breakdown?.stocks || account.breakdown?.stock || account.stocks || {};
          const etfBreakdown = account.breakdown?.etf || account.breakdown?.etfs || account.etf || {};
          const mfBreakdown = account.breakdown?.mf || account.breakdown?.mutual_fund || account.mf || {};
          const npsBreakdown = account.breakdown?.nps || account.nps || {};

          const breakdown = {
            stocks: {
              invested: Number(stocksBreakdown.invested || stocksBreakdown.total_invested || account.stocks_invested) || 0,
              marketValue: Number(stocksBreakdown.marketValue || stocksBreakdown.market_value || stocksBreakdown.total_market_value || account.stocks_market_value) || 0,
              dayChange: Number(stocksBreakdown.dayChange || stocksBreakdown.day_change) || 0,
              dayChangePercent: Number(stocksBreakdown.dayChangePercent || stocksBreakdown.day_change_percent) || 0,
            },
            etf: {
              invested: Number(etfBreakdown.invested || etfBreakdown.total_invested || account.etf_invested) || 0,
              marketValue: Number(etfBreakdown.marketValue || etfBreakdown.market_value || etfBreakdown.total_market_value || account.etf_market_value) || 0,
              dayChange: Number(etfBreakdown.dayChange || etfBreakdown.day_change) || 0,
              dayChangePercent: Number(etfBreakdown.dayChangePercent || etfBreakdown.day_change_percent) || 0,
            },
            mf: {
              invested: Number(mfBreakdown.invested || mfBreakdown.total_invested || account.mf_invested) || 0,
              marketValue: Number(mfBreakdown.marketValue || mfBreakdown.market_value || mfBreakdown.total_market_value || account.mf_market_value) || 0,
              dayChange: Number(mfBreakdown.dayChange || mfBreakdown.day_change) || 0,
              dayChangePercent: Number(mfBreakdown.dayChangePercent || mfBreakdown.day_change_percent) || 0,
            },
            nps: {
              invested: Number(npsBreakdown.invested || npsBreakdown.total_invested || account.nps_invested) || 0,
              marketValue: Number(npsBreakdown.marketValue || npsBreakdown.market_value || npsBreakdown.total_market_value || account.nps_market_value) || 0,
              dayChange: Number(npsBreakdown.dayChange || npsBreakdown.day_change) || 0,
              dayChangePercent: Number(npsBreakdown.dayChangePercent || npsBreakdown.day_change_percent) || 0,
            },
          };

          totalsMap.set(accountName, { invested, marketValue, breakdown });
        });

        const otherInvested = Number(data?.otherAccounts?.totalInvested ?? data?.otherAccounts?.total_invested) || 0;
        const otherMarketValue = Number(data?.otherAccounts?.totalMarketValue ?? data?.otherAccounts?.total_market_value) || 0;
        const otherBreakdown = data?.otherAccounts?.breakdown || {};

        if (otherInvested > 0 || otherMarketValue > 0 || Object.keys(otherBreakdown).length > 0) {
          totalsMap.set('Other Accounts', {
            invested: otherInvested,
            marketValue: otherMarketValue,
            breakdown: {
              stocks: {
                invested: Number(otherBreakdown?.stocks?.invested || otherBreakdown?.stocks?.total_invested) || 0,
                marketValue: Number(otherBreakdown?.stocks?.marketValue || otherBreakdown?.stocks?.market_value || otherBreakdown?.stocks?.total_market_value) || 0,
                dayChange: Number(otherBreakdown?.stocks?.dayChange || otherBreakdown?.stocks?.day_change) || 0,
                dayChangePercent: Number(otherBreakdown?.stocks?.dayChangePercent || otherBreakdown?.stocks?.day_change_percent) || 0,
              },
              etf: {
                invested: Number(otherBreakdown?.etf?.invested || otherBreakdown?.etf?.total_invested) || 0,
                marketValue: Number(otherBreakdown?.etf?.marketValue || otherBreakdown?.etf?.market_value || otherBreakdown?.etf?.total_market_value) || 0,
                dayChange: Number(otherBreakdown?.etf?.dayChange || otherBreakdown?.etf?.day_change) || 0,
                dayChangePercent: Number(otherBreakdown?.etf?.dayChangePercent || otherBreakdown?.etf?.day_change_percent) || 0,
              },
              mf: {
                invested: Number(otherBreakdown?.mf?.invested || otherBreakdown?.mf?.total_invested) || 0,
                marketValue: Number(otherBreakdown?.mf?.marketValue || otherBreakdown?.mf?.market_value || otherBreakdown?.mf?.total_market_value) || 0,
                dayChange: Number(otherBreakdown?.mf?.dayChange || otherBreakdown?.mf?.day_change) || 0,
                dayChangePercent: Number(otherBreakdown?.mf?.dayChangePercent || otherBreakdown?.mf?.day_change_percent) || 0,
              },
              nps: {
                invested: Number(otherBreakdown?.nps?.invested || otherBreakdown?.nps?.total_invested) || 0,
                marketValue: Number(otherBreakdown?.nps?.marketValue || otherBreakdown?.nps?.market_value || otherBreakdown?.nps?.total_market_value) || 0,
                dayChange: Number(otherBreakdown?.nps?.dayChange || otherBreakdown?.nps?.day_change) || 0,
                dayChangePercent: Number(otherBreakdown?.nps?.dayChangePercent || otherBreakdown?.nps?.day_change_percent) || 0,
              },
            },
          });
        }

        setAccountTotals(totalsMap);
        setSummary(data?.totals || { invested: 0, marketValue: 0, dayChange: 0, dayChangePercent: 0 });
        setError('');
      } catch (err) {
        if (!isMounted) return;

        console.error('[useAnalysisAccountTotals] Error:', err);
        setError(err.message || 'Failed to load account totals');
        setAccountTotals(DEFAULT_ACCOUNT_TOTALS);
        setSummary({ invested: 0, marketValue: 0, dayChange: 0, dayChangePercent: 0 });
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
  }, [dashboardRefresh, isTrialMode, priceSource]);

  return { accountTotals, summary, loading, error };
}

export default useAnalysisAccountTotals;