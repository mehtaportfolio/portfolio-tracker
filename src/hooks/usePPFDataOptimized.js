import { useEffect, useState } from 'react';
import { useNavigation } from '../context/NavigationContext.jsx';
import { useMode } from '../context/ModeContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { BACKEND_URL } from '../config/apiConfig.js';

/**
 * Optimized hook for fetching PPF data from backend
 * @returns {object} PPF data including transactions, byAccount, summary, etc.
 */
export function usePPFDataOptimized(refreshToken = 0) {
  const [ppfData, setPpfData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { dashboardRefresh } = useNavigation();
  const { mode } = useMode();
  const { session } = useAuth();
  const accessToken = session?.access_token;
  const isTrialMode = mode === 'trial';

  useEffect(() => {
    let isMounted = true;

    const fetchPPFData = async () => {
      if (isTrialMode) {
        setPpfData(null);
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

        const response = await fetch(`${BACKEND_URL}/api/assets/ppf`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch PPF data: ${response.statusText}`);
        }

        const data = await response.json();

        if (isMounted) {
          setPpfData(data);
        }
      } catch (err) {
        console.error('Error fetching PPF data:', err);
        if (isMounted) {
          setError(err.message || 'Failed to fetch PPF data');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchPPFData();

    return () => {
      isMounted = false;
    };
  }, [dashboardRefresh, refreshToken, isTrialMode, accessToken]);

  return {
    ppfData,
    loading,
    error,
  };
}

export default usePPFDataOptimized;
