// src/config/EquityVisibilityConfig.js

// Which columns should be hidden per tab
export const hiddenColumns = {
  portfolio: ["invested", "currentValue", "dayChange", "holdings", "absReturn", "xirr"],
  stock: ["quantity", "avgBuyPrice", "currentValue", "profitLoss"],
  etf: ["quantity", "currentValue", "profitLoss"],
  closed: ["invested", "realizedProfit", "xirr"],
};

// ✅ Helper function to mask a value
export const maskValue = (value, hidden, tab, column) => {
  if (!hidden) return value;
  if (hiddenColumns[tab]?.includes(column)) {
    return "*****";
  }
  return value;
};
