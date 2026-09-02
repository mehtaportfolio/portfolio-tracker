import { useMode } from "../context/ModeContext.jsx";

export const useMFTrialMode = () => {
  const { mode } = useMode();
  const isTrialMode = mode === "trial";

  const maskValue = (value) => {
    return isTrialMode ? 0 : value;
  };

  const maskStats = (stats) => {
    if (!isTrialMode || !stats) return stats;
    
    return {
      invested: 0,
      currentValue: 0,
      dayChange: 0,
      absReturn: 0,
      returnPct: 0,
      realizedValue: 0,
      realizedProfit: 0,
      realizedCost: 0,
      urp: 0,
      urpPct: 0,
      xirr: stats.xirr,
      profit: 0,
      totalValue: stats.totalValue !== undefined ? stats.totalValue : 0,
      marketValue: 0,
    };
  };

  return { isTrialMode, maskValue, maskStats };
};

export const getMaskedValue = (value, isTrialMode) => {
  return isTrialMode ? 0 : value;
};

export const getMaskedStats = (stats, isTrialMode) => {
  if (!isTrialMode || !stats) return stats;
  
  return {
    ...stats,
    invested: 0,
    currentValue: 0,
    dayChange: 0,
    absReturn: 0,
    returnPct: 0,
    realizedValue: 0,
    realizedProfit: 0,
    realizedCost: 0,
    urp: 0,
    urpPct: 0,
    profit: 0,
    marketValue: 0,
  };
};
