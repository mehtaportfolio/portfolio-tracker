import React, { useEffect, useState, useRef, useCallback } from "react";
import { stockAPI } from "../../../api/stockAPI.js";
import { Bar } from "react-chartjs-2";
import CashflowForm from "../Forms/CashflowForm.jsx";
import { Plus, RefreshCw, Landmark, IndianRupee } from "lucide-react";
import DividendDetails from "./DividendDetails.jsx";
import DividendCashflowDetails from "./DividendCashflowDetails.jsx";
import DividendEventsModal from "./DividendEventsModal.jsx";
import NetInvestmentDetails from "./NetInvestmentDetails.jsx";
import { useTrialMode } from "../../../hooks/useTrialMode.js";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartDataLabels
);

const DDTab = () => {
  const { isTrialMode } = useTrialMode();
  const [account, setAccount] = useState("ALL");
  const [selectedStock, setSelectedStock] = useState("");
  const [netInvestmentData, setNetInvestmentData] = useState({});
  const [dividendData, setDividendData] = useState({});
  const [loading, setLoading] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showForm, setShowForm] = useState(false);
  // Totals for summary cards
  const [totalNetInvestment, setTotalNetInvestment] = useState(0);
  const [totalDividend, setTotalDividend] = useState(0);
  const [accountOptions, setAccountOptions] = useState([]);
  const [stockOptions, setStockOptions] = useState([]);

  // Month-wise details states
  const [selectedMonthYear, setSelectedMonthYear] = useState(new Date().getFullYear());
  const [monthWiseData, setMonthWiseData] = useState([]);
  const [monthModalOpen, setMonthModalOpen] = useState(false);
  const [showCashflowDetails, setShowCashflowDetails] = useState(false);
  const [showEventsModal, setShowEventsModal] = useState(false);

  // ✅ For popup
  const divChartRef = useRef();
  const netChartRef = useRef();
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedYear, setSelectedYear] = useState(null);
  const [netModalOpen, setNetModalOpen] = useState(false);
  const [selectedNetYear, setSelectedNetYear] = useState(null);

  const getChartHeight = (labels) => {
    if (!labels || labels.length === 0) return 350;
    const rowHeight = 45;
    const basePadding = 100;
    return Math.max(350, labels.length * rowHeight + basePadding);
  };

  const formatAmount = (val) => {
    const absVal = Math.abs(val);
    let formatted;

    if (absVal >= 10000000) formatted = (absVal / 10000000).toFixed(2) + " Cr";
    else if (absVal >= 100000) formatted = (absVal / 100000).toFixed(2) + " L";
    else formatted = absVal.toFixed(0);

    return val < 0 ? `-${formatted}` : formatted;
  };

  // ✅ Normalize date to YYYY-MM-DD
  const normalizeDate = (dateStr) => {
    if (!dateStr) return null;
    let trimmed = dateStr.trim();
    // Remove time part if present
    trimmed = trimmed.split(' ')[0];
    trimmed = trimmed.split('T')[0];
    const date = new Date(trimmed);
    if (!isNaN(date.getTime())) {
      const yyyy = date.getFullYear();
      const mm = String(date.getMonth() + 1).padStart(2, '0');
      const dd = String(date.getDate()).padStart(2, '0');
      return `${yyyy}-${mm}-${dd}`;
    }
    // Fallback to parsing DD.MM.YYYY or MM.DD.YYYY or YYYY-MM-DD
    const separator = trimmed.includes('.') ? '.' : trimmed.includes('/') ? '/' : trimmed.includes('-') ? '-' : null;
    if (separator) {
      const parts = trimmed.split(separator);
      if (parts.length === 3) {
        let dd, mm, yyyy;
        if (parts[2].length === 4) {
          yyyy = parts[2];
          const first = parseInt(parts[0]);
          const second = parseInt(parts[1]);
          if (first > 12) {
            dd = parts[0];
            mm = parts[1];
          } else if (second > 12) {
            mm = parts[0];
            dd = parts[1];
          } else {
            // Assume DD MM
            dd = parts[0];
            mm = parts[1];
          }
        } else if (parts[0].length === 4) {
          yyyy = parts[0];
          mm = parts[1];
          dd = parts[2];
        } else {
          return null;
        }
        if (dd && mm && yyyy) {
          return `${yyyy}-${mm.padStart(2,'0')}-${dd.padStart(2,'0')}`;
        }
      }
    }
    return null;
  };


  const fetchData = useCallback(async () => {
    if (isTrialMode) {
      setNetInvestmentData({});
      setDividendData({});
      setTotalNetInvestment(0);
      setTotalDividend(0);
      setMonthWiseData([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // 1️⃣ Net Investment & Dividends
      const params = {};
      if (account !== "ALL") params.account_name = account;
      if (selectedStock) params.stock_name = selectedStock;
      
      const result = await stockAPI.fetchCashflow(params);
      if (!result.success) throw new Error(result.error);
      const allCashflow = result.data || [];

      // Process Net Investment
      const netData = allCashflow.filter(row => row.transaction_type === "deposit" || row.transaction_type === "withdrawal");
      const yearlyNet = {};
      netData.forEach((row) => {
        const normalized = normalizeDate(row.date);
        if (normalized) {
          const year = new Date(normalized).getFullYear();
          if (!yearlyNet[year]) yearlyNet[year] = 0;
          yearlyNet[year] += row.transaction_type === "deposit" ? Number(row.amount) : -Number(row.amount);
        }
      });

      const netYears = Object.keys(yearlyNet).map(Number).sort((a, b) => b - a).map(String);
      const netValues = netYears.map((y) => yearlyNet[y]);

      const totalNet = netData.reduce((sum, row) => sum + (row.transaction_type === "deposit" ? Number(row.amount) : -Number(row.amount)), 0);
      setTotalNetInvestment(totalNet);

      setNetInvestmentData({
        labels: netYears,
        datasets: [
          {
            label: "Net Investment",
            data: netValues,
            backgroundColor: "rgba(255, 189, 64, 0.7)",
            hoverBackgroundColor: "rgba(255, 140, 0, 0.9)",
            borderRadius: 4,
          },
        ],
      });

      // Process Dividends
      const divData = allCashflow.filter(row => row.transaction_type === "dividend");
      const yearlyDiv = {};
      divData.forEach((row) => {
        const normalized = normalizeDate(row.date);
        if (normalized) {
          const year = new Date(normalized).getFullYear();
          if (!yearlyDiv[year]) yearlyDiv[year] = 0;
          yearlyDiv[year] += parseFloat(row.amount) || 0;
        }
      });

      const divYears = Object.keys(yearlyDiv).map(Number).sort((a, b) => b - a).map(String);
      const divValues = divYears.map((y) => yearlyDiv[y]);

      const totalDiv = divData.reduce((sum, row) => sum + (parseFloat(row.amount) || 0), 0);
      setTotalDividend(totalDiv);

      setDividendData({
        labels: divYears,
        datasets: [
          {
            label: "Dividends",
            data: divValues,
            backgroundColor: "rgba(34, 339, 34, 0.7)",
            hoverBackgroundColor: "rgba(50, 205, 50, 0.9)",
            borderRadius: 4,
            barPercentage: 0.6,
            categoryPercentage: 0.7,
          },
        ],
      });
    } catch (err) {
      console.error("Error fetching data:", err);
      setNetInvestmentData({});
      setDividendData({});
    } finally {
      setLoading(false);
    }
  }, [account, selectedStock, isTrialMode]);

  // Fetch month-wise data
  const fetchMonthWiseData = useCallback(async (year) => {
    try {
      const months = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ];

      const params = { startDate: `${year}-01-01`, endDate: `${year}-12-31` };
      if (account !== "ALL") params.account_name = account;
      if (selectedStock) params.stock_name = selectedStock;

      const result = await stockAPI.fetchCashflow(params);
      if (!result.success) throw new Error(result.error);
      const data = result.data || [];

      // Process month-wise data
      const monthData = months.map((month, index) => {
        const monthNum = index + 1;

        const monthItems = data.filter(row => {
          const date = normalizeDate(row.date);
          if (!date) return false;
          return new Date(date).getMonth() + 1 === monthNum;
        });

        const monthNet = monthItems
          .filter(row => row.transaction_type === "deposit" || row.transaction_type === "withdrawal")
          .reduce((sum, row) => sum + (row.transaction_type === "deposit" ? Number(row.amount) : -Number(row.amount)), 0);

        const monthDiv = monthItems
          .filter(row => row.transaction_type === "dividend")
          .reduce((sum, row) => sum + (parseFloat(row.amount) || 0), 0);

        return {
          month,
          investment: monthNet,
          dividend: monthDiv
        };
      });

      setMonthWiseData(monthData);
    } catch (err) {
      console.error("Error fetching month-wise data:", err);
      setMonthWiseData([]);
    }
  }, [account, selectedStock]);

  const handleSyncDividends = async () => {
    setIsSyncing(true);
    try {
      const result = await stockAPI.syncDividendEvents();
      if (result.success) {
        if (result.count > 0) {
          alert(`Successfully synced ${result.count} new dividend records.`);
          await fetchData();
        } else {
          alert("No new dividend corporate actions found.");
        }
      } else {
        throw new Error(result.error || "Failed to sync dividend events");
      }
    } catch (error) {
      console.error("Sync error:", error);
      alert("Failed to sync dividend actions: " + error.message);
    } finally {
      setIsSyncing(false);
    }
  };
  useEffect(() => {
    fetchData();
  }, [fetchData]);

// ✅ cleanup effect
useEffect(() => {
  const chartContainer = divChartRef.current;

  return () => {
    if (chartContainer) {
      try {
        const chartInstance = chartContainer.chart || chartContainer;
        chartInstance.destroy?.(); // 👈 safely destroy chart before React unmounts canvas
      } catch (error) {
        console.warn("Chart already cleaned up", error);
      }
    }
  };
}, []);

useEffect(() => {
  const fetchAccounts = async () => {
    try {
      const result = await stockAPI.fetchStockAccountNames("cashflow");
      if (result.success && result.data) {
        setAccountOptions(result.data.sort());
      }
    } catch (error) {
      console.error("Error fetching account options:", error);
    }
  };
  const fetchStockNames = async () => {
    try {
      const result = await stockAPI.fetchStockSymbols();
      if (result && typeof result === "object") {
        const stocks = Object.keys(result).sort();
        setStockOptions(stocks);
      }
    } catch (error) {
      console.error("Error fetching stock options:", error);
    }
  };
  fetchAccounts();
  fetchStockNames();
}, []);



  // ✅ Handle click on dividend bar
  const handleDivBarClick = (evt) => {
    const chart = divChartRef.current;
    if (!chart) return;

    const points = chart.getElementsAtEventForMode(
      evt,
      "nearest",
      { intersect: true },
      true
    );

    if (points.length > 0) {
      const firstPoint = points[0];
      const year = chart.data.labels[firstPoint.index];
      setSelectedYear(year);
      setModalOpen(true);
    }
  };

  // ✅ Handle click on net investment bar
  const handleNetBarClick = (evt) => {
    const chart = netChartRef.current;
    if (!chart) return;

    const points = chart.getElementsAtEventForMode(
      evt,
      "nearest",
      { intersect: true },
      true
    );

    if (points.length > 0) {
      const firstPoint = points[0];
      const year = chart.data.labels[firstPoint.index];
      setSelectedNetYear(year);
      setNetModalOpen(true);
    }
  };

  const chartOptions = (title, isDividend = false) => ({
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: { top: 10, left: 0, right: 30, bottom: 0 } },
    plugins: {
      legend: { display: false },
      title: {
        display: true,
        text: title,
        font: { size: 16, weight: "bold" },
        color: "#fff",
        padding: { bottom: 20 },
      },
      tooltip: { 
        backgroundColor: "rgba(17, 24, 39, 0.9)",
        titleColor: "#fff", 
        bodyColor: "#fff",
        borderColor: "rgba(75, 85, 99, 0.3)",
        borderWidth: 1,
      },
      datalabels: {
        anchor: "end",
        align: "right",
        color: "#fff",
        font: { weight: "bold", size: 10 },
        formatter: formatAmount,
        offset: 4,
        display: (context) => context.dataset.data[context.dataIndex] !== 0,
      },
    },
    onClick: isDividend ? handleDivBarClick : handleNetBarClick,
    scales: {
      x: {
        beginAtZero: true,
        ticks: { 
          color: "#94a3b8", 
          font: { size: 11 },
          callback: (value) => formatAmount(value) 
        },
        grid: { color: "rgba(255, 255, 255, 0.05)" },
        afterDataLimits: (scale) => {
          const range = scale.max - scale.min;
          scale.max = scale.max + range * 0.2;
        },
      },
      y: {
        ticks: { color: "#94a3b8", font: { size: 12 } },
        grid: { display: false },
      },
    },
  });

  return (
    <div className="p-2 sm:p-6 w-full max-w-full flex flex-col space-y-6 bg-gray-900 min-h-screen text-gray-100">
      {/* 1. Summary Cards - Modern Glossy Look (Two per row) */}
      <div className="grid grid-cols-2 gap-3 mt-2">
        <div className="bg-gradient-to-br from-indigo-900 to-purple-900 rounded-xl p-3 sm:p-5 shadow-xl border border-indigo-500/30 transform transition active:scale-95 hover:scale-[1.02]">
          <div className="flex items-center gap-2 mb-2 sm:mb-3">
            <div className="bg-indigo-500/20 p-1.5 rounded-lg">
              <Landmark className="text-indigo-300" size={16} />
            </div>
            <h3 className="text-[10px] sm:text-sm font-semibold text-indigo-200 uppercase tracking-wider">Investment</h3>
          </div>
          <p className={`text-base sm:text-2xl lg:text-3xl font-black ${(isTrialMode ? 0 : totalNetInvestment) >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            ₹{formatAmount(isTrialMode ? 0 : totalNetInvestment)}
          </p>
        </div>

        <div className="bg-gradient-to-br from-emerald-900 to-teal-900 rounded-xl p-3 sm:p-5 shadow-xl border border-emerald-500/30 transform transition active:scale-95 hover:scale-[1.02]">
          <div className="flex items-center gap-2 mb-2 sm:mb-3">
            <div className="bg-emerald-500/20 p-1.5 rounded-lg">
              <IndianRupee className="text-emerald-300" size={16} />
            </div>
            <h3 className="text-[10px] sm:text-sm font-semibold text-emerald-200 uppercase tracking-wider">Dividend</h3>
          </div>
          <p className="text-base sm:text-2xl lg:text-3xl font-black text-emerald-400">
            ₹{formatAmount(isTrialMode ? 0 : totalDividend)}
          </p>
        </div>
      </div>

      {/* 2. Controls & Actions */}
      <div className="bg-gray-800/50 backdrop-blur-md rounded-2xl p-4 border border-gray-700/50 flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <button
            onClick={() => {
              fetchMonthWiseData(selectedMonthYear);
              setMonthModalOpen(true);
            }}
            className="flex-1 sm:flex-none px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl font-bold shadow-lg shadow-indigo-900/40 transition-all active:scale-95"
          >
            Monthly View
          </button>

          <div className="flex items-center gap-2 bg-gray-700/50 px-3 py-1.5 rounded-xl border border-gray-600">
            <label className="text-xs font-bold text-gray-400 uppercase">Account</label>
            <select
              value={account}
              onChange={(e) => setAccount(e.target.value)}
              className="bg-transparent text-white font-semibold focus:outline-none cursor-pointer"
            >
              <option value="ALL" className="bg-gray-800">All</option>
              {accountOptions.map((acc) => (
                <option key={acc} value={acc} className="bg-gray-800">
                  {acc}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowEventsModal(true)}
            disabled={isSyncing}
            className="w-11 h-11 flex items-center justify-center bg-amber-500 hover:bg-amber-400 text-amber-950 rounded-full shadow-lg transition-all active:scale-90 font-black text-lg"
            title="Dividend Events"
          >
            A
          </button>
          <button
            onClick={handleSyncDividends}
            disabled={isSyncing}
            className={`w-11 h-11 flex items-center justify-center bg-sky-500 hover:bg-sky-400 text-sky-950 rounded-full shadow-lg transition-all active:scale-90 ${isSyncing ? "animate-spin" : ""}`}
            title="Sync Data"
          >
            <RefreshCw size={20} />
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="w-11 h-11 flex items-center justify-center bg-rose-500 hover:bg-rose-400 text-white rounded-full shadow-lg transition-all active:scale-90"
            title="Add New"
          >
            <Plus size={24} strokeWidth={3} />
          </button>
        </div>
      </div>

      {/* 3. Charts - Vertically Stacked */}
      <div className="flex flex-col space-y-8 pb-10">
        {!isTrialMode && (
          <div className="bg-gray-800/30 rounded-3xl p-4 border border-gray-700/30">
            <div 
              className="w-full"
              style={{ height: `${getChartHeight(netInvestmentData.labels)}px` }}
            >
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <RefreshCw className="animate-spin text-indigo-500" size={40} />
                </div>
              ) : netInvestmentData.labels && netInvestmentData.labels.length ? (
                <Bar
                  ref={netChartRef}
                  data={netInvestmentData}
                  options={chartOptions(`Investment Trends`)}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-gray-500 italic">
                  <p>No investment data to display</p>
                </div>
              )}
            </div>
          </div>
        )}

        {!isTrialMode && (
          <div className="bg-gray-800/30 rounded-3xl p-4 border border-gray-700/30 flex flex-col space-y-4">
            <div className="flex items-center gap-3 bg-gray-800/50 p-2 rounded-xl border border-gray-700">
              <div className="pl-2">
                <Plus size={16} className="text-gray-500" />
              </div>
              <input
                list="stock-list"
                value={selectedStock}
                onChange={(e) => setSelectedStock(e.target.value)}
                className="bg-transparent text-white w-full outline-none placeholder:text-gray-600"
                placeholder="Search specific stock..."
              />
              <datalist id="stock-list">
                {stockOptions.map((stock) => (
                  <option key={stock} value={stock} />
                ))}
              </datalist>
              {selectedStock && (
                <button
                  onClick={() => setSelectedStock("")}
                  className="px-3 py-1 bg-gray-700 hover:bg-gray-600 text-xs font-bold rounded-lg transition-colors"
                >
                  Clear
                </button>
              )}
            </div>

            <div 
              className="w-full"
              style={{ height: `${getChartHeight(dividendData.labels)}px` }}
            >
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <RefreshCw className="animate-spin text-emerald-500" size={40} />
                </div>
              ) : dividendData.labels && dividendData.labels.length ? (
                <Bar
                  ref={divChartRef}
                  data={dividendData}
                  options={chartOptions(`Dividend History`, true)}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-gray-500 italic">
                  <p>No dividend data to display</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {showForm && (
        <CashflowForm
          onClose={() => setShowForm(false)}
          refreshData={fetchData}
        />
      )}

      {/* ✅ Month-wise Details Modal */}
      {monthModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-40 p-4">
          <div className="bg-gray-900 rounded-3xl shadow-2xl max-w-2xl w-full max-h-[85vh] flex flex-col overflow-hidden border border-gray-700">
            <div className="shrink-0 bg-gray-800/80 backdrop-blur-md p-5 flex justify-between items-center border-b border-gray-700">
              <h2 className="text-xl font-black text-indigo-400">Monthly Performance</h2>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowCashflowDetails(true)}
                  className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-sm font-bold shadow-lg shadow-indigo-900/40 transition"
                >
                  Full Details
                </button>
                <button
                  onClick={() => setMonthModalOpen(false)}
                  className="text-gray-400 hover:text-white text-3xl font-light transition-colors"
                >
                  ×
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              {/* Year Filter inside Modal */}
              <div className="flex flex-wrap items-center gap-4 mb-6 pb-6 border-b border-gray-800">
                <div className="flex items-center gap-3 bg-gray-800 px-4 py-2 rounded-2xl border border-gray-700">
                  <label className="text-xs font-bold text-gray-400 uppercase">Year</label>
                  <input
                    type="number"
                    value={selectedMonthYear}
                    onChange={(e) => setSelectedMonthYear(parseInt(e.target.value) || new Date().getFullYear())}
                    className="bg-transparent text-white font-bold w-16 focus:outline-none"
                    placeholder="2024"
                    min="2000"
                    max="2050"
                  />
                </div>
                <button
                  onClick={() => fetchMonthWiseData(selectedMonthYear)}
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-2xl font-bold shadow-lg shadow-indigo-900/30 transition-all active:scale-95"
                >
                  Apply
                </button>
                <button
                  onClick={() => {
                    setSelectedMonthYear(new Date().getFullYear());
                    setMonthWiseData([]);
                  }}
                  className="px-6 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-2xl font-bold transition-all active:scale-95"
                >
                  Reset
                </button>
              </div>

              {/* Month-wise Table */}
              {monthWiseData.length > 0 ? (
                <div className="overflow-hidden rounded-2xl border border-gray-800">
                  <table className="w-full text-left">
                    <thead>
                      <tr className="bg-gray-800/50 text-gray-400 text-xs font-black uppercase tracking-widest">
                        <th className="p-4 border-b border-gray-800">Month</th>
                        <th className="p-4 border-b border-gray-800 text-right">Investment</th>
                        <th className="p-4 border-b border-gray-800 text-right">Dividend</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-800">
                      {/* Overall Row */}
                      <tr className="bg-indigo-900/20 font-black text-indigo-300">
                        <td className="p-4 italic">Yearly Total</td>
                        <td className="p-4 text-right">
                          ₹{formatAmount(
                            monthWiseData.reduce((sum, row) => sum + (isTrialMode ? 0 : row.investment), 0)
                          )}
                        </td>
                        <td className="p-4 text-right text-emerald-400">
                          ₹{formatAmount(
                            monthWiseData.reduce((sum, row) => sum + (isTrialMode ? 0 : row.dividend), 0)
                          )}
                        </td>
                      </tr>
                      {/* Individual Month Rows */}
                      {monthWiseData.map((row, index) => (
                        <tr key={index} className="hover:bg-gray-800/30 transition-colors">
                          <td className="p-4 text-gray-300 font-medium">{row.month}</td>
                          <td className={`p-4 text-right font-bold ${(isTrialMode ? 0 : row.investment) >= 0 ? "text-gray-300" : "text-rose-400"}`}>
                            {(isTrialMode ? 0 : row.investment) !== 0 ? `₹${formatAmount(isTrialMode ? 0 : row.investment)}` : '-'}
                          </td>
                          <td className="p-4 text-right text-emerald-500/80 font-bold">
                            {(isTrialMode ? 0 : row.dividend) !== 0 ? `₹${formatAmount(isTrialMode ? 0 : row.dividend)}` : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-gray-600 italic">
                  <RefreshCw className="mb-4 text-gray-700" size={48} />
                  <p>No data found. Select a year and click "Apply".</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ✅ Dividend popup */}
      {modalOpen && (
        <DividendDetails
          year={selectedYear}
          stockFilter={selectedStock}
          accountFilter={account}
          onClose={() => setModalOpen(false)}
          refreshData={fetchData}
        />
      )}

      {/* ✅ Net Investment popup */}
      {netModalOpen && (
        <NetInvestmentDetails
          year={selectedNetYear}
          accountFilter={account}
          onClose={() => setNetModalOpen(false)}
          refreshData={fetchData}
        />
      )}

      {/* ✅ Dividend Cashflow Details popup */}
      {showCashflowDetails && (
        <DividendCashflowDetails
          onClose={() => setShowCashflowDetails(false)}
          refreshData={fetchData}
        />
      )}

      {/* ✅ Dividend Events Modal */}
      {showEventsModal && (
        <DividendEventsModal
          onClose={() => setShowEventsModal(false)}
          refreshData={fetchData}
        />
      )}
    </div>
  );
};

export default DDTab;
// Removed Excel download feature
