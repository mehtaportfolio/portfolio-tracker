import React, { useMemo, useState, useRef } from "react";
import { useAnalysisAccountTotals } from "../hooks/useAnalysisAccountTotals.js";
import { useDashboardAssetAllocation } from "../hooks/useDashboardAssetAllocation.js";
import { useFixedAssetTotals } from "../hooks/useFixedAssetTotals.js";
import { usePPFDataOptimized } from "../hooks/usePPFDataOptimized.js";
import { useBankDataOptimized } from "../hooks/useBankDataOptimized.jsx";
import { 
  FiTrendingUp, 
  FiBriefcase, 
  FiPieChart, 
  FiDollarSign, 
  FiCreditCard, 
  FiActivity,
  FiBox,
  FiTarget,
  FiUser
} from "react-icons/fi";

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const formatCurrency = (value) => currencyFormatter.format(Number(value) || 0);

const ASSET_CONFIG = {
  'Stock': { icon: FiTrendingUp, color: 'from-blue-500 to-cyan-400', key: 'stocks' },
  'ETF': { icon: FiPieChart, color: 'from-indigo-500 to-purple-400', key: 'etf' },
  'MF': { icon: FiBriefcase, color: 'from-emerald-500 to-teal-400', key: 'mf' },
  'NPS': { icon: FiActivity, color: 'from-violet-500 to-fuchsia-400', key: 'nps' },
  'PPF': { icon: FiTarget, color: 'from-orange-500 to-amber-400', key: 'ppf' },
  'Bank': { icon: FiDollarSign, color: 'from-sky-500 to-blue-400', key: 'bank' },
  'EPF': { icon: FiBox, color: 'from-slate-500 to-gray-400', key: 'epf' },
  'FD': { icon: FiCreditCard, color: 'from-rose-500 to-pink-400', key: 'fd' },
};

