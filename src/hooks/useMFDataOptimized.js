import { useEffect, useState } from 'react';
import { useNavigation } from '../context/NavigationContext.jsx';
import { useMode } from '../context/ModeContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { BACKEND_URL } from '../config/apiConfig.js';

/**
 * Optimized hook for fetching MF data from backend
 * Replaces multiple Supabase queries with single API call
 *
 * @returns {object} MF data including transactions, holdings, fund master, etc.
 */
export function useMFDataOptimized(refreshToken = 0) {
  const [mfTxns, setMfTxns] = useState([]);
  const [fundMaster, setFundMaster] = useState([]);
  const [sipDetails, setSipDetails] = useState([]);
  const [holdings, setHoldings] = useState([]);
  const [closedSplits, setClosedSplits] = useState([]);
  const [categoryColorMap, setCategoryColorMap] = useState({});
  const [sipAccountAmounts, setSipAccountAmounts] = useState({});
  const [accountSummaries, setAccountSummaries] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { dashboardRefresh } = useNavigation();
  const { mode, priceSource } = useMode();
  const { session } = useAuth();
  const accessToken = session?.access_token;
  const isTrialMode = mode === 'trial';

  useEffect(() => {
    let isMounted = true;

    const fetchMFData = async () => {
      if (isTrialMode) {
        // ... (existing trial mode reset)
        setMfTxns([]);
        setFundMaster([]);
        setSipDetails([]);
        setHoldings([]);
        setClosedSplits([]);
        setCategoryColorMap({});
        setSipAccountAmounts({});
        setAccounts([]);
        setLoading(false);
        setError(null);
        return;
      }

      if (!accessToken) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const url = new URL(`${BACKEND_URL}/api/assets/mf`);
        url.searchParams.append('priceSource', priceSource);

        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch MF data: ${response.statusText}`);
        }

        const data = await response.json();

        if (isMounted) {
          setMfTxns(data.transactions || []);
          setFundMaster(data.fundMaster || []);
          setSipDetails(data.sipDetails || []);
          setHoldings(data.holdings || []);
          setClosedSplits(data.closedSplits || []);
          setCategoryColorMap(data.categoryColorMap || {});
          setSipAccountAmounts(data.sipAccountAmounts || {});
          setAccountSummaries(data.accountSummaries || []);
          setAccounts(data.accounts || []);
        }
      } catch (err) {
        console.error('Error fetching MF data:', err);
        if (isMounted) {
          setError(err.message || 'Failed to fetch MF data');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchMFData();

    return () => {
      isMounted = false;
    };
  }, [dashboardRefresh, refreshToken, isTrialMode, accessToken, priceSource]);

  return {
    mfTxns,
    fundMaster,
    sipDetails,
    holdings,
    closedSplits,
    categoryColorMap,
    sipAccountAmounts,
    accountSummaries,
    accounts,
    loading,
    error,
  };
}