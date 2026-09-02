import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "../../../context/AuthContext.jsx";
import { useNavigation } from "../../../context/NavigationContext.jsx";
import { BACKEND_URL } from "../../../config/apiConfig.js";
import { stockAPI } from "../../../api/stockAPI.js";
import { useClosedStockDataOptimized } from "../../../hooks/useClosedStockDataOptimized.js";
import * as XLSX from "xlsx";
import { Edit, Trash2, X, TrendingUp, Activity, BarChart3, Download } from "lucide-react";
import { invalidateBulkCache } from "../../../utils/supabasePagination.js";

const calculateXIRR = (buyDate, sellDate, invested, closedValue) => {
  if (!buyDate || !sellDate || invested <= 0 || closedValue <= 0) return null;

  const days =
    (new Date(sellDate) - new Date(buyDate)) / (1000 * 60 * 60 * 24);
  if (days <= 0) return null;

  const xirr = Math.pow(closedValue / invested, 365 / days) - 1;
  return xirr * 100;
};

// 🔹 Proper Iterative XIRR for multiple cashflows
const calculateIterativeXIRR = (flows) => {
  if (!flows || flows.length < 2) return null;

  const cashflows = flows
    .map((cf) => ({ amount: Number(cf.amount), date: new Date(cf.date) }))
    .sort((a, b) => a.date - b.date);

  const t0 = cashflows[0].date;
  const MS_PER_YEAR = 1000 * 60 * 60 * 24 * 365;

  const npv = (rate) =>
    cashflows.reduce(
      (acc, cf) =>
        acc +
        cf.amount /
          Math.pow(1 + rate, (cf.date - t0) / MS_PER_YEAR),
      0
    );

  let low = -0.9999;
  let high = 100; // 10,000% upper cap
  let guess = 0.1;

  for (let i = 0; i < 100; i++) {
    const mid = (low + high) / 2;
    const val = npv(mid);
    if (Math.abs(val) < 1e-6) return mid * 100; // %
    if (val > 0) low = mid;
    else high = mid;
    guess = mid;
  }
  return guess * 100;
};

const capXIRR = (xirrValue) => {
  if (xirrValue === null || xirrValue === undefined) return null;
  return Math.min(xirrValue, 1000);
};

const formatINRShort = (value) => {
  const num = Number(value) || 0;
  const abs = Math.abs(num);
  const sign = num < 0 ? "-" : "";

  if (abs >= 1e7) return `${sign}₹${(abs / 1e7).toFixed(2)} Cr`;
  if (abs >= 1e5) return `${sign}₹${(abs / 1e5).toFixed(2)} L`;
  if (abs >= 1e3) return `${sign}₹${(abs / 1e3).toFixed(1)} K`;
  return `${sign}₹${abs.toLocaleString("en-IN")}`;
};

function SummaryCard({ label, value, subValue, icon: Icon, accentClass = "text-white" }) {
  return (
    <div className="flex-1 min-w-[160px] rounded-[2rem] border border-gray-700/50 bg-gray-800/40 backdrop-blur-xl p-4 shadow-xl transition-all duration-300 hover:bg-gray-700/50 hover:shadow-2xl">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-bold text-gray-400 tracking-widest uppercase leading-tight whitespace-normal">
  {label}
</div>
        {Icon && <Icon className="text-gray-500" size={18} />}
      </div>
      <div className={`text-2xl font-bold tracking-tight ${accentClass}`}>{value}</div>
      {subValue && <div className="mt-1 text-sm font-medium text-gray-500">{subValue}</div>}
    </div>
  );
}

