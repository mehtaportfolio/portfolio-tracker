import React, { useMemo, useState, useEffect } from "react";
import { usePortfolioDataOptimized } from "../../../hooks/usePortfolioDataOptimized.js";
import { TrendingUp, TrendingDown } from "lucide-react";
import { stockAPI } from "../../../api/stockAPI.js";
import { useMode } from "../../../context/ModeContext.jsx";

const MarketTicker = () => {
  const { masterMap: backendMasterMap } = usePortfolioDataOptimized();
  const { indexSource } = useMode();
  const [localMasterMap, setLocalMasterMap] = useState({});

  const indices = useMemo(() => [
    { key: "NIFTY 50", label: "NIFTY 50" },
    { key: "SENSEX", label: "SENSEX" },
    { key: "MIDCAP 100", label: "MIDCAP 100" },
    { key: "SMALLCAP 250", label: "SMLCAP 250" },
  ], []);

  // Fetch from Backend with selected source
  useEffect(() => {
    const fetchIndices = async () => {
      try {
        const response = await stockAPI.fetchMarketIndices(indexSource);
        if (response.success && response.data) {
          const map = {};
          response.data.forEach(item => {
            map[item.stock_name] = item;
          });
          setLocalMasterMap(map);
        }
      } catch (err) {
        console.error("Error in fetchIndices:", err);
      }
    };

    fetchIndices();
  }, [indexSource]);

  const masterMap = useMemo(() => {
    const combinedMap = { ...(backendMasterMap || {}) };
    
    // Prioritize local fetch for the 4 specific indices
    if (Object.keys(localMasterMap).length > 0) {
      indices.forEach(idx => {
        if (localMasterMap[idx.key]) {
          combinedMap[idx.key] = localMasterMap[idx.key];
        }
      });
    }
    
    return combinedMap;
  }, [backendMasterMap, localMasterMap, indices]);

  const tickerData = useMemo(() => {
    if (!masterMap || Object.keys(masterMap).length === 0) return [];
    
    return indices.map((idx) => {
      const data = masterMap[idx.key];
      if (!data) return null;
      const cmp = Number(data.cmp) || 0;
      const lcp = Number(data.lcp) || 0;
      const absChange = cmp - lcp;
      const pctChange = lcp > 0 ? (absChange / lcp) * 100 : 0;
      return { label: idx.label, cmp, absChange, pctChange };
    }).filter(Boolean);
  }, [masterMap, indices]);

  if (tickerData.length === 0) return null;

  return (
    <div className="bg-gray-900 border-b border-gray-700/50 py-1.5 overflow-hidden w-full relative">
      <div className="flex animate-marquee whitespace-nowrap w-max">
        {/* Render content twice for seamless loop */}
        {[...Array(2)].map((_, i) => (
          <div key={i} className="flex gap-12 px-6 items-center flex-shrink-0">
            {tickerData.map((idx) => {
              const isPositive = idx.absChange >= 0;
              return (
                <div key={`${i}-${idx.label}`} className="flex items-center gap-2">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{idx.label}</span>
                  <span className="text-[11px] font-bold text-white tracking-tight">
                    {idx.cmp.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span className={`flex items-center gap-0.5 text-[10px] font-bold ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
                    {isPositive ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                    {isPositive ? "+" : ""}{idx.absChange.toFixed(1)} ({isPositive ? "+" : ""}{idx.pctChange.toFixed(2)}%)
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export default MarketTicker;
