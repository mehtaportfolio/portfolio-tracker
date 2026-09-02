import { useState, useEffect, useCallback } from "react";

import { API_URL } from "../config/apiConfig.js";
import { useAuth } from "../context/AuthContext.jsx";

export function useMarketIndicesLastUpdated() {
  const [lastUpdated, setLastUpdated] = useState(null);
  const { session } = useAuth();
  const token = session?.access_token;

  const fetchLastUpdated = useCallback(async () => {
    if (!token) return;
    try {
      const response = await fetch(`${API_URL}/stock/indices`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

        if (!response.ok) throw new Error("Failed to fetch indices");
        const result = await response.json();

        if (result.success && result.data && result.data.length > 0) {
          // Find the latest updated_at among all indices
          const latestRecord = result.data.reduce((latest, current) => {
            if (!latest?.updated_at) return current;
            if (!current?.updated_at) return latest;
            return new Date(current.updated_at) > new Date(latest.updated_at) ? current : latest;
          }, result.data[0]);

          if (latestRecord?.updated_at) {
            const date = new Date(latestRecord.updated_at);
            
            const day = String(date.getDate()).padStart(2, "0");
            const month = String(date.getMonth() + 1).padStart(2, "0");
            const year = String(date.getFullYear()).slice(-2);
            const hours = String(date.getHours()).padStart(2, "0");
            const minutes = String(date.getMinutes()).padStart(2, "0");
            
            setLastUpdated(`${day}-${month}-${year}, ${hours}:${minutes}`);
          }
        }
      } catch (err) {
        console.error("Error fetching market_indices timestamp:", err);
      }
    }, [token]);

  useEffect(() => {
    fetchLastUpdated();
    
    // Refresh every minute
    const interval = setInterval(fetchLastUpdated, 60000);
    return () => clearInterval(interval);
  }, [fetchLastUpdated]);

  return lastUpdated;
}
