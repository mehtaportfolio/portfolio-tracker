import { useMemo, useState, useEffect, useRef } from "react";
import { useEarningData } from "../../hooks/useEarningData.js";
import { ChevronLeft, ChevronRight, Filter, Check } from "lucide-react";

const ROWS_PER_PAGE = 6;

const FILTER_OPTIONS = [
  { key: "profit", label: "Profit" },
  { key: "dividend", label: "Dividend" },
  { key: "total_earning", label: "Total Earning" },
  { key: "current_investment", label: "Current Investment" },
];

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

export default function EarningTab() {
  const { data: earningData, loading, error } = useEarningData();
  const [searchTerm, setSearchTerm] = useState("");
  const [sortConfig, setSortConfig] = useState({ key: "total_earning", direction: "desc" });
  const [currentPage, setCurrentPage] = useState(1);
  const [zeroFilters, setZeroFilters] = useState([]); // Array of keys: ["profit", "dividend", etc.]
  const [accountType, setAccountType] = useState("all"); // "all", "FREE", "REGULAR"
  const [showFilterModal, setShowFilterModal] = useState(false);
  const filterModalRef = useRef(null);

  // Close modal when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (filterModalRef.current && !filterModalRef.current.contains(event.target)) {
        setShowFilterModal(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Reset to first page when search, sort, or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, sortConfig, zeroFilters, accountType]);

  const handleSort = (key) => {
    setSortConfig((prev) => ({
      key,
      direction: prev.key === key && prev.direction === "desc" ? "asc" : "desc",
    }));
  };

  const toggleZeroFilter = (key) => {
    setZeroFilters((prev) =>
      prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key]
    );
  };

  const filteredData = useMemo(() => {
    let list = (earningData || []).map(item => ({
      ...item,
      total_earning: (item.profit || 0) + (item.dividend || 0)
    }));

    // Account Type Filter
    if (accountType !== "all") {
      list = list.filter((item) => item.account_type === accountType);
    }

    // Zero-value filters (Hide if ANY selected column is zero)
    if (zeroFilters.length > 0) {
      list = list.filter((item) => {
        return zeroFilters.every((filterKey) => {
          const value = item[filterKey];
          return value !== 0 && value !== null && value !== undefined;
        });
      });
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      list = list.filter((stock) => stock.stock_name.toLowerCase().includes(term));
    }

    const { key, direction } = sortConfig;
    list.sort((a, b) => {
      let valA = a[key];
      let valB = b[key];

      if (typeof valA === "string") {
        valA = valA.toLowerCase();
        valB = valB.toLowerCase();
      }

      if (valA < valB) return direction === "asc" ? -1 : 1;
      if (valA > valB) return direction === "asc" ? 1 : -1;
      return 0;
    });

    return list;
  }, [earningData, searchTerm, sortConfig, zeroFilters, accountType]);

  const totalPages = Math.ceil(filteredData.length / ROWS_PER_PAGE);
  const paginatedData = useMemo(() => {
    const startIndex = (currentPage - 1) * ROWS_PER_PAGE;
    return filteredData.slice(startIndex, startIndex + ROWS_PER_PAGE);
  }, [filteredData, currentPage]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-slate-500">Loading earning insights…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">
        <p className="font-semibold">Unable to fetch earning data</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  const SortIndicator = ({ columnKey }) => {
    if (sortConfig.key !== columnKey) return <span className="ml-1 opacity-20">⇅</span>;
    return <span className="ml-1 text-orange-500">{sortConfig.direction === "asc" ? "↑" : "↓"}</span>;
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Search Bar */}
        <div className="relative w-full max-w-md">
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

        {/* Filter Controls */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Account Type Filter */}
          <div className="flex items-center gap-2">
            <label className="text-xs font-black uppercase tracking-widest text-slate-500 whitespace-nowrap">
              Type:
            </label>
            <select
              value={accountType}
              onChange={(e) => setAccountType(e.target.value)}
              className="rounded-lg border border-slate-700/50 bg-slate-900 px-3 py-2 text-xs font-bold text-slate-300 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500 cursor-pointer"
              style={{ backgroundColor: '#0f172a' }}
            >
              <option value="all" className="bg-slate-900">All</option>
              <option value="REGULAR" className="bg-slate-900">Regular</option>
              <option value="FREE" className="bg-slate-900">Free</option>
            </select>
          </div>

          {/* Multi-select Zero Value Filter */}
          <div className="relative" ref={filterModalRef}>
            <button
              onClick={() => setShowFilterModal(!showFilterModal)}
              className={`flex items-center gap-2 rounded-lg border border-slate-700/50 bg-slate-800/40 px-4 py-2 text-xs font-bold transition-all hover:bg-slate-700/50 ${
                zeroFilters.length > 0 ? "text-orange-400 border-orange-500/50" : "text-slate-400"
              }`}
            >
              <Filter size={14} />
              HIDE ZERO {zeroFilters.length > 0 && `(${zeroFilters.length})`}
            </button>

            {showFilterModal && (
              <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-xl border border-slate-700/50 bg-slate-900 p-2 shadow-2xl backdrop-blur-xl">
                <div className="mb-2 px-2 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
                  Hide stocks if zero in:
                </div>
                <div className="space-y-1">
                  {FILTER_OPTIONS.map((option) => (
                    <button
                      key={option.key}
                      onClick={() => toggleZeroFilter(option.key)}
                      className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-xs font-bold transition-colors hover:bg-slate-800"
                    >
                      <span className={zeroFilters.includes(option.key) ? "text-orange-400" : "text-slate-300"}>
                        {option.label}
                      </span>
                      {zeroFilters.includes(option.key) && (
                        <Check size={14} className="text-orange-500" />
                      )}
                    </button>
                  ))}
                </div>
                {zeroFilters.length > 0 && (
                  <button
                    onClick={() => setZeroFilters([])}
                    className="mt-2 w-full border-t border-slate-800 pt-2 text-center text-[10px] font-black uppercase tracking-widest text-rose-500 hover:text-rose-400"
                  >
                    Clear All
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-700/50 bg-slate-800/40 backdrop-blur-xl">
        <table className="min-w-full divide-y divide-slate-700">
          <thead className="bg-slate-900/50">
            <tr>
              <th className="px-4 py-3 text-center text-[10px] font-black uppercase tracking-widest text-slate-500">#</th>
              <th 
                className="px-6 py-3 text-left text-xs font-black uppercase tracking-widest text-slate-400 cursor-pointer hover:text-white transition-colors"
                onClick={() => handleSort("stock_name")}
              >
                Name <SortIndicator columnKey="stock_name" />
              </th>
              <th 
                className="px-6 py-3 text-center text-xs font-black uppercase tracking-widest text-slate-400 cursor-pointer hover:text-white transition-colors"
                onClick={() => handleSort("profit")}
              >
                P/L <SortIndicator columnKey="profit" />
              </th>
              <th 
                className="px-6 py-3 text-center text-xs font-black uppercase tracking-widest text-slate-400 cursor-pointer hover:text-white transition-colors"
                onClick={() => handleSort("dividend")}
              >
                DD <SortIndicator columnKey="dividend" />
              </th>
              <th 
                className="px-6 py-3 text-center text-xs font-black uppercase tracking-widest text-slate-400 cursor-pointer hover:text-white transition-colors"
                onClick={() => handleSort("total_earning")}
              >
                Sum <SortIndicator columnKey="total_earning" />
              </th>
              <th 
                className="px-6 py-3 text-center text-xs font-black uppercase tracking-widest text-slate-400 cursor-pointer hover:text-white transition-colors"
                onClick={() => handleSort("current_investment")}
              >
                CI <SortIndicator columnKey="current_investment" />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-700 bg-transparent">
            {paginatedData.length ? (
              paginatedData.map((item, index) => {
                const globalIndex = (currentPage - 1) * ROWS_PER_PAGE + index + 1;
                const total = item.profit + item.dividend;
                return (
                  <tr key={`${item.stock_name}-${item.account_type}`} className="hover:bg-slate-700/30 transition-colors">
                    <td className="px-4 py-4 text-center whitespace-nowrap">
                      <span className="text-[10px] font-black text-slate-100 tracking-widest">{globalIndex}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">

                        <span className="text-sm font-bold text-slate-100 uppercase tracking-tight">{item.stock_name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center whitespace-nowrap">
                      <span className={`text-sm font-black ${item.profit >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {formatCurrency(item.profit)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center whitespace-nowrap">
                      <span className="text-sm font-black text-indigo-400">
                        {formatCurrency(item.dividend)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center whitespace-nowrap">
                      <span className={`text-sm font-black ${total >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                        {formatCurrency(total)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center whitespace-nowrap">
                      <span className="text-sm font-black text-orange-400">
                        {formatCurrency(item.current_investment)}
                      </span>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="6" className="px-6 py-10 text-center text-sm text-slate-500">
                  No records found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-2">
          <div className="text-xs font-bold text-slate-500 uppercase tracking-widest">
            Showing <span className="text-slate-300">{(currentPage - 1) * ROWS_PER_PAGE + 1}</span> to{" "}
            <span className="text-slate-300">{Math.min(currentPage * ROWS_PER_PAGE, filteredData.length)}</span> of{" "}
            <span className="text-slate-300">{filteredData.length}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700/50 bg-slate-800/40 text-slate-400 transition-colors hover:bg-slate-700/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-20"
            >
              <ChevronLeft size={16} />
            </button>
            <div className="text-xs font-black text-orange-500">
              {currentPage} / {totalPages}
            </div>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-700/50 bg-slate-800/40 text-slate-400 transition-colors hover:bg-slate-700/50 hover:text-white disabled:cursor-not-allowed disabled:opacity-20"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
