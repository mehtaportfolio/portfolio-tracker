import { useMemo } from "react";
import { useAnalysisAccountTotals } from "../../hooks/useAnalysisAccountTotals.js";
import { 
  Briefcase, 
  Layers, 
  PieChart, 
  ShieldCheck, 
  ArrowUpRight, 
  ArrowDownRight,
  Wallet
} from "lucide-react";

const formatCurrency = (value) => {
  const num = Number(value) || 0;
  const abs = Math.abs(num);
  const sign = num < 0 ? "-" : "";

  if (abs >= 1_00_00_000) {
    return `${sign}₹${(abs / 1_00_00_000).toFixed(2)} Cr`;
  }
  if (abs >= 1_00_000) {
    return `${sign}₹${(abs / 1_00_000).toFixed(2)} L`;
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

const AssetIcon = ({ type }) => {
  switch (type) {
    case "stocks": return <Briefcase className="w-5 h-5 text-blue-600" />;
    case "etf": return <Layers className="w-5 h-5 text-orange-600" />;
    case "mf": return <PieChart className="w-5 h-5 text-rose-600" />;
    case "nps": return <ShieldCheck className="w-5 h-5 text-emerald-600" />;
    default: return <Wallet className="w-5 h-5 text-slate-600" />;
  }
};

export const AccountFullDetailsCards = () => {
  const { accountTotals, loading, error } = useAnalysisAccountTotals();

  const cards = useMemo(() => {
    if (loading) return [];
    if (!(accountTotals instanceof Map) || accountTotals.size === 0) return [];

    return Array.from(accountTotals.entries()).map(([accountName, stats]) => {
      const stocks = stats.breakdown?.stocks || { invested: 0, marketValue: 0 };
      const etf = stats.breakdown?.etf || { invested: 0, marketValue: 0 };
      const mf = stats.breakdown?.mf || { invested: 0, marketValue: 0 };
      const nps = stats.breakdown?.nps || { invested: 0, marketValue: 0 };

      const investedTotal = Number(stats.invested) || 0;
      const marketTotal = Number(stats.marketValue) || 0;
      const profitAbs = marketTotal - investedTotal;
      const profitPct = investedTotal > 0 ? (profitAbs / investedTotal) * 100 : 0;

      return {
        key: accountName,
        header: accountName,
        totalMarket: marketTotal,
        totalInvested: investedTotal,
        profitAbs,
        profitPct,
        assets: [
          { key: "stocks", label: "Stocks", data: stocks },
          { key: "etf", label: "ETFs", data: etf },
          { key: "mf", label: "MFs", data: mf },
          { key: "nps", label: "NPS", data: nps },
        ].filter(asset => (Number(asset.data.invested) || 0) !== 0 || (Number(asset.data.marketValue) || 0) !== 0),
      };
    });
  }, [accountTotals, loading]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="w-12 h-12 border-4 border-indigo-500/30 border-t-indigo-400 rounded-full animate-spin"></div>
        <div className="text-slate-400 font-black uppercase tracking-[0.2em] text-xs">Analyzing Portfolio...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-rose-500/10 backdrop-blur-xl border border-rose-900/50 p-8 rounded-[2.5rem] text-center max-w-md mx-auto">
        <div className="text-rose-400 font-black text-xl mb-2 uppercase tracking-tight">Sync Failed</div>
        <div className="text-rose-500 font-bold text-sm">{error}</div>
      </div>
    );
  }

  if (!cards.length) {
    return (
      <div className="bg-slate-800/40 backdrop-blur-xl border-2 border-dashed border-slate-700 p-16 rounded-[3rem] text-center">
        <div className="text-slate-400 font-black uppercase tracking-[0.2em] text-sm">No Assets Found</div>
        <p className="text-slate-500 text-xs mt-3 font-bold uppercase tracking-widest">Connect an account to begin</p>
      </div>
    );
  }

  return (
    <div className="grid gap-8 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
      {cards.map((card) => (
        <div key={card.key} className="group relative overflow-hidden rounded-[2.5rem] bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 shadow-2xl hover:bg-slate-800 hover:shadow-2xl transition-all duration-700">
          {/* Decorative Gradient Bar */}
          <div className={`absolute top-0 left-0 right-0 h-2.5 bg-gradient-to-r shadow-sm ${
            card.profitAbs >= 0 ? "from-emerald-500 to-teal-500" : "from-rose-500 to-red-500"
          }`} />
          
          <div className="p-8">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h3 className="text-2xl font-black text-white tracking-tighter group-hover:text-indigo-400 transition-colors">
                  {card.header}
                </h3>
                <p className="text-[15px] font-black text-slate-400 uppercase tracking-[0.25em] mt-2">Investment Portfolio</p>
              </div>
              <div className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full text-[15px] font-black shadow-sm ${
                card.profitAbs >= 0 ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
              }`}>
                {card.profitAbs >= 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                {formatPercent(card.profitPct)}
              </div>
            </div>

            {/* Main Value Display - Polished Glassmorphic Card */}
            <div className="bg-slate-700/30 rounded-[2rem] p-7 mb-8 border border-slate-600/30 shadow-inner">
              <div className="flex justify-between items-baseline mb-2.5">
                <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.15em]">Market Value</span>
                <span className={`text-[13px] font-black px-2 py-0.5 rounded-lg ${card.profitAbs >= 0 ? "text-emerald-400 bg-emerald-500/10" : "text-rose-400 bg-rose-500/10"}`}>
                  {card.profitAbs >= 0 ? "+" : ""}{formatCurrency(card.profitAbs)}
                </span>
              </div>
              <div className="text-4xl font-black text-white tracking-tighter">
                {formatCurrency(card.totalMarket)}
              </div>
              <div className="mt-4 pt-4 border-t border-slate-700/30 flex items-center justify-between">
                <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Invested Capital</div>
                <div className="text-base font-black text-slate-200 tracking-tight">{formatCurrency(card.totalInvested)}</div>
              </div>
            </div>

            {/* Asset Breakdown Grid */}
            <div className="grid grid-cols-2 gap-4">
              {card.assets.map((asset) => (
                <div key={asset.key} className="group/item flex flex-col p-5 rounded-3xl bg-slate-700/40 border border-slate-600/30 hover:bg-slate-700/80 hover:shadow-xl transition-all duration-500">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-xl bg-slate-600/40 shadow-sm group-hover/item:scale-110 group-hover/item:rotate-3 transition-all">
                      <AssetIcon type={asset.key} />
                    </div>
                    <span className="text-[13px] font-black text-slate-400 uppercase tracking-widest">{asset.label}</span>
                  </div>
                  <div className="text-xl font-black text-white tracking-tighter">
                    {formatCurrency(asset.data.marketValue)}
                  </div>
                  <div className="mt-2 pt-2 border-t border-slate-700/20 flex justify-between items-center text-[12px] font-black text-slate-500 tracking-tighter">
                    <span>Invest</span>
                    <span className="text-slate-200">{formatCurrency(asset.data.invested)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};
