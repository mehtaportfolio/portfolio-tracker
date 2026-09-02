import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { API_URL as CONFIG_API_URL } from '../../config/apiConfig.js';

const API_URL = CONFIG_API_URL;

export function usePortfolioDayChange() {
  const [dayChange, setDayChange] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { session } = useAuth();
  const token = session?.access_token;

  const fetchDayChanges = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      // Fetch day changes from all volatile asset types
      const headers = { Authorization: `Bearer ${token}` };
      const [stockRes, etfRes, mfRes, npsRes] = await Promise.all([
        fetch(`${API_URL}/stock/open`, { headers }),
        fetch(`${API_URL}/stock/etf`, { headers }),
        fetch(`${API_URL}/assets/mf`, { headers }),
        fetch(`${API_URL}/assets/nps`, { headers }),
      ]);

      if (!stockRes.ok || !etfRes.ok || !mfRes.ok || !npsRes.ok) {
        throw new Error('One or more API calls failed');
      }

      const [stockData, etfData, mfData, npsData] = await Promise.all([
        stockRes.json(),
        etfRes.json(),
        mfRes.json(),
        npsRes.json(),
      ]);

      const stockDayChange = stockData?.summary?.dayChange || 0;
      const etfDayChange = etfData?.summary?.dayChange || 0;
      const mfDayChange = mfData?.summary?.dayChange || 0;
      const npsDayChange = npsData?.summary?.dayChange || 0;

      const totalDayChange = stockDayChange + etfDayChange + mfDayChange + npsDayChange;

      setDayChange(totalDayChange);
    } catch (err) {
      console.error('Error fetching portfolio day change:', err);
      setError(err.message || 'Failed to fetch day change');
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchDayChanges();
  }, [fetchDayChanges]);

  return { dayChange, loading, error };
}