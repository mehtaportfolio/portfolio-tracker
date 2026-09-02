import { useEffect, useState } from 'react';
import { fetchAnalysisDashboard } from '../api/analysisAPI.js';
import { useNavigation } from '../context/NavigationContext.jsx';
import { useMode } from '../context/ModeContext.jsx';

const DEFAULT_STATE = {
  accountWise: [],
  topGainers: [],
  topLosers: [],
  totalStocks: 0,
  openEquityPositions: { stocks: [] },
};

export function useAnalysisDashboardOptimized() {
  const [data, setData] = useState(DEFAULT_STATE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { dashboardRefresh } = useNavigation();
  const { mode, priceSource } = useMode();
  const isTrialMode = mode === 'trial';

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      if (isTrialMode) {
        setData(DEFAULT_STATE);
        setLoading(false);
        setError('');
        return;
      }

      setLoading(true);
      setError('');

      try {
        const result = await fetchAnalysisDashboard(priceSource);
        
        if (!isMounted) return;

        setData(result || DEFAULT_STATE);
        setError('');
      } catch (err) {
        if (!isMounted) return;
        
        console.error('[useAnalysisDashboardOptimized] Error:', err);
        setError(err.message || 'Failed to load analysis dashboard');
        setData(DEFAULT_STATE);
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

  return { ...data, loading, error };
}

export default useAnalysisDashboardOptimized;