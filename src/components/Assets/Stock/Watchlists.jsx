// src/components/Assets/Stock/Watchlists.js
import React, { useEffect, useState, useCallback } from "react";
import { stockAPI } from "../../../api/stockAPI.js";
import { Pencil, Check, X, ArrowUpDown, Plus } from "lucide-react";

const Watchlists = ({ stockMaster }) => {
  const [watchlists, setWatchlists] = useState([
    { list_number: 1, list_name: "list1", stock_names: [] },
    { list_number: 2, list_name: "list2", stock_names: [] },
    { list_number: 3, list_name: "list3", stock_names: [] },
    { list_number: 4, list_name: "list4", stock_names: [] },
    { list_number: 5, list_name: "list5", stock_names: [] },
  ]);
  const [activeWatchlist, setActiveWatchlist] = useState(1);
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [removeMode, setRemoveMode] = useState(false);
  const [selectedToRemove, setSelectedToRemove] = useState([]);
  const [sortConfig, setSortConfig] = useState(
    JSON.parse(localStorage.getItem("watchlistSort")) || { key: "stock_name", direction: "asc" }
  );
  const [sortMenuOpen, setSortMenuOpen] = useState(false);

  // 🔹 Fetch from Supabase
  const fetchWatchlists = useCallback(async () => {
    try {
      const { data } = await stockAPI.getAllWatchlists();

      if (!data) return;

      setWatchlists((prev) =>
        prev.map((wl) => {
          const match = data?.find((d) => d.list_number === wl.list_number);
          if (!match) return wl;
          return {
            ...wl,
            list_name: match.list_name || wl.list_name,
            stock_names: Array.isArray(match.stock_names)
              ? match.stock_names
              : wl.stock_names,
          };
        })
      );
    } catch (error) {
      console.error("Error fetching watchlists:", error);
    }
  }, []);

  useEffect(() => {
    fetchWatchlists();
  }, [fetchWatchlists]);

  // 🔹 Rename
  const handleRename = async (list_number) => {
    const wl = watchlists.find((w) => w.list_number === list_number);
    if (!wl) return;

    const newName = editName || wl.list_name;

    setWatchlists((prev) =>
      prev.map((w) =>
        w.list_number === list_number ? { ...w, list_name: newName } : w
      )
    );

    try {
      const { data: allWatchlists } = await stockAPI.getAllWatchlists();
      const existingRow = allWatchlists?.find(w => w.list_number === list_number);

      if (!existingRow) {
        await stockAPI.addWatchlist({
          list_number,
          list_name: newName,
          stock_names: wl.stock_names || [],
        });
      } else {
        await stockAPI.updateWatchlist(list_number, {
          list_name: newName,
          stock_names: existingRow.stock_names || [],
        });
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
      fetchWatchlists();
    } catch (error) {
      console.error("Rename failed:", error);
    }

    setEditingId(null);
    setEditName("");
  };

  // 🔹 Add stock
  const handleAddStock = async (stock) => {
    const wl = watchlists.find((w) => w.list_number === activeWatchlist);
    if (!wl) return;

    const nameToAdd = stock.stock_name;
    if ((wl.stock_names || []).includes(nameToAdd)) {
      setSearchQuery("");
      return;
    }

    try {
      const { data: allWatchlists } = await stockAPI.getAllWatchlists();
      const existingRow = allWatchlists?.find(w => w.list_number === wl.list_number);

      const newArray = [
        ...(existingRow?.stock_names || wl.stock_names || []),
        nameToAdd,
      ];

      if (!existingRow) {
        await stockAPI.addWatchlist({
          list_number: wl.list_number,
          list_name: wl.list_name,
          stock_names: newArray,
        });
      } else {
        await stockAPI.updateWatchlist(wl.list_number, {
          list_name: existingRow.list_name || wl.list_name,
          stock_names: newArray,
        });
      }

      await new Promise(resolve => setTimeout(resolve, 500));
      setSearchQuery("");
      fetchWatchlists();
    } catch (error) {
      console.error("Add stock failed:", error);
    }
  };

  // 🔹 Remove stock
  const handleRemoveStock = async (stockName) => {
    const wl = watchlists.find((w) => w.list_number === activeWatchlist);
    if (!wl) return;

    try {
      const { data: allWatchlists } = await stockAPI.getAllWatchlists();
      const existingRow = allWatchlists?.find(w => w.list_number === wl.list_number);

      if (!existingRow) return;

      const current = existingRow.stock_names || [];
      const updated = current.filter((n) => n !== stockName);

      await stockAPI.updateWatchlist(wl.list_number, { stock_names: updated });

      await new Promise(resolve => setTimeout(resolve, 500));
      fetchWatchlists();
    } catch (error) {
      console.error("Remove stock failed:", error);
    }
  };

  // 🔹 Bulk remove
  const handleBulkRemove = async () => {
    for (const stockName of selectedToRemove) {
      await handleRemoveStock(stockName);
    }
    setSelectedToRemove([]);
    setRemoveMode(false);
  };

  // 🔹 Toggle select stock
  const toggleSelectStock = (stockName) => {
    setSelectedToRemove((prev) =>
      prev.includes(stockName)
        ? prev.filter((n) => n !== stockName)
        : [...prev, stockName]
    );
  };

  // 🔹 Close remove mode when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        removeMode &&
        !e.target.closest(".remove-bar") &&
        !e.target.closest(".remove-area") &&
        !e.target.closest(".sort-menu") &&
        !e.target.closest(".sort-button")
      ) {
        setRemoveMode(false);
        setSelectedToRemove([]);
        setSortMenuOpen(false);
      }
    };
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, [removeMode]);

  // 🔹 Build stock data
  const getStocksForActiveWatchlist = () => {
    const wl = watchlists.find((w) => w.list_number === activeWatchlist);
    if (!wl || !wl.stock_names) return [];

    let stocks = wl.stock_names.map((name) => {
      const sm = stockMaster.find((s) => s.stock_name === name);
      const cmp = sm?.cmp ?? null;
      const lcp = sm?.lcp ?? null;
      const change = cmp != null && lcp ? ((cmp - lcp) / lcp) * 100 : null;
      const sector = sm?.sector ?? "-";
      return { stock_name: name, cmp, lcp, change, sector };
    });

    // 🔹 Sorting
    const { key, direction } = sortConfig;
    const dir = direction === "asc" ? 1 : -1;

    stocks.sort((a, b) => {
      const A = a[key];
      const B = b[key];
      if (A == null && B == null) return 0;
      if (A == null) return 1;
      if (B == null) return -1;
      if (key === "stock_name" || key === "sector") return dir * String(A).localeCompare(String(B));
      return dir * (Number(A) - Number(B));
    });

    return stocks;
  };

  // 🔹 Handle sort option click
  const handleSort = (key) => {
    setSortConfig((prev) => {
      const newDir = prev.key === key && prev.direction === "asc" ? "desc" : "asc";
      const newConfig = { key, direction: newDir };
      localStorage.setItem("watchlistSort", JSON.stringify(newConfig));
      return newConfig;
    });
    setSortMenuOpen(false);
  };

  return (
    <div className="p-2">
      {/* Tabs */}
      <div className="flex space-x-2 border-b pb-2 mb-4">
        {watchlists.map((wl) => (
          <div
            key={wl.list_number}
            className={`px-2 py-1 rounded cursor-pointer ${
              activeWatchlist === wl.list_number
                ? "bg-blue-600 text-white"
                : "bg-orange-200 text-gray-700"
            }`}
            onClick={() => setActiveWatchlist(wl.list_number)}
          >
            {editingId === wl.list_number ? (
              <div className="flex items-center space-x-1">
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="border rounded p-1 text-sm bg-white text-black"
                />
                <button
                  onClick={() => handleRename(wl.list_number)}
                  className="text-black-600"
                >
                  <Check size={16} />
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="text-red-600"
                >
                  <X size={16} />
                </button>
              </div>
            ) : (
              <div className="flex items-center space-x-1">
                <span>{wl.list_name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingId(wl.list_number);
                    setEditName(wl.list_name);
                  }}
                  className="text-gray-600 hover:text-gray-800"
                >
                  <Pencil size={14} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add stock & Remove toggle */}
      <div className="flex items-center space-x-2 mb-4 remove-bar">
        <input
          type="text"
          placeholder="Search stocks..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="p-2 border rounded w-64" // Reduced width
        />
        <button
          onClick={() => {
            if (removeMode) handleBulkRemove();
            else setRemoveMode(true);
          }}
          className="p-2 bg-red-600 text-white rounded hover:bg-red-700"
        >
          <X size={18} />
        </button>

        {/* Sort button */}
        <div className="relative">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setSortMenuOpen((prev) => !prev);
            }}
            className="p-2 bg-green-300 rounded flex items-center space-x-1 sort-button"
          >
            <span></span>
            <ArrowUpDown size={16} />
          </button>
          {sortMenuOpen && (
            <div className="absolute top-full right-0 bg-white border rounded shadow p-2 space-y-2 sort-menu z-50">
              <button
                className="block w-full text-left border border-black px-2 py-1 hover:bg-gray-100"
                onClick={() => handleSort("stock_name")}
              >
                Stock {sortConfig.key === "stock_name" ? (sortConfig.direction === "asc" ? "↑" : "↓") : ""}
              </button>
              <button
                className="block w-full text-left border border-black px-2 py-1 hover:bg-gray-100"
                onClick={() => handleSort("cmp")}
              >
                CMP {sortConfig.key === "cmp" ? (sortConfig.direction === "asc" ? "↑" : "↓") : ""}
              </button>
              <button
                className="block w-full text-left border border-black px-2 py-1 hover:bg-gray-100"
                onClick={() => handleSort("change")}
              >
                Change {sortConfig.key === "change" ? (sortConfig.direction === "asc" ? "↑" : "↓") : ""}
              </button>
              <button
                className="block w-full text-sm text-left border border-black px-2 py-1 hover:bg-gray-100"
                onClick={() => handleSort("change")}
              >
                %Change {sortConfig.key === "change" ? (sortConfig.direction === "asc" ? "↑" : "↓") : ""}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Search results */}
      {searchQuery && (
        <div className="space-y-2 mb-6">
          {stockMaster
            .filter((s) =>
              s.stock_name.toLowerCase().includes(searchQuery.toLowerCase())
            )
            .map((s) => (
              <div
                key={s.stock_name}
                className="flex justify-between items-center border p-2 rounded bg-gray-50"
              >
                <span>{s.stock_name}</span>
                <button
                  onClick={() => handleAddStock(s)}
                  className="text-blue-600 hover:text-blue-800"
                >
                  <Plus size={18} />
                </button>
              </div>
            ))}
        </div>
      )}

      {/* Stocks cards */}
      <div className="remove-area grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
        {getStocksForActiveWatchlist().map((s) => {
          const cmpClass =
            s.cmp == null
              ? "text-gray-600"
              : s.cmp > (s.lcp ?? 0)
              ? "text-green-600"
              : s.cmp < (s.lcp ?? 0)
              ? "text-red-600"
              : "text-gray-600";

          return (
            <div
              key={s.stock_name}
              className="border rounded p-4 flex border-2 border-green-600 justify-between items-center bg-white shadow"
            >
              {/* Left: stock name, sector & checkbox if removeMode */}
              <div className="flex flex-col">
                <div className="flex items-center space-x-2">
                  {removeMode && (
                    <input
                      type="checkbox"
                      checked={selectedToRemove.includes(s.stock_name)}
                      onChange={() => toggleSelectStock(s.stock_name)}
                    />
                  )}
                  <span className="font-medium">{s.stock_name}</span>
                </div>
                <span className="text-gray-500 text-sm">{s.sector}</span>
              </div>

              {/* Right: CMP (colored) and change info */}
              <div className="text-right space-y-1">
                <div className={`font-semibold ${cmpClass}`}>
                  {s.cmp ?? "-"}
                </div>
                <div className="text-gray-600">
                  {s.cmp != null && s.lcp != null
                    ? (s.cmp - s.lcp).toFixed(2)
                    : "-"}{" "}
                  ({s.change != null ? s.change.toFixed(2) + "%" : "-"})
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default Watchlists;
