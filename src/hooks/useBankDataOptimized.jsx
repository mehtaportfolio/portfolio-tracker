import { useEffect, useState, useCallback } from 'react';
import { useNavigation } from '../context/NavigationContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { BACKEND_URL } from '../config/apiConfig.js';

const API_URL = BACKEND_URL;

export function useBankDataOptimized() {
  const [bankData, setBankData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { dashboardRefresh } = useNavigation();
  const { session } = useAuth();

  const fetchBankData = useCallback(async () => {
    if (!session?.access_token) {
      setBankData([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(`${API_URL}/api/assets/bank`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch bank data: ${response.statusText}`);
      }

      const data = await response.json();
      const groupedByMonth = data.groupedByMonth || {};

      const monthKeys = Object.keys(groupedByMonth).sort((a, b) => b.localeCompare(a));
      const currentMonthKey = monthKeys[0] || null;
      const prevMonthKey = monthKeys[1] || null;

      const accountNames = new Set();
      if (currentMonthKey) {
        Object.keys(groupedByMonth[currentMonthKey] || {}).forEach((key) => {
          accountNames.add(key.split('___')[0] || 'Unknown');
        });
      }
      if (prevMonthKey) {
        Object.keys(groupedByMonth[prevMonthKey] || {}).forEach((key) => {
          accountNames.add(key.split('___')[0] || 'Unknown');
        });
      }

      const results = Array.from(accountNames).map((name) => {
        const currentMonthAmount = currentMonthKey && groupedByMonth[currentMonthKey]
          ? Object.keys(groupedByMonth[currentMonthKey])
              .filter((key) => key.split('___')[0] === name)
              .reduce((sum, key) => sum + (Number(groupedByMonth[currentMonthKey][key]?.amount) || 0), 0)
          : 0;

        const previousMonthAmount = prevMonthKey && groupedByMonth[prevMonthKey]
          ? Object.keys(groupedByMonth[prevMonthKey])
              .filter((key) => key.split('___')[0] === name)
              .reduce((sum, key) => sum + (Number(groupedByMonth[prevMonthKey][key]?.amount) || 0), 0)
          : 0;

        return {
          name,
          marketValue: currentMonthAmount,
          invested: previousMonthAmount,
          monthChange: currentMonthAmount - previousMonthAmount,
        };
      });

      setBankData(results);
    } catch (err) {
      console.error('[useBankDataOptimized] Error:', err);
      setError(err.message || 'Failed to fetch bank data');
    } finally {
      setLoading(false);
    }
  }, [dashboardRefresh, session]);

  useEffect(() => {
    fetchBankData();
  }, [fetchBankData]);

  return { bankData, loading, error };
}

export default useBankDataOptimized;
