import { useEffect, useState } from 'react';
import { useNavigation } from '../context/NavigationContext.jsx';
import { useMode } from '../context/ModeContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { API_URL as CONFIG_API_URL } from '../config/apiConfig.js';

const API_URL = CONFIG_API_URL;

export function useFixedAssetTotals() {
  const [fixedAssets, setFixedAssets] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { dashboardRefresh } = useNavigation();
  const { mode } = useMode();
  const { session } = useAuth();
  const token = session?.access_token;
  const isTrialMode = mode === 'trial';

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      if (isTrialMode) {
        setFixedAssets(null);
        setLoading(false);
        return;
      }

      if (!token) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');

      try {
        const response = await fetch(`${API_URL}/analysis/fixed-assets`, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (!response.ok) {
          throw new Error(`API error: ${response.status}`);
        }

        const json = await response.json();
        if (!isMounted) return;

        if (json.success) {
          setFixedAssets(json.data);
        } else {
          throw new Error(json.error || 'Failed to load fixed assets');
        }
      } catch (err) {
        if (!isMounted) return;
        console.error('[useFixedAssetTotals] Error:', err);
        setError(err.message);
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
  }, [dashboardRefresh, isTrialMode, token]);

  return { fixedAssets, loading, error };
}

export default useFixedAssetTotals;
