import { useEffect, useState } from 'react';
import { fetchEarningData } from '../api/earningAPI.js';
import { useNavigation } from '../context/NavigationContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export function useEarningData() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { dashboardRefresh } = useNavigation();
  const { session } = useAuth();
  const token = session?.access_token;

  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      if (!token) return;
      setLoading(true);
      setError('');

      try {
        const result = await fetchEarningData(token);
        if (!isMounted) return;
        setData(result || []);
        setError('');
      } catch (err) {
        if (!isMounted) return;
        console.error('[useEarningData] Error:', err);
        setError(err.message || 'Failed to load earning data');
        setData([]);
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
  }, [dashboardRefresh, token]);

  return { data, loading, error };
}
