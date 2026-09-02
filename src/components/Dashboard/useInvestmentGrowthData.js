import { useEffect, useState } from "react";
import { fetchInvestmentGrowth } from "../../api/dashboardAPI.js";
import { useMode } from "../../context/ModeContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";

export const useInvestmentGrowthData = () => {
  const [data, setData] = useState([]);
  const [labels, setLabels] = useState([]);
  const [yearBreakdowns, setYearBreakdowns] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const { mode, priceSource } = useMode();
  const { session } = useAuth();
  const token = session?.access_token;

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      if (mode === "trial") {
        setLoading(false);
        return;
      }

      if (!token) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const result = await fetchInvestmentGrowth(priceSource);
        if (isMounted) {
          if (result.success) {
            // Transform data for frontend expectations
            const { labels: resLabels, yearBreakdowns: resBreakdowns } = result.data;
            
            // yearBreakdowns in backend has Map-like structure but as object
            // Chart.js expects yearBreakdowns.combined.get(year)
            // Let's make combined a Map for easy access
            const processedBreakdowns = {
              combined: new Map()
            };

            resLabels.forEach(year => {
              processedBreakdowns.combined.set(year, resBreakdowns[year]?.combined || { invested: 0 });
            });

            setLabels(resLabels || []);
            setYearBreakdowns(processedBreakdowns);
            setData(result.data || []);
          } else {
            throw new Error(result.error || "Failed to fetch growth data");
          }
        }
      } catch (err) {
        console.error("[useInvestmentGrowthData] Error:", err);
        if (isMounted) {
          setError(err.message);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      isMounted = false;
    };
  }, [mode, priceSource, token]);

  return { data, loading, error, labels, yearBreakdowns };
};
