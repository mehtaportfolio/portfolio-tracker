import { useEffect, useState } from 'react';
import { fetchAnalysisSummary, fetchChargesData } from '../api/analysisAPI.js';
import { useNavigation } from '../context/NavigationContext.jsx';
import { useMode } from '../context/ModeContext.jsx';

const DEFAULT_STATE = {
  equityActive: [],
  equityClosed: [],
  mfActive: [],
  mfClosed: [],
  chargesData: [],
};

export function useAnalysisSummaryOptimized() {
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
        const [summaryResult, chargesResult] = await Promise.all([
          fetchAnalysisSummary(priceSource),
          fetchChargesData(priceSource)
        ]);

        if (!isMounted) return;

        setData({
          ...DEFAULT_STATE,
          ...summaryResult,
          chargesData: chargesResult
        });
        setError('');
      } catch (err) {
        if (!isMounted) return;
        
        console.error('[useAnalysisSummaryOptimized] Error:', err);
        setError(err.message || 'Failed to load analysis summary');
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

export default useAnalysisSummaryOptimized;