const Closed = () => {
  const { refreshDashboard, refreshAssets } = useNavigation();
  const { stocks: backendStocks, fetchClosedStockData } = useClosedStockDataOptimized();
  const { session } = useAuth();

  const invalidateBackendCache = async () => {
    try {
      const token = session?.access_token;
      if (!token) return;
      const response = await fetch(`${BACKEND_URL}/api/stock/invalidate-cache`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        console.log('✅ Backend cache invalidated');
        invalidateBulkCache();
      }
    } catch (error) {
      console.error('⚠️ Failed to invalidate cache:', error);
    }
  };

  const [filteredStocks, setFilteredStocks] = useState([]);
  const [selectedStock, setSelectedStock] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [buyDateFilter, setBuyDateFilter] = useState("");
  const [sellDateFilter, setSellDateFilter] = useState("");
  const [accountFilter, setAccountFilter] = useState("");
  const [accountOptions, setAccountOptions] = useState([]);
  const [accountTypeFilter, setAccountTypeFilter] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "stock_name", direction: "asc" });
  const [isRefreshing, setIsRefreshing] = useState(false);

  const summary = useMemo(() => {
    let totalInvested = 0;
    let totalRealizedProfit = 0;
    const allCashflows = [];

    filteredStocks.forEach(stock => {
      totalInvested += stock.invested;
      totalRealizedProfit += stock.urp;
      
      (stock.transactions || []).forEach(txn => {
        // Only include if matches current filters (though filteredStocks already maps to filtered totals)
        // To be safe, we re-filter as in recalculateStockTotals
        const buyMatch = !buyDateFilter || (txn.buy_date && String(txn.buy_date).slice(0, 10) === buyDateFilter);
        const sellMatch = !sellDateFilter || (txn.sell_date && String(txn.sell_date).slice(0, 10) === sellDateFilter);
        const accountMatch = !accountFilter || txn.account_name === accountFilter;
        const accountTypeMatch = !accountTypeFilter || txn.account_type === accountTypeFilter;

        if (txn.sell_date && buyMatch && sellMatch && accountMatch && accountTypeMatch) {
          const qty = Number(txn.quantity);
          const buyPrice = Number(txn.buy_price);
          const sellPrice = Number(txn.sell_price || 0);

          if (txn.buy_date) {
            allCashflows.push({ amount: -(qty * buyPrice), date: new Date(txn.buy_date) });
          }
          if (txn.sell_date) {
            allCashflows.push({ amount: qty * sellPrice, date: new Date(txn.sell_date) });
          }
        }
      });
    });

    const overallProfitPct = totalInvested > 0 ? (totalRealizedProfit / totalInvested) * 100 : 0;
    const overallXirr = calculateIterativeXIRR(allCashflows);

    return {
      totalRealizedProfit,
      overallProfitPct,
      overallXirr
    };
  }, [filteredStocks, buyDateFilter, sellDateFilter, accountFilter, accountTypeFilter]);

  const getSortIndicator = useCallback(
    (key) => {
      if (sortConfig.key !== key) return "";
      return sortConfig.direction === "asc" ? "↑" : "↓";
    },
    [sortConfig]
  );

  const getHeaderClasses = useCallback(
    (key, extraClasses = "") => {
      const isActive = sortConfig.key === key;
      const base = isActive ? "bg-red-600 text-white" : "bg-red-500 text-black";
      return `border px-2 py-2 cursor-pointer select-none ${base} ${extraClasses}`;
    },
    [sortConfig]
  );

  const handleSort = useCallback((key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return {
          key,
          direction: prev.direction === "desc" ? "asc" : "desc",
        };
      }
      return { key, direction: "desc" };
    });
  }, []);

  useEffect(() => {
    if (editingId) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "unset";
    }
    return () => {
      document.body.style.overflow = "unset";
    };
  }, [editingId]);

  useEffect(() => {
    if (!backendStocks || backendStocks.length === 0) {
      setFilteredStocks([]);
      return;
    }

    const uniqueAccounts = [
      ...new Set(
        backendStocks
          .flatMap((stock) => (stock.transactions || []).map((t) => t.account_name))
          .filter(Boolean)
      ),
    ];
    setAccountOptions(uniqueAccounts);

    const filtered = backendStocks
      .filter((stock) => {
        const nameMatch = stock.stock_name
          .toLowerCase()
          .includes(searchQuery.toLowerCase());
        if (!nameMatch) return false;

        if (
          !buyDateFilter &&
          !sellDateFilter &&
          !accountFilter &&
          !accountTypeFilter
        )
          return true;

        const hasClosedMatch = (stock.transactions || []).some((t) => {
          if (!t.sell_date) return false;

          const buyMatch =
            !buyDateFilter ||
            (t.buy_date && String(t.buy_date).slice(0, 10) === buyDateFilter);

          const sellMatch =
            !sellDateFilter ||
            (t.sell_date && String(t.sell_date).slice(0, 10) === sellDateFilter);

          const accountMatch = !accountFilter || t.account_name === accountFilter;

          const accountTypeMatch =
            !accountTypeFilter || t.account_type === accountTypeFilter;

          return buyMatch && sellMatch && accountMatch && accountTypeMatch;
        });

        return hasClosedMatch;
      })
      .map((stock) => {
        return recalculateStockTotals(stock, {
          buyDateFilter,
          sellDateFilter,
          accountFilter,
          accountTypeFilter,
        });
      });

    const sorted = sortStocks(filtered, sortConfig);
    setFilteredStocks(sorted);
    setIsRefreshing(false);
  }, [
    backendStocks,
    searchQuery,
    buyDateFilter,
    sellDateFilter,
    accountFilter,
    accountTypeFilter,
    sortConfig,
  ]);

  const formatDate = (dateStr) => {
    if (!dateStr) return "-";
    const d = new Date(dateStr);
    return d
      .toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit" })
      .replace(/\//g, "-");
  };

  const sortStocks = (stocks, sortConfig) => {
    if (!sortConfig?.key) {
      return stocks;
    }

    const { key, direction } = sortConfig;
    const multiplier = direction === "asc" ? 1 : -1;

    return [...stocks].sort((a, b) => {
      const valueA = a?.[key];
      const valueB = b?.[key];

      if (valueA == null && valueB == null) return 0;
      if (valueA == null) return multiplier * -1;
      if (valueB == null) return multiplier * 1;

      const numericA = Number(valueA);
      const numericB = Number(valueB);
      const bothNumeric = !Number.isNaN(numericA) && !Number.isNaN(numericB);

      if (bothNumeric) {
        if (numericA === numericB) return 0;
        return numericA > numericB ? multiplier * 1 : multiplier * -1;
      }

      return multiplier * String(valueA).localeCompare(String(valueB));
    });
  };

  const recalculateStockTotals = (stock, filters) => {
    const { buyDateFilter, sellDateFilter, accountFilter, accountTypeFilter } = filters;
    
    let invested = 0;
    let closedValue = 0;
    let xirrValues = [];

    const filteredTransactions = stock.transactions.filter((txn) => {
      if (!txn.sell_date) return false;

      const buyMatch = !buyDateFilter || (txn.buy_date && String(txn.buy_date).slice(0, 10) === buyDateFilter);
      const sellMatch = !sellDateFilter || (txn.sell_date && String(txn.sell_date).slice(0, 10) === sellDateFilter);
      const accountMatch = !accountFilter || txn.account_name === accountFilter;
      const accountTypeMatch = !accountTypeFilter || txn.account_type === accountTypeFilter;

      return buyMatch && sellMatch && accountMatch && accountTypeMatch;
    });

    let totalQty = 0;
    filteredTransactions.forEach((txn) => {
      const inv = txn.quantity * txn.buy_price;
      const val = txn.quantity * (txn.sell_price || 0);
      invested += inv;
      closedValue += val;
      totalQty += txn.quantity;

      const txnXirr = calculateXIRR(txn.buy_date, txn.sell_date, inv, val);
      if (txnXirr !== null) xirrValues.push(txnXirr);
    });

    const urp = closedValue - invested;
    const urpPct = invested > 0 ? (urp / invested) * 100 : 0;
    const avgXirr = xirrValues.length > 0 ? xirrValues.reduce((a, b) => a + b, 0) / xirrValues.length : null;
    const avgBuyPrice = totalQty > 0 ? invested / totalQty : 0;
    const avgSellPrice = totalQty > 0 ? closedValue / totalQty : 0;

    return {
      ...stock,
      invested,
      marketValue: closedValue,
      urp,
      urpPct,
      avgBuyPrice,
      avgSellPrice,
      xirr: avgXirr,
      category: stock.category || "",
      sector: stock.sector || "",
      basic_industry: stock.basic_industry || "",
    };
  };

  const handleDelete = async (id) => {
    try {
      await stockAPI.deleteTransaction(id);
      alert("🗑 Transaction deleted successfully");
      setIsRefreshing(true);
      await invalidateBackendCache();
      await new Promise(resolve => setTimeout(resolve, 500));
      await fetchClosedStockData();
      setIsRefreshing(false);
      refreshDashboard();
      refreshAssets();
    } catch (error) {
      console.error("Delete failed:", error);
      alert("❌ Failed to delete transaction");
    }
  };

  const handleEdit = (txn) => {
    setEditingId(txn.id);
    setEditValues({ ...txn });
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditValues({});
  };

  const handleSave = async () => {
    const { id, ...updateValues } = editValues;
    try {
      await stockAPI.updateTransaction(editingId, updateValues);
      alert("✅ Transaction updated successfully");
      setEditingId(null);
      setEditValues({});
      setIsRefreshing(true);
      await invalidateBackendCache();
      await new Promise(resolve => setTimeout(resolve, 500));
      await fetchClosedStockData();
      setIsRefreshing(false);
      refreshDashboard();
      refreshAssets();
    } catch (error) {
      console.error("Update failed:", error);
      alert("❌ Failed to update transaction");
    }
  };

  const handleChange = (field, value) => {
    setEditValues((prev) => ({ ...prev, [field]: value }));
  };

  const handleCloseDetails = () => setSelectedStock(null);

  const selectedStockTransactions = selectedStock ? selectedStock.transactions.filter(txn => txn.sell_date && (!accountFilter || txn.account_name === accountFilter)) : [];

  const handleExportIndividualToExcel = () => {
    if (!selectedStock || !selectedStockTransactions.length) return;

    const dataToExport = selectedStockTransactions.map(txn => {
      const inv = txn.quantity * txn.buy_price;
      const val = txn.quantity * (txn.sell_price || 0);
      const urp = val - inv;
      const urpPct = inv > 0 ? (urp / inv) * 100 : 0;

      return {
        "Stock Name": selectedStock.stock_name,
        "Buy Date": formatDate(txn.buy_date),
        "Sell Date": formatDate(txn.sell_date),
        "Quantity": txn.quantity,
        "Buy Price": txn.buy_price,
        "Sell Price": txn.sell_price,
        "Account Name": txn.account_name,
        "Account Type": txn.account_type,
        "Invested": Number(inv.toFixed(2)),
        "Closed Value": Number(val.toFixed(2)),
        "P&L": Number(urp.toFixed(2)),
        "P&L %": Number(urpPct.toFixed(2))
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Individual_Closed_Holdings");
    XLSX.writeFile(workbook, `${selectedStock.stock_name}_Closed_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleExportToExcel = () => {
    const dataToExport = filteredStocks.map(stock => {
      const transactions = stock.transactions || [];
      const uniqueAccounts = [...new Set(transactions.map(t => t.account_name).filter(Boolean))].join(" & ");
      const uniqueAccountTypes = [...new Set(transactions.map(t => t.account_type).filter(Boolean))].join(" & ");

      return {
        "Stock Name": stock.stock_name,
        "Account Name/Owner": uniqueAccounts || "-",
        "Account Type": uniqueAccountTypes || "-",
        "Category": stock.category || "-",
        "Sector": stock.sector || "-",
        "Basic Industry": stock.basic_industry || "-",
        "Invested": Number(stock.invested),
        "Closed Value": Number(stock.marketValue),
        "Avg Buy Price": Number(stock.avgBuyPrice),
        "Avg Sell Price": Number(stock.avgSellPrice),
        "P&L": Number(stock.urp),
        "P&L %": Number(stock.urpPct),
        "XIRR %": typeof stock.xirr === "number" && !isNaN(stock.xirr)
          ? Number(stock.xirr)
          : null
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Closed_Holdings");
    XLSX.writeFile(workbook, `Closed_Holdings_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="pb-20 relative px-0 sm:px-0">
      {isRefreshing && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-40 flex items-center justify-center">
          <div className="bg-white rounded-lg p-8 flex flex-col items-center gap-4">
            <div className="w-12 h-12 border-4 border-red-300 border-t-red-600 rounded-full animate-spin"></div>
            <p className="text-lg font-semibold text-gray-700">Refreshing data...</p>
          </div>
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-8 mb-8">
        <SummaryCard
          label={<>Realized<br />Profit</>}
          value={formatINRShort(summary.totalRealizedProfit)}
          icon={TrendingUp}
          accentClass={summary.totalRealizedProfit >= 0 ? "text-emerald-400" : "text-rose-400"}
        />
        <SummaryCard
          label="Return%"
          value={`${summary.overallProfitPct.toFixed(2)}%`}
          subValue={summary.overallXirr !== null ? `XIRR: ${capXIRR(summary.overallXirr).toFixed(2)}%` : "XIRR: N/A"}
          icon={Activity}
          accentClass={summary.overallProfitPct >= 0 ? "text-emerald-400" : "text-rose-400"}
        />
      </div>

      <div className="mb-4 flex items-center gap-3 flex-wrap w-full bg-gray-800/20 p-4 rounded-2xl backdrop-blur-md border border-gray-700/30">
        <input
          type="text"
          placeholder="Search closed transactions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="p-3 border-none bg-gray-700/40 text-white rounded-xl flex-1 min-w-0 focus:ring-2 focus:ring-indigo-500 transition-all placeholder-gray-500 shadow-inner"
        />

          <button
            onClick={handleExportToExcel}
            className="p-3 bg-gray-700/40 border border-gray-600/30 text-emerald-400 hover:bg-gray-700/60 rounded-xl transition-all duration-300 flex items-center justify-center shrink-0 shadow-lg"
            title="Download Excel"
          >
            <Download size={18} />
          </button>

        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-1 bg-gray-700/40 px-3 py-1.5 rounded-xl border border-gray-600/30">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Buy:</span>
            <input
              type="date"
              value={buyDateFilter}
              onChange={(e) => setBuyDateFilter(e.target.value)}
              className="bg-transparent border-none text-white text-xs focus:ring-0 w-28"
              title="Filter by Buy Date"
            />
          </div>

          <select
            value={accountTypeFilter}
            onChange={(e) => setAccountTypeFilter(e.target.value)}
            className="p-3 bg-gray-700/40 text-white border-none rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 transition-all shadow-inner"
          >
            <option value="">Account Type</option>
            <option value="Free">Free</option>
            <option value="Regular">Regular</option>
          </select>

          <div className="flex items-center gap-1 bg-gray-700/40 px-3 py-1.5 rounded-xl border border-gray-600/30">
            <span className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Sell:</span>
            <input
              type="date"
              value={sellDateFilter}
              onChange={(e) => setSellDateFilter(e.target.value)}
              className="bg-transparent border-none text-white text-xs focus:ring-0 w-28"
              title="Filter by Sell Date"
            />
          </div>

          <select
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value)}
            className="p-3 bg-gray-700/40 text-white border-none rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 transition-all shadow-inner"
          >
            <option value="">All Accounts</option>
            {accountOptions.map((acc) => (
              <option key={acc} value={acc}>
                {acc}
              </option>
            ))}
          </select>


        </div>
      </div>

      <div className="overflow-x-auto bg-gray-900/40 backdrop-blur-xl rounded-[2rem] border border-gray-700/30 shadow-2xl max-h-[calc(100vh-150px)] -mx-2 sm:mx-0">
        <table className="min-w-full text-sm border-collapse">
          <thead>
            <tr className="bg-gray-800/60 sticky top-0 z-20 border-b border-gray-700/50">
              <th
                className={getHeaderClasses("stock_name", "text-left w-40 sticky left-0 bg-gray-800/90 z-20 !text-gray-400 !font-bold !text-[10px] !uppercase !tracking-widest !border-none")}
                onClick={() => handleSort("stock_name")}
              >
                Stock {getSortIndicator("stock_name")}
              </th>
              <th
                className={getHeaderClasses("invested", "text-center w-32 !text-gray-400 !font-bold !text-[10px] !uppercase !tracking-widest !border-none")}
                onClick={() => handleSort("invested")}
              >
                Invested Amount {getSortIndicator("invested")}
              </th>
              <th
                className={getHeaderClasses("avgBuyPrice", "text-center w-28 !text-gray-400 !font-bold !text-[10px] !uppercase !tracking-widest !border-none")}
                onClick={() => handleSort("avgBuyPrice")}
              >
                Avg Buy Price {getSortIndicator("avgBuyPrice")}
              </th>
              <th
                className={getHeaderClasses("avgSellPrice", "text-center w-28 !text-gray-400 !font-bold !text-[10px] !uppercase !tracking-widest !border-none")}
                onClick={() => handleSort("avgSellPrice")}
              >
                Avg Sell Price {getSortIndicator("avgSellPrice")}
              </th>
              <th
                className={getHeaderClasses("marketValue", "text-center w-32 !text-gray-400 !font-bold !text-[10px] !uppercase !tracking-widest !border-none")}
                onClick={() => handleSort("marketValue")}
              >
                Closed Value {getSortIndicator("marketValue")}
              </th>
              <th
                className={getHeaderClasses("urp", "text-center w-28 !text-gray-400 !font-bold !text-[10px] !uppercase !tracking-widest !border-none")}
                onClick={() => handleSort("urp")}
              >
                P/L (₹) {getSortIndicator("urp")}
              </th>
              <th
                className={getHeaderClasses("urpPct", "text-center w-24 !text-gray-400 !font-bold !text-[10px] !uppercase !tracking-widest !border-none")}
                onClick={() => handleSort("urpPct")}
              >
                P/L % {getSortIndicator("urpPct")}
              </th>
              <th
                className={getHeaderClasses("xirr", "text-center w-24 !text-gray-400 !font-bold !text-[10px] !uppercase !tracking-widest !border-none")}
                onClick={() => handleSort("xirr")}
              >
                XIRR % {getSortIndicator("xirr")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/30">
            {filteredStocks.map((stock) => (
              <React.Fragment key={stock.stock_name}>
                <tr
                  className="cursor-pointer hover:bg-white/5 transition-colors group"
                  onClick={() =>
                    setSelectedStock(
                      selectedStock?.stock_name === stock.stock_name
                        ? null
                        : stock
                    )
                  }
                >
                  <td className="px-4 py-4 font-semibold text-left sticky left-0 bg-gray-900/90 group-hover:bg-gray-800/90 z-10 whitespace-nowrap text-white">
                    <div 
                      className="flex items-center gap-2 cursor-pointer hover:text-blue-400 transition-colors w-fit"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(`https://www.tradingview.com/chart/?symbol=NSE:${stock.stock_name}`, "_blank");
                      }}
                      title="Open TradingView Chart"
                    >
                      {stock.stock_name}
                      <BarChart3 size={16} className="text-blue-400/50 group-hover:text-blue-400 transition-colors" />
                    </div>
                  </td>
                  <td className="px-2 py-4 text-center text-gray-300">
                    ₹{stock.invested.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </td>
                  <td className="px-2 py-4 text-center text-gray-300">
                    ₹{stock.avgBuyPrice.toFixed(2)}
                  </td>
                  <td className="px-2 py-4 text-center text-gray-300">
                    ₹{stock.avgSellPrice.toFixed(2)}
                  </td>
                  <td className="px-2 py-4 text-center text-gray-300">
                    ₹{stock.marketValue.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </td>
                  <td
                    className={`px-2 py-4 text-center font-medium ${
                      stock.urp >= 0 ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    ₹{stock.urp.toLocaleString("en-IN", { maximumFractionDigits: 0 })}
                  </td>
                  <td
                    className={`px-2 py-4 text-center font-medium ${
                      stock.urpPct >= 0 ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {stock.urpPct.toFixed(1)}%
                  </td>
                  <td
                    className={`px-2 py-4 text-center font-medium ${
                      stock.xirr >= 0 ? "text-emerald-400" : "text-rose-400"
                    }`}
                  >
                    {stock.xirr ? capXIRR(stock.xirr).toFixed(1) + "%" : "-"}
                  </td>
                </tr>
              </React.Fragment>
            ))}
            {filteredStocks.length === 0 && (
              <tr>
                <td colSpan="7" className="p-4 text-center text-gray-500">
                  No closed transactions found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {selectedStock && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm flex items-center justify-center px-4" onClick={handleCloseDetails}>
          <div className="bg-gray-900 border border-gray-700/50 rounded-[2.5rem] shadow-2xl w-full max-w-5xl h-[80vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-700/50 px-8 py-6 bg-gray-800/40">
              <div>
                <h3 className="text-xl text-white font-bold tracking-tight">{selectedStock.stock_name}</h3>
                <p className="text-xs text-gray-500 uppercase tracking-widest mt-1 font-bold">Transaction History</p>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={handleExportIndividualToExcel}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors text-emerald-400"
                  title="Download Individual Excel"
                >
                  <Download size={24} />
                </button>
                <button onClick={handleCloseDetails} className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white">
                  <X size={24} />
                </button>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-6 custom-scrollbar">
              <div className="overflow-x-auto rounded-[1.5rem] border border-gray-700/30 custom-scrollbar pb-4">
                <table className="min-w-max w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-gray-800/60 border-b border-gray-700/50">
                      <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Buy Date</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Sell Date</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Quantity</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Buy Price</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Sell Price</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Account</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Type</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Invested</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Closed Value</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">P/L (₹)</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">P/L %</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">XIRR %</th>
                      <th className="px-4 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-center">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700/30">
                    {selectedStockTransactions.length === 0 && (
                      <tr>
                        <td colSpan="13" className="p-8 text-center text-gray-500 font-medium">
                          No closed transactions match the current filters.
                        </td>
                      </tr>
                    )}
                    {selectedStockTransactions.map((txn) => {
                      const invested = txn.quantity * txn.buy_price;
                      const closedValue = txn.quantity * (txn.sell_price || 0);
                      const urp = closedValue - invested;
                      const urpPct = invested > 0 ? (urp / invested) * 100 : 0;
                      const txnXirr = calculateXIRR(txn.buy_date, txn.sell_date, invested, closedValue);
                      return (
                        <tr key={txn.id} className="text-center hover:bg-white/5 transition-colors">
                          <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                            {formatDate(txn.buy_date)}
                          </td>
                          <td className="px-4 py-3 text-gray-300 whitespace-nowrap">
                            {formatDate(txn.sell_date)}
                          </td>
                          <td className="px-4 py-3 text-white font-medium">{txn.quantity}</td>
                          <td className="px-4 py-3 text-gray-300">₹{txn.buy_price.toLocaleString()}</td>
                          <td className="px-4 py-3 text-gray-300">₹{txn.sell_price?.toLocaleString() || "-"}</td>
                          <td className="px-4 py-3 text-gray-300">{txn.account_name}</td>
                          <td className="px-4 py-3 text-gray-300">{txn.account_type}</td>
                          <td className="px-4 py-3 text-gray-300">₹{invested.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                          <td className="px-4 py-3 text-gray-300">₹{closedValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}</td>
                          <td className={`px-4 py-3 font-medium ${urp >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                            ₹{urp.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                          </td>
                          <td className={`px-4 py-3 font-medium ${urpPct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                            {urpPct.toFixed(1)}%
                          </td>
                          <td className={`px-4 py-3 font-medium ${txnXirr >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                            {txnXirr != null ? `${capXIRR(txnXirr).toFixed(1)}%` : "-"}
                          </td>
                          <td className="px-4 py-3 flex justify-center space-x-3">
                            <button
                              onClick={() => handleEdit(txn)}
                              className="p-1.5 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Edit size={14} />
                            </button>
                            <button
                              onClick={() => handleDelete(txn.id)}
                              className="p-1.5 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {editingId && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center px-4" onClick={handleCancel}>
          <div className="bg-gray-900 border border-gray-700/50 rounded-[2.5rem] shadow-2xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-gray-700/50 px-8 py-6 bg-gray-800/40">
              <div>
                <h3 className="text-xl text-white font-bold tracking-tight">Edit Transaction</h3>
                <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1 font-bold">Update details below</p>
              </div>
              <button onClick={handleCancel} className="p-2 hover:bg-white/10 rounded-full transition-colors text-gray-400 hover:text-white">
                <X size={24} />
              </button>
            </div>
            <div className="p-8 space-y-5 max-h-[60vh] overflow-y-auto custom-scrollbar">
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Buy Date</label>
                <input
                  type="date"
                  value={editValues.buy_date || ""}
                  onChange={(e) => handleChange("buy_date", e.target.value)}
                  className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Sell Date</label>
                <input
                  type="date"
                  value={editValues.sell_date || ""}
                  onChange={(e) => handleChange("sell_date", e.target.value)}
                  className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Buy Price</label>
                  <input
                    type="number"
                    value={editValues.buy_price || ""}
                    onChange={(e) => handleChange("buy_price", e.target.value)}
                    className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                    step="0.01"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Sell Price</label>
                  <input
                    type="number"
                    value={editValues.sell_price || ""}
                    onChange={(e) => handleChange("sell_price", e.target.value)}
                    className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 transition-all outline-none"
                    step="0.01"
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Account Name</label>
                <select
                  value={editValues.account_name || ""}
                  onChange={(e) => handleChange("account_name", e.target.value)}
                  className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 transition-all outline-none appearance-none"
                >
                  <option value="" className="bg-gray-900">Select Account</option>
                  {accountOptions.map((acc) => (
                    <option key={acc} value={acc} className="bg-gray-900">
                      {acc}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest ml-1">Account Type</label>
                <select
                  value={editValues.account_type || ""}
                  onChange={(e) => handleChange("account_type", e.target.value)}
                  className="w-full bg-gray-800/50 border border-gray-700/50 rounded-xl px-4 py-3 text-white focus:ring-2 focus:ring-indigo-500 transition-all outline-none appearance-none"
                >
                  <option value="" className="bg-gray-900">Select Type</option>
                  <option value="Free" className="bg-gray-900">Free</option>
                  <option value="Regular" className="bg-gray-900">Regular</option>
                  <option value="ETF" className="bg-gray-900">ETF</option>
                </select>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-gray-700/50 px-8 py-6 bg-gray-800/40">
              <button
                onClick={handleCancel}
                className="px-6 py-3 text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-white transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                className="px-8 py-3 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold uppercase tracking-widest rounded-xl transition-all shadow-lg shadow-indigo-600/20 hover:shadow-indigo-600/40 active:scale-95"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Closed;
