import { useEffect, useMemo, useState, useCallback } from "react";
import { useAnalysisFreeStocksOptimized } from "../../hooks/useAnalysisFreeStocksOptimized.js";
import EarningTab from "./earning.jsx";
import { 
  fetchStockCMP, 
  bulkUpdateStockAccountType,
  updateStockTransaction,
  deleteStockTransaction,
  sellStockTransaction,
  fetchStockAccounts
} from "../../api/analysisAPI.js";
import { clearBackendCache } from "../../api/cacheAPI.js";
import { calculateXIRR } from "../../utils/xirr.jsx";
import { toast } from "react-hot-toast";
import { useNavigation } from "../../context/NavigationContext.jsx";
import { useMode } from "../../context/ModeContext.jsx";
import { Edit, Trash2, LogOut, RotateCw, TrendingUp, Wallet, BarChart3, Activity } from "lucide-react";

const SUB_FILTER_OPTIONS = [
  { value: "marketValue", label: "Market Value" },
  { value: "invested", label: "Invested Value" },
  { value: "absReturn", label: "Absolute Return" },
  { value: "absReturnPct", label: "Absolute Return %" },
  { value: "xirr", label: "XIRR" },
];

const ACCOUNT_TABS = [
  { key: "free", label: "Free" },
  { key: "regular", label: "Others" },
  { key: "earning", label: "Earning" },
];

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
    ],
  },
  {
    key: "account_type",
    label: "Account Type",
    type: "select",
    options: [
      { value: "FREE", label: "Free" },
      { value: "REGULAR", label: "Regular" },
    ],
  },
];

const DETAIL_COLUMN_CONFIGS = {
  "transactions": [
    { key: "index", label: "S.No", format: "number", align: "center" },
    { key: "buy_date", label: "Date", format: "date", align: "center" },
    { key: "cmp", label: "CMP", format: "stockPrice", align: "center" },
    { key: "buy", label: "Buy", format: "currency", align: "center" },
    { key: "quantity", label: "Quantity", align: "center" },
    { key: "invested", label: "Invested", format: "currency", align: "center" },
    { key: "account_name", label: "Account", align: "left" },
    { key: "marketValue", label: "Market Value", format: "currency", align: "center" },
    { key: "profit", label: "P/L", format: "currency", showPositiveNegative: true, align: "center" },
    { key: "profitPercent", label: "P/L %", format: "percent", showPositiveNegative: true, align: "center" },
    { key: "xirr", label: "XIRR", format: "percent", align: "center" },
    { key: "actions", label: "Actions", align: "center" },
  ],
};

const formatCurrency = (value) => {
  const num = Number(value) || 0;
  const abs = Math.abs(num);
  const sign = num < 0 ? "-" : "";

  if (abs >= 1_00_00_000) {
    return `${sign}₹${(abs / 1_00_00_000).toFixed(1)} Cr`;
  }
  if (abs >= 1_00_000) {
    return `${sign}₹${(abs / 1_00_000).toFixed(1)} L`;
  }
  if (abs >= 1_000) {
    return `${sign}₹${(abs / 1_000).toFixed(1)} K`;
  }

  return `${sign}₹${abs.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
};

const formatStockPrice = (value) => {
  const num = Number(value) || 0;
  return `₹${num.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
};

const formatPercent = (value) => {
  const num = Number.isFinite(value) ? value : 0;
  return `${num >= 0 ? "+" : ""}${Math.round(num)}%`;
};

const formatDate = (value) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const day = date.getDate().toString().padStart(2, '0');
  const month = (date.getMonth() + 1).toString().padStart(2, '0');
  const year = date.getFullYear().toString().slice(-2);
  return `${day}-${month}-${year}`;
};

