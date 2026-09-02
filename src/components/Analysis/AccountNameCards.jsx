import { useMemo } from "react";
import { useAnalysisAccountTotals } from "../../hooks/useAnalysisAccountTotals.js";
import { useAssetRowsOptimized } from "../../hooks/useAssetRowsOptimized.js";
import { useTrialMode } from "../../hooks/useTrialMode.js";
import { 
  ArrowUpRight, 
  ArrowDownRight,  
  Briefcase, 
  Coins 
} from "lucide-react";

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
  return `${num >= 0 ? "+" : ""}${num.toFixed(1)}%`;
};

const OTHER_ACCOUNT_TYPES = new Set(["EPF", "PPF", "Bank", "FD"]);

const CARD_THEMES = [
  {
    bg: "bg-indigo-500/10",
    border: "border-indigo-500/30",
    hover: "hover:bg-indigo-500/20",
    iconBg: "bg-indigo-500/20",
    iconColor: "text-indigo-400"
  },
  {
    bg: "bg-orange-500/10",
    border: "border-orange-500/30",
    hover: "hover:bg-orange-500/20",
    iconBg: "bg-orange-500/20",
    iconColor: "text-orange-400"
  },
  {
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    hover: "hover:bg-amber-500/20",
    iconBg: "bg-amber-500/20",
    iconColor: "text-amber-400"
  },
  {
    bg: "bg-rose-500/10",
    border: "border-rose-500/30",
    hover: "hover:bg-rose-500/20",
    iconBg: "bg-rose-500/20",
    iconColor: "text-rose-400"
  }
];

export const AccountNameCards = () => {
  const { isTrialMode } = useTrialMode();
  const { accountTotals, loading, error } = useAnalysisAccountTotals();
  const {
    rows: assetRows,
    loading: assetRowsLoading,
    error: assetRowsError,
  } = useAssetRowsOptimized();

  const accountCards = useMemo(() => {
    if (loading) return [];
    if (!(accountTotals instanceof Map) || accountTotals.size === 0) return [];

    return Array.from(accountTotals.entries()).map(([accountName, stats]) => {
      const investedTotal = Number(stats.invested) || 0;
      const marketTotal = Number(stats.marketValue) || 0;
      const profitAbs = marketTotal - investedTotal;
      const profitPct = investedTotal > 0 ? (profitAbs / investedTotal) * 100 : 0;

      return {
        key: accountName,
        header: accountName,
        marketValue: marketTotal,
        investedValue: investedTotal,
        profitAbs,
        profitPct,
        icon: <Briefcase className="w-5 h-5" />
      };
    });
  }, [accountTotals, loading]);

  const otherAccountsCard = useMemo(() => {
    if (assetRowsLoading) return null;

    const relevantRows = Array.isArray(assetRows) ? assetRows : [];

    let totalMarketValue = 0;
    let totalInvestedValue = 0;

    relevantRows.forEach((row) => {
      if (!row || !OTHER_ACCOUNT_TYPES.has(row.assetType)) return;
      totalMarketValue += Number(row.marketValue) || 0;
      totalInvestedValue += Number(row.investedValue) || 0;
    });

    const profitAbs = totalMarketValue - totalInvestedValue;
    const profitPct = totalInvestedValue > 0 ? (profitAbs / totalInvestedValue) * 100 : 0;

    return {
      key: "other-accounts",
      header: "Other Assets",
      marketValue: totalMarketValue,
      investedValue: totalInvestedValue,
      profitAbs,
      profitPct,
      icon: <Coins className="w-5 h-5" />
    };
  }, [assetRows, assetRowsLoading]);

  const combinedCards = useMemo(() => {
    const result = [...accountCards];
    if (!isTrialMode && otherAccountsCard) {
      const exists = result.some((card) => card.key === otherAccountsCard.key || card.header === otherAccountsCard.header);
      if (!exists) {
        result.push(otherAccountsCard);
      }
    }
    return result;
  }, [accountCards, otherAccountsCard, isTrialMode]);

  if (loading || assetRowsLoading) {
    return (
      <div className="grid grid-cols-2 gap-6">
        {[1, 2, 3, 4].map(i => (
          <div key={i} className="h-44 bg-slate-800/40 backdrop-blur-xl rounded-[2.5rem] animate-pulse border border-slate-700/50" />
        ))}
      </div>
    );
  }

  if (error || assetRowsError) {
    return (
      <div className="p-10 bg-rose-500/10 backdrop-blur-xl text-rose-400 rounded-[2.5rem] border border-rose-900/50 text-center font-black uppercase tracking-widest text-xs">
        {error || assetRowsError}
      </div>
    );
  }

  if (!combinedCards.length) {
    return (
      <div className="p-20 text-center text-slate-400 font-black uppercase tracking-[0.25em] border-2 border-dashed border-slate-700 rounded-[3rem] bg-slate-800/40 backdrop-blur-md">
        Summary Unavailable
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {combinedCards.map((card, index) => {
        const theme = CARD_THEMES[index % CARD_THEMES.length];
        return (
          <div key={card.key} className={`group flex flex-col p-7 rounded-[2.5rem] ${theme.bg} backdrop-blur-xl border ${theme.border} shadow-2xl ${theme.hover} transition-all duration-700 hover:-translate-y-2`}>
            <div className="flex items-center gap-4 mb-7">

              <h3 className="text-lg font-black text-white tracking-tighter break-words">{card.header}</h3>
            </div>
            
            <div className="mt-auto space-y-5">
              <div>
                <div className="flex items-baseline justify-between mb-2">
                  <span className="text-[15px] font-black text-slate-400 tracking-widest">Market Value</span>

                </div>
                <div className="text-3xl font-black text-white tracking-tighter mb-4">
                  {formatCurrency(card.marketValue)}
                </div>
                  <div className={`flex items-center text-[15px] font-black px-2.5 py-1 rounded-lg shadow-sm ${card.profitAbs >= 0 ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"}`}>
                    {card.profitAbs >= 0 ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                    {formatPercent(card.profitPct)}
                  </div>
              </div>
              
              <div className="pt-5 border-t border-slate-700/40 flex justify-between items-center">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Invested</span>
                <span className="text-base font-black text-slate-200 tracking-tight">{formatCurrency(card.investedValue)}</span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
