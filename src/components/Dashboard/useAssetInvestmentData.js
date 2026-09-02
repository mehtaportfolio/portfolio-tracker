import { useEffect, useState } from "react";
import { fetchInvestmentGrowth } from "../../api/dashboardAPI.js";
import { useMode } from "../../context/ModeContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";

export default function useAssetInvestmentData(year) {
  const { mode, priceSource } = useMode();
  const { session } = useAuth();
  const token = session?.access_token;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [data, setData] = useState({ labels: [], invested: [] });

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      if (mode === "trial") {
        setLoading(false);
        return;
      }

      if (!token) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const result = await fetchInvestmentGrowth(priceSource, token);
        
        if (isMounted) {
          if (result.success) {
            const { yearBreakdowns } = result.data;
            const yearData = yearBreakdowns[year] || { assets: {} };
            
            // Expected labels: ["Stock", "ETF", "MF", "PPF", "FD", "NPS", "Bank", "EPF"]
            // The backend returns whatever assets it found for that year
            const labels = ["Stock", "ETF", "MF", "PPF", "FD", "NPS", "Bank", "EPF"];
            const invested = labels.map(label => yearData.assets[label]?.invested || 0);

            setData({ labels, invested });
          } else {
            throw new Error(result.error || "Failed to fetch asset investment data");
          }
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || "Failed to load asset investment data");
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    load();
    return () => {
      isMounted = false;
    };
  }, [year, mode, priceSource, token]);

  return {
    loading,
    error,
    labels: data.labels,
    invested: data.invested,
  };
}
