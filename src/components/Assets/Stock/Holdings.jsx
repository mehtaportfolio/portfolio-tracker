import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigation } from "../../../context/NavigationContext.jsx";
import { stockAPI } from "../../../api/stockAPI.js";
import { useStockDataOptimized } from "../../../hooks/useStockDataOptimized.js";
import { useTrialMode } from "../../../hooks/useTrialMode.js";
import { useMode } from "../../../context/ModeContext.jsx";
import { useAuth } from "../../../context/AuthContext.jsx";
import { useLivePrices } from "../../../context/LivePriceContext.jsx";
import { BACKEND_URL } from "../../../config/apiConfig.js";
import * as XLSX from "xlsx";
import { Edit, Trash2, X, TrendingUp, TrendingDown, LogOut, RefreshCw, Activity, PieChart, BarChart3, ArrowUpDown, Search, Download } from "lucide-react";
import { invalidateBulkCache } from "../../../utils/supabasePagination.js";

const EDITABLE_FIELDS = [
  { key: "buy_date", label: "Buy Date", type: "date" },
  { key: "quantity", label: "Quantity", type: "number" },
  { key: "buy_price", label: "Buy Price", type: "number" },
  { key: "account_name", label: "Account Name", type: "select", optionsSource: "accounts" },
  {
    key: "equity_type",
    label: "Equity Type",
    type: "select",
    options: [
      { value: "stocks", label: "Stocks" },
      { value: "etf", label: "ETF" },
      { value: "Stocks", label: "Stocks" },
      { value: "ETF", label: "ETF" },
    ],
  },
  {
    key: "account_type",
    label: "Account Type",
    type: "select",
    options: [
      { value: "Free", label: "Free" },
      { value: "Regular", label: "Regular" },
      { value: "free", label: "Free" },
      { value: "regular", label: "Regular" },
    ],
  },
];

// Note: We still keep Supabase import for write operations (delete/update)

// 🔹 Helper: Calculate XIRR (percentage)
const calculateXIRR = (cashflows) => {
  if (!cashflows || cashflows.length < 2) return null;

  const npv = (rate) =>
    cashflows.reduce(
      (acc, cf) =>
        acc +
        cf.amount /
          Math.pow(1 + rate, (cf.date - cashflows[0].date) / (1000 * 60 * 60 * 24 * 365)),
      0
    );

  let low = -0.9999, high = 100, guess = 0.1;
  for (let i = 0; i < 100; i++) {
    const mid = (low + high) / 2;
    const val = npv(mid);
    if (Math.abs(val) < 1e-6) return mid * 100; // %
    if (val > 0) low = mid; else high = mid;
    guess = mid;
  }
  return guess * 100;
};

const formatDate = (dateStr) => {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
 return d
  .toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "2-digit" })
  .replace(/\//g, "-");

};

// Format amounts in Indian system with short units (Cr, L).
function formatINRShort(value) {
  const num = Number(value) || 0;
  const abs = Math.abs(num);

  const CRORE = 1e7; // 1,00,00,000
  const LAKH = 1e5;  // 1,00,000
  const THOUSAND = 1e3; // 1,000

  if (abs >= CRORE) return `₹${(num / CRORE).toFixed(2)} Cr`;
  if (abs >= LAKH) return `₹${(num / LAKH).toFixed(2)} L`;
  if (abs >= THOUSAND) return `₹${(num / THOUSAND).toFixed(2)} K`;
  
  return `₹${num.toLocaleString("en-IN")}`;
}

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

// 🔹 Compute summary for open holdings (totals + XIRR)
const computeOpenSummary = (stocksList) => {
  let invested = 0, currentValue = 0, dayChange = 0;
  const cashflows = [];

  (stocksList || []).forEach((stock) => {
    invested += Number(stock.invested) || 0;
    currentValue += Number(stock.marketValue) || 0;

    const cmp = Number(stock.livePrice) || 0;
    const lcp = Number(stock.lcp) || 0;
    
    // Use filteredTransactions if they exist (from recalculateOpenStockTotals), else use transactions
    const txnsToUse = stock.filteredTransactions || stock.transactions || [];
    
    const openQty = txnsToUse.reduce(
      (sum, t) => (!t.sell_date ? sum + (Number(t.quantity) || 0) : sum),
      0
    );
    dayChange += openQty * (cmp - lcp);

    txnsToUse.forEach((txn) => {
      if (!txn.sell_date && txn.buy_date) {
        const qty = Number(txn.quantity) || 0;
        const buy = Number(txn.buy_price) || 0;
        cashflows.push({ amount: -(qty * buy), date: new Date(txn.buy_date) });
      }
    });
  });

  if (currentValue > 0) {
    cashflows.push({ amount: currentValue, date: new Date() });
  }

  const absReturn = currentValue - invested;
  const returnPct = invested > 0 ? (absReturn / invested) * 100 : 0;
  const xirr = calculateXIRR(cashflows);

  return { invested, currentValue, dayChange, absReturn, returnPct, xirr };
};

const defaultSummary = {
  invested: 0,
  currentValue: 0,
  dayChange: 0,
  absReturn: 0,
  returnPct: 0,
  xirr: null,
};