function AccountTypeUpdateModal({ stock, onClose, onUpdate }) {
  const [newType, setNewType] = useState(stock.accountType || "REGULAR");
  const [isUpdating, setIsUpdating] = useState(false);

  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      await bulkUpdateStockAccountType(stock.name, newType);
      toast.success(`Updated all transactions for ${stock.name} to ${newType}`);
      onUpdate();
      onClose();
    } catch (error) {
      toast.error(error.message || "Failed to update account type");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 px-4 py-6"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="relative w-full max-w-md rounded-2xl bg-slate-800 p-6 shadow-2xl border border-slate-700">
        <h3 className="text-xl font-bold text-white mb-4">Update Account Type</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-400">Stock Name</label>
            <div className="mt-1 text-lg font-semibold text-white">{stock.name}</div>
          </div>
          <div>
            <label htmlFor="accountType" className="block text-sm font-medium text-slate-400">
              Account Type
            </label>
            <select
              id="accountType"
              value={newType}
              onChange={(e) => setNewType(e.target.value)}
              className="mt-1 block w-full rounded-md border-slate-700 bg-slate-900 text-slate-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm p-2 border"
            >
              <option value="FREE">FREE</option>
              <option value="REGULAR">REGULAR</option>
            </select>
          </div>
          <div className="flex justify-end space-x-3 mt-6">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-700 rounded-lg hover:bg-slate-600"
            >
              Cancel
            </button>
            <button
              onClick={handleUpdate}
              disabled={isUpdating}
              className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:opacity-50"
            >
              {isUpdating ? "Updating..." : "Update All Rows"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetailModal({ data, onClose, onEdit, onDelete, onSell, onRefresh }) {
  const { title, subtitle, avgBuyPrice, rows, configKey, message } = data || {};
  const columns = DETAIL_COLUMN_CONFIGS[configKey] || [];

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleOverlayClick = (event) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  const renderCell = (row, column) => {
    if (column.key === "actions") {
      return (
        <div className="flex justify-center items-center space-x-2">
          <button
            onClick={() => onEdit(row.rawTxn)}
            className="text-blue-600 hover:text-blue-800"
            title="Edit transaction"
          >
            <Edit size={16} />
          </button>
          <button
            onClick={() => onDelete(row.rawTxn.id)}
            className="text-red-600 hover:text-red-800"
            title="Delete transaction"
          >
            <Trash2 size={16} />
          </button>
          <button
            onClick={() => onSell(row.rawTxn)}
            className="text-purple-600 hover:text-purple-800"
            title="Sell transaction"
          >
            <LogOut size={16} />
          </button>
        </div>
      );
    }
    if (column.key === "name") {
      return (
        <div>
          <div className="text-sm font-semibold text-gray-900">{row.name}</div>
          {row.subLabel ? <div className="mt-0.5 text-xs text-gray-500">{row.subLabel}</div> : null}
        </div>
      );
    }

    const rawValue = row[column.key];
    let displayValue = rawValue;

    if (column.format === "currency") {
      displayValue = formatCurrency(Number(rawValue) || 0);
    } else if (column.format === "stockPrice") {
      displayValue = formatStockPrice(Number(rawValue) || 0);
    } else if (column.format === "percent") {
      displayValue = formatPercent(Number.isFinite(rawValue) ? rawValue : 0);
    } else if (column.format === "xirr") {
      displayValue = formatPercent(rawValue); // assuming xirr is percent
    } else if (column.format === "date") {
      displayValue = formatDate(rawValue);
    } else if (displayValue == null || displayValue === "") {
      displayValue = "-";
    }

    const valueClass = column.showPositiveNegative
      ? Number(rawValue) >= 0
        ? "text-green-400"
        : "text-red-400"
      : "text-slate-200";

    return <span className={`text-sm font-black ${valueClass}`}>{displayValue}</span>;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
    >
      <div className="relative flex w-full max-w-5xl max-h-[90vh] flex-col rounded-2xl bg-slate-800 shadow-2xl border border-slate-700">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-700 text-slate-300 hover:bg-slate-600"
          aria-label="Close"
        >
          <span className="text-xl">×</span>
        </button>

        <div className="bg-slate-900/50 px-6 pt-4 pb-3 border-b border-slate-700">
          <h2 className="text-lg font-bold leading-tight text-white">{title}</h2>
          {avgBuyPrice ? (
            <p className="mt-1 text-sm font-medium text-slate-400">
              (Avg Buy Price - {avgBuyPrice})
            </p>
          ) : null}
          {subtitle ? (
            <div className="mt-1 flex items-center space-x-2">
              <p className="text-sm font-black text-orange-400 tracking-wide uppercase">{subtitle}</p>
              {onRefresh && (
                <button
                  onClick={() => onRefresh()}
                  className="rounded-full p-1 text-orange-400 hover:bg-orange-500/10 transition-colors"
                  title="Refresh Data"
                >
                  <RotateCw size={14} />
                </button>
              )}
            </div>
          ) : null}
        </div>

        <div className="flex-1 overflow-auto px-6 pb-6 min-h-0 scrollbar-thin scrollbar-thumb-slate-700">
          {message ? (
            <div className="py-12 text-center text-sm font-medium text-slate-500">{message}</div>
          ) : (
            <table className="min-w-[900px] divide-y divide-slate-700 border-separate border-spacing-0">
              <thead className="bg-slate-900 sticky top-0 z-10 shadow-sm">
                <tr>
                  {columns.map((column) => (
                    <th
                      key={column.key}
                      className={`px-6 py-3 text-xs font-black uppercase tracking-widest text-slate-400 bg-slate-900 border-b border-slate-700 ${
                        column.align === "left" ? "text-left" : "text-center"
                      }`}
                    >
                      {column.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700 bg-transparent">
                {rows?.length ? (
                  rows.map((row, rowIndex) => (
                    <tr key={row.id || rowIndex} className="hover:bg-slate-700/30 transition-colors">
                      {columns.map((column) => (
                        <td
                          key={column.key}
                          className={`px-6 py-4 ${column.align === "left" ? "text-left" : "text-center"} align-top whitespace-nowrap border-b border-slate-700/30`}
                        >
                          {renderCell(row, column)}
                        </td>
                      ))}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={columns.length || 1} className="px-6 py-10 text-center text-sm text-slate-500">
                      No matching records found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

const getComparableValue = (item, key) => {
  const value = item?.[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  return 0;
};

const toNumberSafe = (value, fallback = 0) => {
  if (Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseThreshold = (value) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
};

const normalizeAccountTypeValue = (accountType, accountName) => {
  const normalizedType = (accountType ?? "").toString().trim().toUpperCase();
  const normalizedName = (accountName ?? "").toString().trim().toUpperCase();

  if (normalizedType.includes("FREE") || normalizedName.includes("FREE")) {
    return "FREE";
  }

  if (normalizedType.includes("REGULAR")) {
    return "REGULAR";
  }

  return normalizedType || "REGULAR";
};

const normalizeStock = (stock = {}) => {
  const name = stock.name ?? stock.stockName ?? stock.stock_name ?? stock.symbol ?? "Unknown";
  const accountNameRaw = stock.accountName ?? stock.account_name ?? "";
  const accountName = (accountNameRaw ?? "").toString().trim();
  const transactions = Array.isArray(stock.transactions) ? stock.transactions : [];
  const investedLots = Array.isArray(stock.investedLots) ? stock.investedLots : [];
  let accountType = normalizeAccountTypeValue(stock.accountType ?? stock.account_type, accountName);
  const hasFreeTransaction = [...transactions, ...investedLots].some((entry) => {
    const entryAccountType = entry?.account_type ?? entry?.accountType;
    const entryAccountName = entry?.account_name ?? entry?.accountName;
    return normalizeAccountTypeValue(entryAccountType, entryAccountName) === "FREE";
  });

  if (accountType !== "FREE" && hasFreeTransaction) {
    accountType = "FREE";
  }

  const marketValue = toNumberSafe(stock.marketValue ?? stock.market_value ?? stock.currentValue);
  const invested = toNumberSafe(stock.invested ?? stock.invested_amount ?? stock.amountInvested);
  const absReturn = toNumberSafe(stock.absReturn ?? stock.profit ?? marketValue - invested);
  const absReturnPct = toNumberSafe(
    stock.absReturnPct ??
      stock.profitPercent ??
      stock.percent ??
      (invested ? (absReturn / invested) * 100 : 0),
  );
  const xirr = toNumberSafe(stock.xirr);
  const quantity = toNumberSafe(stock.quantity ?? stock.units);

  return {
    ...stock,
    name,
    accountName,
    accountType,
    marketValue,
    invested,
    absReturn,
    absReturnPct,
    xirr,
    transactions,
    investedLots,
    quantity,
  };
};

const normalizeStocks = (stocks = []) => {
  if (!Array.isArray(stocks)) return [];

  const merged = new Map();

  stocks.forEach((rawStock) => {
    const normalized = normalizeStock(rawStock);
    const normalizedName = (normalized.name || '').trim();
    const normalizedAccountType = (normalized.accountType || '').toUpperCase();
    const key = `${normalizedAccountType}::${normalizedName.toUpperCase()}`;

    if (!merged.has(key)) {
      merged.set(key, {
        ...normalized,
        name: normalizedName || normalized.name || 'Unknown',
        accountNames: normalized.accountName ? [normalized.accountName] : [],
        transactions: [...normalized.transactions],
      });
      return;
    }

    const existing = merged.get(key);
    const invested = existing.invested + normalized.invested;
    const marketValue = existing.marketValue + normalized.marketValue;
    const absReturn = existing.absReturn + normalized.absReturn;
    const quantity = existing.quantity + normalized.quantity;
    const transactions = [...existing.transactions, ...normalized.transactions];
    const accountNames = new Set([
      ...existing.accountNames,
      ...(normalized.accountName ? [normalized.accountName] : []),
    ]);

    merged.set(key, {
      ...existing,
      invested,
      marketValue,
      absReturn,
      quantity,
      avgPrice: quantity > 0 ? invested / quantity : 0,
      absReturnPct: invested > 0 ? (absReturn / invested) * 100 : 0,
      accountName:
        accountNames.size > 1
          ? 'Multiple Accounts'
          : [...accountNames][0] || existing.accountName,
      accountNames: [...accountNames],
      transactions,
    });
  });

  return Array.from(merged.values()).map((stock) => ({
    ...stock,
    transactions: stock.transactions
      .slice()
      .sort((a, b) => new Date(a.buy_date || 0) - new Date(b.buy_date || 0)),
  }));
};

export default function FreeStockTab() {
  const { freeStocks, regularStocks, loading, error: backendError } = useAnalysisFreeStocksOptimized();
  const { priceSource } = useMode();
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState(ACCOUNT_TABS[0].key);
  const [sortKey, setSortKey] = useState(SUB_FILTER_OPTIONS[0].value);
  const [sortDirection, setSortDirection] = useState("desc");
  const [regularProfitThreshold, setRegularProfitThreshold] = useState("150");
  const [searchTerm, setSearchTerm] = useState("");
  const [detailModalData, setDetailModalData] = useState(null);
  const [updateModalStock, setUpdateModalStock] = useState(null);
  const [editingTxn, setEditingTxn] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [accountOptions, setAccountOptions] = useState([]);
  const [sellingTxn, setSellingTxn] = useState(null);
  const [sellValues, setSellValues] = useState({});
  const { refreshDashboard } = useNavigation();

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const accounts = await fetchStockAccounts();
        setAccountOptions(accounts);
      } catch (err) {
        console.error("Failed to fetch accounts:", err);
      }
    };
    fetchAccounts();
  }, []);

  const normalizedFreeStocks = useMemo(() => normalizeStocks(freeStocks), [freeStocks]);
  const normalizedRegularStocks = useMemo(() => normalizeStocks(regularStocks), [regularStocks]);

  // Move filteredStocks definition before summaryCalculation
  const stocksInTab = useMemo(() => {
    if (activeTab === "free") {
      return normalizedFreeStocks;
    }

    if (activeTab === "regular") {
      const thresholdValue = parseThreshold(regularProfitThreshold);

      if (thresholdValue <= 0) {
        return normalizedRegularStocks;
      }

      return normalizedRegularStocks.filter((item) => Number(item.absReturnPct) >= thresholdValue);
    }

    return [];
  }, [normalizedFreeStocks, normalizedRegularStocks, activeTab, regularProfitThreshold]);

  const filteredStocks = useMemo(() => {
    let list = stocksInTab;

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter((stock) => stock.name.toLowerCase().includes(term));
    }

    return list;
  }, [stocksInTab, searchTerm]);

  // Now summaryCalculation can safely use stocksInTab
  const summaryCalculation = useMemo(() => {
    if (!stocksInTab.length) {
      return { marketValue: 0, invested: 0, netReturn: 0, netReturnPct: 0 };
    }

    const totals = stocksInTab.reduce(
      (accumulator, stock) => {
        const marketValue = Number(stock.marketValue) || 0;
        const invested = Number(stock.invested) || 0;
        const netReturnCandidate = Number(stock.absReturn);
        const netReturn = Number.isFinite(netReturnCandidate)
          ? netReturnCandidate
          : marketValue - invested;

        return {
          marketValue: accumulator.marketValue + marketValue,
          invested: accumulator.invested + invested,
          netReturn: accumulator.netReturn + netReturn,
        };
      },
      { marketValue: 0, invested: 0, netReturn: 0 },
    );

    const netReturnPct = totals.invested > 0 ? (totals.netReturn / totals.invested) * 100 : 0;

    return { ...totals, netReturnPct };
  }, [stocksInTab]);

  const handleStockClick = useCallback(async (stock) => {
    const avgBuyPrice = stock.quantity > 0 ? stock.invested / stock.quantity : 0;
    const baseModal = {
      title: `${stock.name} Transactions`,
      stockName: stock.name,
      avgBuyPrice: Math.round(avgBuyPrice),
      subtitle: `${stock.accountType} Account`,
      rows: [],
      configKey: "transactions",
    };

    if (!stock.transactions.length) {
      setDetailModalData({
        ...baseModal,
        message: "Transaction history is not available for this stock from the current backend response.",
      });
      return;
    }

    const fetchedCmp = await fetchStockCMP(stock.name, priceSource);
    const cmp = fetchedCmp !== null ? fetchedCmp : (stock.quantity > 0 ? stock.marketValue / stock.quantity : 0);

    const rows = stock.transactions.map((txn, index) => {
      const txnInvested = toNumberSafe(txn.amount || (toNumberSafe(txn.quantity) * toNumberSafe(txn.buy_price)));
      const txnMarketValue = toNumberSafe(txn.quantity) * cmp;
      const txnProfit = txnMarketValue - txnInvested;
      const txnProfitPercent = txnInvested > 0 ? (txnProfit / txnInvested) * 100 : 0;
      
      const flows = [
        { amount: -txnInvested, date: txn.buy_date },
        { amount: txnMarketValue, date: new Date() }
      ];
      const txnXirr = calculateXIRR(flows);

      return {
        id: index,
        index: index + 1,
        buy_date: txn.buy_date,
        cmp: cmp,
        buy: txn.buy_price,
        quantity: txn.quantity,
        invested: txnInvested,
        account_name: txn.account_name,
        marketValue: txnMarketValue,
        profit: txnProfit,
        profitPercent: txnProfitPercent,
        xirr: txnXirr,
        rawTxn: txn,
      };
    });

    setDetailModalData({
      ...baseModal,
      rows,
    });
  }, [priceSource]);

  useEffect(() => {
    const stockName = detailModalData?.stockName;
    if (stockName) {
      const allStocks = [...normalizedFreeStocks, ...normalizedRegularStocks];
      const updatedStock = allStocks.find((s) => s.name === stockName);
      if (updatedStock) {
        handleStockClick(updatedStock);
      }
    }
  }, [normalizedFreeStocks, normalizedRegularStocks, detailModalData?.stockName, handleStockClick]);

  const handleRefresh = async () => {
    toast.loading("Refreshing data...", { id: "free-stocks-refresh" });
    try {
      await clearBackendCache();
      refreshDashboard();
      toast.success("Data refreshed!", { id: "free-stocks-refresh" });
    } catch (err) {
      console.error("Refresh failed:", err);
      toast.error("Failed to refresh data", { id: "free-stocks-refresh" });
    }
  };

  // Sync backend error to local state
  useEffect(() => {
    setError(backendError);
  }, [backendError]);

  const closeDetailModal = () => setDetailModalData(null);

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this transaction?")) return;
    try {
      await deleteStockTransaction(id);
      toast.success("Transaction deleted successfully");
      refreshDashboard();
      closeDetailModal();
    } catch (err) {
      console.error("Delete failed:", err);
      toast.error("Failed to delete transaction");
    }
  };

  const openEditModal = (txn) => {
    setEditingTxn(txn);
    setEditValues({ ...txn });
  };

  const handleEditSave = async () => {
    try {
      const payload = EDITABLE_FIELDS.reduce((acc, field) => {
        let val = editValues[field.key];
        if (field.type === "number") {
          val = parseFloat(val);
          acc[field.key] = Number.isFinite(val) ? val : 0;
        } else {
          acc[field.key] = val;
        }
        return acc;
      }, {});

      await updateStockTransaction(editingTxn.id, payload);
      
      toast.success("Transaction updated successfully");
      setEditingTxn(null);
      refreshDashboard();
      closeDetailModal();
    } catch (err) {
      console.error("Update failed:", err);
      toast.error("Failed to update transaction");
    }
  };

  const openSellPopup = (txn) => {
    setSellingTxn(txn);
    setSellValues({
      stock_name: txn.stock_name,
      sell_date: new Date().toISOString().split('T')[0],
      sell_price: "",
      sell_quantity: txn.quantity,
    });
  };

  const handleSellSave = async () => {
    const sellQty = Number(sellValues.sell_quantity);
    const originalQty = Number(sellingTxn.quantity);

    if (sellQty <= 0 || sellQty > originalQty) {
      toast.error("Invalid sell quantity");
      return;
    }

    try {
      await sellStockTransaction(sellingTxn.id, {
        sellQty,
        sellDate: sellValues.sell_date,
        sellPrice: Number(sellValues.sell_price),
      });

      toast.success("Transaction sold successfully");
      setSellingTxn(null);
      refreshDashboard();
      closeDetailModal();
    } catch (err) {
      console.error("Sell failed:", err);
      toast.error("Failed to sell transaction");
    }
  };

  const sortedStocks = useMemo(() => {
    const list = [...filteredStocks];

    list.sort((a, b) => {
      const aVal = getComparableValue(a, sortKey);
      const bVal = getComparableValue(b, sortKey);
      return sortDirection === "desc" ? bVal - aVal : aVal - bVal;
    });

    return list;
  }, [filteredStocks, sortKey, sortDirection]);

  const handleSortChange = (value) => {
    if (value === sortKey) {
      setSortDirection((prev) => (prev === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(value);
      setSortDirection("desc");
    }
  };

  const getTabLabel = (tabKey, defaultLabel) => {
    if (tabKey === "earning") {
      return defaultLabel;
    }
    
    if (tabKey === "free") {
      return `${defaultLabel} (${normalizedFreeStocks.length})`;
    }

    const thresholdValue = parseThreshold(regularProfitThreshold);
    const regularCount = thresholdValue > 0
      ? normalizedRegularStocks.filter((stock) => Number(stock.absReturnPct) >= thresholdValue).length
      : normalizedRegularStocks.length;

    return `${defaultLabel} (${regularCount})`;
  };

  const handleThresholdChange = (event) => {
    setRegularProfitThreshold(event.target.value);
  };

  const regularThresholdDisplay = parseThreshold(regularProfitThreshold);
  const regularTabLabel = `Others (≥${regularThresholdDisplay}%)`;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-slate-500">Loading free stock insights…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">
        <p className="font-semibold">Unable to fetch free stock data</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  return (
    <section className="space-y-6 sm:space-y-8">
      {detailModalData ? (
        <DetailModal
          data={detailModalData}
          onClose={closeDetailModal}
          onEdit={openEditModal}
          onDelete={handleDelete}
          onSell={openSellPopup}
          onRefresh={handleRefresh}
        />
      ) : null}

      {/* Edit Modal */}
      {editingTxn && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 px-4 py-6">
          <div className="relative w-full max-w-md rounded-2xl bg-slate-800 p-6 shadow-2xl overflow-y-auto max-h-[90vh] border border-slate-700">
            <h3 className="text-xl font-bold text-white mb-4">Edit Transaction</h3>
            <div className="space-y-4">
              {EDITABLE_FIELDS.map((field) => (
                <div key={field.key}>
                  <label className="block text-sm font-medium text-slate-400">{field.label}</label>
                  {field.type === "select" && field.optionsSource === "accounts" ? (
                    <select
                      value={editValues[field.key] || ""}
                      onChange={(e) => setEditValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      className="mt-1 block w-full rounded-md border-slate-700 bg-slate-900 text-slate-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm p-2 border"
                    >
                      <option value="">Select Account</option>
                      {accountOptions.map((acc) => (
                        <option key={acc} value={acc}>
                          {acc}
                        </option>
                      ))}
                    </select>
                  ) : field.type === "select" ? (
                    <select
                      value={editValues[field.key] || ""}
                      onChange={(e) => setEditValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      className="mt-1 block w-full rounded-md border-slate-700 bg-slate-900 text-slate-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm p-2 border"
                    >
                      {field.options.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={field.type}
                      value={editValues[field.key] || ""}
                      onChange={(e) => setEditValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      className="mt-1 block w-full rounded-md border-slate-700 bg-slate-900 text-slate-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm p-2 border"
                    />
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setEditingTxn(null)}
                className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-700 rounded-lg hover:bg-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={handleEditSave}
                className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sell Modal */}
      {sellingTxn && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 px-4 py-6">
          <div className="relative w-full max-w-md rounded-2xl bg-slate-800 p-6 shadow-2xl border border-slate-700">
            <h3 className="text-xl font-bold text-white mb-4">Sell Transaction</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-400">Stock Name</label>
                <div className="mt-1 text-sm font-black text-white uppercase tracking-tight">{sellValues.stock_name}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400">Sell Date</label>
                <input
                  type="date"
                  value={sellValues.sell_date}
                  onChange={(e) => setSellValues((prev) => ({ ...prev, sell_date: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-slate-700 bg-slate-900 text-slate-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm p-2 border"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400">
                  Sell Quantity (Max: {sellingTxn.quantity})
                </label>
                <input
                  type="number"
                  value={sellValues.sell_quantity}
                  max={sellingTxn.quantity}
                  onChange={(e) => setSellValues((prev) => ({ ...prev, sell_quantity: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-slate-700 bg-slate-900 text-slate-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm p-2 border"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-400">Sell Price</label>
                <input
                  type="number"
                  value={sellValues.sell_price}
                  onChange={(e) => setSellValues((prev) => ({ ...prev, sell_price: e.target.value }))}
                  className="mt-1 block w-full rounded-md border-slate-700 bg-slate-900 text-slate-200 shadow-sm focus:border-orange-500 focus:ring-orange-500 sm:text-sm p-2 border"
                />
              </div>
            </div>
            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={() => setSellingTxn(null)}
                className="px-4 py-2 text-sm font-medium text-slate-300 bg-slate-700 rounded-lg hover:bg-slate-600"
              >
                Cancel
              </button>
              <button
                onClick={handleSellSave}
                className="px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700"
              >
                Confirm Sell
              </button>
            </div>
          </div>
        </div>
      )}
      {updateModalStock && (
        <AccountTypeUpdateModal
          stock={updateModalStock}
          onClose={() => setUpdateModalStock(null)}
          onUpdate={refreshDashboard}
        />
      )}

        {/* Account Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {ACCOUNT_TABS.map((tab) => {
            const isActive = activeTab === tab.key;
            const label = getTabLabel(tab.key, tab.key === "regular" ? regularTabLabel : tab.label);
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`px-3 py-2 text-sm font-semibold rounded-lg transition-colors duration-200 ${
                  isActive
                    ? "bg-gradient-to-r from-orange-600 to-orange-700 text-white shadow-lg"
                    : "bg-slate-800/40 text-slate-400 hover:bg-slate-800 hover:text-white border border-slate-700/50"
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>

      {/* Summary cards for free account stocks */}
      {(activeTab === "free" || activeTab === "regular") && (
        <section className="grid grid-cols-2 gap-4">
          {[
            {
              label: "Market Value",
              value: formatCurrency(summaryCalculation.marketValue),
              valueClassName: "text-orange-700",
              icon: TrendingUp,
              bgColor: "bg-orange-500/10",
              borderActive: "border-orange-500/20",
            },
            {
              label: "Invested Value",
              value: formatCurrency(summaryCalculation.invested),
              valueClassName: "text-emerald-700",
              icon: Wallet,
              bgColor: "bg-emerald-500/10",
              borderActive: "border-emerald-500/20",
            },
            {
              label: "Net Return",
              value: formatCurrency(summaryCalculation.netReturn),
              valueClassName: summaryCalculation.netReturn >= 0 ? "text-emerald-400" : "text-rose-400",
              icon: BarChart3,
              bgColor: summaryCalculation.netReturn >= 0 ? "bg-yellow-500/10" : "bg-rose-500/10",
              borderActive: summaryCalculation.netReturn >= 0 ? "border-yellow-500/20" : "border-rose-500/20",
            },
            {
              label: "Net Return %",
              value: formatPercent(summaryCalculation.netReturnPct),
              valueClassName: summaryCalculation.netReturnPct >= 0 ? "text-emerald-400" : "text-rose-400",
              icon: Activity,
              bgColor: summaryCalculation.netReturnPct >= 0 ? "bg-yellow-500/10" : "bg-rose-500/10",
              borderActive: summaryCalculation.netReturnPct >= 0 ? "border-yellow-500/20" : "border-rose-500/20",
            },
          ].map((card) => {
            const Icon = card.icon;
            return (
              <article
                key={card.label}
                className={`group flex h-full w-full flex-col rounded-[2rem] ${card.bgColor} backdrop-blur-xl p-6 border ${card.borderActive} shadow-2xl transition-all duration-500`}
              >
                <div className="flex justify-between items-start mb-6">
                  <div className="space-y-1">
                    <h3 className={`text-[11px] font-black uppercase tracking-[0.2em] text-slate-400`}>
                      {card.label} {activeTab === "regular" && `(≥${regularThresholdDisplay}%)`}
                    </h3>
                  </div>
                  <div className={`p-3 rounded-2xl bg-white/5 ${card.valueClassName} shadow-sm transition-transform group-hover:scale-110`}>
                    <Icon className="w-5 h-5" />
                  </div>
                </div>
                <div className="bg-white/5 rounded-2xl p-4 border border-white/5 shadow-inner">
                  <p className={`maskable-number text-2xl font-black ${card.valueClassName} tracking-tighter`}>
                    {card.value}
                  </p>
                </div>
              </article>
            );
          })}
        </section>
      )}

      <div className="space-y-4">
        {activeTab !== "earning" && (
          <>
            {/* Search Bar */}
            <div className="relative max-w-md">
              <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <svg
                  className="h-4 w-4 text-slate-400"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Search stock name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full rounded-xl border border-slate-700/50 bg-slate-800/40 py-2 pl-10 pr-4 text-sm text-slate-200 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 placeholder:text-slate-500"
              />
            </div>

            {/* Filters and Sorting */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                {SUB_FILTER_OPTIONS.map((option) => {
                  const isActive = sortKey === option.value;
                  const isDescending = isActive && sortDirection === "desc";
                  const icon = isActive ? (isDescending ? "↓" : "↑") : "";
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleSortChange(option.value)}
                      className={`rounded-full border px-3 py-1 text-xs font-semibold transition focus:outline-none focus:ring-2 focus:ring-orange-200 ${
                        isActive
                          ? "border-orange-500 bg-orange-500/10 text-orange-400"
                          : "border-slate-700/50 bg-slate-800/40 text-slate-400 hover:border-orange-400 hover:text-white"
                      }`}
                    >
                      {option.label} {icon && <span className="ml-1 text-orange-400">{icon}</span>}
                    </button>
                  );
                })}
              </div>

              {activeTab === "regular" && (
                <div className="flex items-center gap-2 rounded-lg border border-slate-700/50 bg-slate-800/40 px-3 py-1.5">
                  <label className="text-xs font-bold tracking-wide text-blue-400" htmlFor="profit-threshold">
                    Profit / Loss %
                  </label>
                  <input
                    id="profit-threshold"
                    type="number"
                    value={regularProfitThreshold}
                    onChange={handleThresholdChange}
                    className="w-16 rounded border border-slate-700/50 bg-slate-900 px-2 py-0.5 text-xs text-slate-200 focus:border-orange-400 focus:outline-none focus:ring-1 focus:ring-orange-300"
                  />
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {activeTab === "earning" ? (
        <EarningTab />
      ) : sortedStocks.length ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2">
          {sortedStocks.map((stock, index) => {
            const isPositive = Number(stock.absReturn) >= 0;
            const palettes = [
              { bg: "bg-blue-500/10", border: "border-blue-500/20", text: "text-blue-400" },
              { bg: "bg-purple-500/10", border: "border-purple-500/20", text: "text-purple-400" },
              { bg: "bg-indigo-500/10", border: "border-indigo-500/20", text: "text-indigo-400" },
              { bg: "bg-emerald-500/10", border: "border-emerald-500/20", text: "text-emerald-400" },
            ];
            const palette = palettes[index % palettes.length];

            return (
              <article
                key={`${stock.accountType}-${stock.accountName || 'unknown'}-${stock.name}-${stock.quantity || 0}`}
                className={`flex h-full flex-col rounded-2xl border ${palette.border} ${palette.bg} p-5 shadow-sm transition hover:shadow-md hover:bg-slate-800/60 focus-within:ring-2 focus-within:ring-indigo-500/50`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3 truncate">
                    <div className={`p-2 rounded-lg bg-white/5 ${palette.text}`}>
                      <Activity size={18} />
                    </div>
                    <button 
                      onClick={() => handleStockClick(stock)} 
                      className="truncate text-lg font-black text-slate-100 hover:text-indigo-400 transition-colors text-left tracking-tight"
                    >
                      {stock.name} ({stock.transactions.length})
                    </button>
                  </div>
                  <button
                    onClick={() => setUpdateModalStock(stock)}
                    title="Click to bulk update account type"
                    className={`text-[10px] font-black uppercase tracking-widest px-2 py-1 rounded-md bg-white/5 cursor-pointer hover:bg-white/10 transition-colors ${
                      stock.accountType === "FREE" ? "text-indigo-400" : "text-emerald-400"
                    }`}
                  >
                    {stock.accountType}
                  </button>
                </div>

                <div className="overflow-x-auto scrollbar-hide">
                  <dl className="min-w-max flex gap-5 text-sm">
                    <div className="text-left">
                      <dt className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">MV</dt>
                      <dd className="maskable-number font-black text-orange-400">
                        {formatCurrency(stock.marketValue)}
                      </dd>
                    </div>

                    <div className="text-left">
                      <dt className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Invested</dt>
                      <dd className="maskable-number font-black text-slate-300">
                        {formatCurrency(stock.invested)}
                      </dd>
                    </div>

                    <div className="text-left">
                      <dt className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">P/L</dt>
                      <dd className={`font-black ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
                        {formatCurrency(stock.absReturn)}
                      </dd>
                    </div>

                    <div className="text-left">
                      <dt className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">P/L %</dt>
                      <dd className={`font-black ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
                        {formatPercent(stock.absReturnPct)}
                      </dd>
                    </div>

                    <div className="text-left">
                      <dt className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">XIRR</dt>
                      <dd className="font-black text-indigo-400">
                        {formatPercent(stock.xirr)}
                      </dd>
                    </div>
                  </dl>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-slate-700/50 bg-slate-800/20 p-8 text-center text-sm text-slate-500">
          No stocks match the selected filters yet.
        </p>
      )}
    </section>
  );
}