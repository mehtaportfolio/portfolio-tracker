// src/components/Dashboard/Portfolio.js
import React, { useMemo, useCallback, useRef, useEffect } from "react";
import { Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import ChartDataLabels from "chartjs-plugin-datalabels";
import { usePrivacy } from "../../context/PrivacyContext.jsx";
import { useNavigation } from "../../context/NavigationContext.jsx";
import { useMode } from "../../context/ModeContext.jsx";
import { useLivePrices } from "../../context/LivePriceContext.jsx";
import { useDashboardAssetAllocation } from "../../hooks/useDashboardAssetAllocation.js";
import { useTrialMode } from "../../hooks/useTrialMode.js";

import { 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  PieChart as PieChartIcon, 
  Briefcase,
  Layers,
  Building,
  Home,
  CreditCard,
  Activity,
  PiggyBank
} from "lucide-react";

ChartJS.register(ArcElement, Tooltip, Legend, ChartDataLabels);

// Helper: Indian currency compact formatting with K, L, Cr
const formatINRCompact = (value) => {
  const num = Number(value) || 0;
  const sign = num < 0 ? "-" : "";
  const abs = Math.abs(num);

  if (abs < 1000) {
    return `${sign}₹${abs.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
  }
  if (abs < 1e5) {
    return `${sign}₹${(abs / 1e3).toFixed(1)}K`;
  }
  if (abs < 1e7) {
    return `${sign}₹${(abs / 1e5).toFixed(2)}L`;
  }
  return `${sign}₹${(abs / 1e7).toFixed(2)}Cr`;
};

const formatChange = (v) => {
  const intVal = Math.round(v || 0);
  const sign = intVal < 0 ? "-" : "+";
  const abs = Math.abs(intVal);

  if (abs < 1000) return `${sign}₹${abs}`;
  if (abs < 1e5) return `${sign}₹${(abs / 1e3).toFixed(1)}K`;
  if (abs < 1e7) return `${sign}₹${(abs / 1e5).toFixed(2)}L`;
  return `${sign}₹${(abs / 1e7).toFixed(2)}Cr`;
};

const AssetIcon = ({ type, className }) => {
  switch (type) {
    case "Stock": return <Activity className={className} />;
    case "MF": return <Briefcase className={className} />;
    case "ETF": return <Layers className={className} />;
    case "NPS": return <Home className={className} />;
    case "EPF": return <PiggyBank className={className} />;
    case "PPF": return <Building className={className} />;
    case "FD": return <CreditCard className={className} />;
    case "Bank": return <Wallet className={className} />;
    default: return <Wallet className={className} />;
  }
};

const AssetCard = ({ label, value, type, onClick, colorClass, iconColor }) => (
  <button 
    onClick={onClick}
    className="group relative flex flex-col p-5 bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-3xl transition-all duration-300 hover:bg-gray-700/50 hover:border-gray-600 hover:shadow-2xl hover:shadow-black/20 active:scale-[0.98] text-left overflow-hidden"
  >
    <div className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 opacity-10 blur-2xl rounded-full ${colorClass}`} />
    
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        <div className={`p-2.5 rounded-2xl ${colorClass} bg-opacity-20`}>
          <AssetIcon type={type} className={`w-5 h-5 ${iconColor}`} />
        </div>
        <div className="text-[13px] font-medium text-gray-400 uppercase tracking-wider">{label}</div>
      </div>
    </div>

    <div>
      <div className="text-xl font-bold text-white portfolio-card-value tracking-tight">
        {value}
      </div>
    </div>
  </button>
);

export default function Portfolio() {
  const { isDataMasked } = usePrivacy();
  const { trialValue } = useTrialMode();
  const { navigateToAsset } = useNavigation();
  const { priceSource } = useMode();
  const { livePrices } = useLivePrices();

  const cardContainerRef = useRef(null);
  const pieChartRef = useRef(null);
  const cardValues = useRef([]);
  const {
    rows = [],
    loading = false,
    masked = false,
    bankSavings = 0,
    bankDemat = 0,
    stockHoldings = [],
    overallTotals = { marketValue: 0, invested: 0, profit: 0, profitPercent: 0 },
  } = useDashboardAssetAllocation();

  // Compute live values for volatile assets if in live mode
  const liveData = useMemo(() => {
    if (priceSource !== 'live' || !stockHoldings.length) {
      return null;
    }

    let liveStockMV = 0;
    let liveEtfMV = 0;
    let liveStockDayChange = 0;
    let liveEtfDayChange = 0;

    stockHoldings.forEach(holding => {
      const qty = Number(holding.quantity) || 0;
      const lcp = Number(holding.lcp) || 0;
      const backendCmp = Number(holding.cmp) || 0;
      const symbol = holding.symbol_ao;
      
      // Use live price if available, otherwise fallback to backend cmp
      const currentPrice = (symbol && livePrices[symbol]) ? livePrices[symbol] : backendCmp;
      const mv = qty * currentPrice;
      const dayChange = lcp > 0 ? qty * (currentPrice - lcp) : 0;

      const name = String(holding.stockName || '').trim().toUpperCase();
      const isETF = (holding.equityType || '').toLowerCase() === 'etf' || 
                    holding.accountType === 'ETF' || 
                    ['ETF', 'BEES', 'NIFTYBEES', 'JUNIORBEES', 'BANKBEES', 'GOLDBEES'].some(p => name.includes(p));
      
      if (isETF) {
        liveEtfMV += mv;
        liveEtfDayChange += dayChange;
      } else {
        liveStockMV += mv;
        liveStockDayChange += dayChange;
      }
    });

    return {
      stockMV: liveStockMV,
      etfMV: liveEtfMV,
      stockDayChange: liveStockDayChange,
      etfDayChange: liveEtfDayChange
    };
  }, [priceSource, stockHoldings, livePrices]);

  const applyLocalMaskToCards = useCallback(() => {
    const values = cardValues.current;

    values.forEach((element) => {
      if (!element) return;

      if (isDataMasked || masked) {
        element.classList.add("maskable-number", "maskable-label");
      } else {
        element.classList.remove("maskable-number", "maskable-label");
      }
    });
  }, [masked, isDataMasked]);

  useEffect(() => {
    if (cardContainerRef.current) {
      cardValues.current = Array.from(
        cardContainerRef.current.querySelectorAll(".portfolio-card-value")
      );
    }
    applyLocalMaskToCards();
  }, [applyLocalMaskToCards]);

  // Helper to extract values from rows
  const findRowValue = useCallback(
    (assetType, key = "marketValue") => {
      const row = rows.find((item) => item.assetType === assetType);
      return row ? row[key] || 0 : 0;
    },
    [rows]
  );

  // Derive asset values from useAssetRows data
  const stockMV = trialValue(liveData ? liveData.stockMV : findRowValue("Stock"), 0);
  const etfMV = trialValue(liveData ? liveData.etfMV : findRowValue("ETF"), 0);
  const mfMV = trialValue(findRowValue("MF"), 0);
  const epfTotal = trialValue(findRowValue("EPF"), 0);
  const ppfBalance = trialValue(findRowValue("PPF"), 0);
  const bankFD = trialValue(findRowValue("FD"), 0);
  const npsMV = trialValue(findRowValue("NPS"), 0);

  const { marketValue: backendOverall = 0, invested: totalInvested = 0, profit: backendProfit = 0, profitPercent: backendProfitPercent = 0 } = overallTotals || {};
  
  // Use backend values for overall stats to match Home.js
  const currentOverall = backendOverall;
  const currentProfit = backendProfit;
  const currentProfitPercent = backendProfitPercent;

  const trialOverall = trialValue(currentOverall, 0);
  const trialTotalInvested = trialValue(totalInvested, 0);
  const trialProfit = trialValue(currentProfit, 0);
  const trialProfitPercent = trialValue(currentProfitPercent, 0);
  const trialBankSavings = trialValue(bankSavings, 0);
  const trialBankDemat = trialValue(bankDemat, 0);

  // Calculate overall daily change as sum of day changes for volatile assets (stock, ETF, MF, NPS) to match Home.js logic
  const overallChange = useMemo(() => {
    const volatileAssetKeys = ['Stock', 'ETF', 'MF', 'NPS'];
    const totalDayChange = (rows || [])
      .filter(r => volatileAssetKeys.includes(r.assetType))
      .reduce((sum, r) => sum + (r.dayChange || 0), 0);
    return trialValue(totalDayChange, 0);
  }, [rows, trialValue]);

  // Build pie chart data from asset rows
  const pieData = useMemo(() => {
    const assetData = [
      { label: "Stock", value: stockMV || 0, color: "#FF6B35" }, // Orange
      { label: "Mutual Funds", value: mfMV || 0, color: "#53B36A" }, // Green
      { label: "ETF", value: etfMV || 0, color: "#4D96FF" }, // Blue
      { label: "NPS", value: npsMV || 0, color: "#E91E63" }, // Pink
      { label: "Savings+Demat", value: (trialBankSavings || 0) + (trialBankDemat || 0), color: "#9B59B6" }, // Purple
      { label: "FD", value: bankFD || 0, color: "#E74C3C" }, // Red
      { label: "EPF", value: epfTotal || 0, color: "#F1C40F" }, // Yellow
      { label: "PPF", value: ppfBalance || 0, color: "#1ABC9C" }, // Cyan
      
    ];
    const total = assetData.reduce((sum, item) => sum + item.value, 0);

    assetData.forEach((item) => {
      item.percentage = total > 0 ? ((item.value / total) * 100).toFixed(1) : 0;
    });

    assetData.sort((a, b) => b.value - a.value);

    return {
      labels: assetData.map((item) => `${item.label}: ${item.percentage}%`),
      datasets: [
        {
          data: assetData.map((item) => item.value),
          backgroundColor: assetData.map((item) => item.color),
          hoverBackgroundColor: assetData.map((item) => item.color),
        },
      ],
    };
  }, [
    stockMV,
    etfMV,
    mfMV,
    trialBankSavings,
    bankFD,
    trialBankDemat,
    epfTotal,
    ppfBalance,
    npsMV,
  ]);

  const pieOptions = useMemo(
    () => ({
      responsive: true,
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: "#ffffff", // white
            font: { weight: "600", size: 11 },
            padding: 20,
            usePointStyle: true,
            pointStyle: "circle",
            generateLabels: (chart) => {
              const data = chart.data;
              if (!data?.labels?.length) return [];

              if (isDataMasked) return [];

              return data.labels.map((label, index) => ({
                text: label.split(":")[0], // Only show asset name in legend
                fillStyle: data.datasets[0].backgroundColor[index],
                strokeStyle: "transparent",
                lineWidth: 0,
                hidden: false,
                fontColor: "#ffffff",
                index,
              }));
            },
          },
        },
        tooltip: {
          enabled: !isDataMasked,
        },
        datalabels: {
          display: false,
        },
      },
    }),
    [isDataMasked]
  );



  return (
    <div className="w-full max-w-4xl mx-auto space-y-8 pb-10">
      {/* Overall Portfolio Header Card */}
      <div className="relative overflow-hidden p-8 rounded-[2.5rem] bg-gradient-to-br from-gray-800 via-gray-900 to-black border border-gray-700/50 shadow-2xl shadow-black/40">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-64 h-64 -mr-20 -mt-20 bg-indigo-600/10 blur-[80px] rounded-full" />
        <div className="absolute bottom-0 left-0 w-64 h-64 -ml-20 -mb-20 bg-purple-600/10 blur-[80px] rounded-full" />
        
        <div className="relative z-10 space-y-6">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-gray-400 font-medium text-sm tracking-wide uppercase">Total Net Worth</p>
              <h2 className="text-4xl sm:text-5xl font-bold text-white mt-1 portfolio-card-value tracking-tight">
                {formatINRCompact(trialOverall)}
              </h2>
            </div>
            <div className={`flex items-center gap-1.5 px-4 py-2 rounded-2xl backdrop-blur-md border ${
              overallChange >= 0 
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' 
                : 'bg-rose-500/10 border-rose-500/20 text-rose-400'
            }`}>
              {overallChange >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              <span className="font-bold text-sm">{formatChange(overallChange)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 pt-6 border-t border-gray-800">
            <div>
              <p className="text-gray-500 text-xs font-medium uppercase mb-1">Total Returns</p>
              <div className="flex items-baseline gap-2">
                <span className={`text-xl font-bold portfolio-card-value ${trialProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {formatINRCompact(trialProfit)}
                </span>
                <span className={`text-sm font-semibold ${trialProfit >= 0 ? 'text-emerald-500/80' : 'text-rose-500/80'}`}>
                  ({trialProfitPercent >= 0 ? '+' : ''}{trialProfitPercent.toFixed(1)}%)
                </span>
              </div>
            </div>
            <div>
              <p className="text-gray-500 text-xs font-medium uppercase mb-1">Total Invested</p>
              <p className="text-xl font-bold text-gray-200 portfolio-card-value">
                {formatINRCompact(trialTotalInvested)}
              </p>
            </div>
          </div>
        </div>

        {loading && (
          <div className="absolute top-4 right-4">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-indigo-500 border-t-transparent" />
          </div>
        )}
      </div>

      {/* Asset Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Wallet className="w-5 h-5 text-indigo-400" />
            Asset Allocation
          </h3>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4" ref={cardContainerRef}>
          <AssetCard 
            label="Stocks"
            value={formatINRCompact(stockMV)}
            type="Stock"
            colorClass="bg-orange-500"
            iconColor="text-orange-400"
            onClick={() => navigateToAsset("stock")}
          />
          <AssetCard 
            label="Mutual Funds"
            value={formatINRCompact(mfMV)}
            type="MF"
            colorClass="bg-emerald-500"
            iconColor="text-emerald-400"
            onClick={() => navigateToAsset("mf")}
          />
          <AssetCard 
            label="ETF"
            value={formatINRCompact(etfMV)}
            type="ETF"
            colorClass="bg-blue-500"
            iconColor="text-blue-400"
            onClick={() => navigateToAsset("stock", "etf")}
          />
          <AssetCard 
            label="NPS"
            value={formatINRCompact(npsMV)}
            type="NPS"
            colorClass="bg-pink-500"
            iconColor="text-pink-400"
            onClick={() => navigateToAsset("nps")}
          />
          <AssetCard 
            label="EPF"
            value={formatINRCompact(epfTotal)}
            type="EPF"
            colorClass="bg-yellow-500"
            iconColor="text-yellow-400"
            onClick={() => navigateToAsset("epf")}
          />
          <AssetCard 
            label="PPF"
            value={formatINRCompact(ppfBalance)}
            type="PPF"
            colorClass="bg-cyan-500"
            iconColor="text-cyan-400"
            onClick={() => navigateToAsset("ppf")}
          />
          <AssetCard 
            label="Fixed Deposits"
            value={formatINRCompact(bankFD)}
            type="FD"
            colorClass="bg-rose-500"
            iconColor="text-rose-400"
            onClick={() => navigateToAsset("ppf")} // Assuming FD is under PPF/Fixed Income tab
          />
          <AssetCard 
            label="Cash & Savings"
            value={formatINRCompact(trialBankSavings + trialBankDemat)}
            type="Bank"
            colorClass="bg-purple-500"
            iconColor="text-purple-400"
            onClick={() => navigateToAsset("bank")}
          />
        </div>
      </div>

      {/* Distribution Chart */}
      <div className="p-8 bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 rounded-[2.5rem] shadow-xl">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-2.5 bg-indigo-500/20 rounded-2xl">
            <PieChartIcon className="w-5 h-5 text-indigo-400" />
          </div>
          <h3 className="text-xl font-bold text-white">Portfolio Distribution</h3>
        </div>
        
        <div className="relative max-w-md mx-auto">
          {pieData.datasets[0].data.some(v => v > 0) ? (
            <div className="aspect-square">
              <Pie ref={pieChartRef} data={pieData} options={pieOptions} />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-white space-y-3">
              <Activity className="w-12 h-12 opacity-20" />
              <p className="font-medium text-lg">No data available</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}