const Holdings = () => {
  const { isTrialMode } = useTrialMode();
  const { dashboardRefresh, assetsRefresh } = useNavigation();
  const { priceSource } = useMode();
  const { livePrices } = useLivePrices();
  // Use optimized backend API instead of direct Supabase queries
  const { stocks: backendStocks, fetchStockData } = useStockDataOptimized();
  const { session } = useAuth();

  const invalidateBackendCache = async () => {
    try {
      if (!session?.access_token) return;
      const response = await fetch(`${BACKEND_URL}/api/stock/invalidate-cache`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
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

  const [openStocks, setOpenStocks] = useState([]);
  const [filteredStocks, setFilteredStocks] = useState([]);
  const originalStocksRef = useRef([]);

  const [selectedStockName, setSelectedStockName] = useState(null);
  const [detailScrollY, setDetailScrollY] = useState(0);
  const [selectedStockTransactions, setSelectedStockTransactions] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [sellingTxn, setSellingTxn] = useState(null); // store selected transaction
  const [sellValues, setSellValues] = useState({});
  const [accountFilter, setAccountFilter] = useState("");
  const [accountOptions, setAccountOptions] = useState([]);
  const [accountTypeFilter, setAccountTypeFilter] = useState("");
  const [buyDateFilter, setBuyDateFilter] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "stock_name", direction: "asc" });
  const [isSortMenuOpen, setIsSortMenuOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);

  const computeFilteredTransactions = useCallback(
    (stock) => {
      if (!stock) return [];
      return (stock.transactions || []).filter((txn) => {
        if (txn.sell_date) return false;
        if (accountFilter && txn.account_name !== accountFilter) return false;
        if (accountTypeFilter && txn.account_type !== accountTypeFilter) return false;
        if (
          buyDateFilter &&
          !(txn.buy_date && String(txn.buy_date).slice(0, 10) === buyDateFilter)
        ) {
          return false;
        }
        return true;
      });
    },
    [accountFilter, accountTypeFilter, buyDateFilter]
  );

  const handleStockRowClick = useCallback(
    (stockName) => {
      const stock = filteredStocks.find((item) => item.stock_name === stockName);
      if (typeof window !== "undefined") {
        setDetailScrollY(window.scrollY || 0);
      }
      setSelectedStockTransactions(computeFilteredTransactions(stock));
      setSelectedStockName(stockName);
      setEditingId(null);
    },
    [filteredStocks, computeFilteredTransactions]
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


  const handleCloseDetails = useCallback(() => {
    if (typeof window !== "undefined") {
      window.scrollTo({ top: detailScrollY, behavior: "smooth" });
    }
    setSelectedStockName(null);
    setSelectedStockTransactions([]);
    setEditingId(null);
  }, [detailScrollY]);

  useEffect(() => {
    setEditingId(null);
  }, [dashboardRefresh, assetsRefresh]);

  // 🔹 Update filteredStocks whenever backendStocks changes
  useEffect(() => {
  
    const openOnlyStocks = (backendStocks || [])
      .map((stock) => {
        const openTransactions = (stock.transactions || []).filter((txn) => {
          const equityType = String(txn.equity_type || txn.equityType || "").trim().toLowerCase();
          return !txn.sell_date && (equityType === "stock" || equityType === "stocks");
        });

        if (openTransactions.length === 0) {
          return null;
        }

        const invested = openTransactions.reduce((sum, txn) => {
          const qty = Number(txn.quantity) || 0;
          const buyPrice = Number(txn.buy_price) || 0;
          return sum + qty * buyPrice;
        }, 0);

        const totalQty = openTransactions.reduce((sum, txn) => {
          const qty = Number(txn.quantity) || 0;
          return sum + qty;
        }, 0);

        const livePriceFromWs = (priceSource === 'live' && stock.symbol_ao) ? livePrices[stock.symbol_ao] : null;
        const cmp = livePriceFromWs || Number(stock.livePrice) || 0;
        const marketValue = totalQty * cmp;
        const urp = marketValue - invested;
        const urpPct = invested > 0 ? (urp / invested) * 100 : 0;
        const avgBuyPrice = totalQty > 0 ? invested / totalQty : 0;

        const cashflows = openTransactions
          .filter((txn) => txn.buy_date)
          .map((txn) => ({
            amount: -((Number(txn.quantity) || 0) * (Number(txn.buy_price) || 0)),
            date: new Date(txn.buy_date),
          }));

        if (totalQty > 0 && cmp > 0) {
          cashflows.push({ amount: marketValue, date: new Date() });
        }

        const xirr = cashflows.length >= 2 ? calculateXIRR(cashflows) : null;

        return {
          ...stock,
          invested,
          marketValue,
          urp,
          urpPct,
          avgBuyPrice,
          xirr,
          openTransactions,
          transactions: openTransactions,
          category: stock.category || "",
          sector: stock.sector || "",
          basic_industry: stock.basic_industry || "",
        };
      })
      .filter(Boolean);

    originalStocksRef.current = openOnlyStocks;
    setOpenStocks(openOnlyStocks);
    setFilteredStocks(openOnlyStocks);
    setIsRefreshing(false);
  }, [backendStocks, livePrices, priceSource]);

// 🔹 Helper function to recalculate stock totals based on filtered open transactions
const recalculateOpenStockTotals = useCallback((stock, filters) => {
  const { buyDateFilter, accountFilter, accountTypeFilter } = filters;

  let invested = 0;
  let openQty = 0;
  const cashflows = [];

  const filteredTransactions = (stock.openTransactions || []).filter((txn) => {
    const buyMatch =
      !buyDateFilter ||
      (txn.buy_date && String(txn.buy_date).slice(0, 10) === buyDateFilter);
    const accountMatch = !accountFilter || txn.account_name === accountFilter;
    const accountTypeMatch =
      !accountTypeFilter || txn.account_type === accountTypeFilter;

    return buyMatch && accountMatch && accountTypeMatch;
  });

  filteredTransactions.forEach((txn) => {
    const qty = Number(txn.quantity) || 0;
    const buyPrice = Number(txn.buy_price) || 0;
    invested += qty * buyPrice;
    openQty += qty;

    if (txn.buy_date) {
      cashflows.push({ amount: -(qty * buyPrice), date: new Date(txn.buy_date) });
    }
  });

  const livePriceFromWs = (priceSource === 'live' && stock.symbol_ao) ? livePrices[stock.symbol_ao] : null;
  const cmp = livePriceFromWs || Number(stock.livePrice) || 0;
  const marketValue = openQty * cmp;
  const urp = marketValue - invested;
  const urpPct = invested > 0 ? (urp / invested) * 100 : 0;
  const avgBuyPrice = openQty > 0 ? invested / openQty : 0;

  let xirr = null;
  if (openQty > 0 && cmp > 0 && cashflows.length > 0) {
    cashflows.push({ amount: marketValue, date: new Date() });
    xirr = calculateXIRR(cashflows);
  }

  return {
    ...stock,
    invested,
    marketValue,
    urp,
    urpPct,
    avgBuyPrice,
    xirr,
    filteredTransactions,
    basic_industry: stock.basic_industry || "",
  };
}, [priceSource, livePrices]);

useEffect(() => {
  const filtered = openStocks
    .filter((stock) => {
      const nameMatch = stock.stock_name
        .toLowerCase()
        .includes(searchQuery.toLowerCase());

      const buyDateMatch = !buyDateFilter
        ? true
        : (stock.openTransactions || []).some(
            (t) =>
              t.buy_date &&
              String(t.buy_date).slice(0, 10) === buyDateFilter
          );

      const accountMatch = !accountFilter
        ? true
        : (stock.openTransactions || []).some(
            (t) => t.account_name === accountFilter
          );

      const accountTypeMatch = !accountTypeFilter
        ? true
        : (stock.openTransactions || []).some(
            (t) => t.account_type === accountTypeFilter
          );

      return nameMatch && buyDateMatch && accountMatch && accountTypeMatch;
    })
    .map((stock) =>
      recalculateOpenStockTotals(stock, {
        buyDateFilter,
        accountFilter,
        accountTypeFilter,
      })
    );

  const sorted = sortStocks(filtered, sortConfig);

  setFilteredStocks(sorted);
}, [
  searchQuery,
  buyDateFilter,
  accountFilter,
  accountTypeFilter,
  openStocks,
  sortConfig,
  recalculateOpenStockTotals,
]);

// 🔹 Extract account names from backend stocks data
useEffect(() => {
  const accounts = [];
  (backendStocks || []).forEach((stock) => {
    (stock.transactions || []).forEach((txn) => {
      if (txn.account_name && !accounts.includes(txn.account_name)) {
        accounts.push(txn.account_name);
      }
    });
  });
  accounts.sort();
  setAccountOptions(accounts);
}, [backendStocks]);

useEffect(() => {
  if (!selectedStockName) return;
  const stock = openStocks.find((item) => item.stock_name === selectedStockName);
  if (!stock) {
    setSelectedStockName(null);
    setSelectedStockTransactions([]);
    setEditingId(null);
    return;
  }

  setSelectedStockTransactions(computeFilteredTransactions(stock));
}, [selectedStockName, openStocks, computeFilteredTransactions]);


  const handleDelete = async (id) => {
    if (selectedStockName) {
      const refreshed = filteredStocks.find((stock) => stock.stock_name === selectedStockName);
      if (!refreshed) {
        setSelectedStockName(null);
      }
    }
    
    try {
      await stockAPI.deleteTransaction(id);
      alert("🗑 Transaction deleted successfully");
      setIsRefreshing(true);
      await invalidateBackendCache();
      await new Promise(resolve => setTimeout(resolve, 500));
      await fetchStockData();
      setIsRefreshing(false);
    } catch (error) {
      console.error("Delete failed:", error);
      alert("❌ Failed to delete transaction");
    }
  };

  const openEditModal = (txn) => {
    setEditingId(txn.id);
    setEditValues({ ...txn });
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    setEditingId(null);
    setEditValues({});
    setIsEditModalOpen(false);
  };

  const handleEditFieldChange = (fieldKey, value) => {
    setEditValues((prev) => ({ ...prev, [fieldKey]: value }));
  };

  const handleEditModalSave = async () => {
    if (!editingId) return;
    const payload = EDITABLE_FIELDS.reduce((acc, field) => {
      if (typeof editValues[field.key] !== "undefined") {
        if (field.type === "number") {
          const parsed = parseFloat(editValues[field.key]);
          acc[field.key] = Number.isFinite(parsed) ? parsed : null;
        } else {
          acc[field.key] = editValues[field.key];
        }
      }
      return acc;
    }, {});

    try {
      await stockAPI.updateTransaction(editingId, payload);
      alert("✅ Transaction updated successfully");
      closeEditModal();
      setIsRefreshing(true);
      await invalidateBackendCache();
      await new Promise(resolve => setTimeout(resolve, 500));
      await fetchStockData();
      setIsRefreshing(false);
    } catch (error) {
      console.error("Update failed:", error);
      alert("❌ Failed to update transaction");
    }
  };

  // --- Sell Handlers ---
  const openSellPopup = (txn) => {
    setSellingTxn(txn);
    setSellValues({
      stock_name: txn.stock_name,
      sell_date: "",
      sell_price: "",
      sell_quantity: txn.quantity,
    });
  };

  const handleCancelSell = () => {
    setSellingTxn(null);
    setSellValues({});
  };

  const handleSaveSell = async () => {
    const sellQty = Number(sellValues.sell_quantity);
    const originalQty = Number(sellingTxn.quantity);

    if (sellQty <= 0 || sellQty > originalQty) {
      alert("Invalid sell quantity");
      return;
    }

    try {
      await stockAPI.sellTransaction(sellingTxn.id, {
        sellQty,
        sellDate: sellValues.sell_date,
        sellPrice: sellValues.sell_price
      });
      alert("✅ Transaction sold successfully");
      setSellingTxn(null);
      setSellValues({});
      setIsRefreshing(true);
      await invalidateBackendCache();
      await new Promise((resolve) => setTimeout(resolve, 500));
      await fetchStockData();
      setIsRefreshing(false);
    } catch (error) {
      console.error("Sell failed:", error);
      alert("❌ Failed to sell transaction");
    }
  };

  const selectedStock = selectedStockName
    ? filteredStocks.find((item) => item.stock_name === selectedStockName) ||
      originalStocksRef.current.find((item) => item.stock_name === selectedStockName)
    : null;

  const localSummary = computeOpenSummary(filteredStocks);

  const fallbackSummary = openStocks.length > 0 ? computeOpenSummary(openStocks) : defaultSummary;
  const displaySummary = filteredStocks.length > 0 ? localSummary : fallbackSummary;

  const safeSummary = {
    invested: Number(displaySummary?.invested) || 0,
    currentValue: Number(displaySummary?.currentValue) || 0,
    dayChange: Number(displaySummary?.dayChange) || 0,
    absReturn: Number(displaySummary?.absReturn) || 0,
    returnPct:
      typeof displaySummary?.returnPct === "number" && Number.isFinite(displaySummary.returnPct)
        ? displaySummary.returnPct
        : 0,
    xirr:
      typeof displaySummary?.xirr === "number" && Number.isFinite(displaySummary.xirr)
        ? displaySummary.xirr
        : null,
  };

  const handleExportIndividualToExcel = () => {
    if (!selectedStock || !selectedStockTransactions.length) return;
    
    const dataToExport = selectedStockTransactions.map(txn => {
      const invested = txn.quantity * txn.buy_price;
      const marketValue = txn.quantity * (parseFloat(selectedStock.livePrice) || 0);
      const urp = marketValue - invested;
      const urpPct = invested > 0 ? (urp / invested) * 100 : 0;

      return {
        stock_name: selectedStock.stock_name,
        s_broad_sector: selectedStock.s_broad_sector || selectedStock.broad_sector || "-",
        s_sector: selectedStock.s_sector || selectedStock.sector || "-",
        s_broad_industry: selectedStock.s_broad_industry || selectedStock.broad_industry || "-",
        s_industry: selectedStock.s_industry || selectedStock.industry || "-",
        category: selectedStock.category || "-",
        sector: selectedStock.sector || "-",
        macro_sector: selectedStock.macro_sector || "-",
        known_sector: selectedStock.known_sector || "-",
        basic_industry: selectedStock.basic_industry || "-",
        buy_date: formatDate(txn.buy_date),
        quantity: txn.quantity,
        "Buy Price": txn.buy_price,
        "Account Name": txn.account_name,
        "Account Type": txn.account_type,
        "Invested": Number(invested.toFixed(2)),
        "Market Value": Number(marketValue.toFixed(2)),
        "P&L": Number(urp.toFixed(2)),
        "P&L %": Number(urpPct.toFixed(2))
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Individual_Holdings");
    XLSX.writeFile(workbook, `${selectedStock.stock_name}_Holdings_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleExportToExcel = () => {
    const dataToExport = filteredStocks.map(stock => {
      const transactions = stock.filteredTransactions || stock.transactions || [];
      const totalQty = transactions.reduce((sum, t) => sum + (Number(t.quantity) || 0), 0);
      
      const uniqueAccounts = [...new Set(transactions.map(t => t.account_name).filter(Boolean))].join(" & ");
      const uniqueAccountTypes = [...new Set(transactions.map(t => t.account_type).filter(Boolean))].join(" & ");

      return {
        stock_name: stock.stock_name,
        s_broad_sector: stock.s_broad_sector || stock.broad_sector || "-",
        s_sector: stock.s_sector || stock.sector || "-",
        s_broad_industry: stock.s_broad_industry || stock.broad_industry || "-",
        s_industry: stock.s_industry || stock.industry || "-",
        category: stock.category || "-",
        sector: stock.sector || "-",
        macro_sector: stock.macro_sector || "-",
        known_sector: stock.known_sector || "-",
        basic_industry: stock.basic_industry || "-",
        account_name: uniqueAccounts || "-",
        account_type: uniqueAccountTypes || "-",
        quantity: totalQty,
        "Avg Buy Price": isTrialMode ? 0 : Number(stock.avgBuyPrice),
        "Invested": isTrialMode ? 0 : Number(stock.invested),
        "Market Value": isTrialMode ? 0 : Number(stock.marketValue),
        "LTP": isTrialMode ? 0 : Number(stock.livePrice),
        "P&L": isTrialMode ? 0 : Number(stock.urp),
        "P&L %": isTrialMode ? 0 : Number(stock.urpPct),
        "XIRR %": typeof (isTrialMode ? 0 : stock.xirr) === "number" && !isNaN(isTrialMode ? 0 : stock.xirr)
          ? Number((isTrialMode ? 0 : stock.xirr))
          : null
      };
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Holdings");
    XLSX.writeFile(workbook, `Holdings_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="pb-20 relative">
{/* Loading Overlay */}
{isRefreshing && (
  <div className="fixed inset-0 z-50 bg-black bg-opacity-40 flex items-center justify-center">
    <div className="bg-white rounded-lg p-8 flex flex-col items-center gap-4">
      <div className="w-12 h-12 border-4 border-blue-300 border-t-blue-600 rounded-full animate-spin"></div>
      <p className="text-lg font-semibold text-gray-700">Refreshing data...</p>
    </div>
  </div>
)}

{/* 🔹 Portfolio Summary Cards (Apple Touch Look) */}
<div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4 sm:gap-6 mb-8">
  {/* 1) Total Stock Value */}
  <div className="bg-gradient-to-br from-blue-600/20 to-indigo-900/40 backdrop-blur-xl p-4 sm:p-6 rounded-[2rem] shadow-xl border border-blue-500/20 flex flex-col justify-between hover:from-blue-600/30 hover:to-indigo-900/50 transition-all duration-300 group overflow-hidden relative">
    <div className="absolute -right-4 -top-4 w-20 h-20 bg-blue-500/10 blur-2xl rounded-full" />
    <div className="flex items-center gap-2 sm:gap-3 mb-2 relative z-10">
      <div className="p-2 sm:p-2.5 bg-blue-500/30 rounded-2xl text-blue-300 group-hover:scale-110 transition-transform">
        <TrendingUp size={18} strokeWidth={2.5} />
      </div>
      <h3 className="text-[12px] sm:text-xs font-bold text-blue-200/70 uppercase tracking-widest">Market Value</h3>
    </div>
    <div className="relative z-10">
      <p className="text-2xl sm:text-2xl font-bold text-white mb-1 tracking-tight">{formatINRShort(isTrialMode ? 0 : safeSummary.currentValue)}</p>
      <p className="text-[13px] sm:text-xs font-medium mt-4 text-emerald-400">
        Invested: <span className="text-blue-100">₹{isTrialMode ? 0 : (safeSummary.invested / 100000).toFixed(2)}L</span>
      </p>
    </div>
  </div>

  {/* 2) Day's Change */}
  <div className={`bg-gradient-to-br ${ (isTrialMode ? 0 : safeSummary.dayChange) >= 0 ? "from-cyan-600/20 to-blue-900/40 border-cyan-500/20" : "from-pink-600/20 to-purple-900/40 border-pink-500/20" } backdrop-blur-xl p-4 sm:p-6 rounded-[2rem] shadow-xl border flex flex-col justify-between hover:opacity-90 transition-all duration-300 group overflow-hidden relative`}>
    <div className={`absolute -right-4 -top-4 w-20 h-20 ${ (isTrialMode ? 0 : safeSummary.dayChange) >= 0 ? "bg-cyan-500/10" : "bg-pink-500/10" } blur-2xl rounded-full`} />
    <div className="flex items-center gap-2 sm:gap-3 mb-4 relative z-10">
      <div className={`p-2 sm:p-2.5 rounded-2xl ${ (isTrialMode ? 0 : safeSummary.dayChange) >= 0 ? "bg-cyan-500/30 text-cyan-300" : "bg-pink-500/30 text-pink-300" } group-hover:scale-110 transition-transform`}>
        <BarChart3 size={18} strokeWidth={2.5} />
      </div>
      <h3 className={`text-[10px] sm:text-xs font-bold ${ (isTrialMode ? 0 : safeSummary.dayChange) >= 0 ? "text-cyan-200/70" : "text-pink-200/70" } uppercase tracking-widest`}>Day's Change</h3>
    </div>
    <div className="relative z-10">
      <p className={`text-xl sm:text-2xl font-bold tracking-tight mb-1 ${ (isTrialMode ? 0 : safeSummary.dayChange) >= 0 ? "text-emerald-400" : "text-rose-400" }`}>
        {(isTrialMode ? 0 : safeSummary.dayChange) >= 0 ? "+" : ""}{formatINRShort(isTrialMode ? 0 : safeSummary.dayChange)}
      </p>
      <p className={`text-l0 sm:text-lg font-bold tracking-tight mb-1 ${ (isTrialMode ? 0 : safeSummary.dayChange) >= 0 ? "text-emerald-400" : "text-rose-400" }`}>
        ({(((isTrialMode ? 0 : safeSummary.dayChange) / ((isTrialMode ? 0 : safeSummary.currentValue) - (isTrialMode ? 0 : safeSummary.dayChange) || 1)) * 100).toFixed(2)}%)
      </p>
    </div>
  </div>

  {/* 4) Net Returns */}
  <div className={`bg-gradient-to-br ${ (isTrialMode ? 0 : safeSummary.absReturn) >= 0 ? "from-emerald-600/20 to-teal-900/40 border-emerald-500/20" : "from-rose-600/20 to-red-900/40 border-rose-500/20" } backdrop-blur-xl p-4 sm:p-6 rounded-[2rem] shadow-xl border flex flex-col justify-between hover:opacity-90 transition-all duration-300 group overflow-hidden relative`}>
    <div className={`absolute -right-4 -top-4 w-20 h-20 ${ (isTrialMode ? 0 : safeSummary.absReturn) >= 0 ? "bg-emerald-500/10" : "bg-rose-500/10" } blur-2xl rounded-full`} />
    <div className="flex items-center gap-2 sm:gap-3 mb-4 relative z-10">
      <div className={`p-2 sm:p-2.5 rounded-2xl ${ (isTrialMode ? 0 : safeSummary.absReturn) >= 0 ? "bg-emerald-500/30 text-emerald-300" : "bg-rose-500/30 text-rose-300" } group-hover:scale-110 transition-transform`}>
        <PieChart size={18} strokeWidth={2.5} />
      </div>
      <h3 className={`text-[10px] sm:text-xs font-bold ${ (isTrialMode ? 0 : safeSummary.absReturn) >= 0 ? "text-emerald-200/70" : "text-rose-200/70" } uppercase tracking-widest`}>Unrealized P/L</h3>
    </div>
    <div className="relative z-10">
      <p className={`text-xl sm:text-2xl font-bold tracking-tight ml-6 mb-1 ${ (isTrialMode ? 0 : safeSummary.absReturn) >= 0 ? "text-emerald-400" : "text-rose-400" }`}>
        {(isTrialMode ? 0 : safeSummary.absReturn) >= 0 ? "+" : ""} {formatINRShort(isTrialMode ? 0 : safeSummary.absReturn)}
      </p>
    </div>
  </div>

  {/* 5) Returns% */}
  <div className="bg-gradient-to-br from-violet-600/20 to-purple-900/40 backdrop-blur-xl p-4 sm:p-6 rounded-[2rem] shadow-xl border border-violet-500/20 flex flex-col justify-between hover:from-violet-600/30 hover:to-purple-900/50 transition-all duration-300 group overflow-hidden relative">
    <div className="absolute -right-4 -top-4 w-20 h-20 bg-violet-500/10 blur-2xl rounded-full" />
    <div className="flex items-center gap-2 sm:gap-3 mb-4 relative z-10">
      <div className="p-2 sm:p-2.5 bg-violet-500/30 rounded-2xl text-violet-300 group-hover:scale-110 transition-transform">
        <Activity size={18} strokeWidth={2.5} />
      </div>
      <h3 className="text-[10px] sm:text-xs font-bold text-violet-200/70 uppercase tracking-widest">Returns%</h3>
    </div>
    <div className="relative z-10">
      <div className="space-y-1">
        <p className={`text-lm sm:text-base font-bold ${ (isTrialMode ? 0 : safeSummary.returnPct) >= 0 ? "text-emerald-400" : "text-rose-400" }`}>
          IRR: {(isTrialMode ? 0 : safeSummary.returnPct).toFixed(2)}%
        </p>
        <p className={`text-lm sm:text-base font-bold ${ safeSummary.xirr != null && (isTrialMode ? 0 : safeSummary.xirr) >= 0 ? "text-emerald-400" : "text-rose-400" }`}>
          XIRR: {safeSummary.xirr != null ? `${(isTrialMode ? 0 : safeSummary.xirr).toFixed(2)}%` : "-"}
        </p>
      </div>
    </div>
  </div>
</div>

{/* Search + Filters (Apple Style) */}
<div className="mb-8 flex flex-col gap-4 bg-white/5 backdrop-blur-2xl p-6 rounded-[2.5rem] border border-white/10 shadow-2xl">
  {/* Line 1: Search, Sort, Date */}
  <div className="flex items-center gap-4 w-full">
    {/* Search Toggle */}
    <div className={`relative flex items-center transition-all duration-300 ${isSearchExpanded ? 'w-full' : 'w-12'}`}>
      {isSearchExpanded ? (
        <div className="relative w-full">
          <input
            type="text"
            placeholder="Search stocks..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-white/10 border border-white/10 text-white placeholder-blue-200/30 rounded-2xl pl-12 pr-10 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all duration-300"
            autoFocus
          />
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-200/30">
            <Search size={20} />
          </div>
          <button 
            onClick={() => { setIsSearchExpanded(false); setSearchQuery(""); }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-200/30 hover:text-white"
          >
            <X size={18} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setIsSearchExpanded(true)}
          className="p-3 bg-white/10 border border-white/10 text-blue-400 hover:bg-white/20 rounded-2xl transition-all duration-300 w-full flex justify-center"
          title="Search"
        >
          <Search size={20} />
        </button>
      )}
    </div>

    {!isSearchExpanded && (
      <>
        {/* Sort Icon */}
        <button
          onClick={() => setIsSortMenuOpen(true)}
          className="p-3 bg-white/10 border border-white/10 text-blue-400 hover:bg-white/20 rounded-2xl transition-all duration-300"
          title="Sort holdings"
        >
          <ArrowUpDown size={20} />
        </button>

        {/* Date Filter */}
        <div className="relative flex-1">
          <input
            id="buyDate"
            type="date"
            value={buyDateFilter}
            onChange={(e) => setBuyDateFilter(e.target.value)}
            className="w-full bg-white/10 border border-white/10 text-white rounded-2xl px-5 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 cursor-pointer transition-all duration-300 [color-scheme:dark]"
            title="Filter by Buy Date"
          />
        </div>
      </>
    )}
  </div>

  {/* Line 2: Account & Type */}
  <div className="flex gap-4 w-full items-center">
    <div className="relative flex-1">
      <select
        name="account_name"
        value={accountFilter}
        onChange={(e) => setAccountFilter(e.target.value)}
        className="w-full bg-white/10 border border-white/10 text-white rounded-2xl px-5 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none cursor-pointer transition-all duration-300 pr-12"
      >
        <option value="" className="bg-slate-900">Account Names</option>
        {accountOptions.map((acc) => (
          <option key={acc} value={acc} className="bg-slate-900">
            {acc}
          </option>
        ))}
      </select>
      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-blue-200/40">
        <Activity size={16} />
      </div>
    </div>

    <div className="relative flex-1">
      <select
        name="account_type"
        value={accountTypeFilter}
        onChange={(e) => setAccountTypeFilter(e.target.value)}
        className="w-full bg-white/10 border border-white/10 text-white rounded-2xl px-5 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none cursor-pointer transition-all duration-300 pr-12"
      >
        <option value="" className="bg-slate-900">Account Types</option>
        <option value="Free" className="bg-slate-900">Free</option>
        <option value="Regular" className="bg-slate-900">Regular</option>
      </select>
      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-blue-200/40">
        <PieChart size={16} />
      </div>
    </div>

    <button
      onClick={handleExportToExcel}
      className="p-3 bg-white/10 border border-white/10 text-emerald-400 hover:bg-white/20 rounded-2xl transition-all duration-300 flex items-center justify-center shrink-0"
      title="Download Excel"
    >
      <Download size={20} />
    </button>
  </div>
</div>

      

      {/* Stocks List (Zerodha Mobile Style) */}
      <div className="space-y-4 px-2 sm:px-0 mb-10">
        {filteredStocks.map((stock) => {
          const transactions = stock.filteredTransactions || stock.transactions || [];
          const totalQty = transactions.reduce((sum, t) => sum + (Number(t.quantity) || 0), 0);
          const isPositive = (isTrialMode ? 0 : stock.urp) >= 0;
          
          return (
            <div
              key={stock.stock_name}
              className="bg-slate-900/40 backdrop-blur-2xl border border-white/10 rounded-[2rem] p-6 hover:bg-white/5 transition-all duration-300 cursor-pointer group shadow-2xl relative overflow-hidden"
              onClick={() => handleStockRowClick(stock.stock_name)}
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl rounded-full -mr-16 -mt-16 pointer-events-none"></div>
              
              <div className="flex justify-between items-center relative z-10">
                {/* Left Side */}
                <div className="space-y-2">
                  {/* Line 1: Total Qty, Avg Buy Price */}
                  <div className="text-[10px] font-bold text-blue-100/30 uppercase tracking-[0.2em] flex items-center gap-2">
                    <span className="bg-white/5 px-2 py-0.5 rounded-md">Qty: {totalQty}</span>
                    <span className="w-1.5 h-1.5 bg-white/10 rounded-full"></span>
                    <span className="bg-white/5 px-2 py-0.5 rounded-md">Avg: ₹{(isTrialMode ? 0 : stock.avgBuyPrice).toFixed(2)}</span>
                  </div>
                  
                  {/* Line 2: Stock Name */}
                  <h4 
                    className="text-2xl font-black text-white group-hover:text-blue-400 transition-colors tracking-tighter cursor-pointer flex items-center gap-2 w-fit"
                    onClick={(e) => {
                      e.stopPropagation();
                      window.open(`https://www.tradingview.com/chart/?symbol=NSE:${stock.stock_name}`, "_blank");
                    }}
                    title="Open TradingView Chart"
                  >
                    {stock.stock_name}
                    <BarChart3 size={18} className="text-blue-400/50 group-hover:text-blue-400 transition-colors" />
                  </h4>
                  
                  {/* Line 3: Invested Amount & Market Value */}
                  <div className="text-[11px] font-bold text-blue-100/50 flex items-center gap-3">
                    <div className="flex items-center gap-1.5">
                      <span className="opacity-50">IV:</span>
                      <span className="text-white/80">{formatINRShort(isTrialMode ? 0 : stock.invested)}</span>
                    </div>
                    <span className="text-white/10">||</span>
                    <div className="flex items-center gap-1.5">
                      <span className="opacity-50">MV:</span>
                      <span className="text-white/80">{formatINRShort(isTrialMode ? 0 : stock.marketValue)}</span>
                    </div>
                  </div>
                </div>

                {/* Right Side */}
                <div className="text-right space-y-2">
                  {/* Line 1: Overall Net Return% + XIRR */}
                  <div className={`text-[10px] font-black tracking-widest px-2.5 py-1 rounded-lg inline-flex items-center gap-2 ${isPositive ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"}`}>
                    <span>{(isTrialMode ? 0 : stock.urpPct).toFixed(1)}%</span>
                    <span className="w-1 h-1 bg-current opacity-30 rounded-full"></span>
                    <span className="opacity-70">
                      {typeof (isTrialMode ? 0 : stock.xirr) === "number" && !isNaN(isTrialMode ? 0 : stock.xirr)
                        ? `(${(isTrialMode ? 0 : stock.xirr).toFixed(1)}%)`
                        : "-"}
                    </span>
                  </div>
                  
                  {/* Line 2: Return in Absolute */}
                  <div className={`text-2xl font-black tracking-tighter ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
                    {isPositive ? "+" : ""}₹ {(isTrialMode ? 0 : stock.urp).toFixed(0)}
                  </div>
                  
                  {/* Line 3: CMP (Daily % Change) */}
                  <div className="flex items-center justify-end gap-2">
                    <div className="text-sm font-bold text-white tracking-tight">
                      ₹ {isTrialMode ? 0 : stock.livePrice}
                    </div>
                    {stock.changePct != null && !isNaN(stock.changePct) && (
                      <div className={`text-[10px] font-bold flex items-center gap-1 ${
                        (isTrialMode ? 0 : stock.changePct) >= 0 ? "text-emerald-400" : "text-rose-400"
                      }`}>
                        ({(isTrialMode ? 0 : stock.changePct) >= 0 ? <TrendingUp size={10} strokeWidth={3} /> : <TrendingDown size={10} strokeWidth={3} />}
                        {(isTrialMode ? 0 : stock.changePct).toFixed(1)}%)
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {filteredStocks.length === 0 && (
          <div className="text-center py-32 bg-white/5 backdrop-blur-2xl rounded-[3.5rem] border border-white/10 shadow-2xl">
            <div className="p-6 bg-white/5 rounded-full inline-block mb-6">
              <Activity size={48} className="text-blue-400/20" />
            </div>
            <p className="text-2xl font-bold text-blue-100/20 tracking-tight">No holdings found in your portfolio</p>
          </div>
        )}
      </div>

      {selectedStock && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center px-4 transition-all duration-300"
          onClick={handleCloseDetails}
        >
          <div
            className="bg-slate-900/90 backdrop-blur-2xl rounded-[3.5rem] shadow-[0_0_80px_rgba(0,0,0,0.6)] border border-white/10 w-full max-w-6xl h-[85vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-white/10 px-10 py-8 bg-white/5">
              <div className="flex items-center gap-5">
                <div className="p-4 bg-blue-500/20 rounded-xl text-blue-400 shadow-lg shadow-blue-500/20">
                   <Activity size={20} />
                </div>
                <div>
                  <h3 className="text-xl text-white font-bold tracking-tight">
                    {selectedStock.stock_name}
                  </h3>
                  <p className="text-blue-200/40 text-xs font-bold tracking-widest mt-1">Detailed Holdings Breakdown</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={handleExportIndividualToExcel}
                  className="p-4 bg-white/5 hover:bg-white/10 text-emerald-400 rounded-xl transition-all duration-300 border border-white/5 group"
                  title="Download Individual Excel"
                >
                  <Download size={20} />
                </button>
                <button
                  onClick={async () => {
                    setIsRefreshing(true);
                    await invalidateBackendCache();
                    await fetchStockData();
                    setIsRefreshing(false);
                  }}
                  className="p-4 bg-white/5 hover:bg-white/10 text-blue-400 rounded-xl transition-all duration-300 border border-white/5 group"
                  title="Refresh Stock Data"
                >
                  <RefreshCw size={20} className={isRefreshing ? "animate-spin" : "group-hover:rotate-180 transition-transform duration-500"} />
                </button>
                <button
                  onClick={handleCloseDetails}
                  className="p-4 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 rounded-xl transition-all duration-300 border border-rose-500/10"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-hidden p-2">
              <div className="h-full overflow-auto rounded-[2.5rem] border border-white/10 bg-white/5 shadow-inner">
                <table className="min-w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-white/5 sticky top-0 z-10 backdrop-blur-md text-blue-100/40 text-[10px] uppercase tracking-[0.2em] border-b border-white/10">
                      <th className="px-6 py-6 font-bold text-left">Buy Date</th>
                      <th className="px-4 py-6 font-bold">Quantity</th>
                      <th className="px-4 py-6 font-bold">Buy Price</th>
                      <th className="px-4 py-6 font-bold">Account</th>
                      <th className="px-4 py-6 font-bold">Type</th>
                      <th className="px-4 py-6 font-bold">Invested</th>
                      <th className="px-4 py-6 font-bold">Value</th>
                      <th className="px-4 py-6 font-bold">P/L</th>
                      <th className="px-4 py-6 font-bold">P/L %</th>
                      <th className="px-4 py-6 font-bold">XIRR</th>
                      <th className="px-4 py-6 font-bold">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedStockTransactions.length === 0 && (
                      <tr>
                        <td colSpan="11" className="p-8 text-center text-blue-200/30 font-bold text-lg">
                          No open transactions match the current filters.
                        </td>
                      </tr>
                    )}

                    {selectedStockTransactions.map((txn) => {
                      const invested = txn.quantity * txn.buy_price;
                      const marketValue =
                        txn.quantity * (parseFloat(selectedStock.livePrice) || 0);
                      const urp = marketValue - invested;
                      const urpPct = invested > 0 ? (urp / invested) * 100 : 0;

                      const cf = [];
                      if (txn.buy_date) {
                        cf.push({ amount: -invested, date: new Date(txn.buy_date) });
                      }
                      if (marketValue > 0) {
                        cf.push({ amount: marketValue, date: new Date() });
                      }
                      const txnXirr = calculateXIRR(cf);

                      return (
                        <tr key={txn.id} className="text-center border-t border-white/5 hover:bg-white/10 transition-all duration-200 group">
                          <td className="px-6 py-5 text-white font-semibold whitespace-nowrap text-left">{formatDate(txn.buy_date)}</td>
                          <td className="px-4 py-5 text-white font-bold text-base">{txn.quantity}</td>
                          <td className="px-4 py-5 text-blue-100/60 font-medium">₹{txn.buy_price}</td>
                          <td className="px-4 py-5 text-white/50">{txn.account_name}</td>
                          <td className="px-4 py-5 text-white/50">{txn.account_type}</td>
                          <td className="px-4 py-5 text-white font-semibold">₹{invested.toFixed(0)}</td>
                          <td className="px-4 py-5 text-white font-semibold">₹{marketValue.toFixed(0)}</td>
                          <td className={`px-4 py-5 font-bold ${urp >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                            ₹{urp.toFixed(0)}
                          </td>
                          <td className={`px-4 py-5 font-bold ${urpPct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                            {urpPct.toFixed(1)}%
                          </td>
                          <td className="px-4 py-5">
                             <span className="text-white font-bold bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">
                              {txnXirr != null ? `${txnXirr.toFixed(1)}%` : "-"}
                            </span>
                          </td>
                          <td className="px-4 py-5">
                            <div className="flex justify-center items-center gap-2.5">
                              <button
                                onClick={() => openEditModal(txn)}
                                className="p-2.5 bg-blue-500/10 text-blue-400 rounded-xl hover:bg-blue-500/20 hover:scale-110 transition-all duration-300 border border-blue-500/10 shadow-lg shadow-blue-500/5"
                                title="Edit transaction"
                              >
                                <Edit size={16} />
                              </button>
                              <button
                                onClick={() => handleDelete(txn.id)}
                                className="p-2.5 bg-rose-500/10 text-rose-400 rounded-xl hover:bg-rose-500/20 hover:scale-110 transition-all duration-300 border border-rose-500/10 shadow-lg shadow-rose-500/5"
                                title="Delete transaction"
                              >
                                <Trash2 size={16} />
                              </button>
                              <button
                                onClick={() => openSellPopup(txn)}
                                className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl hover:bg-amber-500/20 hover:scale-110 transition-all duration-300 border border-amber-500/10 shadow-lg shadow-amber-500/5"
                                title="Sell transaction"
                              >
                                <LogOut size={16} />
                              </button>
                            </div>
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

      {/* Sell Modal (Apple Style) */}
      {sellingTxn && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70] transition-all duration-300">
          <div className="bg-slate-900/90 backdrop-blur-2xl p-10 rounded-[3rem] shadow-[0_0_50px_rgba(0,0,0,0.5)] w-full max-w-md border border-white/10">
            <h2 className="text-2xl font-bold mb-8 text-white tracking-tight flex items-center gap-3">
              <div className="p-2 bg-amber-500/20 rounded-xl text-amber-400"><LogOut size={20} /></div>
              Sell Transaction
            </h2>

            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-bold text-blue-100/40 uppercase tracking-widest mb-2 ml-1">Stock Name</label>
                <input
                  type="text"
                  value={sellValues.stock_name}
                  readOnly
                  className="w-full bg-white/5 border border-white/10 text-white/60 rounded-2xl p-4 focus:outline-none cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-blue-100/40 uppercase tracking-widest mb-2 ml-1">Sell Date</label>
                <input
                  type="date"
                  value={sellValues.sell_date}
                  onChange={(e) => setSellValues((prev) => ({ ...prev, sell_date: e.target.value }))}
                  className="w-full bg-white/10 border border-white/10 text-white rounded-2xl p-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50 [color-scheme:dark]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-blue-100/40 uppercase tracking-widest mb-2 ml-1">Quantity (Max: {sellingTxn.quantity})</label>
                <input
                  type="number"
                  value={sellValues.sell_quantity}
                  max={sellingTxn.quantity}
                  onChange={(e) => setSellValues((prev) => ({ ...prev, sell_quantity: e.target.value }))}
                  className="w-full bg-white/10 border border-white/10 text-white rounded-2xl p-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-blue-100/40 uppercase tracking-widest mb-2 ml-1">Sell Price</label>
                <input
                  type="number"
                  value={sellValues.sell_price}
                  onChange={(e) => setSellValues((prev) => ({ ...prev, sell_price: e.target.value }))}
                  className="w-full bg-white/10 border border-white/10 text-white rounded-2xl p-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                />
              </div>
            </div>

            <div className="flex justify-end gap-4 mt-10">
              <button
                onClick={handleCancelSell}
                className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-4 rounded-2xl transition-all border border-white/5"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveSell}
                className="flex-1 bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-600/20 transition-all"
              >
                Confirm Sell
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal (Apple Style) */}
      {isEditModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70] transition-all duration-300">
          <div className="bg-slate-900/90 backdrop-blur-2xl p-10 rounded-[3rem] shadow-[0_0_50px_rgba(0,0,0,0.5)] w-full max-w-2xl border border-white/10">
            <h2 className="text-2xl font-bold mb-8 text-white tracking-tight flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-xl text-blue-400"><Edit size={20} /></div>
              Edit Transaction
            </h2>

            <div className="grid grid-cols-2 gap-6">
              {EDITABLE_FIELDS.map((field) => (
                <div key={field.key} className="flex flex-col">
                  <label className="text-[10px] font-bold text-blue-100/40 uppercase tracking-widest mb-2 ml-1">{field.label}</label>
                  {field.type === "select" && field.optionsSource === "accounts" ? (
                    <select
                      value={editValues[field.key] || ""}
                      onChange={(e) => handleEditFieldChange(field.key, e.target.value)}
                      className="w-full bg-white/10 border border-white/10 text-white rounded-2xl p-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none cursor-pointer"
                    >
                      <option value="" className="bg-slate-900">Select Account</option>
                      {accountOptions.map((acc) => (
                        <option key={acc} value={acc} className="bg-slate-900">
                          {acc}
                        </option>
                      ))}
                    </select>
                  ) : field.type === "select" ? (
                    <select
                      value={editValues[field.key] || ""}
                      onChange={(e) => handleEditFieldChange(field.key, e.target.value)}
                      className="w-full bg-white/10 border border-white/10 text-white rounded-2xl p-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none cursor-pointer"
                    >
                      <option value="" className="bg-slate-900">Select</option>
                      {(field.options || []).map((option) => (
                        <option key={option.value} value={option.value} className="bg-slate-900">
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.type}
                      value={editValues[field.key] || ""}
                      onChange={(e) => handleEditFieldChange(field.key, e.target.value)}
                      className="w-full bg-white/10 border border-white/10 text-white rounded-2xl p-4 focus:outline-none focus:ring-2 focus:ring-blue-500/50 [color-scheme:dark]"
                    />
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-4 mt-10">
              <button
                onClick={closeEditModal}
                className="flex-1 bg-white/5 hover:bg-white/10 text-white font-bold py-4 rounded-2xl transition-all border border-white/5"
              >
                Cancel
              </button>
              <button
                onClick={handleEditModalSave}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-4 rounded-2xl shadow-lg shadow-emerald-600/20 transition-all"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Zerodha-Style Sort Menu */}
      {isSortMenuOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
            onClick={() => setIsSortMenuOpen(false)}
          />
          <div className="relative w-full max-w-md bg-slate-900 border border-white/10 shadow-2xl overflow-hidden rounded-[2.5rem] animate-in fade-in zoom-in duration-300">
            <div className="p-5 border-b border-white/5 flex justify-between items-center bg-white/5">
              <h3 className="text-xl font-black text-white tracking-tight">Sort</h3>
              <button
                onClick={() => setIsSortMenuOpen(false)}
                className="text-blue-400 font-bold hover:text-blue-300 transition-colors uppercase tracking-widest text-[10px]"
              >
                Close
              </button>
            </div>
            <div className="p-3 bg-slate-900/50 max-h-[60vh] overflow-y-auto">
              {[
                { label: "Stock Name", key: "stock_name", icon: "A-Z" },
                { label: "Invested Amount", key: "invested", icon: "INV" },
                { label: "Market Value", key: "marketValue", icon: "VAL" },
                { label: "Unrealized Return", key: "urp", icon: "P&L" },
                { label: "Return %", key: "urpPct", icon: "P&L%" },
                { label: "CMP", key: "livePrice", icon: "LTP" },
                { label: "Day Change %", key: "changePct", icon: "CHG%" },
                { label: "XIRR", key: "xirr", icon: "XIRR" },
              ].map((option) => (
                <button
                  key={option.key}
                  onClick={() => {
                    handleSort(option.key);
                    setIsSortMenuOpen(false);
                  }}
                  className={`w-full flex items-center justify-between p-3.5 rounded-2xl transition-all duration-300 mb-1.5 group ${
                    sortConfig.key === option.key
                      ? "bg-blue-500/10 border border-blue-500/20"
                      : "hover:bg-white/5 border border-transparent"
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <span className={`w-10 text-[9px] font-black tracking-tighter text-center py-1.5 rounded-lg ${
                      sortConfig.key === option.key ? "bg-blue-500/20 text-blue-400" : "bg-white/5 text-blue-100/30"
                    }`}>
                      {option.icon}
                    </span>
                    <span className={`text-sm font-bold tracking-tight ${
                      sortConfig.key === option.key ? "text-blue-400" : "text-blue-100/70"
                    }`}>
                      {option.label}
                    </span>
                  </div>
                  {sortConfig.key === option.key && (
                    <div className={`p-1.5 rounded-lg bg-blue-500/10 text-blue-400 ${sortConfig.direction === 'asc' ? 'rotate-180' : ''} transition-transform duration-300`}>
                      <ArrowUpDown size={12} />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Holdings;
