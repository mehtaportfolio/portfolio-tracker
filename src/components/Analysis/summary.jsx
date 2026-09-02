import { useState, useEffect, useMemo, useCallback } from "react";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import * as XLSX from "xlsx";
import { useAnalysisSummaryOptimized } from "../../hooks/useAnalysisSummaryOptimized.js";
import { useMFDataOptimized } from "../../hooks/useMFDataOptimized.js";
import { calculateXIRR } from "../../utils/xirr.jsx";
import { computeMutualFundRealizedAndOpen } from "../../utils/realizedCalculations.js";

const formatCurrency = (value) => {
  const num = Number(value) || 0;
  const abs = Math.abs(num);
  const sign = num < 0 ? "-" : "";

  if (abs >= 1_00_00_000) {
    return `${sign}₹${(abs / 1_00_00_000).toFixed(2)} Cr`;
  }
  if (abs >= 1_00_000) {
    return `${sign}₹${(abs / 1_00_000).toFixed(1)} L`;
  }
  if (abs >= 1_000) {
    return `${sign}₹${(abs / 1_000).toFixed(1)} K`;
  }

  return `${sign}₹${abs.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
};

const formatPercent = (value) => {
  const num = Number.isFinite(value) ? value : 0;
  return `${num >= 0 ? "+" : ""}${num.toFixed(0)}%`;
};

const toNumber = (value) => {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }
  if (value == null) return 0;
  const parsed = parseFloat(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};


const getValidDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date?.getTime()) ? null : date;
};



const computeActiveXirr = (items, selectors = {}) => {
  if (!Array.isArray(items) || !items.length) return null;

  const flows = [];

  items.forEach((item) => {
    const explicitFlows = typeof selectors.cashflows === "function" ? selectors.cashflows(item) : null;

    if (Array.isArray(explicitFlows) && explicitFlows.length) {
      explicitFlows.forEach((flow) => {
        const amount = toNumber(flow?.amount);
        const date = getValidDate(flow?.date);
        if (amount !== 0 && date) {
          flows.push({ amount, date });
        }
      });
      return;
    }

    const investedAmount = toNumber(selectors.investedAmount?.(item));
    const investedDate = getValidDate(selectors.investedDate?.(item));
    if (investedAmount > 0 && investedDate) {
      flows.push({ amount: -investedAmount, date: investedDate });
    }

    const marketValue = toNumber(selectors.marketValue?.(item));
    const valuationDate = getValidDate(selectors.marketDate?.(item)) || new Date();
    if (marketValue > 0) {
      flows.push({ amount: marketValue, date: valuationDate });
    }
  });

  return calculateXIRR(flows);
};

const computeClosedXirr = (items, selectors) => {
  if (!Array.isArray(items) || !items.length) return null;
  if (!selectors) return null;

  const flows = [];

  items.forEach((item) => {
    const investedAmount = toNumber(selectors.investedAmount?.(item));
    const investedDate = getValidDate(selectors.investedDate?.(item));
    if (investedAmount > 0 && investedDate) {
      flows.push({ amount: -investedAmount, date: investedDate });
    }

    const saleAmount = toNumber(selectors.saleAmount?.(item));
    const saleDate = getValidDate(selectors.saleDate?.(item));
    const charges = toNumber(selectors.chargesAllocated?.(item));
    if (saleAmount > 0 && saleDate) {
      const netSale = saleAmount - charges;
      if (netSale !== 0) {
        flows.push({ amount: netSale, date: saleDate });
      }
    }
  });

  return calculateXIRR(flows);
};

const buildClosedFlowsFromSplits = (splits) => {
  if (!Array.isArray(splits) || !splits.length) return [];

  return splits.flatMap((split) => {
    const flows = [];
    const units = toNumber(split?.units);
    if (!units) return flows;

    const buyNav = toNumber(split?.buy_nav);
    const buyDate = getValidDate(split?.buy_date);
    if (buyDate && buyNav > 0) {
      flows.push({ amount: -(units * buyNav), date: buyDate });
    }

    const sellNav = toNumber(split?.sell_nav);
    const sellDate = getValidDate(split?.sell_date);
    if (sellDate && sellNav > 0) {
      flows.push({ amount: units * sellNav, date: sellDate });
    }

    return flows;
  });
};

const buildClosedFlowsFromLots = (items) => {
  if (!Array.isArray(items) || !items.length) return [];
  return items.flatMap((item) => buildClosedFlowsFromSplits(item?.transactions));
};

const formatXirr = (value) => (Number.isFinite(value) ? formatPercent(value) : "N/A");

const FILTER_OPTIONS = [
  { value: "account_name", label: "Account Name" },
  { value: "account_type", label: "Account Type" },
  { value: "stock_name", label: "Stock Name" },
  { value: "sector", label: "Sector" },
  { value: "s_sector", label: "S Sector" },
  { value: "s_broad_sector", label: "S Broad Sector" },
  { value: "industry", label: "Industry" },
  { value: "s_industry", label: "S Industry" },
  { value: "s_broad_industry", label: "S Broad Industry" },
  { value: "macro_sector", label: "Macro Sector" },
  { value: "known_sector", label: "Known Sector" },
  { value: "basic_industry", label: "Basic Industry" },
  { value: "category", label: "Category" },
  { value: "equity_type", label: "Equity Type" },
];

const MF_FILTER_OPTIONS = [
  { value: "account_name", label: "Account Name" },
  { value: "fund_short_name", label: "Fund" },
  { value: "amc_name", label: "AMC" },
  { value: "category", label: "Category" },
];

const MAIN_TABS = ["Equity", "MF"];
const SUB_TABS = ["Active", "Closed"];

const DETAIL_COLUMN_CONFIGS = {
  "equity-active": [
    { key: "index", label: "#", align: "center" },
    { key: "name", label: "Stock", align: "left" },
    { key: "account_type", label: "Account Type", align: "center" },
    { key: "marketCap", label: "Market Cap", format: "currency", align: "center" },
    { key: "marketValue", label: "Market Value", format: "currency", align: "center" },
    { key: "investedAmount", label: "Invested Amount", format: "currency", align: "center" },
    { key: "gain", label: "P/L", format: "currency", showPositiveNegative: true, align: "center" },
    { key: "gainPercent", label: "P/L %", format: "percent", showPositiveNegative: true, align: "center" },
    { key: "xirr", label: "XIRR", format: "xirr", showPositiveNegative: true, align: "center" },
  ],
  "equity-closed": [
    { key: "index", label: "#", align: "center" },
    { key: "name", label: "Stock", align: "left" },
    { key: "account_type", label: "Account Type", align: "center" },
    { key: "marketCap", label: "Market Cap", format: "currency", align: "center" },
    { key: "saleAmount", label: "Sale Amount", format: "currency", align: "center" },
    { key: "investedAmount", label: "Invested Amount", format: "currency", align: "center" },
    { key: "gain", label: "P/L", format: "currency", showPositiveNegative: true, align: "center" },
    { key: "gainPercent", label: "P/L %", format: "percent", showPositiveNegative: true, align: "center" },
    { key: "xirr", label: "XIRR", format: "xirr", showPositiveNegative: true, align: "center" },
  ],
  "mf-active": [
    { key: "index", label: "#", align: "center" },
    { key: "name", label: "Fund", align: "left" },
    { key: "marketValue", label: "Market Value", format: "currency", align: "center" },
    { key: "investedAmount", label: "Invested Amount", format: "currency", align: "center" },
    { key: "gain", label: "P/L", format: "currency", showPositiveNegative: true, align: "center" },
    { key: "gainPercent", label: "P/L %", format: "percent", showPositiveNegative: true, align: "center" },
    { key: "xirr", label: "XIRR", format: "xirr", showPositiveNegative: true, align: "center" },
  ],
  "mf-closed": [
    { key: "index", label: "#", align: "center" },
    { key: "name", label: "Fund", align: "left" },
    { key: "saleAmount", label: "Sale Amount", format: "currency", align: "center" },
    { key: "investedAmount", label: "Invested Amount", format: "currency", align: "center" },
    { key: "gain", label: "P/L", format: "currency", showPositiveNegative: true, align: "center" },
    { key: "gainPercent", label: "P/L %", format: "percent", showPositiveNegative: true, align: "center" },
    { key: "xirr", label: "XIRR", format: "xirr", showPositiveNegative: true, align: "center" },
  ],
};

function DetailModal({ data, onClose }) {
  const { title, rows, configKey } = data || {};
  const columns = DETAIL_COLUMN_CONFIGS[configKey] || [];

  const rowsPerPage = 5;
  const totalPages = Math.ceil((rows?.length || 0) / rowsPerPage);
  const [currentPage, setCurrentPage] = useState(0);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  const handleExportToExcel = () => {
    if (!rows || rows.length === 0) return;

    const dataToExport = rows.map((row) => {
      const exportRow = {};
      exportRow[columns.find(c => c.key === "name")?.label || "Name"] = row.name;
      
      if (row.units !== undefined) exportRow['Quantity'] = row.units;
      if (row.avgPrice !== undefined) exportRow['Avg Price'] = row.avgPrice;

      columns.forEach((col) => {
        if (col.key === "index" || col.key === "name") return;
        let value = row[col.key];
        if (col.format === "percent" || col.format === "xirr") {
          value = value != null ? Number(value) / 100 : null;
        } else if (col.format === "currency") {
          value = Number(value) || 0;
        }
        exportRow[col.label] = value;
      });
      return exportRow;
    });

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    
    // Format percentages as numeric with percentage format in Excel
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const address = XLSX.utils.encode_col(C) + "1";
      if (!worksheet[address]) continue;
      const header = worksheet[address].v;
      if (header.includes("%") || header.includes("XIRR")) {
        for (let R = range.s.r + 1; R <= range.e.r; ++R) {
          const cellAddr = XLSX.utils.encode_cell({ r: R, c: C });
          if (worksheet[cellAddr] && typeof worksheet[cellAddr].v === 'number') {
            worksheet[cellAddr].z = '0.00%';
          }
        }
      }
    }

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Details");
    XLSX.writeFile(workbook, `${title.replace(/\s+/g, '_')}_Details.xlsx`);
  };

  const sortedRows = useMemo(() => {
    if (!rows) return [];
    if (!sortConfig.key) return rows;
    return [...rows].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
      }
      const aStr = String(aVal || '');
      const bStr = String(bVal || '');
      if (sortConfig.direction === 'asc') {
        return aStr.localeCompare(bStr);
      } else {
        return bStr.localeCompare(aStr);
      }
    });
  }, [rows, sortConfig]);

  const displayRows = sortedRows?.slice(currentPage * rowsPerPage, (currentPage + 1) * rowsPerPage) || [];

  const handleSort = (key) => {
    if (key === 'index') return;
    setSortConfig(prev => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      } else {
        return { key, direction: 'asc' };
      }
    });
  };

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

  const renderCell = (row, column, rowIndex) => {
    if (column.key === "index") {
      return <span className="text-sm font-medium text-slate-300">{currentPage * rowsPerPage + rowIndex + 1}</span>;
    }

    if (column.key === "name") {
      return (
        <div>
          <div className="text-sm font-semibold text-slate-100">{row.name}</div>
          {row.subLabel ? <div className="mt-0.5 text-xs text-slate-400">{row.subLabel}</div> : null}
        </div>
      );
    }

    const rawValue = row[column.key];
    let displayValue = rawValue;

    if (column.format === "currency") {
      displayValue = formatCurrency(Number(rawValue) || 0);
    } else if (column.format === "percent") {
      displayValue = formatPercent(Number.isFinite(rawValue) ? rawValue : 0);
    } else if (column.format === "xirr") {
      displayValue = formatXirr(rawValue);
    } else if (displayValue == null || displayValue === "") {
      displayValue = "-";
    }

    const valueClass = column.showPositiveNegative
      ? Number(rawValue) >= 0
        ? "text-green-400"
        : "text-red-400"
      : "text-slate-200";

    return <span className={`text-sm font-medium ${valueClass}`}>{displayValue}</span>;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 px-4 py-6 backdrop-blur-sm"
      onClick={handleOverlayClick}
      role="dialog"
      aria-modal="true"
    >
      <div className="relative flex w-full max-w-5xl max-h-[90vh] flex-col rounded-2xl bg-slate-900 border border-slate-700 shadow-2xl overflow-hidden">
        <div className="absolute right-4 top-4 flex items-center gap-3 z-10">
          <button
            type="button"
            onClick={handleExportToExcel}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors border border-green-500/30"
            aria-label="Download Excel"
            title="Download Excel"
          >
            <Download size={20} />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-800 text-slate-400 hover:bg-slate-700 transition-colors border border-slate-700"
            aria-label="Close"
          >
            <span className="text-2xl leading-none">×</span>
          </button>
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          <div className="bg-slate-800 px-6 py-5 border-b border-slate-700">
            <h2 className="text-xl font-bold text-slate-100">{title}</h2>
          </div>

          <div className="flex-1 overflow-hidden flex flex-col p-4">
            <div className="flex-1 overflow-x-scroll overflow-y-auto scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800 border border-slate-700 rounded-xl mb-4">
              <table className="min-w-full divide-y divide-slate-700">
                <thead className="bg-slate-800 sticky top-0 z-10">
                  <tr>
                    {columns.map((column, index) => (
                      <th
                        key={column.key}
                        className={`px-4 py-4 text-xs font-bold uppercase tracking-wider text-slate-400 cursor-pointer hover:text-slate-200 transition-colors border-b border-slate-700 ${
                          column.align === "left" ? "text-left" : "text-center"
                        } ${index === 0 ? "sticky left-0 z-20 bg-slate-800 w-12" : index === 1 ? "sticky left-12 z-20 bg-slate-800" : ""}`}
                        onClick={() => handleSort(column.key)}
                      >
                        <div className="flex items-center justify-center gap-1">
                          {column.label}
                          {sortConfig.key === column.key && (
                            <span className="text-purple-400">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700 bg-slate-900/50">
                  {displayRows?.length ? (
                    displayRows.map((row, rowIndex) => (
                      <tr key={row.id || rowIndex} className="hover:bg-slate-800/50 transition-colors">
                        {columns.map((column, index) => (
                          <td
                            key={column.key}
                            className={`px-4 py-4 whitespace-nowrap ${column.align === "left" ? "text-left" : "text-center"} align-middle ${index === 0 ? "sticky left-0 z-10 bg-slate-900 w-12" : index === 1 ? "sticky left-12 z-10 bg-slate-900" : ""}`}
                          >
                            {renderCell(row, column, rowIndex)}
                          </td>
                        ))}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={columns.length || 1} className="px-6 py-12 text-center text-sm text-slate-500">
                        No matching records found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            <div className="bg-slate-800/50 rounded-lg p-2 border border-slate-700">
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
function buildEquityActiveRows(stocks) {
  const grouped = (stocks || []).reduce((acc, stock) => {
    const name = stock.stock_name;
    if (!acc[name]) {
      acc[name] = {
        name: name,
        units: 0,
        invested_amount: 0,
        market_value: 0,
        unrealized_gain: 0,
        market_cap: 0,
        xirrList: [],
        account_types: [],
      };
    }
    acc[name].units += toNumber(stock.units);
    acc[name].invested_amount += toNumber(stock.invested_amount);
    acc[name].market_value += toNumber(stock.market_value);
    acc[name].unrealized_gain += toNumber(stock.unrealized_gain);
    if (!acc[name].market_cap) acc[name].market_cap = toNumber(stock.market_cap);
    if (stock.xirr != null) acc[name].xirrList.push(toNumber(stock.xirr));
    const accountType = stock.account_type || stock.equity_type || "";
    if (accountType) acc[name].account_types.push(accountType);
    return acc;
  }, {});

  return Object.values(grouped).map((group, index) => {
    const avgPrice = group.units > 0 ? group.invested_amount / group.units : 0;
    const gainPercent = group.invested_amount > 0 ? (group.unrealized_gain / group.invested_amount) * 100 : 0;
    const xirr = group.xirrList.length > 0 ? group.xirrList.reduce((a, b) => a + b, 0) / group.xirrList.length : null;
    const accountTypes = Array.from(new Set(group.account_types.map((type) => String(type || "").trim().toLowerCase())))
      .filter((type) => type !== "")
      .map((type) => type === "regular" ? "regular" : type)
      .join("/") || "Unknown";

    return {
      id: `${group.name}-${index}`,
      name: group.name,
      subLabel: `${Number(group.units || 0).toLocaleString("en-IN", {
        maximumFractionDigits: 2,
      })} shares · Avg ₹${avgPrice.toFixed(2)}`,
      account_type: accountTypes,
      units: group.units,
      avgPrice: avgPrice,
      marketValue: group.market_value,
      investedAmount: group.invested_amount,
      marketCap: group.market_cap || 0,
      gain: group.unrealized_gain,
      gainPercent: gainPercent,
      xirr: xirr,
    };
  });
}

function buildEquityClosedRows(stocks) {
  const grouped = (stocks || []).reduce((acc, stock) => {
    const name = stock.stock_name;
    if (!acc[name]) {
      acc[name] = {
        name: name,
        sale_amount: 0,
        invested_amount: 0,
        market_cap: 0,
        xirrList: [],
        account_types: [],
      };
    }
    acc[name].sale_amount += toNumber(stock.sale_amount);
    acc[name].invested_amount += toNumber(stock.invested_amount);
    if (!acc[name].market_cap) acc[name].market_cap = toNumber(stock.market_cap);
    if (stock.xirr != null) acc[name].xirrList.push(toNumber(stock.xirr));
    const accountType = stock.account_type || stock.equity_type || "";
    if (accountType) acc[name].account_types.push(accountType);
    return acc;
  }, {});

  return Object.values(grouped).map((group, index) => {
    const gain = group.sale_amount - group.invested_amount;
    const gainPercent = group.invested_amount > 0 ? (gain / group.invested_amount) * 100 : 0;
    const xirr = group.xirrList.length > 0 ? group.xirrList.reduce((a, b) => a + b, 0) / group.xirrList.length : null;
    const accountTypes = Array.from(new Set(group.account_types.map((type) => String(type || "").trim().toLowerCase())))
      .filter((type) => type !== "")
      .join("/") || "Unknown";

    return {
      id: `${group.name}-${index}`,
      name: group.name,
      subLabel: `Closed positions`,
      account_type: accountTypes,
      saleAmount: group.sale_amount,
      investedAmount: group.invested_amount,
      marketCap: group.market_cap || 0,
      gain: gain,
      gainPercent: gainPercent,
      xirr: xirr,
    };
  });
}

function buildMfActiveRows(lots) {
  const groupedData = {};
  (lots || []).forEach((lot) => {
    const name = lot.fund_short_name;
    if (!groupedData[name]) {
      groupedData[name] = {
        name: name,
        units: 0,
        investedAmount: 0,
        marketValue: 0,
        gain: 0,
        transactions: [],
        marketPrice: Number(lot.cmp || lot.lcp || 0)
      };
    }
    const marketPrice = groupedData[name].marketPrice;
    (lot.transactions || []).forEach((t) => {
      const units = toNumber(t.units);
      const nav = toNumber(t.nav);
      const mv = units * marketPrice;
      const inv = units * nav;

      groupedData[name].units += units;
      groupedData[name].investedAmount += inv;
      groupedData[name].marketValue += mv;
      groupedData[name].gain += (mv - inv);
      groupedData[name].transactions.push(t);
    });
  });

  return Object.values(groupedData).map((group, index) => {
    const avgPrice = group.units > 0 ? group.investedAmount / group.units : 0;
    const gainPercent = group.investedAmount > 0 ? (group.gain / group.investedAmount) * 100 : 0;

    const xirr = computeActiveXirr(group.transactions, {
      investedAmount: (t) => toNumber(t.units) * toNumber(t.nav),
      investedDate: (t) => t.date,
      marketValue: (t) => toNumber(t.units) * group.marketPrice,
      marketDate: () => new Date()
    });

    return {
      id: `${group.name}-${index}`,
      name: group.name,
      subLabel: `${Number(group.units || 0).toLocaleString("en-IN", {
        maximumFractionDigits: 2,
      })} units · Avg NAV ₹${avgPrice.toFixed(2)}`,
      units: group.units,
      avgPrice: avgPrice,
      marketValue: group.marketValue,
      investedAmount: group.investedAmount,
      gain: group.gain,
      gainPercent: gainPercent,
      xirr: xirr,
    };
  });
}

function buildMfClosedRows(lots) {
  const grouped = (lots || []).reduce((acc, lot) => {
    const name = lot.fund_short_name;
    if (!acc[name]) {
      acc[name] = {
        name: name,
        closedValue: 0,
        invested: 0,
        urp: 0,
        xirrList: [],
      };
    }
    acc[name].closedValue += toNumber(lot.closedValue);
    acc[name].invested += toNumber(lot.invested);
    acc[name].urp += toNumber(lot.urp);
    if (lot.xirr != null) acc[name].xirrList.push(toNumber(lot.xirr));
    return acc;
  }, {});

  return Object.values(grouped).map((group, index) => {
    const gainPercent = group.invested > 0 ? (group.urp / group.invested) * 100 : 0;
    const xirr = group.xirrList.length > 0 ? group.xirrList.reduce((a, b) => a + b, 0) / group.xirrList.length : null;

    return {
      id: `${group.name}-${index}`,
      name: group.name,
      subLabel: `Closed positions`,
      saleAmount: group.closedValue,
      investedAmount: group.invested,
      gain: group.urp,
      gainPercent: gainPercent,
      xirr: xirr,
    };
  });
}

function buildDetailSummary(configKey, items) {
  const isClosed = configKey.includes("closed");
  if (!Array.isArray(items) || !items.length) {
    return {
      investedAmount: 0,
      marketValue: 0,
      saleAmount: 0,
      gain: 0,
      gainPercent: 0,
      xirr: null,
    };
  }

  if (isClosed) {
    const investedAmount = items.reduce((acc, item) => acc + toNumber(item.invested_amount ?? item.investedAmount), 0);
    const saleAmount = items.reduce((acc, item) => acc + toNumber(item.sale_amount ?? item.saleAmount), 0);
    const gain = configKey.startsWith("equity")
      ? items.reduce((acc, item) => acc + (toNumber(item.sale_amount ?? item.saleAmount) - toNumber(item.invested_amount ?? item.investedAmount)), 0)
      : items.reduce((acc, item) => acc + toNumber(item.realized_gain ?? item.gain), 0);

    const xirrItems = items
      .filter((item) => toNumber(item.sale_amount ?? item.saleAmount) > 0)
      .map((item) => ({
        ...item,
        __saleAmount: toNumber(item.sale_amount ?? item.saleAmount),
        __charges: toNumber(item.charges_allocated ?? item.chargesAllocated ?? 0),
      }));

    const xirr = computeClosedXirr(xirrItems, {
      investedAmount: (item) => item.invested_amount ?? item.investedAmount,
      investedDate: (item) => item.buy_date ?? item.buyDate,
      saleAmount: (item) => item.__saleAmount,
      saleDate: (item) => item.sell_date ?? item.sellDate,
      chargesAllocated: (item) => item.__charges,
    });

    return {
      investedAmount,
      saleAmount,
      gain,
      gainPercent: investedAmount > 0 ? (gain / investedAmount) * 100 : 0,
      xirr,
    };
  }

  const investedAmount = items.reduce((acc, item) => acc + toNumber(item.invested_amount ?? item.investedAmount), 0);
  const marketValue = items.reduce((acc, item) => acc + toNumber(item.market_value ?? item.marketValue), 0);
  const gain = items.reduce((acc, item) => acc + toNumber(item.unrealized_gain ?? item.gain), 0);
  const xirrValues = items
    .map((item) => {
      const raw = item.xirr ?? item.XIRR ?? null;
      if (raw == null) return null;
      const parsed = typeof raw === "number" ? raw : Number.parseFloat(raw);
      return Number.isFinite(parsed) ? parsed : null;
    })
    .filter((value) => value != null);
  const xirr = xirrValues.length ? xirrValues.reduce((acc, value) => acc + value, 0) / xirrValues.length : null;

  return {
    investedAmount,
    marketValue,
    gain,
    gainPercent: investedAmount > 0 ? (gain / investedAmount) * 100 : 0,
    xirr,
  };
}

function buildDetailPayload({
  group,
  index,
  mainTab,
  subTab,
  selectedFilterLabel,
  mfSelectedFilterLabel,
}) {
  if (!group) return null;

  const isEquity = mainTab === "Equity";
  const isActive = subTab === "Active";
  const configKey = `${isEquity ? "equity" : "mf"}-${isActive ? "active" : "closed"}`;
  const selectedLabel = isEquity ? selectedFilterLabel : mfSelectedFilterLabel;

  if (isEquity && isActive) {
    return {
      title: `Group ${index + 1}: ${group.groupName}`,
      rows: buildEquityActiveRows(group.stocks),
      summary: buildDetailSummary(configKey, group.stocks),
      configKey,
    };
  }

  if (isEquity && !isActive) {
    return {
      title: `Group ${index + 1}: ${group.groupName}`,
      subtitle: selectedLabel ? `${selectedLabel}` : undefined,
      rows: buildEquityClosedRows(group.stocks),
      summary: buildDetailSummary(configKey, group.stocks),
      configKey,
    };
  }

  if (!isEquity && isActive) {
    return {
      title: `Group ${index + 1}: ${group.groupName}`,
      subtitle: selectedLabel ? `${selectedLabel}` : undefined,
      rows: buildMfActiveRows(group.lots),
      summary: buildDetailSummary(configKey, group.lots),
      configKey,
    };
  }

  return {
    title: `Group ${index + 1}: ${group.groupName}`,
    subtitle: selectedLabel ? `${selectedLabel}` : undefined,
    rows: buildMfClosedRows(group.lots),
    summary: buildDetailSummary(configKey, group.lots),
    configKey,
  };
}

function PaginationControls({ currentPage, totalPages, onPageChange }) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between px-4 py-3 bg-white border-t border-gray-200 sm:px-6">
      <div className="flex justify-between flex-1 sm:hidden">
        <button
          onClick={() => onPageChange(Math.max(0, currentPage - 1))}
          disabled={currentPage === 0}
          className="relative inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
        >
          Previous
        </button>
        <button
          onClick={() => onPageChange(Math.min(totalPages - 1, currentPage + 1))}
          disabled={currentPage === totalPages - 1}
          className="relative ml-3 inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
        >
          Next
        </button>
      </div>
      <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
        <div>
          <p className="text-sm text-gray-700">
            Showing page <span className="font-medium">{currentPage + 1}</span> of{' '}
            <span className="font-medium">{totalPages}</span>
          </p>
        </div>
        <div>
          <nav className="inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
            <button
              onClick={() => onPageChange(Math.max(0, currentPage - 1))}
              disabled={currentPage === 0}
              className="relative inline-flex items-center rounded-l-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
            >
              <span className="sr-only">Previous</span>
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              onClick={() => onPageChange(Math.min(totalPages - 1, currentPage + 1))}
              disabled={currentPage === totalPages - 1}
              className="relative inline-flex items-center rounded-r-md px-2 py-2 text-gray-400 ring-1 ring-inset ring-gray-300 hover:bg-gray-50 focus:z-20 focus:outline-offset-0 disabled:opacity-50"
            >
              <span className="sr-only">Next</span>
              <ChevronRight className="h-5 w-5" aria-hidden="true" />
            </button>
          </nav>
        </div>
      </div>
    </div>
  );
}

export default function Summary() {
  const { equityActive, equityClosed, chargesData, loading: allLoading, error: allError } = useAnalysisSummaryOptimized();
  const { mfTxns, fundMaster, loading: mfLoading, error: mfError } = useMFDataOptimized();
  const [activeMainTab, setActiveMainTab] = useState("Equity");
  const [activeSubTab, setActiveSubTab] = useState("Active");
  const [selectedFilter, setSelectedFilter] = useState("account_name");
  const [selectedMfFilter, setSelectedMfFilter] = useState("account_name");
  const [error, setError] = useState(null);
  const [detailModalData, setDetailModalData] = useState(null);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(5);

  useEffect(() => {
    setSortConfig({ key: null, direction: 'asc' });
    setCurrentPage(0);
  }, [activeMainTab, activeSubTab, selectedFilter, selectedMfFilter, rowsPerPage]);

  const handleSort = (key) => {
    setSortConfig(prev => {
      if (prev.key === key) {
        return { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' };
      } else {
        return { key, direction: 'asc' };
      }
    });
  };

  const loading = allLoading || mfLoading;

  useEffect(() => {
    setError(allError || mfError);
  }, [allError, mfError]);

  const { open: { lots: mfOpenLots } } = useMemo(() => computeMutualFundRealizedAndOpen(mfTxns), [mfTxns]);

  const mfActive = useMemo(() => {
    if (!mfOpenLots?.length || !fundMaster.length) return [];

    const masterMap = {};
    fundMaster.forEach((m) => (masterMap[(m.fund_short_name || "").trim()] = m));

    const groupsByFundAndAccount = new Map();

    mfOpenLots.forEach((lot) => {
      const fundShortName = (lot.fund_short_name || "").trim();
      const accountName = lot.account_name || "";
      if (!fundShortName) return;

      const key = `${fundShortName}||${accountName}`;
      if (!groupsByFundAndAccount.has(key)) {
        groupsByFundAndAccount.set(key, {
          fund_short_name: fundShortName,
          account_name: accountName,
          lots: [],
        });
      }

      const entry = groupsByFundAndAccount.get(key);
      entry.lots.push(lot);
    });

    const today = new Date();

    return Array.from(groupsByFundAndAccount.values())
      .map((entry) => {
        const fundShortName = entry.fund_short_name;
        const accountName = entry.account_name;
        const fundMeta = masterMap[fundShortName] || {};
        const cmp = Number(fundMeta.cmp) || 0;
        const lcp = Number(fundMeta.lcp) || 0;

        let units = 0;
        let invested = 0;
        let marketValue = 0;
        const flows = [];
        let earliestBuyDate = null;

        entry.lots.forEach((lot) => {
          const qty = Number(lot.units) || 0;
          const buyNav = Number(lot.buy_nav) || 0;
          const buyDate = getValidDate(lot.buy_date);
          if (!qty || !buyNav || !buyDate) return;

          units += qty;
          invested += qty * buyNav;
          marketValue += qty * cmp;

          flows.push({ amount: -(qty * buyNav), date: buyDate });
          if (!earliestBuyDate || buyDate < earliestBuyDate) {
            earliestBuyDate = buyDate;
          }
        });

        if (marketValue > 0) {
          flows.push({ amount: marketValue, date: today });
        }

        const unrealizedGain = marketValue - invested;
        const unrealizedGainPercent = invested > 0 ? (unrealizedGain / invested) * 100 : 0;
        const xirr = flows.length ? calculateXIRR(flows) : null;

        return {
          fund_short_name: fundShortName,
          fund_full_name: fundMeta?.fund_full_name ?? null,
          category: fundMeta?.category ?? null,
          amc_name: fundMeta?.amc_name ?? "Unknown AMC",
          amc: fundMeta?.amc_name ?? "Unknown AMC",
          account_name: accountName,
          units,
          invested,
          marketValue,
          urp: unrealizedGain,
          urpPct: unrealizedGainPercent,
          cmp,
          lcp,
          xirr,
          buy_date: earliestBuyDate,
          transactions: entry.lots.map((lot) => ({
            id: lot.id,
            units: lot.units,
            nav: lot.buy_nav,
            date: lot.buy_date,
            fund_short_name: fundShortName,
            account_name: accountName,
          })),
        };
      })
      .filter((item) => item.units > 0);
  }, [mfOpenLots, fundMaster]);

  const portfolioXirr = useMemo(() => {
    if (!mfOpenLots?.length || !fundMaster.length) return null;

    const masterMap = {};
    fundMaster.forEach((m) => (masterMap[(m.fund_short_name || "").trim()] = m));

    let currentValue = 0;
    const cashflows = [];

    mfOpenLots.forEach((lot) => {
      const qty = Number(lot.units) || 0;
      const buy = Number(lot.buy_nav) || 0;
      const cmp = Number(masterMap[(lot.fund_short_name || "").trim()]?.cmp) || 0;

      currentValue += qty * cmp;

      const buyDate = getValidDate(lot.buy_date);
      if (buyDate && qty > 0 && buy > 0) {
        cashflows.push({ amount: -(qty * buy), date: buyDate });
      }
    });

    if (currentValue > 0) {
      cashflows.push({ amount: currentValue, date: new Date() });
    }

    return calculateXIRR(cashflows);
  }, [mfOpenLots, fundMaster]);

  const mfClosed = useMemo(() => {
    if (!mfTxns.length || !fundMaster.length) return [];

    const masterMap = {};
    fundMaster.forEach((m) => (masterMap[(m.fund_short_name || "").trim()] = m));

    const grouped = {};
    mfTxns.forEach((txn) => {
      const f = (txn.fund_short_name || "").trim();
      if (!grouped[f]) grouped[f] = [];
      grouped[f].push({ ...txn, fund_short_name: f });
    });

    const fundList = Object.entries(grouped)
      .flatMap(([fund_short_name, arr]) => {
        const txns = arr.slice().sort((a, b) => new Date(a.date) - new Date(b.date));
        const lotsByAccount = new Map();
        const accountSplitsMap = new Map();

        txns.forEach((t) => {
          const type = String(t.transaction_type || "").toLowerCase();
          const units = Number(t.units) || 0;
          const nav = Number(t.nav) || 0;
          const dt = new Date(t.date);
          const acc = t.account_name || "";
          if (!units || !nav) return;

          if (type === "buy") {
            const lots = lotsByAccount.get(acc) || [];
            lots.push({ units, nav, date: dt });
            lotsByAccount.set(acc, lots);
          } else if (type === "sell") {
            let rem = units;
            const lots = lotsByAccount.get(acc) || [];
            const splits = accountSplitsMap.get(acc) || [];

            while (rem > 0 && lots.length) {
              const lot = lots[0];
              const take = Math.min(rem, lot.units);
              splits.push({
                id: `${t.id}-${splits.length + 1}`,
                sell_id: t.id,
                units: take,
                buy_nav: lot.nav,
                buy_date: lot.date.toISOString(),
                sell_nav: nav,
                sell_date: dt.toISOString(),
                account_name: acc,
              });
              lot.units -= take;
              rem -= take;
              if (lot.units <= 1e-8) lots.shift();
            }

            if (rem > 0) {
              splits.push({
                id: `${t.id}-${splits.length + 1}`,
                sell_id: t.id,
                units: rem,
                buy_nav: null,
                buy_date: null,
                sell_nav: nav,
                sell_date: dt.toISOString(),
                account_name: acc,
              });
            }

            accountSplitsMap.set(acc, splits);
          }
        });

        return Array.from(accountSplitsMap.entries()).map(([account_name, splits]) => {
          const invested = splits.reduce((sum, s) => sum + (s.buy_nav != null ? s.units * s.buy_nav : 0), 0);
          const closedValue = splits.reduce((sum, s) => sum + s.units * s.sell_nav, 0);
          const urp = closedValue - invested;
          const urpPct = invested > 0 ? (urp / invested) * 100 : 0;

          const realizedFlows = splits.flatMap((s) => {
            const flows = [];
            if (s.buy_date && s.buy_nav != null) {
              flows.push({ amount: -(s.units * s.buy_nav), date: new Date(s.buy_date) });
            }
            if (s.sell_date) {
              flows.push({ amount: s.units * s.sell_nav, date: new Date(s.sell_date) });
            }
            return flows;
          });
          const xirr = calculateXIRR(realizedFlows);

          const buyDates = splits
            .map((s) => getValidDate(s.buy_date))
            .filter((d) => d instanceof Date && !Number.isNaN(d.getTime()));
          const sellDates = splits
            .map((s) => getValidDate(s.sell_date))
            .filter((d) => d instanceof Date && !Number.isNaN(d.getTime()));

          const earliestBuy = buyDates.length ? buyDates.reduce((min, d) => (d < min ? d : min), buyDates[0]) : null;
          const latestSell = sellDates.length ? sellDates.reduce((max, d) => (d > max ? d : max), sellDates[0]) : null;

          return {
            fund_short_name,
            fund_full_name: masterMap[fund_short_name]?.fund_full_name ?? null,
            category: masterMap[fund_short_name]?.category ?? null,
            amc_name: masterMap[fund_short_name]?.amc_name ?? "Unknown AMC",
            account_name,
            invested,
            invested_amount: invested,
            closedValue,
            sale_amount: closedValue,
            urp,
            urpPct,
            xirr,
            buy_date: earliestBuy,
            sell_date: latestSell,
            transactions: splits,
          };
        });
      })
      .filter((f) => f.transactions && f.transactions.length > 0);

    return fundList;
  }, [mfTxns, fundMaster]);

  const closeDetailModal = () => setDetailModalData(null);

  const handleExportSummaryToExcel = () => {
    let dataToExport = [];
    let filename = "";
    const isEquity = activeMainTab === "Equity";
    const isActive = activeSubTab === "Active";

    if (isEquity) {
      if (isActive) {
        dataToExport = groupedActiveData.map(g => ({
          [selectedFilterLabel]: g.groupName,
          "Market Value": g.market_value,
          "Market %": g.market_percent / 100,
          "Invested Amount": g.invested_amount,
          "Invest %": g.invest_percent / 100,
          "P/L": g.unrealized_gain,
          "P/L %": g.unrealized_gain_percent / 100,
          "XIRR": g.xirr ? g.xirr / 100 : null
        }));
        filename = `Equity_Active_Summary_${selectedFilter}.xlsx`;
      } else {
        dataToExport = groupedClosedData.map(g => ({
          [selectedFilterLabel]: g.groupName,
          "Sale Amount": g.sale_amount,
          "Market %": g.market_percent / 100,
          "Invested Amount": g.invested_amount,
          "Invest %": g.invest_percent / 100,
          "P/L": g.gain,
          "P/L %": g.gain_percent / 100,
          "XIRR": g.xirr ? g.xirr / 100 : null
        }));
        filename = `Equity_Closed_Summary_${selectedFilter}.xlsx`;
      }
    } else {
      if (isActive) {
        dataToExport = groupedMfActiveData.map(g => ({
          [selectedMfFilterLabel]: g.groupName,
          "Market Value": g.market_value,
          "Market %": g.market_percent / 100,
          "Invested Amount": g.invested_amount,
          "Invest %": g.invest_percent / 100,
          "P/L": g.unrealized_gain,
          "P/L %": g.unrealized_gain_percent / 100,
          "XIRR": g.xirr ? g.xirr / 100 : null
        }));
        filename = `MF_Active_Summary_${selectedMfFilter}.xlsx`;
      } else {
        dataToExport = groupedMfClosedData.map(g => ({
          [selectedMfFilterLabel]: g.groupName,
          "Sale Amount": g.sale_amount,
          "Market %": g.market_percent / 100,
          "Invested Amount": g.invested_amount,
          "Invest %": g.invest_percent / 100,
          "P/L": g.realized_gain,
          "P/L %": g.realized_gain_percent / 100,
          "XIRR": g.xirr ? g.xirr / 100 : null
        }));
        filename = `MF_Closed_Summary_${selectedMfFilter}.xlsx`;
      }
    }

    if (dataToExport.length === 0) return;

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    
    // Format percentages as numeric with percentage format in Excel
    const range = XLSX.utils.decode_range(worksheet['!ref']);
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const address = XLSX.utils.encode_col(C) + "1";
      if (!worksheet[address]) continue;
      const header = worksheet[address].v;
      if (header.includes("%") || header.includes("XIRR")) {
        for (let R = range.s.r + 1; R <= range.e.r; ++R) {
          const cellAddr = XLSX.utils.encode_cell({ r: R, c: C });
          if (worksheet[cellAddr] && typeof worksheet[cellAddr].v === 'number') {
            worksheet[cellAddr].z = '0.00%';
          }
        }
      }
    }

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Summary");
    XLSX.writeFile(workbook, filename);
  };

  const selectedFilterLabel = useMemo(
    () => FILTER_OPTIONS.find((option) => option.value === selectedFilter)?.label || "Group",
    [selectedFilter]
  );

  const selectedMfFilterLabel = useMemo(
    () => MF_FILTER_OPTIONS.find((option) => option.value === selectedMfFilter)?.label || "Group",
    [selectedMfFilter]
  );





  // Group active data based on selected filter
  const groupedActiveData = useMemo(() => {
    if (!equityActive?.length) return [];

    const groups = new Map();

    equityActive.forEach((stock) => {
      const rawKey = stock[selectedFilter] || "Unknown";
      const groupKey = typeof rawKey === 'string' ? rawKey.trim().toUpperCase() : rawKey;

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          groupName: rawKey,
          invested_amount: 0,
          market_value: 0,
          unrealized_gain: 0,
          stocks: [],
        });
      }

      const group = groups.get(groupKey);
      group.invested_amount += stock.invested_amount;
      group.market_value += stock.market_value;
      group.unrealized_gain += stock.unrealized_gain;
      group.stocks.push(stock);
    });

    const totals = Array.from(groups.values()).reduce(
      (acc, group) => ({
        totalMarketValue: acc.totalMarketValue + group.market_value,
        totalInvestedAmount: acc.totalInvestedAmount + group.invested_amount,
      }),
      { totalMarketValue: 0, totalInvestedAmount: 0 }
    );

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        unrealized_gain_percent:
          group.invested_amount > 0 ? (group.unrealized_gain / group.invested_amount) * 100 : 0,
        market_percent:
          totals.totalMarketValue > 0 ? (group.market_value / totals.totalMarketValue) * 100 : 0,
        invest_percent:
          totals.totalInvestedAmount > 0 ? (group.invested_amount / totals.totalInvestedAmount) * 100 : 0,
        xirr: (() => {
          const flows = [];
          group.stocks.forEach((item) => {
            const explicitFlows = Array.isArray(item.cashflows) ? item.cashflows : null;
            if (explicitFlows?.length) {
              explicitFlows.forEach((flow) => {
                const amount = toNumber(flow?.amount);
                const date = getValidDate(flow?.date);
                if (amount !== 0 && date) flows.push({ amount, date });
              });
            } else {
              const investedAmount = toNumber(item.invested_amount);
              const investedDate = getValidDate(item.buy_date);
              if (investedAmount > 0 && investedDate) {
                flows.push({ amount: -investedAmount, date: investedDate });
              }
              const marketValue = toNumber(item.market_value);
              const valuationDate = getValidDate(item.market_value_date || item.updated_at) || new Date();
              if (marketValue > 0) {
                flows.push({ amount: marketValue, date: valuationDate });
              }
            }
          });
          return flows.length >= 2 ? calculateXIRR(flows) : null;
        })(),
      }))
      .sort((a, b) => {
        if (sortConfig.key) {
          const getVal = (val) => {
            if (val == null) return sortConfig.direction === 'asc' ? Number.MAX_VALUE : Number.MIN_VALUE;
            if (typeof val === 'number') return val;
            return String(val).toLowerCase();
          };
          const aVal = getVal(a[sortConfig.key]);
          const bVal = getVal(b[sortConfig.key]);
          const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
          return sortConfig.direction === 'asc' ? cmp : -cmp;
        } else {
          return b.market_value - a.market_value;
        }
      });
  }, [equityActive, selectedFilter, sortConfig]);

  const activeEquityXirr = useMemo(() => {
    if (!equityActive?.length) return null;

    const flows = [];

    equityActive.forEach((item) => {
      const explicitFlows = Array.isArray(item.cashflows) ? item.cashflows : null;

      if (explicitFlows?.length) {
        explicitFlows.forEach((flow) => {
          const amount = toNumber(flow?.amount);
          const date = getValidDate(flow?.date);
          if (amount !== 0 && date) {
            flows.push({ amount, date });
          }
        });
        return;
      }

      const investedAmount = toNumber(item.invested_amount);
      const investedDate = getValidDate(item.buy_date);
      if (investedAmount > 0 && investedDate) {
        flows.push({ amount: -investedAmount, date: investedDate });
      }

      const marketValue = toNumber(item.market_value);
      const valuationDate = getValidDate(item.market_value_date || item.updated_at) || new Date();
      if (marketValue > 0) {
        flows.push({ amount: marketValue, date: valuationDate });
      }
    });

    if (!flows.length) return null;
    return calculateXIRR(flows);
  }, [equityActive]);

  const activeEquitySummary = useMemo(() => {
    if (!equityActive?.length) {
      return {
        invested: 0,
        market: 0,
        gain: 0,
        gainPercent: 0,
        xirr: null,
      };
    }

    const invested = equityActive.reduce((total, item) => total + toNumber(item.invested_amount), 0);
    const market = equityActive.reduce((total, item) => total + toNumber(item.market_value), 0);
    const gain = market - invested;
    const gainPercent = invested > 0 ? (gain / invested) * 100 : 0;
    return {
      invested,
      market,
      gain,
      gainPercent,
      xirr: activeEquityXirr,
      positions: equityActive.length,
    };
  }, [equityActive, activeEquityXirr]);

  const buildClosedSummary = useCallback((items) => {
    if (!items?.length) {
      return {
        invested: 0,
        sale: 0,
        charges: 0,
        gain: 0,
        gainPercent: 0,
        xirr: null,
      };
    }

    const invested = items.reduce((total, item) => total + toNumber(item.invested_amount), 0);
    const sale = items.reduce((total, item) => total + toNumber(item.sale_amount), 0);
    const charges = items.reduce((total, item) => total + toNumber(item.charges_allocated ?? 0), 0);
    const netSale = sale - charges;
    const gain = sale - invested;
    const gainPercent = invested > 0 ? (gain / invested) * 100 : 0;

    const fallbackBaseFlows = [];

    items.forEach((item) => {
      const investedAmount = toNumber(item.invested_amount);
      const investedDate = getValidDate(item.buy_date || item.buyDate);
      if (investedAmount > 0 && investedDate) {
        fallbackBaseFlows.push({ amount: -investedAmount, date: investedDate });
      }

      const saleAmount = toNumber(item.sale_amount);
      const saleDate = getValidDate(item.sell_date || item.sellDate);
      const chargesAllocated = toNumber(item.charges_allocated ?? 0);
      if (saleAmount > 0 && saleDate) {
        fallbackBaseFlows.push({ amount: saleAmount - chargesAllocated, date: saleDate });
      }
    });

    const fallbackFlows = fallbackBaseFlows
      .map((flow) => ({ amount: toNumber(flow.amount), date: getValidDate(flow.date) }))
      .filter((flow) => Number.isFinite(flow.amount) && flow.amount !== 0 && flow.date);

    const explicitFlows = items.flatMap((item) => {
      const flows = Array.isArray(item.cashflows) ? item.cashflows : [];
      return flows
        .map((flow) => ({ amount: toNumber(flow?.amount), date: getValidDate(flow?.date) }))
        .filter((flow) => Number.isFinite(flow.amount) && flow.amount !== 0 && flow.date);
    });

    const xirrSourceFlows = explicitFlows.length ? explicitFlows : fallbackFlows;
    const xirr = xirrSourceFlows.length ? calculateXIRR(xirrSourceFlows) : null;

    return {
      invested,
      sale,
      charges,
      netSale,
      gain,
      gainPercent,
      xirr: Number.isFinite(xirr) ? xirr : null,
      positions: items.length,
    };
  }, []);

  const modifiedEquityClosed = useMemo(() => {
    if (!equityClosed?.length) return equityClosed || [];

    if (!chargesData?.length) return equityClosed;

    // Calculate total equity charges for closed positions (year !== null)
    const totalEquityCharges = chargesData.reduce((total, row) => {
      if (row.year !== null) {
        return total + (Number(row.other_charges) || 0) + (Number(row.dp_charges) || 0);
      }
      return total;
    }, 0);

    // Calculate total invested for closed equity
    const totalInvested = equityClosed.reduce((total, item) => total + toNumber(item.invested_amount), 0);

    if (totalInvested === 0 || totalEquityCharges === 0) return equityClosed;

    // Allocate charges proportionally
    return equityClosed.map((item) => {
      const invested = toNumber(item.invested_amount);
      const allocatedCharges = totalEquityCharges * (invested / totalInvested);
      const realizedGainNet = toNumber(item.realized_gain) - allocatedCharges;
      return {
        ...item,
        charges_allocated: allocatedCharges,
        realized_gain: realizedGainNet,
      };
    });
  }, [equityClosed, chargesData]);

  const closedEquitySummary = useMemo(() => buildClosedSummary(modifiedEquityClosed), [buildClosedSummary, modifiedEquityClosed]);

  // Group closed data based on selected filter
  const groupedClosedData = useMemo(() => {
    if (!modifiedEquityClosed?.length) return [];

    const groups = new Map();

    modifiedEquityClosed.forEach((stock) => {
      const rawKey = stock[selectedFilter] || "Unknown";
      const groupKey = typeof rawKey === 'string' ? rawKey.trim().toUpperCase() : rawKey;
      
      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          groupName: rawKey,
          invested_amount: 0,
          sale_amount: 0,
          gain: 0,
          stocks: []
        });
      }

      const group = groups.get(groupKey);
      group.invested_amount += stock.invested_amount;
      group.sale_amount += stock.sale_amount;
      group.gain += (stock.sale_amount - stock.invested_amount);
      group.stocks.push(stock);
    });

    // Calculate totals for percentage calculations
    const totals = Array.from(groups.values()).reduce(
      (acc, group) => ({
        totalSaleAmount: acc.totalSaleAmount + group.sale_amount,
        totalInvestedAmount: acc.totalInvestedAmount + group.invested_amount,
      }),
      { totalSaleAmount: 0, totalInvestedAmount: 0 }
    );

    return Array.from(groups.values())
      .map((group) => {
        const aggregatedXirr = computeClosedXirr(group.stocks, {
          investedAmount: (item) => item.invested_amount,
          investedDate: (item) => item.buy_date,
          saleAmount: (item) => item.sale_amount,
          saleDate: (item) => item.sell_date,
          chargesAllocated: (item) => item.charges_allocated,
        });

        return {
          ...group,
          gain_percent:
            group.invested_amount > 0 ? (group.gain / group.invested_amount) * 100 : 0,
          market_percent:
            totals.totalSaleAmount > 0 ? (group.sale_amount / totals.totalSaleAmount) * 100 : 0,
          invest_percent:
            totals.totalInvestedAmount > 0 ? (group.invested_amount / totals.totalInvestedAmount) * 100 : 0,
          xirr: aggregatedXirr,
        };
      })
      .sort((a, b) => {
        if (sortConfig.key) {
          const getVal = (val) => {
            if (val == null) return sortConfig.direction === 'asc' ? Number.MAX_VALUE : Number.MIN_VALUE;
            if (typeof val === 'number') return val;
            return String(val).toLowerCase();
          };
          const aVal = getVal(a[sortConfig.key]);
          const bVal = getVal(b[sortConfig.key]);
          const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
          return sortConfig.direction === 'asc' ? cmp : -cmp;
        } else {
          return b.sale_amount - a.sale_amount;
        }
      });
  }, [modifiedEquityClosed, selectedFilter, sortConfig]);

  const groupedMfActiveData = useMemo(() => {
    if (!mfActive?.length) return [];

    const groups = new Map();

    mfActive.forEach((lot) => {
      const rawKey = lot[selectedMfFilter] || "Unknown";
      const groupKey = typeof rawKey === 'string' ? rawKey.trim().toUpperCase() : rawKey;

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          groupName: rawKey,
          invested_amount: 0,
          market_value: 0,
          unrealized_gain: 0,
          units: 0,
          lots: [],
        });
      }

      const group = groups.get(groupKey);
      group.invested_amount += lot.invested;
      group.market_value += lot.marketValue;
      group.unrealized_gain += lot.urp;
      group.units += lot.units;
      group.lots.push(lot);
    });

    const totals = Array.from(groups.values()).reduce(
      (acc, group) => ({
        totalMarketValue: acc.totalMarketValue + group.market_value,
        totalInvestedAmount: acc.totalInvestedAmount + group.invested_amount,
      }),
      { totalMarketValue: 0, totalInvestedAmount: 0 }
    );

    return Array.from(groups.values())
      .map((group) => {
        const groupXirr = computeActiveXirr(group.lots, {
          cashflows: ({ transactions, marketValue }) => {
            const flows = [];
            transactions?.forEach((txn) => {
              const amount = -toNumber(txn.units) * toNumber(txn.nav);
              const date = getValidDate(txn.date);
              if (amount && date) flows.push({ amount, date });
            });
            if (marketValue > 0) {
              flows.push({ amount: marketValue, date: new Date() });
            }
            return flows;
          },
        });

        return {
          ...group,
          unrealized_gain_percent:
            group.invested_amount > 0 ? (group.unrealized_gain / group.invested_amount) * 100 : 0,
          market_percent:
            totals.totalMarketValue > 0 ? (group.market_value / totals.totalMarketValue) * 100 : 0,
          invest_percent:
            totals.totalInvestedAmount > 0 ? (group.invested_amount / totals.totalInvestedAmount) * 100 : 0,
          xirr: groupXirr,
        };
      })
      .sort((a, b) => {
        if (sortConfig.key) {
          const getVal = (val) => {
            if (val == null) return sortConfig.direction === 'asc' ? Number.MAX_VALUE : Number.MIN_VALUE;
            if (typeof val === 'number') return val;
            return String(val).toLowerCase();
          };
          const aVal = getVal(a[sortConfig.key]);
          const bVal = getVal(b[sortConfig.key]);
          const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
          return sortConfig.direction === 'asc' ? cmp : -cmp;
        } else {
          return b.market_value - a.market_value;
        }
      });
  }, [mfActive, selectedMfFilter, sortConfig]);

  const groupedMfClosedData = useMemo(() => {
    if (!mfClosed?.length) return [];

    const groups = new Map();

    mfClosed.forEach((lot) => {
      const rawKey = lot[selectedMfFilter] || "Unknown";
      const groupKey = typeof rawKey === 'string' ? rawKey.trim().toUpperCase() : rawKey;

      if (!groups.has(groupKey)) {
        groups.set(groupKey, {
          groupName: rawKey,
          invested_amount: 0,
          sale_amount: 0,
          realized_gain: 0,
          units: 0,
          lots: [],
        });
      }

      const group = groups.get(groupKey);
      group.invested_amount += lot.invested;
      group.sale_amount += lot.closedValue;
      group.realized_gain += lot.urp;
      group.units += lot.units;
      group.lots.push(lot);
    });

    const totals = Array.from(groups.values()).reduce(
      (acc, group) => ({
        totalSaleAmount: acc.totalSaleAmount + group.sale_amount,
        totalInvestedAmount: acc.totalInvestedAmount + group.invested_amount,
      }),
      { totalSaleAmount: 0, totalInvestedAmount: 0 }
    );

    return Array.from(groups.values())
      .map((group) => {
        const groupSplits = group.lots.flatMap((item) => item?.transactions || []);
        const groupFlows = groupSplits.length ? buildClosedFlowsFromSplits(groupSplits) : buildClosedFlowsFromLots(group.lots);
        const groupXirr = groupFlows.length ? calculateXIRR(groupFlows) : computeClosedXirr(group.lots, {
          investedAmount: (item) => item.invested_amount ?? item.invested,
          investedDate: (item) => item.buy_date,
          saleAmount: (item) => item.sale_amount ?? item.closedValue,
          saleDate: (item) => item.sell_date,
          chargesAllocated: (item) => item.charges_allocated ?? item.chargesAllocated ?? 0,
        });

        return {
          ...group,
          realized_gain_percent:
            group.invested_amount > 0 ? (group.realized_gain / group.invested_amount) * 100 : 0,
          market_percent:
            totals.totalSaleAmount > 0 ? (group.sale_amount / totals.totalSaleAmount) * 100 : 0,
          invest_percent:
            totals.totalInvestedAmount > 0 ? (group.invested_amount / totals.totalInvestedAmount) * 100 : 0,
          xirr: groupXirr,
        };
      })
      .sort((a, b) => {
        if (sortConfig.key) {
          const getVal = (val) => {
            if (val == null) return sortConfig.direction === 'asc' ? Number.MAX_VALUE : Number.MIN_VALUE;
            if (typeof val === 'number') return val;
            return String(val).toLowerCase();
          };
          const aVal = getVal(a[sortConfig.key]);
          const bVal = getVal(b[sortConfig.key]);
          const cmp = aVal < bVal ? -1 : aVal > bVal ? 1 : 0;
          return sortConfig.direction === 'asc' ? cmp : -cmp;
        } else {
          return b.sale_amount - a.sale_amount;
        }
      });
  }, [mfClosed, selectedMfFilter, sortConfig]);




  const handleGroupClick = useCallback(
    (group, index) => {
      if (!group) return;

      setDetailModalData(
        buildDetailPayload({
          group,
          index,
          mainTab: activeMainTab,
          subTab: activeSubTab,
          selectedFilterLabel,
          mfSelectedFilterLabel: selectedMfFilterLabel,
        })
      );
    },
    [activeMainTab, activeSubTab, selectedFilterLabel, selectedMfFilterLabel]
  );

  const RowsPerPageInput = () => (
    <div className="flex items-center space-x-2 ml-auto bg-slate-800/50 px-3 py-1.5 rounded-lg border border-slate-700">
      <input
        type="number"
        min="1"
        max="100"
        value={rowsPerPage}
        onChange={(e) => setRowsPerPage(Math.max(1, parseInt(e.target.value) || 1))}
        className="w-12 bg-transparent text-slate-100 text-sm font-semibold focus:outline-none border-b border-slate-600 focus:border-purple-500 transition-colors text-center"
      />
    </div>
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg text-gray-600">Loading summary data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">
        <p className="text-lg font-semibold mb-2">Error Loading Data</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 p-4 md:p-6 text-slate-100">
      <div className="max-w-7xl mx-auto space-y-6">
      {detailModalData ? <DetailModal data={detailModalData} onClose={closeDetailModal} /> : null}
      {/* Main Tabs */}
      <div className="flex space-x-2 mb-4">
        {MAIN_TABS.map((tab) => (
          <button
            key={tab}
            className={`px-6 py-3 font-semibold rounded-lg transition-all duration-200 ${
              activeMainTab === tab
                ? "bg-purple-600 text-white shadow-lg ring-2 ring-purple-400"
                : "bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700"
            }`}
            onClick={() => {
              setActiveMainTab(tab);
              setActiveSubTab("Active");
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Equity Tab Content */}
      {activeMainTab === "Equity" && (
        <div className="space-y-6">
          {/* Sub Tabs */}
          <div className="flex space-x-2">
            {SUB_TABS.map((tab) => (
              <button
                key={tab}
                className={`px-4 py-2 font-medium rounded-lg transition-all duration-200 ${
                  activeSubTab === tab
                    ? "bg-blue-600 text-white shadow-lg ring-2 ring-blue-400"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700"
                }`}
                onClick={() => setActiveSubTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>

        {/* Active Tab Content */}
        {activeSubTab === "Active" && (
        <div className="space-y-4">
          {/* Filter Dropdown */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <label className="text-sm font-medium text-slate-300">Group by:</label>
              <select
                value={selectedFilter}
                onChange={(e) => setSelectedFilter(e.target.value)}
                className="px-3 py-2 bg-slate-800 border border-slate-700 text-slate-100 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                {FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value} className="bg-slate-800">
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <RowsPerPageInput />
            <button
              onClick={handleExportSummaryToExcel}
              className="p-2 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-lg transition-colors border border-emerald-500/20"
              title="Export Summary to Excel"
            >
              <Download size={18} />
            </button>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-blue-600/20 p-4 rounded-xl border border-blue-500/50 shadow-lg flex items-center space-x-4 transition-all hover:scale-[1.02]">
              <div>
                <div className="text-sm font-semibold text-blue-200 uppercase tracking-wider">Market Value</div>
                <div className="text-2xl font-bold text-white mb-2">
                  {formatCurrency(activeEquitySummary.market)}
                </div>
                <div className="text-xs font-medium text-blue-300">
                  Invested: {formatCurrency(activeEquitySummary.invested)}
                </div>
              </div>
            </div>
            <div className="bg-green-600/20 p-4 rounded-xl border border-green-500/50 shadow-lg flex items-center space-x-4 transition-all hover:scale-[1.02]">
              <div>
                <div className="text-sm font-semibold text-green-200 uppercase tracking-wider">Net Returns</div>
                <div className={`text-2xl font-bold ${activeEquitySummary.gain >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {formatCurrency(activeEquitySummary.gain)}
                </div>
              </div>
            </div>
            <div className="bg-indigo-600/20 p-4 rounded-xl border border-indigo-500/50 shadow-lg flex items-center space-x-4 transition-all hover:scale-[1.02]">
              <div>
                <div className="text-sm font-semibold text-indigo-200 uppercase tracking-wider">Returns%</div>
                <div
                  className={`text-2xl font-bold ${
                    activeEquitySummary.gainPercent >= 0 ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {formatPercent(activeEquitySummary.gainPercent)}
                </div>
              </div>
            </div>
            <div className="bg-orange-600/20 p-4 rounded-xl border border-orange-500/50 shadow-lg flex items-center space-x-4 transition-all hover:scale-[1.02]">
              <div>
                <div className="text-sm font-semibold text-orange-200 uppercase tracking-wider">Equity XIRR</div>
                <div
                  className={`text-2xl font-bold ${
                    Number(activeEquitySummary.xirr) >= 0 ? "text-green-400" : "text-red-400"
                  }`}
                >
                  {formatXirr(activeEquitySummary.xirr)}
                </div>
              </div>
            </div>
          </div>

          {/* Data Table */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-xl overflow-hidden">
            <div className="overflow-x-scroll scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800">
              <table className="min-w-full divide-y divide-slate-700">
                <thead className="bg-slate-700/50">
                  <tr>
                    <th className="sticky left-0 z-20 bg-slate-700 px-6 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('groupName')}>
                      {FILTER_OPTIONS.find(opt => opt.value === selectedFilter)?.label || "Group"}{sortConfig.key === 'groupName' ? (sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : ''}
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('market_value')}>
                      Market Value{sortConfig.key === 'market_value' ? (sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : ''}
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('market_percent')}>
                      Market %{sortConfig.key === 'market_percent' ? (sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : ''}
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('invested_amount')}>
                      Invested Amount{sortConfig.key === 'invested_amount' ? (sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : ''}
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('invest_percent')}>
                      Invest %{sortConfig.key === 'invest_percent' ? (sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : ''}
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('unrealized_gain')}>
                      P/L{sortConfig.key === 'unrealized_gain' ? (sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : ''}
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('unrealized_gain_percent')}>
                      P/L %{sortConfig.key === 'unrealized_gain_percent' ? (sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : ''}
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('xirr')}>
                      XIRR{sortConfig.key === 'xirr' ? (sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : ''}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-slate-800 divide-y divide-slate-700">
                  {groupedActiveData.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="px-6 py-8 text-center text-slate-400">
                        No active positions found
                      </td>
                    </tr>
                  ) : (
                    groupedActiveData
                      .slice(currentPage * rowsPerPage, (currentPage + 1) * rowsPerPage)
                      .map((group, index) => (
                      <tr key={index} className="hover:bg-slate-700/50 transition-colors">
                        <td className="sticky left-0 z-10 bg-slate-800 px-6 py-4 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleGroupClick(group, currentPage * rowsPerPage + index)}
                            className="w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 rounded-md group"
                          >
                            <div className="text-sm font-medium text-slate-100 group-hover:text-purple-400">
                              {group.groupName}
                            </div>
                            <div className="text-xs text-slate-400">
                              {group.stocks.length} position{group.stocks.length !== 1 ? 's' : ''}
                            </div>
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-slate-100">
                          {formatCurrency(group.market_value)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-blue-400 font-medium">
                          {formatPercent(group.market_percent)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-slate-300">
                          {formatCurrency(group.invested_amount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-blue-400 font-medium">
                          {formatPercent(group.invest_percent)}
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-right text-sm font-medium ${
                          group.unrealized_gain >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {formatCurrency(group.unrealized_gain)}
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-right text-sm font-medium ${
                          group.unrealized_gain_percent >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {formatPercent(group.unrealized_gain_percent)}
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-right text-sm font-medium ${
                          group.xirr >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                         {formatXirr(group.xirr)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <PaginationControls
              currentPage={currentPage}
              totalPages={Math.ceil(groupedActiveData.length / rowsPerPage)}
              onPageChange={setCurrentPage}
            />
          </div>
        </div>
      )}

        {/* Closed Tab Content */}
        {activeSubTab === "Closed" && (
        <div className="space-y-4">
          {/* Filter Dropdown */}
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-3">
              <label className="text-sm font-medium text-slate-300">Group by:</label>
              <select
                value={selectedFilter}
                onChange={(e) => setSelectedFilter(e.target.value)}
                className="px-3 py-2 bg-slate-800 border border-slate-700 text-slate-100 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                {FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value} className="bg-slate-800">
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <RowsPerPageInput />
            <button
              onClick={handleExportSummaryToExcel}
              className="p-2 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-lg transition-colors border border-emerald-500/20"
              title="Export Summary to Excel"
            >
              <Download size={18} />
            </button>
          </div>

          {/* Summary Stats */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-blue-600/20 p-4 rounded-xl border border-blue-500/50 shadow-lg flex items-center space-x-4 transition-all hover:scale-[1.02]">

              <div>
                <div className="text-sm font-semibold text-blue-200 uppercase tracking-wider ">Transaction Value</div>
                <div className="text-2xl font-bold text-white mb-2">{formatCurrency(closedEquitySummary.sale)}</div>         
                <div className="text-xs font-medium text-blue-300">Invested: {formatCurrency(closedEquitySummary.invested)}</div>	      
              </div>
            </div>
            <div className="bg-green-600/20 p-4 rounded-xl border border-green-500/50 shadow-lg flex items-center space-x-4 transition-all hover:scale-[1.02]">

              <div>
                <div className="text-sm font-semibold text-green-200 uppercase tracking-wider">Net Return</div>
                <div className={`text-2xl font-bold mb-2 ${closedEquitySummary.gain >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {formatCurrency(closedEquitySummary.gain)}
                </div>
                <div className="text-xs font-semibold text-slate-400">Charges: {formatCurrency(closedEquitySummary.charges)}</div>
              </div>
            </div>
            <div className="bg-indigo-600/20 p-4 rounded-xl border border-indigo-500/50 shadow-lg flex items-center space-x-4 transition-all hover:scale-[1.02]">
              <div>
                <div className="text-sm font-semibold text-indigo-200 uppercase tracking-wider">Net Return %</div>
                <div className={`text-2xl font-bold ${closedEquitySummary.gainPercent >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {formatPercent(closedEquitySummary.gainPercent)}
                </div>
              </div>
            </div>
           <div className="bg-orange-600/20 p-4 rounded-xl border border-orange-500/50 shadow-lg flex items-center space-x-4 transition-all hover:scale-[1.02]">
              <div>
                <div className="text-sm font-semibold text-orange-200 uppercase tracking-wider">Closed XIRR</div>
                <div className={`text-2xl font-bold ${Number(closedEquitySummary.xirr) >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {formatXirr(closedEquitySummary.xirr)}
                </div>
              </div>
            </div>
          </div>

          {/* Data Table */}
          <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-xl overflow-hidden">
            <div className="overflow-x-scroll scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800">
              <table className="min-w-full divide-y divide-slate-700">
                <thead className="bg-slate-700/50">
                  <tr>
                    <th className="sticky left-0 z-20 bg-slate-700 px-6 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('groupName')}>
                      {FILTER_OPTIONS.find(opt => opt.value === selectedFilter)?.label || "Group"}{sortConfig.key === 'groupName' ? (sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : ''}
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('sale_amount')}>
                      Sale Amount{sortConfig.key === 'sale_amount' ? (sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : ''}
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('market_percent')}>
                      SA %{sortConfig.key === 'market_percent' ? (sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : ''}
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('invested_amount')}>
                      Invested Amount{sortConfig.key === 'invested_amount' ? (sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : ''}
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('invest_percent')}>
                      Invest %{sortConfig.key === 'invest_percent' ? (sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : ''}
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('gain')}>
                      P/L{sortConfig.key === 'gain' ? (sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : ''}
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('gain_percent')}>
                      P/L %{sortConfig.key === 'gain_percent' ? (sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : ''}
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('xirr')}>
                      XIRR{sortConfig.key === 'xirr' ? (sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : ''}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-slate-800 divide-y divide-slate-700">
                  {groupedClosedData.length === 0 ? (
                    <tr>
                      <td colSpan="8" className="px-6 py-8 text-center text-slate-400">
                        No closed positions found
                      </td>
                    </tr>
                  ) : (
                    groupedClosedData
                      .slice(currentPage * rowsPerPage, (currentPage + 1) * rowsPerPage)
                      .map((group, index) => (
                      <tr key={index} className="hover:bg-slate-700/50 transition-colors">
                        <td className="sticky left-0 z-10 bg-slate-800 px-6 py-4 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => handleGroupClick(group, currentPage * rowsPerPage + index)}
                            className="w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 rounded-md group"
                            aria-label={`View details for ${group.groupName}`}
                          >
                            <div className="text-sm font-medium text-slate-100 group-hover:text-purple-400">
                              {group.groupName}
                            </div>
                            <div className="text-xs text-slate-400">
                              {group.stocks.length} transaction{group.stocks.length !== 1 ? 's' : ''}
                            </div>
                          </button>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-slate-100">
                          {formatCurrency(group.sale_amount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-blue-400 font-medium">
                          {formatPercent(group.market_percent)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-slate-300">
                          {formatCurrency(group.invested_amount)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-blue-400 font-medium">
                          {formatPercent(group.invest_percent)}
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-right text-sm font-medium ${
                          group.gain >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {formatCurrency(group.gain)}
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-right text-sm font-medium ${
                          group.gain_percent >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {formatPercent(group.gain_percent)}
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-right text-sm font-medium ${
                          group.xirr >= 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                         {formatXirr(group.xirr)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <PaginationControls
              currentPage={currentPage}
              totalPages={Math.ceil(groupedClosedData.length / rowsPerPage)}
              onPageChange={setCurrentPage}
            />
          </div>
        </div>
        )}
        </div>
      )}

      {/* MF Tab Content */}
      {activeMainTab === "MF" && (
        <div className="space-y-6">
          <div className="flex space-x-2">
            {SUB_TABS.map((tab) => (
              <button
                key={tab}
                className={`px-4 py-2 font-medium rounded-lg transition-all duration-200 ${
                  activeSubTab === tab
                    ? "bg-blue-600 text-white shadow-lg ring-2 ring-blue-400"
                    : "bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700"
                }`}
                onClick={() => setActiveSubTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>

          {activeSubTab === "Active" && (
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-3">
                  <label className="text-sm font-medium text-slate-300">Group by:</label>
                  <select
                    value={selectedMfFilter}
                    onChange={(e) => setSelectedMfFilter(e.target.value)}
                    className="px-3 py-2 bg-slate-800 border border-slate-700 text-slate-100 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    {MF_FILTER_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value} className="bg-slate-800">
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <RowsPerPageInput />
                <button
                  onClick={handleExportSummaryToExcel}
                  className="p-2 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-lg transition-colors border border-emerald-500/20"
                  title="Export Summary to Excel"
                >
                  <Download size={18} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                {(() => {
                  const totals = groupedMfActiveData.reduce(
                    (acc, group) => ({
                      invested: acc.invested + group.invested_amount,
                      market: acc.market + group.market_value,
                      gain: acc.gain + group.unrealized_gain,
                    }),
                    { invested: 0, market: 0, gain: 0 }
                  );
                  const gainPercent = totals.invested > 0 ? (totals.gain / totals.invested) * 100 : 0;
                  const overallXirr = portfolioXirr;

                  return (
                    <>
                      <div className="bg-blue-600/20 p-4 rounded-xl border border-blue-500/50 shadow-lg flex items-center space-x-4 transition-all hover:scale-[1.02]">
                          <div>
                          <div className="text-sm font-semibold text-blue-200 uppercase tracking-wider">Market Value</div>
                          <div className="text-2xl font-bold text-white">
                            {formatCurrency(totals.market)}
                          </div>
                          <div className="text-xs font-medium text-blue-300">
                            IV: {formatCurrency(totals.invested)}
                          </div>
                        </div>
                      </div>
                      <div className="bg-green-600/20 p-4 rounded-xl border border-green-500/50 shadow-lg flex items-center space-x-4 transition-all hover:scale-[1.02]">
                        <div>
                          <div className="text-sm font-semibold text-green-200 uppercase tracking-wider">Net Return</div>
                          <div className={`text-2xl font-bold ${totals.gain >= 0 ? "text-green-400" : "text-red-400"}`}>
                            {formatCurrency(totals.gain)}
                          </div>
                        </div>
                      </div>
                      <div className="bg-indigo-600/20 p-4 rounded-xl border border-indigo-500/50 shadow-lg flex items-center space-x-4 transition-all hover:scale-[1.02]">
	                        <div>
                          <div className="text-sm font-semibold text-indigo-200 uppercase tracking-wider">Net Return %</div>
                          <div className={`text-2xl font-bold ${gainPercent >= 0 ? "text-green-400" : "text-red-400"}`}>
                            {formatPercent(gainPercent)}
                          </div>
                        </div>
                      </div>
                      <div className="bg-orange-600/20 p-4 rounded-xl border border-orange-500/50 shadow-lg flex items-center space-x-4 transition-all hover:scale-[1.02]">
                         <div>
                          <div className="text-sm font-semibold text-orange-200 uppercase tracking-wider">MF XIRR</div>
                          <div className={`text-2xl font-bold ${Number(overallXirr) >= 0 ? "text-green-400" : "text-red-400"}`}>
                            {formatXirr(overallXirr)}
                          </div>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>

              <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-xl overflow-hidden">
                <div className="overflow-x-scroll scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800">
                  <table className="min-w-full divide-y divide-slate-700">
                    <thead className="bg-slate-700/50">
                      <tr>
                        <th className="sticky left-0 z-20 bg-slate-700 px-6 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('groupName')}>
                          {MF_FILTER_OPTIONS.find(opt => opt.value === selectedMfFilter)?.label || "Group"}{sortConfig.key === 'groupName' ? (sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : ''}
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('market_value')}>
                          Market Value{sortConfig.key === 'market_value' ? (sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : ''}
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('market_percent')}>
                          Market %{sortConfig.key === 'market_percent' ? (sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : ''}
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('invested_amount')}>
                          Invested Amount{sortConfig.key === 'invested_amount' ? (sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : ''}
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('invest_percent')}>
                          Invest %{sortConfig.key === 'invest_percent' ? (sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : ''}
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('unrealized_gain')}>
                          P/L{sortConfig.key === 'unrealized_gain' ? (sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : ''}
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('unrealized_gain_percent')}>
                          P/L %{sortConfig.key === 'unrealized_gain_percent' ? (sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : ''}
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('xirr')}>
                          XIRR{sortConfig.key === 'xirr' ? (sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : ''}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-slate-800 divide-y divide-slate-700">
                      {groupedMfActiveData.length === 0 ? (
                        <tr>
                          <td colSpan="8" className="px-6 py-8 text-center text-slate-400">
                            No active mutual fund positions found
                          </td>
                        </tr>
                      ) : (
                        groupedMfActiveData
                          .slice(currentPage * rowsPerPage, (currentPage + 1) * rowsPerPage)
                          .map((group, index) => (
                          <tr key={index} className="hover:bg-slate-700/50 transition-colors">
                            <td className="sticky left-0 z-10 bg-slate-800 px-6 py-4 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => handleGroupClick(group, currentPage * rowsPerPage + index)}
                                className="w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 rounded-md group"
                                aria-label={`View details for ${group.groupName}`}
                              >
                                <div className="text-sm font-medium text-slate-100 group-hover:text-purple-400">
                                  {group.groupName}
                                </div>
                                <div className="text-xs text-slate-400">
                                  {group.lots.length} lot{group.lots.length !== 1 ? 's' : ''} · {Number(group.units || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })} units
                                </div>
                              </button>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-slate-100">
                              {formatCurrency(group.market_value)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-blue-400 font-medium">
                              {formatPercent(group.market_percent)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-slate-300">
                              {formatCurrency(group.invested_amount)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-blue-400 font-medium">
                              {formatPercent(group.invest_percent)}
                            </td>
                            <td className={`px-6 py-4 whitespace-nowrap text-right text-sm font-medium ${
                              group.unrealized_gain >= 0 ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {formatCurrency(group.unrealized_gain)}
                            </td>
                            <td className={`px-6 py-4 whitespace-nowrap text-right text-sm font-medium ${
                              group.unrealized_gain_percent >= 0 ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {formatPercent(group.unrealized_gain_percent)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-indigo-400">
                              {formatXirr(group.xirr)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <PaginationControls
                  currentPage={currentPage}
                  totalPages={Math.ceil(groupedMfActiveData.length / rowsPerPage)}
                  onPageChange={setCurrentPage}
                />
              </div>
            </div>
          )}

          {activeSubTab === "Closed" && (
            <div className="space-y-4">
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-3">
                  <label className="text-sm font-medium text-slate-300">Group by:</label>
                  <select
                    value={selectedMfFilter}
                    onChange={(e) => setSelectedMfFilter(e.target.value)}
                    className="px-3 py-2 bg-slate-800 border border-slate-700 text-slate-100 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    {MF_FILTER_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value} className="bg-slate-800">
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <RowsPerPageInput />
                <button
                  onClick={handleExportSummaryToExcel}
                  className="p-2 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-lg transition-colors border border-emerald-500/20"
                  title="Export Summary to Excel"
                >
                  <Download size={18} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4 mb-6">
                {(() => {
                  const totals = groupedMfClosedData.reduce(
                    (acc, group) => ({
                      invested: acc.invested + group.invested_amount,
                      sale: acc.sale + group.sale_amount,
                      gain: acc.gain + group.realized_gain,
                    }),
                    { invested: 0, sale: 0, gain: 0 }
                  );
                  const gainPercent = totals.invested > 0 ? (totals.gain / totals.invested) * 100 : 0;
                  const overallSplits = mfClosed.flatMap((lot) => lot?.transactions || []);
                  const overallFlows = overallSplits.length
                    ? buildClosedFlowsFromSplits(overallSplits)
                    : buildClosedFlowsFromLots(mfClosed);
                  const overallXirr = overallFlows.length
                    ? calculateXIRR(overallFlows)
                    : computeClosedXirr(
                        mfClosed,
                        {
                          investedAmount: (item) => item.invested_amount,
                          investedDate: (item) => item.buy_date,
                          saleAmount: (item) => item.sale_amount,
                          saleDate: (item) => item.sell_date,
                        }
                      );

                  return (
                    <>
                      <div className="bg-blue-600/20 p-4 rounded-xl border border-blue-500/50 shadow-lg flex items-center space-x-4 transition-all hover:scale-[1.02]">
                            <div>
                          <div className="text-sm font-semibold text-blue-200 uppercase tracking-wider">Transaction Value</div>
                          <div className="text-2xl font-bold text-white mb-2">
                            {formatCurrency(totals.sale)}
                          </div>
                          <div className="text-xs font-medium text-blue-300">
                            Invested: {formatCurrency(totals.invested)}
                          </div>
                        </div>
                      </div>
                      <div className="bg-green-600/20 p-4 rounded-xl border border-green-500/50 shadow-lg flex items-center space-x-4 transition-all hover:scale-[1.02]">
                        <div>
                          <div className="text-sm font-semibold text-green-200 uppercase tracking-wider">Net Return</div>
                          <div className={`text-2xl font-bold ${totals.gain >= 0 ? "text-green-400" : "text-red-400"}`}>
                            {formatCurrency(totals.gain)}
                          </div>
                        </div>
                      </div>
                      <div className="bg-indigo-600/20 p-4 rounded-xl border border-indigo-500/50 shadow-lg flex items-center space-x-4 transition-all hover:scale-[1.02]">

                        <div>
                          <div className="text-sm font-semibold text-indigo-200 uppercase tracking-wider">Net Return %</div>
                          <div className={`text-2xl font-bold ${gainPercent >= 0 ? "text-green-400" : "text-red-400"}`}>
                            {formatPercent(gainPercent)}
                          </div>
                        </div>
                      </div>
                      <div className="bg-orange-600/20 p-4 rounded-xl border border-orange-500/50 shadow-lg flex items-center space-x-4 transition-all hover:scale-[1.02]">
                        <div>
                          <div className="text-sm font-semibold text-orange-200 uppercase tracking-wider">Closed XIRR</div>
                          <div className={`text-2xl font-bold ${overallXirr >= 0 ? "text-green-400" : "text-red-400"}`}>
                            {formatXirr(overallXirr)}
                          </div>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>

              <div className="bg-slate-800 rounded-xl border border-slate-700 shadow-xl overflow-hidden">
                <div className="overflow-x-scroll scrollbar-thin scrollbar-thumb-slate-600 scrollbar-track-slate-800">
                  <table className="min-w-full divide-y divide-slate-700">
                    <thead className="bg-slate-700/50">
                      <tr>
                        <th className="sticky left-0 z-20 bg-slate-700 px-6 py-3 text-left text-xs font-semibold text-slate-300 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('groupName')}>
                          {MF_FILTER_OPTIONS.find(opt => opt.value === selectedMfFilter)?.label || "Group"}{sortConfig.key === 'groupName' ? (sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : ''}
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('sale_amount')}>
                          Sale Amount{sortConfig.key === 'sale_amount' ? (sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : ''}
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('market_percent')}>
                          SA %{sortConfig.key === 'market_percent' ? (sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : ''}
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('invested_amount')}>
                          Invested Amount{sortConfig.key === 'invested_amount' ? (sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : ''}
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('invest_percent')}>
                          Invest %{sortConfig.key === 'invest_percent' ? (sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : ''}
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('realized_gain')}>
                          P/L{sortConfig.key === 'realized_gain' ? (sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : ''}
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('realized_gain_percent')}>
                          P/L %{sortConfig.key === 'realized_gain_percent' ? (sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : ''}
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-semibold text-slate-300 uppercase tracking-wider cursor-pointer" onClick={() => handleSort('xirr')}>
                          XIRR{sortConfig.key === 'xirr' ? (sortConfig.direction === 'asc' ? ' ↑' : ' ↓') : ''}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-slate-800 divide-y divide-slate-700">
                      {groupedMfClosedData.length === 0 ? (
                        <tr>
                          <td colSpan="8" className="px-6 py-8 text-center text-slate-400">
                            No closed mutual fund positions found
                          </td>
                        </tr>
                      ) : (
                        groupedMfClosedData
                          .slice(currentPage * rowsPerPage, (currentPage + 1) * rowsPerPage)
                          .map((group, index) => (
                          <tr key={index} className="hover:bg-slate-700/50 transition-colors">
                            <td className="sticky left-0 z-10 bg-slate-800 px-6 py-4 whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => handleGroupClick(group, currentPage * rowsPerPage + index)}
                                className="w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 rounded-md group"
                                aria-label={`View details for ${group.groupName}`}
                              >
                                <div className="text-sm font-medium text-slate-100 group-hover:text-purple-400">
                                  {group.groupName}
                                </div>
                                <div className="text-xs text-slate-400">
                                  {group.lots.length} lot{group.lots.length !== 1 ? 's' : ''} · {Number(group.units || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })} units
                                </div>
                              </button>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-slate-100">
                              {formatCurrency(group.sale_amount)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-blue-400 font-medium">
                              {formatPercent(group.market_percent)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-slate-300">
                              {formatCurrency(group.invested_amount)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-blue-400 font-medium">
                              {formatPercent(group.invest_percent)}
                            </td>
                            <td className={`px-6 py-4 whitespace-nowrap text-right text-sm font-medium ${
                              group.realized_gain >= 0 ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {formatCurrency(group.realized_gain)}
                            </td>
                            <td className={`px-6 py-4 whitespace-nowrap text-right text-sm font-medium ${
                              group.realized_gain_percent >= 0 ? 'text-green-400' : 'text-red-400'
                            }`}>
                              {formatPercent(group.realized_gain_percent)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium text-indigo-400">
                              {formatXirr(group.xirr)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
                <PaginationControls
                  currentPage={currentPage}
                  totalPages={Math.ceil(groupedMfClosedData.length / rowsPerPage)}
                  onPageChange={setCurrentPage}
                />
              </div>
            </div>
          )}
        </div>
      )}
      </div>
    </div>
  );
}
