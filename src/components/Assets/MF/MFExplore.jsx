// src/components/Assets/MF/MFExplore.js
import React, { useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import mfAPI from "../../../api/mfAPI.js";

import { BACKEND_URL } from "../../../config/apiConfig.js";

// ---- Fallback: compute returns on the client using backend proxy ----

// Start server and public API in parallel, return whichever succeeds first, abort the other
async function fetchReturnsFast(amfi) {
  const serverCtrl = new AbortController();
  const mfCtrl = new AbortController();

  // Fail fast if server is slow (then mf api keeps running)
  const serverTimeout = setTimeout(() => serverCtrl.abort(), 3000);

  const serverP = fetch(`${BACKEND_URL}/funds/${amfi}/returns`, {
    signal: serverCtrl.signal,
  }).then(async (res) => {
    if (!res.ok) throw new Error(await res.text());
    return res.json();
  });

  // Backend is pre-calculating everything, so if it succeeds, it's the fastest and smallest payload
  try {
    const data = await serverP;
    clearTimeout(serverTimeout);
    mfCtrl.abort();
    return data;
  } catch (e) {
    // If backend fails, fallback to proxy + client-side calculation
    console.warn("Backend returns failed, falling back to proxy:", e.message);
    const mfP = fetchReturnsFromProxy(amfi, mfCtrl.signal);
    return await mfP;
  } finally {
    serverCtrl.abort();
    mfCtrl.abort();
  }
}

const periods = {
  "1M": 30,
  "1Y": 365,
  "3Y": 365 * 3,
  "5Y": 365 * 5,
  "7Y": 365 * 7,
  "10Y": 365 * 10,
};

// ---- Performance helpers ----
const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24 hours
function cacheKey(amfi) {
  return `mf_returns_v1_${amfi}`;
}
function getCachedReturns(amfi) {
  try {
    const raw = localStorage.getItem(cacheKey(amfi));
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (!ts || !data) return null;
    if (Date.now() - ts > CACHE_TTL_MS) return null;
    return data;
  } catch {
    return null;
  }
}
function setCachedReturns(amfi, data) {
  try {
    localStorage.setItem(cacheKey(amfi), JSON.stringify({ ts: Date.now(), data }));
  } catch {}
}

function toISODate(ddmmyyyy) {
  const [d, m, y] = ddmmyyyy.split("-");
  return `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`;
}

function buildMonthlyHistoryAsc(dataArr) {
  // Optimized: prefer single pass over newest-first arrays and early-break past cutoff
  const arr = Array.isArray(dataArr) ? dataArr : [];
  if (!arr.length) return [];

  const parseRow = (row) => {
    const iso = toISODate(row?.date || "");
    const nav = parseFloat(String(row?.nav ?? "").replace(/,/g, ""));
    if (!iso || !Number.isFinite(nav)) return null;
    return { date: iso, nav };
  };

  const first = parseRow(arr[0]);
  const last = parseRow(arr[arr.length - 1]);

  // We need up to ~10 years for 10Y rolling; keep 12y buffer
  const now = new Date();
  const cutoff = new Date(now);
  cutoff.setFullYear(now.getFullYear() - 12);

  const seen = new Set();
  const outDesc = [];

  // If API returns newest-first (common for mfapi), do a single pass and break early
  if (first && last && new Date(first.date) > new Date(last.date)) {
    for (const row of arr) {
      const pr = parseRow(row);
      if (!pr) continue;
      const d = new Date(pr.date);
      if (d < cutoff && outDesc.length > 0) break; // early exit
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      if (!seen.has(key)) {
        outDesc.push(pr); // newest-first collection
        seen.add(key);
      }
    }
    return outDesc.reverse(); // oldest-first for downstream consumers
  }

  // Fallback: original approach with full sort if order is unknown/ascending
  const fullAsc = arr
    .map(parseRow)
    .filter(Boolean)
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const seenMonths = new Set();
  const navHistory = [];
  for (const r of fullAsc) {
    const d = new Date(r.date);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (!seenMonths.has(key)) {
      navHistory.push({ date: r.date, nav: r.nav });
      seenMonths.add(key);
    }
  }
  return navHistory;
}

function calculateReturn(startNav, endNav, days) {
  if (days > 365) {
    // Annualized Return (CAGR) for periods > 1 year
    const years = days / 365;
    return (Math.pow(endNav / startNav, 1 / years) - 1) * 100;
  }
  // Absolute Return for periods <= 1 year
  return ((endNav - startNav) / startNav) * 100;
}

function getStandardReturns(navHistory) {
  if (!navHistory?.length) return {};
  const today = new Date(navHistory[navHistory.length - 1].date);
  const results = {};
  for (const [key, days] of Object.entries(periods)) {
    const startDate = new Date(today);
    startDate.setDate(today.getDate() - days);
    const closest = navHistory.find((nav) => new Date(nav.date) >= startDate);
    if (closest) {
      results[key] = calculateReturn(closest.nav, navHistory[navHistory.length - 1].nav, days);
    }
  }
  return results;
}

function getRollingReturns(navHistory, years) {
  const out = [];
  const daysInPeriod = years * 365;
  for (let i = 0; i < navHistory.length; i += 12) {
    const startDate = new Date(navHistory[i].date);
    const endDate = new Date(startDate);
    endDate.setFullYear(startDate.getFullYear() + years);
    const endNavObj = navHistory.find((nav) => new Date(nav.date) >= endDate);
    if (endNavObj) {
      out.push({
        start: navHistory[i].date,
        end: endNavObj.date,
        return: calculateReturn(navHistory[i].nav, endNavObj.nav, daysInPeriod)
      });
    }
  }
  return out;
}

async function fetchReturnsFromProxy(amfi, signal) {
  // Use backend proxy to avoid CORS issues
  const res = await fetch(`${BACKEND_URL}/api/assets/mf/proxy/${amfi}`, { signal });
  if (!res.ok) throw new Error(`MF Proxy failed: ${res.status}`);
  const json = await res.json();
  const history = buildMonthlyHistoryAsc(json?.data || []);
  if (!history.length) throw new Error("No NAV data found");
  return {
    fund: amfi,
    standardReturns: getStandardReturns(history),
    rolling: {
      "1Y": getRollingReturns(history, 1),
      "3Y": getRollingReturns(history, 3),
      "5Y": getRollingReturns(history, 5),
      "7Y": getRollingReturns(history, 7),
      "10Y": getRollingReturns(history, 10),
    },
  };
}

export default function MFExplore() {
  // Shared meta
  const [categories, setCategories] = useState([]);
  const [amcs, setAmcs] = useState([]);
  const [funds, setFunds] = useState([]);

  // Filters (multi-select with search)
  const [selectedCategories, setSelectedCategories] = useState([]); // string[]
  const [selectedAMCs, setSelectedAMCs] = useState([]); // string[]
  const [selectedFundIds, setSelectedFundIds] = useState([]); // amfi_code[]

  const [categoryQuery, setCategoryQuery] = useState("");
  const [amcQuery, setAmcQuery] = useState("");
  const [fundQuery, setFundQuery] = useState("");

  // Collapsible filter panels
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [amcOpen, setAmcOpen] = useState(false);

  // Single vs comparison data
  const [returns, setReturns] = useState(null); // single fund returns
  const [compReturns, setCompReturns] = useState({}); // { [amfi]: returnsObj }

  // UI: date filter and sub-tab state for tables
  const [selectedDate, setSelectedDate] = useState(""); // YYYY-MM-DD
  const [activeTab, setActiveTab] = useState("standard"); // 'standard' | 'rolling'

  // Loading flags
  const [loadingSingle, setLoadingSingle] = useState(false);
  const [loadingComp, setLoadingComp] = useState(false);
  const [restarting, setRestarting] = useState(false);

  // Refs for outside-click handling on long lists
  const fundListWrapRef = useRef(null);
  const categoryWrapRef = useRef(null);
  const amcWrapRef = useRef(null);
  const [fundListOpen, setFundListOpen] = useState(false);

  useEffect(() => {
    function handleClickOutside(e) {
      if (fundListWrapRef.current && !fundListWrapRef.current.contains(e.target)) {
        setFundListOpen(false);
      }
      if (categoryWrapRef.current && !categoryWrapRef.current.contains(e.target)) {
        setCategoryOpen(false);
      }
      if (amcWrapRef.current && !amcWrapRef.current.contains(e.target)) {
        setAmcOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Fetch metadata once (from backend)
  useEffect(() => {
    async function loadMeta() {
      try {
        const all = await mfAPI.getExplorerFunds();

        const unique = (arr) => Array.from(new Set(arr)).sort();

        setCategories(unique((all || []).map((d) => d.category).filter(Boolean)));
        setAmcs(unique((all || []).map((d) => d.amc_name).filter(Boolean)));
        setFunds(
          (all || []).map((d) => ({
            amfi_code: d.amfi_code,
            category: d.category,
            amc_name: d.amc_name,
            scheme_name: d.scheme_name,
          }))
        );
      } catch (error) {
        console.error("MF Explorer meta error", error);
      }
    }
    loadMeta();
  }, []);

  // Reset helpers
  const resetAll = () => {
    setSelectedCategories([]);
    setSelectedAMCs([]);
    setSelectedFundIds([]);
    setCategoryQuery("");
    setAmcQuery("");
    setFundQuery("");

    setReturns(null);
    setCompReturns({});
    setSelectedDate("");
    setActiveTab("standard");

    // close all panels/lists
    setFundListOpen(false);
    setCategoryOpen(false);
    setAmcOpen(false);
  };

  // Toggle helpers
  const toggleArrayValue = (arr, value) =>
    arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];

  const toggleCategory = (c) => setSelectedCategories((prev) => toggleArrayValue(prev, c));
  const toggleAMC = (a) => setSelectedAMCs((prev) => toggleArrayValue(prev, a));
  const toggleFund = (amfi) => setSelectedFundIds((prev) => toggleArrayValue(prev, amfi));

  // Filtered lists for display
  const filteredCategories = useMemo(() => {
    const q = categoryQuery.trim().toLowerCase();
    if (!q) return categories;
    return categories.filter((c) => c.toLowerCase().includes(q));
  }, [categories, categoryQuery]);

  const filteredAMCs = useMemo(() => {
    const q = amcQuery.trim().toLowerCase();
    if (!q) return amcs;
    return amcs.filter((a) => a.toLowerCase().includes(q));
  }, [amcs, amcQuery]);

  const filteredFunds = useMemo(() => {
    // Apply category + AMC filters first to avoid rendering huge lists
    const base = funds.filter((f) => {
      const catOk = selectedCategories.length === 0 || selectedCategories.includes(f.category);
      const amcOk = selectedAMCs.length === 0 || selectedAMCs.includes(f.amc_name);
      return catOk && amcOk;
    });
    const q = fundQuery.trim().toLowerCase();
    if (!q) return base;
    return base.filter((f) =>
      `${f.scheme_name} ${f.amc_name} ${f.category}`.toLowerCase().includes(q)
    );
  }, [funds, selectedCategories, selectedAMCs, fundQuery]);

  // Table-only label: just the scheme name
  const fundShortLabelById = (amfi) => {
    const f = funds.find((x) => x.amfi_code === amfi);
    return f?.scheme_name || amfi;
  };

  const pickRollingValue = (returnsObj, dateStr, periodKey) => {
    if (!returnsObj?.rolling || !Array.isArray(returnsObj.rolling[periodKey])) return null;
    if (!dateStr) return null;
    const arr = returnsObj.rolling[periodKey];
    const target = new Date(dateStr);
    const found = arr.find((r) => new Date(r.start) >= target);
    return found?.return ?? null;
  };

  const singleRollingDisplay = useMemo(() => {
    const keys = ["1Y", "3Y", "5Y", "7Y", "10Y"];
    return keys.map((k) => ({ key: k, value: pickRollingValue(returns, selectedDate, k) }));
  }, [returns, selectedDate]);

  // Actions
  const handleGetSingleReturns = async () => {
    if (selectedFundIds.length !== 1) return;
    setLoadingSingle(true);
    setReturns(null);
    setCompReturns({});
    try {
      const amfi = selectedFundIds[0];

      // 1) Serve immediately from cache if available
      const cached = getCachedReturns(amfi);
      if (cached) {
        setReturns(cached);
        setActiveTab(selectedDate ? "rolling" : "standard");
        // Warm in background with fast fetch
        fetchReturnsFast(amfi)
          .then((fresh) => {
            setCachedReturns(amfi, fresh);
            // Only update UI if user still on this single selection
            setReturns((cur) => (selectedFundIds.length === 1 && selectedFundIds[0] === amfi ? fresh : cur));
          })
          .catch(() => {});
        return;
      }

      // 2) No cache -> use fast parallel fetch
      const data = await fetchReturnsFast(amfi);
      setReturns(data);
      setCachedReturns(amfi, data);
      setActiveTab(selectedDate ? "rolling" : "standard");
    } finally {
      setLoadingSingle(false);
    }
  };

  const handleGetComparisonReturns = async () => {
    if (selectedFundIds.length < 2) return;
    setLoadingComp(true);
    setReturns(null);
    setCompReturns({});
    try {
      // Prefer cached values first for instant display, then backfill
      const initial = {};
      const toFetch = [];
      for (const amfi of selectedFundIds) {
        const cached = getCachedReturns(amfi);
        if (cached) initial[amfi] = cached;
        else toFetch.push(amfi);
      }
      if (Object.keys(initial).length) setCompReturns(initial);

      // Fetch all funds fast in parallel
      const results = await Promise.all(
        selectedFundIds.map(async (amfi) => {
          try {
            const data = await fetchReturnsFast(amfi);
            return { amfi, data };
          } catch (e) {
            return { amfi, data: initial[amfi] || null };
          }
        })
      );
      const map = { ...initial };
      results.forEach(({ amfi, data }) => {
        if (data) {
          map[amfi] = data;
          setCachedReturns(amfi, data);
        }
      });
      setCompReturns(map);
    } finally {
      setLoadingComp(false);
    }
  };

  // Handler to restart the Render backend service
  const handleRestartService = async () => {
    setRestarting(true);
    try {
      const response = await fetch(`${BACKEND_URL}/restart`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (response.ok) {
        alert("✅ Backend caches cleared successfully!");
        // Clear local cache too
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith("mf_returns_v1_")) {
            localStorage.removeItem(key);
          }
        }
        // Reset UI state
        setReturns(null);
        setCompReturns({});
        setSelectedFundIds([]);
        resetAll();
      } else {
        alert("⚠️ Restart request sent. If issues persist, restart manually from Render dashboard.");
      }
    } catch (err) {
      console.error("Restart error:", err);
      alert("⚠️ Could not restart service. Please restart manually from Render dashboard: https://dashboard.render.com");
    } finally {
      setRestarting(false);
    }
  };

  // Comparison helpers
  const standardPeriods = useMemo(() => {
    const set = new Set();
    Object.values(compReturns).forEach((r) => {
      const sr = r?.standardReturns || {};
      Object.keys(sr).forEach((k) => set.add(k));
    });
    const order = [
      "YTD",
      "1M",
      "3M",
      "6M",
      "1Y",
      "2Y",
      "3Y",
      "5Y",
      "7Y",
      "10Y",
      "15Y",
    ];
    const remaining = Array.from(set).filter((k) => !order.includes(k)).sort();
    return [...order.filter((k) => set.has(k)), ...remaining];
  }, [compReturns]);
  const rollingPeriods = ["1Y", "3Y", "5Y", "7Y", "10Y"];

  return (
    <div className="p-3 sm:p-4">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg sm:text-xl text-indigo-200 font-bold">🔍 Explore Mutual Funds</h2>
        <button
          onClick={handleRestartService}
          disabled={restarting}
          title="Restart backend service"
          className="p-2 rounded-full hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw
            size={20}
            className={`text-indigo-300 ${restarting ? "animate-spin" : ""}`}
          />
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-md border-2 border-red-400 p-3 sm:p-4 mb-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
          {/* Category filter */}
          <div className="space-y-2" ref={categoryWrapRef}>
            <button
              type="button"
              onClick={() => setCategoryOpen((v) => !v)}
              className="w-full flex items-center justify-between px-3 py-2 text-sm border border-gray-300 rounded bg-white hover:bg-gray-50"
            >
              <span className="text-xs font-medium text-gray-600">Category</span>
              <span className="text-xs text-gray-500">{selectedCategories.length} selected</span>
            </button>
            {categoryOpen && (
              <>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                  placeholder="Search category..."
                  value={categoryQuery}
                  onChange={(e) => setCategoryQuery(e.target.value)}
                />
                <div className="max-h-56 overflow-y-auto border rounded p-2 bg-white">
                  {filteredCategories.map((c) => (
                    <label key={c} className="flex items-center gap-2 py-1 cursor-pointer text-xs sm:text-sm">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={selectedCategories.includes(c)}
                        onChange={() => toggleCategory(c)}
                      />
                      <span>{c}</span>
                    </label>
                  ))}
                  {filteredCategories.length === 0 && (
                    <div className="text-gray-500 text-xs">No categories.</div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* AMC filter */}
          <div className="space-y-2" ref={amcWrapRef}>
            <button
              type="button"
              onClick={() => setAmcOpen((v) => !v)}
              className="w-full flex items-center justify-between px-3 py-2 text-sm border border-gray-300 rounded bg-white hover:bg-gray-50"
            >
              <span className="text-xs font-medium text-gray-600">AMC</span>
              <span className="text-xs text-gray-500">{selectedAMCs.length} selected</span>
            </button>
            {amcOpen && (
              <>
                <input
                  type="text"
                  className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
                  placeholder="Search AMC..."
                  value={amcQuery}
                  onChange={(e) => setAmcQuery(e.target.value)}
                />
                <div className="max-h-56 overflow-y-auto border rounded p-2 bg-white">
                  {filteredAMCs.map((a) => (
                    <label key={a} className="flex items-center gap-2 py-1 cursor-pointer text-xs sm:text-sm">
                      <input
                        type="checkbox"
                        className="h-4 w-4"
                        checked={selectedAMCs.includes(a)}
                        onChange={() => toggleAMC(a)}
                      />
                      <span>{a}</span>
                    </label>
                  ))}
                  {filteredAMCs.length === 0 && (
                    <div className="text-gray-500 text-xs">No AMCs.</div>
                  )}
                </div>
              </>
            )}
          </div>

          {/* Fund filter (checkbox + search) */}
          <div className="space-y-2 md:col-span-1" ref={fundListWrapRef}>
            <label className="text-xs font-medium text-gray-600"></label>
            <input
              type="text"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              placeholder="Type to search Fund"
              value={fundQuery}
              onChange={(e) => {
                const val = e.target.value;
                setFundQuery(val);
                setFundListOpen(Boolean(val.trim()) || selectedCategories.length > 0 || selectedAMCs.length > 0);
              }}
              onFocus={() =>
                setFundListOpen(Boolean(fundQuery.trim()) || selectedCategories.length > 0 || selectedAMCs.length > 0)
              }
            />
            {fundListOpen && (
              <div className="max-h-64 overflow-y-auto border rounded p-2 bg-white">
                {filteredFunds.map((f) => (
                  <label key={f.amfi_code} className="flex items-center gap-2 py-1 cursor-pointer text-xs sm:text-sm">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={selectedFundIds.includes(f.amfi_code)}
                      onChange={() => toggleFund(f.amfi_code)}
                    />
                    <span className="flex-1">
                      <span className="font-medium">{f.scheme_name}</span>
                      <span className="text-gray-500"> {` · ${f.amc_name} · ${f.category}`}</span>
                    </span>
                  </label>
                ))}
                {filteredFunds.length === 0 && (
                  <div className="text-gray-500 text-xs">No funds match your search.</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Date filter and actions */}
        <div className="mt-3 sm:mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4 items-start">
          <div className="space-y-1">
            <label className="text-xs font-medium text-gray-600">Rolling Date (optional)</label>
            <input
              type="date"
              className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              placeholder="YYYY-MM-DD"
            />
          </div>

          <div className="flex flex-col md:col-span-2 gap-2">
  <div className="flex gap-2">
    <button
      onClick={handleGetSingleReturns}
      disabled={selectedFundIds.length !== 1 || loadingSingle}
      className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50 w-60 hover:bg-blue-900"
    >
      {loadingSingle ? "Loading..." : "Get Returns"}
    </button>
    <button
      onClick={handleGetComparisonReturns}
      disabled={selectedFundIds.length < 2 || loadingComp}
      className="px-4 py-2 bg-indigo-600 text-white rounded disabled:opacity-50 w-60 hover:bg-indigo-900"
    >
      {loadingComp ? "Loading..." : "Comparison"}
    </button>
  </div>
  <button
    type="button"
    onClick={resetAll}
    className="px-4 py-2 border border-gray-300 rounded bg-gray-600 text-white hover:bg-gray-900"
  >
    Reset
  </button>
</div>

        </div>
      </div>

      {/* Single fund tables */}
      {returns && selectedFundIds.length === 1 && (
        <div className="mt-6">
          {/* Selected fund name (scheme only) */}
          <div className="mb-2 font-bold text-lg text-orange-500">
            <span className="font-medium">Fund:</span> {fundShortLabelById(selectedFundIds[0])}
          </div>

          <div className="flex flex-wrap gap-2 mb-3">
            <button
              onClick={() => setActiveTab("standard")}
              className={`px-3 py-1 rounded border ${
                activeTab === "standard" ? "bg-blue-600 text-white" : "bg-white"
              }`}
            >
              Standard Returns
            </button>
            <button
              onClick={() => setActiveTab("rolling")}
              className={`px-3 py-1 rounded border ${
                activeTab === "rolling" ? "bg-blue-600 text-white" : "bg-white"
              }`}
            >
              Rolling Returns
            </button>
          </div>

          {activeTab === "standard" && (
            <div>
              <h3 className="text-base text-yellow-300 sm:text-lg font-semibold">📊 Standard Returns</h3>
              <div className="mt-2 overflow-x-auto border-4 border-red-700 rounded">
                <table className="min-w-full text-sm sm:text-sm">
                  <thead className="bg-orange-500">
                    <tr>
                      <th className="text-left text-white border-b px-3 sm:px-4 py-2 whitespace-nowrap">Period</th>
                      <th className="text-left text-white border-b px-3 sm:px-4 py-2 whitespace-nowrap">Return (%)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(returns?.standardReturns ?? {}).map(([period, value]) => (
                      <tr key={period} className="odd:bg-white even:bg-gray-300">
                        <td className="px-3 sm:px-4 py-2 whitespace-nowrap">{period}</td>
                        <td className="px-3 sm:px-4 py-2 whitespace-nowrap">
                          {Number.isFinite(Number(value)) ? Number(value).toFixed(2) : "NA"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === "rolling" && (
            <div>
              <h3 className="text-base text-yellow-300 sm:text-lg font-semibold">📈 Rolling Returns</h3>
              {!selectedDate && (
                <p className="text-xs sm:text-sm text-gray-100 mt-1">Pick a date to view rolling returns.</p>
              )}
              {selectedDate && (
                <div className="mt-2 overflow-x-auto border border-black rounded">
                  <table className="min-w-full text-sm sm:text-sm">
                    <thead className="bg-orange-500">
                      <tr>
                        <th className="text-left text-white border-b px-3 sm:px-4 py-2 whitespace-nowrap">Period</th>
                        <th className="text-left text-white border-b px-3 sm:px-4 py-2 whitespace-nowrap">Return (%)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {["1Y", "3Y", "5Y", "7Y", "10Y"].map((period) => {
                        const val = singleRollingDisplay.find((r) => r.key === period)?.value;
                        return (
                          <tr key={period} className="odd:bg-white even:bg-gray-300">
                            <td className="px-3 sm:px-4 py-2 whitespace-nowrap">{period}</td>
                            <td className="px-3 sm:px-4 py-2 whitespace-nowrap">
                              {Number.isFinite(Number(val)) ? Number(val).toFixed(2) : "NA"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Comparison tables */}
      {Object.keys(compReturns).length >= 2 && (
        <div className="space-y-6 mt-6">
          {/* Standard Returns Comparison */}
          <div>
            <h3 className="text-base text-orange-600 sm:text-lg font-semibold">📊 Standard Returns — Comparison</h3>
            <div className="mt-2 overflow-x-auto border border-black rounded">
              <table className="min-w-full text-xs sm:text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left text-white bg-blue-600 border-b border-black  px-3 sm:px-4 py-2 whitespace-nowrap">Fund</th>
                    {standardPeriods.map((period) => (
                      <th key={period} className="text-left text-white bg-blue-600 border-b border-black px-3 sm:px-4 py-2 whitespace-nowrap">
                        {period}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {selectedFundIds.map((amfi) => (
                    <tr key={amfi} className="odd:bg-white even:bg-gray-200">
                      <td className="px-3 sm:px-4 py-4 whitespace-nowrap font-medium">
                        {fundShortLabelById(amfi)}
                      </td>
                      {standardPeriods.map((period) => {
                        const v = compReturns[amfi]?.standardReturns?.[period];
                        return (
                          <td key={`${amfi}-${period}`} className="px-3 sm:px-4 py-2 whitespace-nowrap">
                            {Number.isFinite(Number(v)) ? Number(v).toFixed(2) : "NA"}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Rolling Returns Comparison */}
          <div>
            <h3 className="text-base text-green-800 sm:text-lg font-semibold">📈 Rolling Returns — Comparison</h3>
            {!selectedDate && (
              <p className="text-xs sm:text-sm text-gray-600 mt-1">Pick a date to view rolling returns comparison.</p>
            )}
            {selectedDate && (
              <div className="mt-2 overflow-x-auto border border-black rounded">
                <table className="min-w-full text-xs sm:text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left border-b border-black text-white bg-blue-600 px-3 sm:px-4 py-2 whitespace-nowrap">Fund</th>
                      {rollingPeriods.map((period) => (
                        <th key={period} className="text-left text-white bg-blue-600 border-b border-black px-3 sm:px-4 py-2 whitespace-nowrap">
                          {period}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {selectedFundIds.map((amfi) => (
                      <tr key={amfi} className="odd:bg-white even:bg-gray-200">
                        <td className="px-3 sm:px-4 py-4 whitespace-nowrap font-medium">
                          {fundShortLabelById(amfi)}
                        </td>
                        {rollingPeriods.map((period) => {
                          const r = compReturns[amfi];
                          const val = pickRollingValue(r, selectedDate, period);
                          return (
                            <td key={`${amfi}-${period}`} className="px-3 sm:px-4 py-2 whitespace-nowrap">
                              {Number.isFinite(Number(val)) ? Number(val).toFixed(2) : "NA"}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}