const SummaryCard = ({ totalMarket, totalInvested, dayChange, dayChangePercent }) => {
  const profit = totalMarket - totalInvested;
  const profitPercent = totalInvested > 0 ? (profit / totalInvested) * 100 : 0;
  const isPositive = profit >= 0;
  const isDayPositive = dayChange >= 0;

  return (
    <div className="w-full p-8 rounded-[2.5rem] bg-gray-800/40 backdrop-blur-xl border border-gray-700/50 shadow-2xl animate-in fade-in zoom-in duration-700">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-6">
        <div className="space-y-1">
          <div className="text-gray-400 text-xs font-bold uppercase tracking-[0.2em]">Overall Portfolio</div>
          <div className="text-4xl sm:text-5xl font-black text-white tracking-tighter">
            {formatCurrency(totalMarket)}
          </div>
          {dayChange !== undefined && (
            <div className={`text-sm font-bold flex items-center gap-2 ${isDayPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
              <span>{isDayPositive ? '▲' : '▼'} {formatCurrency(dayChange)}</span>
              <span className="opacity-60">({isDayPositive ? '+' : ''}{dayChangePercent.toFixed(2)}%)</span>
              <span className="text-gray-500 font-medium text-[10px] uppercase tracking-widest ml-1">Today</span>
            </div>
          )}
        </div>
        <div className="flex gap-8">
          <div className="space-y-1">
            <div className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">Invested</div>
            <div className="text-lg font-bold text-gray-300 tracking-tight">{formatCurrency(totalInvested)}</div>
          </div>
          <div className="space-y-1">
            <div className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">Return</div>
            <div className={`text-lg font-bold tracking-tight ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
              {isPositive ? '+' : ''}{formatCurrency(profit)} ({profitPercent.toFixed(2)}%)
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const AccountCard = ({ accountName, data, assetType }) => {
  const { marketValue, invested, dayChange, dayChangePercent } = data;
  const profit = marketValue - invested;
  const profitPercent = invested > 0 ? (profit / invested) * 100 : 0;
  const isPositive = profit >= 0;
  const isDayPositive = dayChange >= 0;
  const isBank = assetType === 'Bank';

  return (
    <div className="p-6 rounded-[2rem] bg-gray-800/30 backdrop-blur-lg border border-gray-700/40 shadow-xl transition-all duration-300 hover:bg-gray-700/40 hover:scale-[1.02] animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gray-700/50 flex items-center justify-center">
            <FiUser className="text-gray-400 text-lg" />
          </div>
          <div className="text-lg font-bold text-white tracking-tight">{accountName}</div>
        </div>
        {!isBank && dayChange !== undefined && (
          <div className={`text-xs font-bold ${isDayPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
            {isDayPositive ? '▲' : '▼'} {Math.abs(dayChangePercent).toFixed(2)}%
          </div>
        )}
      </div>
      
      {!isBank ? (
        <>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="space-y-0.5">
              <div className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">Market Value</div>
              <div className="text-xl font-black text-white">{formatCurrency(marketValue)}</div>
            </div>
            <div className="space-y-0.5">
              <div className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">Net Return</div>
              <div className={`text-xl font-black ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                {isPositive ? '+' : ''}{formatCurrency(profit)} ({profitPercent.toFixed(2)}%)
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-gray-500 border-t border-gray-700/30 pt-4">
            <div className="flex flex-col gap-1">
              <span>Invested Value</span>
              <span className="text-gray-300">{formatCurrency(invested)}</span>
            </div>
            {dayChange !== undefined && (
              <div className="flex flex-col gap-1 items-end">
                <span>Day Change</span>
                <span className={isDayPositive ? 'text-emerald-400' : 'text-rose-400'}>
                  {isDayPositive ? '+' : ''}{formatCurrency(dayChange)}
                </span>
              </div>
            )}
          </div>
        </>
      ) : (
        <div className="space-y-0.5">
          <div className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">Balance</div>
          <div className="text-3xl font-black text-white tracking-tighter">{formatCurrency(marketValue)}</div>
        </div>
      )}
    </div>
  );
};

const AssetSummaryCard = ({ assetType, marketValue, invested, dayChange }) => {
  const profit = marketValue - invested;
  const profitPercent = invested > 0 ? (profit / invested) * 100 : 0;
  const isPositive = profit >= 0;
  const isDayPositive = dayChange >= 0;
  const dayChangePercent = (marketValue - dayChange) > 0 ? (dayChange / (marketValue - dayChange)) * 100 : 0;
  const isBank = assetType === 'Bank';

  return (
    <div className="w-full p-6 rounded-[2rem] bg-indigo-500/10 backdrop-blur-xl border border-indigo-500/20 shadow-xl animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-indigo-500/20 flex items-center justify-center">
          <FiBriefcase className="text-indigo-400 text-lg" />
        </div>
        <div className="text-lg font-bold text-white tracking-tight">Overall {assetType} Portfolio</div>
      </div>

      <div className={`grid ${isBank ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'} gap-8`}>
        <div className="space-y-4">
          <div className="space-y-1">
            <div className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">{isBank ? 'Total Balance' : 'Total Market Value'}</div>
            <div className="text-3xl font-black text-white tracking-tighter">{formatCurrency(marketValue)}</div>
          </div>
          {!isBank && dayChange !== 0 && (
            <div className={`text-sm font-bold flex items-center gap-2 ${isDayPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
              <span>{isDayPositive ? '▲' : '▼'} {formatCurrency(dayChange)}</span>
              <span className="opacity-60">({isDayPositive ? '+' : ''}{dayChangePercent.toFixed(2)}%)</span>
              <span className="text-gray-500 font-medium text-[10px] uppercase tracking-widest ml-1">Today</span>
            </div>
          )}
        </div>

        {!isBank && (
          <div className="grid grid-cols-2 gap-6 pt-4 sm:pt-0 border-t sm:border-t-0 sm:border-l border-gray-700/30 sm:pl-8">
            <div className="space-y-1">
              <div className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">Invested</div>
              <div className="text-lg font-bold text-gray-300 tracking-tight">{formatCurrency(invested)}</div>
            </div>
            <div className="space-y-1">
              <div className="text-gray-500 text-[10px] font-bold uppercase tracking-widest">Return</div>
              <div className={`text-lg font-bold tracking-tight ${isPositive ? 'text-emerald-400' : 'text-rose-400'}`}>
                {isPositive ? '+' : ''}{formatCurrency(profit)} ({profitPercent.toFixed(2)}%)
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const Home = () => {
  const { accountTotals, loading: accountLoading } = useAnalysisAccountTotals();
  const { overallTotals: overallSummary, rows: dashboardRows, loading: dashboardLoading } = useDashboardAssetAllocation();
  const { fixedAssets, loading: fixedLoading } = useFixedAssetTotals();
  const { ppfData, loading: ppfLoading } = usePPFDataOptimized();
  const { bankData, loading: bankLoading } = useBankDataOptimized();
  const [selectedAsset, setSelectedAsset] = useState('Stock');

  const homeOverallSummary = useMemo(() => {
    if (!overallSummary || !dashboardRows) return overallSummary;

    // Use overallSummary directly for Market Value and Invested to match Dashboard exactly
    const totalMV = overallSummary.marketValue || 0;
    const totalInv = overallSummary.invested || 0;

    // Portfolio.js logic: sum of Stock, ETF, MF, NPS day changes
    const volatileAssetKeys = ['Stock', 'ETF', 'MF', 'NPS'];
    const totalDayChange = (dashboardRows || [])
      .filter(r => volatileAssetKeys.includes(r.assetType))
      .reduce((sum, r) => sum + (r.dayChange || 0), 0);

    const profit = totalMV - totalInv;
    const profitPercent = totalInv > 0 ? (profit / totalInv) * 100 : 0;
    const prevMV = totalMV - totalDayChange;
    const dayChangePercent = prevMV > 0 ? (totalDayChange / prevMV) * 100 : 0;

    return {
      marketValue: totalMV,
      invested: totalInv,
      profit,
      profitPercent,
      dayChange: totalDayChange,
      dayChangePercent
    };
  }, [overallSummary, dashboardRows]);
  
  // Mouse Drag to Scroll Logic
  const scrollRef = useRef(null);
  const [isDown, setIsDown] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeftState, setScrollLeftState] = useState(0);
  const [isMoved, setIsMoved] = useState(false);

  const handleMouseDown = (e) => {
    setIsDown(true);
    setIsMoved(false);
    scrollRef.current.classList.add('active');
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeftState(scrollRef.current.scrollLeft);
  };

  const handleMouseLeave = () => {
    setIsDown(false);
    scrollRef.current.classList.remove('active');
  };

  const handleMouseUp = () => {
    setIsDown(false);
    scrollRef.current.classList.remove('active');
  };

  const handleMouseMove = (e) => {
    if (!isDown) return;
    e.preventDefault();
    setIsMoved(true);
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 2; // Scroll speed
    scrollRef.current.scrollLeft = scrollLeftState - walk;
  };

  const activeAssetTypes = useMemo(() => {
    const rowTypes = (dashboardRows || [])
      .filter(row => row.marketValue > 0 || row.investedValue > 0)
      .map(row => row.assetType);
    
    // Add fixed assets if they have data but might not be in rows yet
    const fixedTypes = [];
    if (fixedAssets) {
      if (fixedAssets.bank?.overall?.marketValue > 0 || fixedAssets.bank?.overall?.total > 0) fixedTypes.push('Bank');
      if (ppfData?.typeSummaries?.ppf?.current > 0 || fixedAssets.ppf?.overall?.marketValue > 0 || fixedAssets.ppf?.overall?.total > 0) fixedTypes.push('PPF');
      if (fixedAssets.epf?.overall?.total > 0) fixedTypes.push('EPF');
      if (ppfData?.typeSummaries?.fd?.current !== 0 || fixedAssets.fd?.overall?.marketValue !== 0) fixedTypes.push('FD');
    }

    return [...new Set([...rowTypes, ...fixedTypes])];
  }, [dashboardRows, fixedAssets, ppfData]);

  const filteredAccountData = useMemo(() => {
    const results = [];
    const assetKey = ASSET_CONFIG[selectedAsset]?.key;

    // 1. Check if it's the Bank asset tab to use the optimized bank data
    if (selectedAsset === 'Bank' && bankData && bankData.length > 0) {
      return bankData.map(account => {
        const prevBalance = account.marketValue - account.monthChange;
        return {
          name: account.name,
          marketValue: account.marketValue,
          invested: account.invested,
          dayChange: account.monthChange, // Using month change as day change for display
          dayChangePercent: prevBalance > 0 ? (account.monthChange / prevBalance) * 100 : 0
        };
      });
    }

    // 2. Check accountTotals (Stocks, ETF, MF, NPS)
    if (accountTotals && assetKey) {
      accountTotals.forEach((data, name) => {
        const breakdown = data.breakdown?.[assetKey];
        if (breakdown && (breakdown.marketValue > 0 || breakdown.invested > 0)) {
          results.push({
            name,
            marketValue: breakdown.marketValue,
            invested: breakdown.invested,
            dayChange: breakdown.dayChange,
            dayChangePercent: breakdown.dayChangePercent
          });
        }
      });
    }

    // 2. Check fixedAssets (Bank, PPF, FD, EPF)
    const fixedKey = selectedAsset.toLowerCase();
    if ((fixedKey === 'ppf' || fixedKey === 'fd') && ppfData?.byType?.[fixedKey]) {
      Object.entries(ppfData.byType[fixedKey]).forEach(([name, data]) => {
        // Show if has non-zero balance. For FD, could be lent/borrowed.
        const hasBalance = fixedKey === 'fd' ? (data.current !== 0) : (data.current > 0 || data.invested > 0);
        
        if (hasBalance) {
          results.push({
            name,
            marketValue: data.current,
            invested: data.invested,
            dayChange: 0,
            dayChangePercent: 0
          });
        }
      });
    } else if (fixedAssets?.[fixedKey]?.accounts) {
      Object.entries(fixedAssets[fixedKey].accounts).forEach(([name, data]) => {
        // For FD, show if non-zero (Lent/Borrowed). For others, show if positive balance.
        const hasBalance = fixedKey === 'fd' ? (data.marketValue !== 0) : (data.marketValue > 0 || data.invested > 0);
        
        if (hasBalance) {
          const mv = data.marketValue;
          const inv = data.invested;
          
          results.push({
            name,
            marketValue: mv,
            invested: inv,
            dayChange: data.dayChange || 0,
            dayChangePercent: 0 // Fixed assets usually don't have day change % like stocks
          });
        }
      });
    }

    return results;
  }, [accountTotals, fixedAssets, ppfData, selectedAsset, bankData]);

  const selectedAssetTotals = useMemo(() => {
    // If we have accounts data, sum it up
    if (filteredAccountData.length > 0) {
      return filteredAccountData.reduce((acc, curr) => ({
        marketValue: acc.marketValue + curr.marketValue,
        invested: acc.invested + curr.invested,
        dayChange: acc.dayChange + (curr.dayChange || 0)
      }), { marketValue: 0, invested: 0, dayChange: 0 });
    }

    // If no accounts data (like EPF), use overall from fixedAssets
    const fixedKey = selectedAsset.toLowerCase();
    if ((fixedKey === 'ppf' || fixedKey === 'fd') && ppfData?.typeSummaries?.[fixedKey]) {
      const summary = ppfData.typeSummaries[fixedKey];
      return {
        marketValue: summary.current,
        invested: summary.invested,
        dayChange: 0
      };
    }
    if (fixedAssets?.[fixedKey]?.overall) {
      const overall = fixedAssets[fixedKey].overall;
      return {
        marketValue: overall.marketValue || overall.total || 0,
        invested: overall.invested || 0,
        dayChange: overall.dayChange || 0
      };
    }

    return null;
  }, [filteredAccountData, fixedAssets, ppfData, selectedAsset]);

  const isLoading = accountLoading || dashboardLoading || fixedLoading || ppfLoading || bankLoading;

  if (isLoading || !homeOverallSummary) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gray-900 text-gray-400 space-y-4">
        <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-500 rounded-full animate-spin"></div>
        <div className="text-sm font-bold uppercase tracking-widest animate-pulse">Loading Portfolio...</div>
      </div>
    );
  }

  return (
    <div className="w-full bg-gray-900 min-h-screen text-gray-100 font-sans selection:bg-indigo-500/30">
      <div className="p-4 sm:p-6 max-w-7xl mx-auto w-full space-y-10">
        
        {/* Summary Section */}
        <SummaryCard 
          totalMarket={homeOverallSummary.marketValue} 
          totalInvested={homeOverallSummary.invested} 
          dayChange={homeOverallSummary.dayChange}
          dayChangePercent={homeOverallSummary.dayChangePercent}
        />

        {/* Assets Tabs Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <div className="text-sm font-bold text-gray-400 uppercase tracking-widest">Asset Allocation</div>
          </div>
          
          <div 
            ref={scrollRef}
            onMouseDown={handleMouseDown}
            onMouseLeave={handleMouseLeave}
            onMouseUp={handleMouseUp}
            onMouseMove={handleMouseMove}
            className="flex gap-4 overflow-x-auto pb-4 px-2 scrollbar-hide scroll-smooth snap-x snap-mandatory pr-10 cursor-grab active:cursor-grabbing"
          >
            {activeAssetTypes.map((type) => {
              const config = ASSET_CONFIG[type] || { icon: FiBox, color: 'from-gray-500 to-gray-400' };
              const Icon = config.icon;
              const isActive = selectedAsset === type;

              return (
                <button
                  key={type}
                  onClick={() => !isMoved && setSelectedAsset(type)}
                  className={`flex-shrink-0 flex items-center gap-3 px-6 py-4 rounded-[1.5rem] transition-all duration-500 border snap-start select-none ${
                    isActive 
                      ? "bg-white text-gray-900 border-white shadow-xl scale-105" 
                      : "bg-gray-800/40 text-gray-400 border-gray-700/50 hover:bg-gray-800/60"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    isActive ? "bg-gray-900 text-white" : `bg-gradient-to-br ${config.color} text-white`
                  }`}>
                    <Icon size={16} />
                  </div>
                  <span className="font-bold text-sm tracking-tight">{type}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Selected Asset Overall Summary */}
        {selectedAssetTotals && (
          <AssetSummaryCard 
            assetType={selectedAsset}
            marketValue={selectedAssetTotals.marketValue}
            invested={selectedAssetTotals.invested}
            dayChange={selectedAssetTotals.dayChange}
          />
        )}

        {/* Accounts Breakdown Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between px-2">
            <div className="text-sm font-bold text-gray-400 uppercase tracking-widest">
              {selectedAsset} Holders
            </div>
            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">
              {filteredAccountData.length} Accounts
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredAccountData.length > 0 ? (
              filteredAccountData.map((account) => (
                <AccountCard 
                  key={account.name} 
                  accountName={account.name} 
                  data={account} 
                  assetType={selectedAsset}
                />
              ))
            ) : selectedAssetTotals ? (
              // If we have overall data but no account breakdown (like EPF or single account)
              <div className="col-span-full py-10 flex flex-col items-center justify-center space-y-4 opacity-50">
                <div className="text-gray-500 font-bold text-sm uppercase tracking-widest text-center px-4">
                  Account wise breakdown not available for {selectedAsset}
                </div>
              </div>
            ) : (
              <div className="col-span-full py-20 flex flex-col items-center justify-center space-y-4 opacity-50">
                <div className="w-16 h-16 rounded-full bg-gray-800 flex items-center justify-center">
                  <FiBriefcase className="text-gray-500 text-2xl" />
                </div>
                <div className="text-gray-500 font-bold text-sm uppercase tracking-widest">
                  No breakdown data for {selectedAsset}
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
};

export default Home;
