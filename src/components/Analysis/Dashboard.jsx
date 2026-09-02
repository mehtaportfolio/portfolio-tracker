import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import * as XLSX from "xlsx";
import {
  LayoutDashboard,
  FileText,
  TrendingUp,
  Layers,
  PieChart,
  BarChart3,
  Filter,
  ArrowUpRight,
  ArrowDownRight,
  Briefcase,
  FileSpreadsheet
} from "lucide-react";
import { useMFDataOptimized } from "../../hooks/useMFDataOptimized.js";
import { usePortfolioDataOptimized } from "../../hooks/usePortfolioDataOptimized.js";
import { useStockDataOptimized } from "../../hooks/useStockDataOptimized.js";
import { fetchTopMutualFunds, fetchAnalysisDashboard, fetchTodayTopGainersLosersDayChange } from "../../api/analysisAPI.js";
import { AccountNameCards } from "./AccountNameCards.jsx";
import { AccountFullDetailsCards } from "./AccountFullDetailsCards.jsx";
import { useMode } from "../../context/ModeContext.jsx";

ChartJS.register(ArcElement, Tooltip, Legend);

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

const formatCompactAmount = (value) => {
  const num = Number(value) || 0;
  const abs = Math.abs(num);
  const sign = num < 0 ? "-" : "";

  if (abs >= 1_00_00_000) {
    return `${sign}₹${(abs / 1_00_00_000).toFixed(1)}Cr`;
  }
  if (abs >= 1_00_000) {
    return `${sign}₹${(abs / 1_00_000).toFixed(1)}L`;
  }
  if (abs >= 1_000) {
    return `${sign}₹${(abs / 1_000).toFixed(1)}K`;
  }

  return `${sign}₹${abs.toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
};

const formatPercent = (value) => {
  const num = Number.isFinite(value) ? value : 0;
  return `${num >= 0 ? "+" : ""}${Math.round(num)}%`;
};

const FILTER_OPTIONS = [
  { value: "accountName", label: "Accounts", icon: LayoutDashboard, color: "bg-blue-500" },
  { value: "accountFullDetails", label: "Details", icon: FileText, color: "bg-purple-500" },
  { value: "topEtfs", label: "ETFs", icon: Layers, color: "bg-orange-500" },
  { value: "profitFilter", label: "Filter %", icon: Filter, color: "bg-amber-500" },
  { value: "topStocks", label: "Gainers", icon: TrendingUp, color: "bg-emerald-500" },
  { value: "todayGainers", label: "Today Gainers", icon: TrendingUp, color: "bg-cyan-500" },
  { value: "topMutualFunds", label: "Mutual Funds", icon: PieChart, color: "bg-rose-500" },
  { value: "stockReturns", label: "Stocks", icon: BarChart3, color: "bg-indigo-500" },
];

const DEFAULT_PROFIT_THRESHOLD = "50";

const SUB_FILTER_OPTIONS = [
  { value: "marketValue", label: "Market Value" },
  { value: "invested", label: "Invested Value" },
  { value: "absReturn", label: "Absolute Return" },
  { value: "absReturnPct", label: "Absolute Return %" },
  { value: "xirr", label: "XIRR" },
];

const DashboardCards = () => {
  const scrollRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const [isHovered, setIsHovered] = useState(false);
  const autoScrollRef = useRef(null);
  const scrollPosRef = useRef(0);

  useEffect(() => {
    const startAutoScroll = () => {
      if (scrollRef.current) {
        if (!scrollRef.current.isMouseDown && !isHovered) {
          scrollPosRef.current += 0.8;
          const halfWidth = scrollRef.current.scrollWidth / 2;
          if (scrollPosRef.current >= halfWidth) {
            scrollPosRef.current -= halfWidth;
          } else if (scrollPosRef.current < 0) {
            scrollPosRef.current += halfWidth;
          }
          scrollRef.current.scrollLeft = scrollPosRef.current;
        } else {
          scrollPosRef.current = scrollRef.current.scrollLeft;
        }
      }
      autoScrollRef.current = requestAnimationFrame(startAutoScroll);
    };

    autoScrollRef.current = requestAnimationFrame(startAutoScroll);
    return () => {
      if (autoScrollRef.current) cancelAnimationFrame(autoScrollRef.current);
    };
  }, [isHovered]);

  const handleMouseDown = (e) => {
    if (!scrollRef.current) return;
    scrollRef.current.isMouseDown = true;
    scrollRef.current.dragMoved = false;
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeft(scrollRef.current.scrollLeft);
  };

  const handleMouseLeave = () => {
    if (scrollRef.current) scrollRef.current.isMouseDown = false;
    setTimeout(() => setIsDragging(false), 50);
  };

  const handleMouseUp = () => {
    if (scrollRef.current) scrollRef.current.isMouseDown = false;
    setTimeout(() => setIsDragging(false), 50);
  };

  const handleMouseMove = (e) => {
    if (!scrollRef.current?.isMouseDown) return;
    
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 2;
    
    if (Math.abs(x - startX) > 5) {
      if (!isDragging) setIsDragging(true);
      scrollRef.current.dragMoved = true;
      e.preventDefault();
      scrollRef.current.scrollLeft = scrollLeft - walk;
    }
  };

  const handleTouchStart = (e) => {
    if (!scrollRef.current) return;
    scrollRef.current.isMouseDown = true;
    scrollRef.current.dragMoved = false;
    setStartX(e.touches[0].pageX - scrollRef.current.offsetLeft);
    setScrollLeft(scrollRef.current.scrollLeft);
  };

  const handleTouchEnd = () => {
    if (scrollRef.current) scrollRef.current.isMouseDown = false;
    setTimeout(() => setIsDragging(false), 50);
  };

  const handleTouchMove = (e) => {
    if (!scrollRef.current?.isMouseDown) return;
    
    const x = e.touches[0].pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 2;
    
    if (Math.abs(x - startX) > 5) {
      if (!isDragging) setIsDragging(true);
      scrollRef.current.dragMoved = true;
      scrollRef.current.scrollLeft = scrollLeft - walk;
    }
  };

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");


  const [topStocksData, setTopStocksData] = useState({ gainersAbs: [], gainersPct: [], losersAbs: [], losersPct: [] });
  const [topMutualFundsData, setTopMutualFundsData] = useState([]);
  const [openEquityPositions, setOpenEquityPositions] = useState({ stocks: [], etfs: [] });
  const [selectedFilter, setSelectedFilter] = useState("accountName");
  const [subFilter, setSubFilter] = useState("marketValue");
  const [sortDirection, setSortDirection] = useState("desc");
  const [profitThreshold, setProfitThreshold] = useState(DEFAULT_PROFIT_THRESHOLD);
  const [profitOperator, setProfitOperator] = useState(">=");
  const [operatorInput, setOperatorInput] = useState(">=");
  const [topStocksTab, setTopStocksTab] = useState("gainers");
  const [topStocksMetric, setTopStocksMetric] = useState("pct");

  // Additional data hooks
  useMFDataOptimized();
  usePortfolioDataOptimized();
  const { stocks: openStockHoldings } = useStockDataOptimized();

  const { mode, priceSource } = useMode();
  const isTrialMode = mode === "trial";

useEffect(() => {
    const load = async () => {
      if (isTrialMode) {
        setTopStocksData({ gainersAbs: [], gainersPct: [], losersAbs: [], losersPct: [] });
        setTopMutualFundsData([]);
        setOpenEquityPositions({ stocks: [], etfs: [] });
        setLoading(false);
        setError("");
        return;
      }

      setLoading(true);
      setError("");
      try {
        const [dashboardData, topMFs] = await Promise.all([
          fetchAnalysisDashboard(priceSource),
          fetchTopMutualFunds(subFilter, sortDirection),
        ]);

        setTopStocksData({
          gainersAbs: dashboardData.topGainers || [],
          gainersPct: dashboardData.topGainersPct || [],
          losersAbs: dashboardData.topLosers || [],
          losersPct: dashboardData.topLosersPct || [],
        });
        setTopMutualFundsData(topMFs || []);
        setOpenEquityPositions(dashboardData.openEquityPositions || { stocks: [], etfs: [] });

      } catch (err) {
        console.error("[Dashboard.useEffect] Error:", err);
        setError(err.message || "Failed to load analysis dashboard");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, [subFilter, sortDirection, isTrialMode, priceSource]);

  const [todayDayChangeData, setTodayDayChangeData] = useState({
    todayGainersAbs: [],
    todayGainersPct: [],
    todayLosersAbs: [],
    todayLosersPct: [],
  });

  useEffect(() => {
    if (isTrialMode) return;

    let cancelled = false;
    const loadTodayTop = async () => {
      try {
        const data = await fetchTodayTopGainersLosersDayChange(priceSource);
        if (!cancelled && data) {
          setTodayDayChangeData({
            todayGainersAbs: data.todayGainersAbs || [],
            todayGainersPct: data.todayGainersPct || [],
            todayLosersAbs: data.todayLosersAbs || [],
            todayLosersPct: data.todayLosersPct || [],
          });
        }
      } catch (e) {
        console.error('[Dashboard] todayTopGainersLosersDayChange failed', e);
      }
    };

    loadTodayTop();

    return () => {
      cancelled = true;
    };
  }, [priceSource, isTrialMode]);

const createTopStockView = useCallback((lists, titlePrefix = "Top", summaryPercentMode = "invested") => {
  const { gainersAbs, gainersPct, losersAbs, losersPct } = lists;


  const isGainers = topStocksTab === "gainers";
  const isPct = topStocksMetric === "pct";
  
  let targetList = [];
  let header = "";

  if (isGainers) {
    targetList = isPct ? gainersPct : gainersAbs;
    header = isPct ? `${titlePrefix} 5 Gainers (%)` : `${titlePrefix} 5 Gainers (Abs)`;
  } else {
    targetList = isPct ? losersPct : losersAbs;
    header = isPct ? `${titlePrefix} 5 Losers (%)` : `${titlePrefix} 5 Losers (Abs)`;
  }

  const mapToListItem = (s) => `${s.name}: ${formatCurrency(s.profit)} (${formatPercent(s.percent)})`;

  const summary = targetList.reduce((acc, s) => ({
    marketValue: acc.marketValue + (s.marketValue || 0),
    invested: acc.invested + (s.invested || 0),
    profit: acc.profit + (s.profit || 0)
  }), { marketValue: 0, invested: 0, profit: 0 });

  const summaryPercentBase = summaryPercentMode === "previousValue"
    ? summary.marketValue - summary.profit
    : summary.invested;
  const summaryPercent = summaryPercentBase > 0 ? (summary.profit / summaryPercentBase) * 100 : 0;

  return {
    title: isGainers ? `${titlePrefix} Gainers` : `${titlePrefix} Losers`,
    cards: [
      {
        key: "top-stocks-summary-values",
        type: "summary-values",
        header: "Combined Value",
        marketValue: summary.marketValue,
        invested: summary.invested,
        isPositive: true
      },
      {
        key: "top-stocks-summary-profit",
        type: "summary-profit",
        header: isGainers ? "Combined Profit" : "Combined Loss",
        profit: summary.profit,
        percent: summaryPercent,
        isPositive: summary.profit >= 0
      },
      {
        key: "top-stocks-main",
        header: header,
        list: targetList.map(mapToListItem)
      }
    ]
  };
}, [topStocksTab, topStocksMetric]);

const topStockCards = useMemo(() => (
  createTopStockView(topStocksData, "Top")
), [createTopStockView, topStocksData]);

const todayStockCards = useMemo(() => {
  const gainersAbs = todayDayChangeData?.todayGainersAbs || [];
  const gainersPct = todayDayChangeData?.todayGainersPct || [];
  const losersAbs = todayDayChangeData?.todayLosersAbs || [];
  const losersPct = todayDayChangeData?.todayLosersPct || [];

  return createTopStockView({ gainersAbs, gainersPct, losersAbs, losersPct }, "Today Top", "previousValue");
}, [createTopStockView, todayDayChangeData]);




  const topMutualFundCards = useMemo(() => {
    if (!topMutualFundsData.length) {
      return { title: "Top 5 Mutual Funds", cards: [] };
    }

    const cards = topMutualFundsData.map((fund, index) => {
      const isPositive = fund.absReturn >= 0;
      return {
        key: `top-mf-${index}`,
        header: fund.name,
        primaryLabel: "Market Value",
        primary: formatCurrency(fund.marketValue),
        secondaryLabel: "Invested",
        secondary: formatCurrency(fund.invested),
        outcomeLabel: isPositive ? "Profit" : "Loss",
        outcomeValue: formatCurrency(fund.absReturn),
        outcomePercent: formatPercent(fund.absReturnPct),
        isPositive,
        metaLabel: "XIRR",
        metaValue: formatPercent(fund.xirr),
        transactionCount: fund.transactionCount,
      };
    });

    const title = sortDirection === "desc" ? "Top 5 Mutual Funds" : "Top 5 Mutual Fund Losers";

    return { title, cards };
  }, [topMutualFundsData, sortDirection]);



  const createEquitySummaryCards = useCallback((items) => {
    const sortKey = subFilter;
    const source = Array.isArray(items) ? items : [];

    const toComparableValue = (item) => {
      const raw = item?.[sortKey];
      const numeric = Number(raw);
      return Number.isFinite(numeric) ? numeric : 0;
    };

    const sorted = [...source].sort((a, b) => {
      const aVal = toComparableValue(a);
      const bVal = toComparableValue(b);
      return sortDirection === "desc" ? bVal - aVal : aVal - bVal;
    });

    const topItems = sorted.slice(0, 5);

    return topItems.map((item, index) => ({
      key: `equity-${item.name}-${index}`,
      header: item.name,
      data: item,
    }));
}, [subFilter, sortDirection]);

  const topEtfCards = useMemo(() => {
   
    
   const etfsData = Array.isArray(openEquityPositions?.etfs) ? openEquityPositions.etfs : [];
   
    
    const baseCards = createEquitySummaryCards(etfsData);
    

    const title = sortDirection === "desc" ? "Top 5 ETFs" : "Top 5 ETF Losers";

    const cards = baseCards.map((card) => {
      const equity = card.data || {};
      const isPositive = Number(equity.absReturn) >= 0;
      return {
        key: card.key,
        header: card.header,
        primaryLabel: "Market Value",
        primary: formatCurrency(equity.marketValue),
        secondaryLabel: "Invested",
        secondary: formatCurrency(equity.invested),
        outcomeLabel: isPositive ? "Profit" : "Loss",
        outcomeValue: formatCurrency(equity.absReturn),
        outcomePercent: formatPercent(equity.absReturnPct),
        isPositive,
        metaLabel: "XIRR",
        metaValue: formatPercent(equity.xirr),
        transactionCount: equity.transactionCount,
        accountType: equity.accountType || "REGULAR",
      };
    });

    return { title, cards };
  }, [openEquityPositions.etfs, sortDirection, createEquitySummaryCards]);

  const stockReturnCards = useMemo(() => {
    const baseCards = createEquitySummaryCards(openEquityPositions.stocks);
    const title = sortDirection === "desc" ? "Top 5 Stocks" : "Top 5 Stock Losers";

    const cards = baseCards.map((card) => {
      const equity = card.data || {};
      const isPositive = Number(equity.absReturn) >= 0;
      return {
        key: card.key,
        header: card.header,
        primaryLabel: "Market Value",
        primary: formatCurrency(equity.marketValue),
        secondaryLabel: "Invested",
        secondary: formatCurrency(equity.invested),
        outcomeLabel: isPositive ? "Profit" : "Loss",
        outcomeValue: formatCurrency(equity.absReturn),
        outcomePercent: formatPercent(equity.absReturnPct),
        isPositive,
        metaLabel: "XIRR",
        metaValue: formatPercent(equity.xirr),
        transactionCount: equity.transactionCount,
        accountType: equity.accountType || "REGULAR",
      };
    });

    return { title, cards };
  }, [openEquityPositions.stocks, sortDirection, createEquitySummaryCards]);

  const topStocksTabControls = (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2.5">
        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-2 mr-2">Category</span>
        {["gainers", "losers"].map((tab) => {
          const isActive = topStocksTab === tab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setTopStocksTab(tab)}
              className={`flex items-center gap-2 rounded-xl px-5 py-2 text-xs font-black transition-all duration-300 capitalize ${
                isActive
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200"
                  : "bg-slate-700/60 text-slate-400 hover:bg-slate-700 border border-transparent hover:border-slate-600"
              }`}
            >
              {tab}
            </button>
          );
        })}
      </div>
      <div className="flex items-center gap-2.5">
        <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-2 mr-2">Sort By</span>
        {[
          { value: "pct", label: "% Profit" },
          { value: "abs", label: "Abs Profit" }
        ].map((metric) => {
          const isActive = topStocksMetric === metric.value;
          return (
            <button
              key={metric.value}
              type="button"
              onClick={() => setTopStocksMetric(metric.value)}
              className={`flex items-center gap-2 rounded-xl px-5 py-2 text-xs font-black transition-all duration-300 ${
                isActive
                  ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200"
                  : "bg-slate-700/60 text-slate-400 hover:bg-slate-700 border border-transparent hover:border-slate-600"
              }`}
            >
              {metric.label}
            </button>
          );
        })}
      </div>
    </div>
  );

  const getCardsForFilter = () => {
    if (selectedFilter === "") {
      return {
        title: "",
        cards: [],
        variant: "account",
      };
    }

    switch (selectedFilter) {
      case "topStocks":
        return {
          title: topStockCards.title,
          cards: topStockCards.cards,
          variant: "structured",
        };
      case "todayGainers":
        return {
          title: todayStockCards.title,
          cards: todayStockCards.cards,
          variant: "structured",
        };
      case "topMutualFunds":
        return {
          title: topMutualFundCards.title,
          cards: topMutualFundCards.cards,
          variant: "summary",
          subFilters: SUB_FILTER_OPTIONS,
        };
      case "topEtfs":
        return {
          title: topEtfCards.title,
          cards: topEtfCards.cards,
          variant: "summary",
          subFilters: SUB_FILTER_OPTIONS,
        };
      case "stockReturns":
        return {
          title: stockReturnCards.title,
          cards: stockReturnCards.cards,
          variant: "summary",
          subFilters: SUB_FILTER_OPTIONS,
        };
      case "accountName":
        return {
          title: "Account Name",
          cards: [],
          variant: "accountName",
          component: AccountNameCards,
        };
      case "accountFullDetails":
        return {
          title: "Account Full Details",
          cards: [],
          variant: "accountFullDetails",
          component: AccountFullDetailsCards,
        };
      default:
        return {
          title: "",
          cards: [],
          variant: "account",
        };
    }
  };

  const handleSubFilterClick = (value) => {
    if (subFilter === value) {
      setSortDirection((prev) => (prev === "desc" ? "asc" : "desc"));
    } else {
      setSubFilter(value);
      setSortDirection("desc");
    }
  };

  const [filterInput, setFilterInput] = useState(DEFAULT_PROFIT_THRESHOLD);
  const [filteredStocks, setFilteredStocks] = useState([]);

  useEffect(() => {
    if (selectedFilter !== "profitFilter") {
      return;
    }

    const thresholdValue = Number(profitThreshold);
    if (!Number.isFinite(thresholdValue)) {
      setFilteredStocks([]);
      return;
    }

    const stocks = Array.isArray(openEquityPositions?.stocks) ? openEquityPositions.stocks : [];
    const eligible = stocks
      .filter((stock) => {
        if (!Number.isFinite(stock.absReturnPct)) return false;
        return profitOperator === ">="
          ? stock.absReturnPct >= thresholdValue
          : stock.absReturnPct <= thresholdValue;
      })
      .sort((a, b) => (Number(b.absReturnPct) || 0) - (Number(a.absReturnPct) || 0));

    setFilteredStocks(eligible);
  }, [selectedFilter, profitThreshold, profitOperator, openEquityPositions]);

  const profitFilterCards = useMemo(() => {
    const thresholdValue = Number(profitThreshold);
    if (!Number.isFinite(thresholdValue) || selectedFilter !== "profitFilter") {
      return { title: "", cards: [], variant: "summary" };
    }

    const cards = filteredStocks.map((stock, index) => {
      const isPositive = Number(stock.absReturn) >= 0;
      return {
        key: `profit-filter-${stock.name}-${index}`,
        header: stock.name,
        primaryLabel: "Market Value",
        primary: formatCurrency(stock.marketValue),
        secondaryLabel: "Invested",
        secondary: formatCurrency(stock.invested),
        outcomeLabel: isPositive ? "Profit" : "Loss",
        outcomeValue: formatCurrency(stock.absReturn),
        outcomePercent: formatPercent(stock.absReturnPct),
        isPositive,
        metaLabel: "XIRR",
        metaValue: formatPercent(stock.xirr),
        transactionCount: stock.transactionCount,
        accountType: stock.accountType || "REGULAR",
      };
    });

    const operatorLabel = profitOperator === ">=" ? "≥" : "≤";
    const title = `Stocks with returns ${operatorLabel} ${formatPercent(thresholdValue)}`;
    return { title, cards, variant: "summary" };
  }, [selectedFilter, profitThreshold, profitOperator, filteredStocks]);

  const profitFilterSummary = useMemo(() => {
    if (selectedFilter !== "profitFilter") return null;

    const summary = filteredStocks.reduce(
      (acc, stock) => ({
        invested: acc.invested + (Number(stock.invested) || 0),
        marketValue: acc.marketValue + (Number(stock.marketValue) || 0),
        absReturn: acc.absReturn + (Number(stock.absReturn) || 0),
      }),
      { invested: 0, marketValue: 0, absReturn: 0 }
    );

    const absReturnPct = summary.invested > 0 ? (summary.absReturn / summary.invested) * 100 : 0;

    return {
      ...summary,
      absReturnPct,
    };
  }, [selectedFilter, filteredStocks]);

  const uniqueProfitFilterCount = useMemo(() => {
    if (selectedFilter !== "profitFilter") return 0;
    return new Set(
      filteredStocks.map((stock) => ((stock.symbol || stock.name || "") + "").trim().toUpperCase())
    ).size;
  }, [selectedFilter, filteredStocks]);

  const isProfitFilterActive = selectedFilter === "profitFilter";

  const handleProfitFilterApply = () => {
    setProfitOperator(operatorInput);
    if (!filterInput.trim()) {
      setProfitThreshold("0");
      return;
    }

    const numeric = Number(filterInput);
    if (!Number.isFinite(numeric)) {
      setProfitThreshold("0");
    } else {
      setProfitThreshold(String(numeric));
    }
  };

  const normalizeAccountName = (name) => {
    if (!name) return "";
    const normalized = String(name).trim();
    const lower = normalized.toLowerCase();
    const hasPm = /\bpm\b/i.test(normalized);
    const hasPdm = /\bpdm\b/i.test(lower);
    if (hasPm && hasPdm) {
      return "PM & PDM";
    }
    return normalized;
  };

  const normalizeStockNameForMatch = (name) => String(name || "").trim().toUpperCase();

  const formatDateForExcel = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.valueOf())) return String(value);
    return date.toISOString().split("T")[0];
  };

  const getExportRows = () => {
    if (!filteredStocks.length) return [];

    return filteredStocks.map((stock) => {
      const normalizedStockName = normalizeStockNameForMatch(stock.name);
      const matching = openStockHoldings.find((holding) => {
        const holdingName = normalizeStockNameForMatch(holding.stock_name || holding.name);
        return holdingName === normalizedStockName;
      });

      const accountNames = matching?.transactions?.map((txn) => String(txn.account_name || "").trim()).filter(Boolean) || [];
      const uniqueAccountNames = [...new Set(accountNames.map(normalizeAccountName))].filter(Boolean);
      const accountName = uniqueAccountNames.length === 0
        ? ""
        : uniqueAccountNames.join(" & ");

      const accountTypes = matching?.transactions?.map((txn) => String(txn.account_type || "").trim()).filter(Boolean) || [];
      const uniqueAccountTypes = [...new Set(accountTypes)].filter(Boolean);
      const accountType = uniqueAccountTypes.join(" & ") || stock.accountType || "";

      const buyDates = matching?.transactions?.map((txn) => formatDateForExcel(txn.buy_date)).filter(Boolean) || [];
      const buyDate = buyDates.length > 0 ? buyDates.sort()[0] : "";

      const totalQuantity = matching?.quantity ?? stock.quantity ?? "";
      const totalInvested = matching?.invested ?? stock.invested ?? "";
      const totalBuyPrice = matching?.transactions?.reduce((sum, txn) => sum + (Number(txn.quantity) || 0) * (Number(txn.buy_price) || 0), 0) || 0;
      const avgBuyPrice = totalQuantity ? totalBuyPrice / totalQuantity : (stock.buyPrice || 0);

      const stockBroadSector = matching?.s_broad_sector || matching?.broad_sector || stock.s_broad_sector || stock.broad_sector || "";
      const stockSector = matching?.s_sector || matching?.sector || stock.s_sector || stock.sector || "";
      const stockBroadIndustry = matching?.s_broad_industry || matching?.broad_industry || stock.s_broad_industry || stock.broad_industry || "";
      const stockIndustry = matching?.s_industry || matching?.industry || stock.s_industry || stock.industry || "";
      const stockMacroSector = matching?.macro_sector || stock.macro_sector || "";
      const stockKnownSector = matching?.known_sector || stock.known_sector || "";
      const stockCategory = matching?.category || stock.category || "";
      const stockBasicIndustry = matching?.basic_industry || stock.basic_industry || "";

      const row = {
        stock_name: stock.name || "",
        account_name: accountName,
        account_type: accountType,
        buy_date: buyDate,
        buy_price: Number(avgBuyPrice) || 0,
        total_quantity: Number(totalQuantity) || 0,
        invested_value: Number(totalInvested) || 0,
        market_value: Number(stock.marketValue ?? stock.currentValue ?? 0) || 0,
        s_broad_sector: stockBroadSector,
        s_sector: stockSector,
        s_broad_industry: stockBroadIndustry,
        s_industry: stockIndustry,
        category: stockCategory,
        macro_sector: stockMacroSector,
        known_sector: stockKnownSector,
        basic_industry: stockBasicIndustry,
        pl: Number(stock.absReturn ?? stock.profit ?? 0) || 0,
        pl_pct: Number(stock.absReturnPct ?? stock.percent ?? 0) / 100,
        xirr: Number(stock.xirr ?? 0) / 100,
      };

      return row;
    });
  };

  const handleProfitFilterExport = () => {
    const rows = getExportRows();
    if (!rows || rows.length === 0) return;

    const workbook = XLSX.utils.book_new();
    const sheet = XLSX.utils.json_to_sheet(rows, { skipHeader: false });
    const range = XLSX.utils.decode_range(sheet['!ref']);

    for (let C = range.s.c; C <= range.e.c; ++C) {
      const header = XLSX.utils.encode_col(C) + '1';
      const headerValue = sheet[header]?.v || '';
      if (headerValue === 'P/L %' || headerValue === 'XIRR') {
        for (let R = range.s.r + 1; R <= range.e.r; ++R) {
          const cellAddr = XLSX.utils.encode_cell({ r: R, c: C });
          if (sheet[cellAddr] && typeof sheet[cellAddr].v === 'number') {
            sheet[cellAddr].z = '0.00%';
          }
        }
      }
    }

    XLSX.utils.book_append_sheet(workbook, sheet, 'Export');
    const operatorLabel = profitOperator === '>=' ? 'gte' : 'lte';
    XLSX.writeFile(workbook, `profit_filter_stock_export_${operatorLabel}_${profitThreshold}.xlsx`);
  };

  const handleProfitFilterReset = () => {
    setFilterInput(DEFAULT_PROFIT_THRESHOLD);
    setProfitThreshold(DEFAULT_PROFIT_THRESHOLD);
    setOperatorInput(">=");
    setProfitOperator(">=");
  };

  const profitFilterControls = isProfitFilterActive ? (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-slate-100" htmlFor="profit-threshold-input">
            Profit %
          </label>
          <select
            value={operatorInput}
            onChange={(e) => setOperatorInput(e.target.value)}
            className="rounded-lg border border-slate-300 px-2 py-1 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 bg-white"
          >
            <option value=">=">≥</option>
            <option value="<=">≤</option>
          </select>
          <input
            id="profit-threshold-input"
            type="number"
            value={filterInput}
            onChange={(event) => setFilterInput(event.target.value)}
            className="w-24 rounded-lg border border-slate-300 px-3 py-1 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            placeholder="e.g. 50"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleProfitFilterApply}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-200"
          >
            Apply Filter
          </button>
          <button
            type="button"
            onClick={handleProfitFilterReset}
            className="rounded-lg bg-red-600 border border-slate-300 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-200"
          >
            Reset
          </button>
          <button
            type="button"
            onClick={handleProfitFilterExport}
            disabled={!filteredStocks.length}
            className={`rounded-lg bg-slate-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition focus:outline-none focus:ring-2 focus:ring-slate-200 ${filteredStocks.length ? 'hover:bg-slate-600' : 'opacity-50 cursor-not-allowed'}`}
            title="Download filtered stocks to Excel"
          >
            <span className="inline-flex items-center gap-2">
              <FileSpreadsheet className="w-4 h-4" />
              Export
            </span>
          </button>
          <span className="text-sm font-semibold text-slate-200">
            ({uniqueProfitFilterCount})
          </span>
        </div>
      </div>

      {profitFilterSummary && (
        <div className="grid grid-cols-2 md:grid-cols-2 gap-4">
          {/* Card 1: Total Invested & Market Value */}
          <div className="bg-slate-800/80 backdrop-blur-xl p-5 rounded-3xl border border-slate-700/50 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <h4 className="text-sm font-black text-slate-100 uppercase tracking-wider">
                Portfolio Overview
              </h4>
            </div>
            <div className="space-y-4">
              <div className="bg-slate-700/30 rounded-2xl p-4 border border-slate-600/30">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">
                  Market Value
                </span>
                <span className="text-xl font-black text-white">
                  {formatCurrency(profitFilterSummary.marketValue)}
                </span>
              </div>
              <div className="flex justify-between items-center px-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  Invested
                </span>
                <span className="text-sm font-black text-slate-200">
                  {formatCurrency(profitFilterSummary.invested)}
                </span>
              </div>
            </div>
          </div>

          {/* Card 2: Net Return & Return % */}
          <div className="bg-slate-800/80 backdrop-blur-xl p-5 rounded-3xl border border-slate-700/50 shadow-xl">
            <div className="flex items-center gap-3 mb-4">

              <h4 className="text-sm font-black text-slate-100 uppercase tracking-wider">
                Performance Analytics
              </h4>
            </div>
            <div className="space-y-4">
              <div
                className={`${
                  profitFilterSummary.absReturn >= 0
                    ? "bg-emerald-500/10 border-emerald-500/20"
                    : "bg-rose-500/10 border-rose-500/20"
                } rounded-2xl p-4 border`}
              >
                <span
                  className={`text-[10px] font-black ${
                    profitFilterSummary.absReturn >= 0 ? "text-emerald-400" : "text-rose-400"
                  } uppercase tracking-widest block mb-1`}
                >
                  P/L
                </span>
                <span
                  className={`text-xl font-black ${
                    profitFilterSummary.absReturn >= 0 ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {formatCurrency(profitFilterSummary.absReturn)}
                </span>
              </div>
              <div className="flex justify-between items-center px-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  P/L %
                </span>
                <span
                  className={`text-sm font-black ${
                    profitFilterSummary.absReturn >= 0 ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {formatPercent(profitFilterSummary.absReturnPct)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  ) : null;

  const profitFilterView = useMemo(() => {
    if (!isProfitFilterActive) {
      return { title: "", cards: [], variant: "summary" };
    }

    return profitFilterCards;
  }, [isProfitFilterActive, profitFilterCards]);

  const {cards: displayedCards, variant, subFilters: subFilterOptions } = isProfitFilterActive
    ? profitFilterView
    : getCardsForFilter();

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-slate-500">Loading insights…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-red-700">
        <p className="font-semibold">Failed to load data</p>
        <p className="text-sm">{error}</p>
      </div>
    );
  }

  const renderAccountCard = (card) => {
    const compactMarket = formatCompactAmount(card.marketValue);
    const compactInvested = formatCompactAmount(card.invested);
    const isPositive = card.absReturn >= 0;

    return (
      <article
        key={card.key}
        className="group flex h-full w-full flex-col rounded-[2.5rem] bg-slate-800/50 backdrop-blur-xl p-6 border border-slate-700/50 shadow-2xl hover:bg-slate-800 transition-all duration-500 hover:-translate-y-1"
      >
        <div className="flex items-center gap-4 mb-5">
          <div className="p-3 rounded-2xl bg-blue-500/10 group-hover:bg-blue-500/20 transition-colors">
            <Briefcase className="w-5 h-5 text-blue-400" />
          </div>
          <h3 className="truncate text-base font-black text-slate-100 tracking-tight">
            {card.header}
          </h3>
        </div>

        <div className="mt-auto space-y-4">
          <div>
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.15em] block mb-1.5">Current Balance</span>
            <div className="flex items-center justify-between">
              <p className="text-2xl font-black text-white tracking-tighter">
                {compactMarket}
              </p>
              <div className={`flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-black shadow-sm ${
                isPositive ? "bg-emerald-500/20 text-emerald-400" : "bg-rose-500/20 text-rose-400"
              }`}>
                {isPositive ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                {formatPercent(card.absReturn)}
              </div>
            </div>
          </div>
          
          <div className="pt-4 border-t border-slate-700/40 flex justify-between items-center">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Invested</span>
            <span className="text-sm font-black text-slate-200 tracking-tight">{compactInvested}</span>
          </div>
        </div>
      </article>
    );
  };

  const renderSummaryCard = (card, indexColor = "text-slate-400", valueColor = "text-white") => {
    if (!card) return null;

    const orangeHeaders = ["Gain", "Gain %"];
    const blueHeaders = ["Loss", "Loss %"];
    
    let themeColor = "indigo";
    let Icon = BarChart3;

    if (orangeHeaders.includes(card.header)) {
      themeColor = "emerald";
      Icon = TrendingUp;
    } else if (blueHeaders.includes(card.header)) {
      themeColor = "rose";
      Icon = TrendingUp; 
    }

    if (Array.isArray(card.list)) {
      const itemThemes = [
        { bg: "bg-indigo-500/10", border: "border-indigo-500/30", text: "text-indigo-400" },
        { bg: "bg-emerald-500/10", border: "border-emerald-500/30", text: "text-emerald-400" },
        { bg: "bg-amber-500/10", border: "border-amber-500/30", text: "text-amber-400" },
        { bg: "bg-rose-500/10", border: "border-rose-500/30", text: "text-rose-400" },
        { bg: "bg-blue-500/10", border: "border-blue-500/30", text: "text-blue-400" },
      ];

      return (
        <article
          key={card.key}
          className="flex h-full w-full flex-col rounded-[2.5rem] bg-slate-800/50 backdrop-blur-xl p-7 border border-slate-700/50 shadow-2xl hover:bg-slate-800 transition-all duration-300"
        >
          <div className="flex items-center gap-4 mb-7">
            <div className={`p-3.5 rounded-2xl bg-${themeColor}-500/10 text-${themeColor}-400`}>
              <Icon className="w-6 h-6" />
            </div>
            <h3 className={`text-xl font-black tracking-tight text-white`}>
              {card.header}
            </h3>
          </div>

          <ul className="space-y-4">
            {card.list.map((item, index) => {
              const theme = itemThemes[index % itemThemes.length];
              const [name, rest] = item.split(":");
              let value = "";
              let percent = "";
              if (rest) {
                const match = rest.match(/([^(]+)\(([^)]+)\)/);
                if (match) {
                  value = match[1].trim();
                  percent = match[2].trim();
                } else {
                  value = rest.trim();
                }
              }
              return (
                <li key={index} className={`flex flex-col p-5 rounded-3xl ${theme.bg} border ${theme.border} hover:bg-slate-700/50 transition-all shadow-sm`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 truncate">
                      <span className={`text-[11px] font-black ${theme.text}`}>{String(index + 1).padStart(2, '0')}</span>
                      <span className="text-sm font-black text-slate-200 truncate tracking-tight">{name}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-sm font-black ${valueColor} tracking-tight`}>
                        {value}
                      </span>
                      {percent && (
                        <span className={`text-[11px] font-black px-2 py-0.5 rounded-md bg-white/10 ${theme.text}`}>
                          {percent}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </article>
      );
    }

    const isPositive = card.isPositive ?? true;
    const accentColor = isPositive ? "emerald" : "rose";

    return (
      <article
        key={card.key}
        className="group flex h-full w-full flex-col rounded-[2.5rem] bg-slate-800/50 backdrop-blur-xl p-8 border border-slate-700/50 shadow-2xl hover:bg-slate-800 transition-all duration-500"
      >
        <div className="flex justify-between items-start mb-10">
          <div className="space-y-1.5">
            <h3 className="text-2xl font-black text-white tracking-tight group-hover:text-indigo-400 transition-colors">
              {card.header}
            </h3>
            <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.25em]">Real-time Analytics</p>
          </div>
          <div className={`p-4 rounded-[1.5rem] bg-${accentColor}-500/10 text-${accentColor}-400 shadow-sm transition-transform group-hover:scale-110`}>
            {isPositive ? <ArrowUpRight className="w-7 h-7" /> : <ArrowDownRight className="w-7 h-7" />}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-700/30 rounded-[2rem] p-6 border border-slate-600/30 shadow-inner">
            <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.15em] block mb-2">
              {card.primaryLabel || "Market Value"}
            </span>
            <div className="text-4xl font-black text-white tracking-tighter">
              {card.primary ?? "—"}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 px-2">
            <div>
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.1em] block mb-1.5">
                {card.secondaryLabel || "Invested"}
              </span>
              <span className="text-lg font-black text-slate-200 tracking-tight">
                {card.secondary ?? "—"}
              </span>
            </div>
            <div className="text-right">
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.1em] block mb-1.5">
                {card.outcomeLabel || "Profit"}
              </span>
              <span className={`text-lg font-black tracking-tighter ${isPositive ? "text-emerald-400" : "text-rose-400"}`}>
                {card.outcomeValue ?? "—"}
                {card.outcomePercent && <span className="text-[11px] ml-1.5 opacity-90 font-black">({card.outcomePercent})</span>}
              </span>
            </div>
          </div>

          {card.metaLabel && (
            <div className="pt-5 border-t border-slate-700/40 flex justify-between items-center px-2">
              <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{card.metaLabel}</span>
              <span className="text-sm font-black text-indigo-400 tracking-tight bg-indigo-500/10 px-4 py-1.5 rounded-2xl shadow-sm">{card.metaValue ?? "—"}</span>
            </div>
          )}
        </div>
      </article>
    );
  };

  const renderMetricCard = (card) => {
    return (
      <article
        key={card.key}
        className="flex h-full flex-col rounded-xl border border-slate-700 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-900 p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-300">{card.header}</h3>
        <p className="mt-2 text-2xl font-bold text-indigo-400">{card.primary}</p>
        <p className="mt-2 text-sm text-slate-400">{card.secondary}</p>
        <p className="mt-auto text-xs text-slate-500">{card.meta}</p>
      </article>
    );
  };

  const renderCompactEquityCard = (card) => {
    const isPositive = card.isPositive ?? true;
    return (
      <article
        key={card.key}
        className="flex h-full flex-col rounded-xl border border-slate-700 bg-slate-800/50 p-4 shadow-sm transition hover:shadow-md focus-within:ring-2 focus-within:ring-indigo-900"
      >
        <div className="flex items-start justify-between">
          <div className="truncate text-lg font-bold text-slate-100 text-left">
            {card.header} {card.transactionCount ? `(${card.transactionCount})` : ""}
          </div>
          {card.accountType && (
            <div
              className={`text-xs font-semibold uppercase tracking-wide ${
                card.accountType === "FREE" ? "text-indigo-400" : "text-emerald-400"
              }`}
            >
              {card.accountType}
            </div>
          )}
        </div>

        <div className="mt-1 overflow-x-auto scrollbar-hide">
          <dl className="min-w-max flex gap-6 text-sm text-slate-400">
            <div className="text-left">
              <dt className="font-medium text-slate-500">MV</dt>
              <dd className="maskable-number font-semibold text-orange-400">
                {card.primary}
              </dd>
            </div>

            <div className="text-left">
              <dt className="font-medium text-slate-500">Invested</dt>
              <dd className="maskable-number font-semibold text-slate-200">
                {card.secondary}
              </dd>
            </div>

            <div className="text-left">
              <dt className="font-medium text-slate-500">P/L</dt>
              <dd className={`font-semibold ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
                {card.outcomeValue}
              </dd>
            </div>

            <div className="text-left">
              <dt className="font-medium text-slate-500">P/L %</dt>
              <dd className={`font-semibold ${isPositive ? "text-emerald-400" : "text-red-400"}`}>
                {card.outcomePercent}
              </dd>
            </div>

            <div className="text-left">
              <dt className="font-medium text-slate-500">XIRR</dt>
              <dd className="font-semibold text-indigo-400">
                {card.metaValue}
              </dd>
            </div>
          </dl>
        </div>
      </article>
    );
  };

  const renderCombinedValueCard = (card) => {
    const isPositive = card.isPositive ?? true;
    const accentColor = isPositive ? "emerald" : "rose";

    return (
      <article
        key={card.key}
        className="group flex h-full w-full flex-col rounded-[2.5rem] bg-slate-800/50 backdrop-blur-xl p-6 border border-slate-700/50 shadow-2xl hover:bg-slate-800 transition-all duration-500"
      >
        <div className="flex justify-between items-start mb-6">
          <div className="space-y-1">
            <h3 className="text-lg font-black text-white tracking-tight group-hover:text-indigo-400 transition-colors">
              {card.header}
            </h3>
          </div>
          <div className={`p-3 rounded-2xl bg-${accentColor}-500/10 text-${accentColor}-400 shadow-sm transition-transform group-hover:scale-110`}>
            <Briefcase className="w-5 h-5" />
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-slate-700/30 rounded-2xl p-4 border border-slate-600/30 shadow-inner">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] block mb-1">
              Market Value
            </span>
            <div className="text-2xl font-black text-white tracking-tighter">
              {formatCurrency(card.marketValue)}
            </div>
          </div>
          <div className="pt-2 flex justify-between items-center px-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Invested</span>
            <span className="text-sm font-black text-slate-200 tracking-tight">{formatCurrency(card.invested)}</span>
          </div>
        </div>
      </article>
    );
  };

  const renderCombinedProfitCard = (card) => {
    const isPositive = card.isPositive ?? true;
    const accentColor = isPositive ? "emerald" : "rose";

    return (
      <article
        key={card.key}
        className="group flex h-full w-full flex-col rounded-[2.5rem] bg-slate-800/50 backdrop-blur-xl p-6 border border-slate-700/50 shadow-2xl hover:bg-slate-800 transition-all duration-500"
      >
        <div className="flex justify-between items-start mb-6">
          <div className="space-y-1">
            <h3 className="text-lg font-black text-white tracking-tight group-hover:text-indigo-400 transition-colors">
              {card.header}
            </h3>
          </div>
          <div className={`p-3 rounded-2xl bg-${accentColor}-500/10 text-${accentColor}-400 shadow-sm transition-transform group-hover:scale-110`}>
            {isPositive ? <ArrowUpRight className="w-6 h-6" /> : <ArrowDownRight className="w-6 h-6" />}
          </div>
        </div>

        <div className="space-y-4">
          <div className={`bg-${accentColor}-500/10 rounded-2xl p-4 border border-${accentColor}-500/20 shadow-inner`}>
            <span className={`text-[10px] font-black text-${accentColor}-400 uppercase tracking-[0.15em] block mb-1`}>
              {isPositive ? "Combined Profit" : "Combined Loss"}
            </span>
            <div className={`text-2xl font-black text-${accentColor}-400 tracking-tighter`}>
              {formatCurrency(card.profit)}
            </div>
          </div>
          <div className="pt-2 flex justify-between items-center px-1">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Returns %</span>
            <span className={`text-sm font-black text-${accentColor}-400 tracking-tight`}>{formatPercent(card.percent)}</span>
          </div>
        </div>
      </article>
    );
  };

  const renderCard = (card, customBorderClass) => {
    if (card.type === "summary-values") {
      return renderCombinedValueCard(card);
    }
    if (card.type === "summary-profit") {
      return renderCombinedProfitCard(card);
    }

    switch (variant) {
      case "highlight":
        return renderCompactEquityCard(card);
      case "summary":
        return renderCompactEquityCard(card);
      case "structured":
        return renderSummaryCard(card);
      case "metric":
        return renderMetricCard(card);
      case "account":
      default:
        return renderAccountCard(card);
    }
  };

  return (
    <section className="space-y-6 sm:space-y-8">
      <header className="flex flex-col gap-6">
        {/* Modern App-like Icon Navigation - Fluid "Sliding Door" Scroll */}
        <div 
          ref={scrollRef}
          onMouseDown={handleMouseDown}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => {
            handleMouseLeave();
            setIsHovered(false);
          }}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="overflow-x-auto pb-4 scrollbar-hide -mx-2 px-2 touch-pan-x cursor-grab active:cursor-grabbing select-none"
        >
          <div className={`flex space-x-5 min-w-max ${isDragging ? "pointer-events-none" : ""}`}>
            {[...FILTER_OPTIONS, ...FILTER_OPTIONS].map((option, index) => {
              const Icon = option.icon;
              const isActive = selectedFilter === option.value;
              return (
                <button
                  key={`${option.value}-${index}`}
                  onClick={() => !isDragging && setSelectedFilter(option.value)}
                  className={`group flex flex-col items-center gap-3 p-4 rounded-[2rem] transition-all duration-500 min-w-[128px] ${
                    isActive
                      ? "bg-slate-800 shadow-2xl scale-105 ring-1 ring-slate-700"
                      : "bg-slate-800/40 backdrop-blur-md hover:bg-slate-800 hover:shadow-xl hover:scale-105 border border-slate-700/40"
                  }`}
                >
                  <div className={`p-4 rounded-2xl ${option.color} transition-transform duration-500 group-hover:rotate-6 ${isActive ? "shadow-lg scale-110" : "bg-opacity-90"}`}>
                    <Icon className={`w-6 h-6 ${isActive ? "text-white" : "text-white/90"}`} />
                  </div>
                  <span className={`text-[10px] font-black uppercase tracking-[0.15em] ${
                    isActive ? "text-indigo-400" : "text-slate-400"
                  }`}>
                    {option.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Sub-filters and Controls */}
        <div className="flex flex-col gap-3">
          {["topStocks", "todayGainers"].includes(selectedFilter) ? (
            <div className="flex flex-wrap items-center gap-2.5 bg-slate-800/50 backdrop-blur-sm p-2.5 rounded-2xl border border-slate-700/40">
              {topStocksTabControls}
            </div>
          ) : isProfitFilterActive ? (
            <div className="bg-slate-800/40 backdrop-blur-md p-5 rounded-3xl shadow-sm border border-slate-700/60">
              {profitFilterControls}
            </div>
          ) : (
            variant === "summary" && Array.isArray(subFilterOptions) && subFilterOptions.length > 0 && (
              <div className="flex flex-wrap items-center gap-2.5 bg-slate-800/50 backdrop-blur-sm p-2.5 rounded-2xl border border-slate-700/40">
                <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest ml-2 mr-2">Sort Criteria</span>
                {subFilterOptions.map((option) => {
                  const isActive = subFilter === option.value;
                  const isDescending = isActive && sortDirection === "desc";
                  return (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => handleSubFilterClick(option.value)}
                      className={`flex items-center gap-2 rounded-xl px-5 py-2 text-xs font-black transition-all duration-300 ${
                        isActive
                          ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200"
                          : "bg-slate-700/60 text-slate-400 hover:bg-slate-700 border border-transparent hover:border-slate-600"
                      }`}
                    >
                      {option.label}
                      {isActive && (
                        isDescending ? <ArrowDownRight className="w-3.5 h-3.5" /> : <ArrowUpRight className="w-3.5 h-3.5" />
                      )}
                    </button>
                  );
                })}
              </div>
            )
          )}
        </div>
      </header>

      <div className="space-y-6 sm:space-y-8">
        {variant === "accountName" ? (
          <AccountNameCards />
        ) : variant === "accountFullDetails" ? (
          <AccountFullDetailsCards />
        ) : displayedCards.length ? (
          variant === "summary" ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {displayedCards.map((card) => renderCard(card))}
            </div>
          ) : (
            <div className="space-y-10">
              {displayedCards.map((group) => {
                if (group.children) {
                  const isTopGainer = group.commonHeader === "Top 5 Gainers";
                  const isTopLoser = group.commonHeader === "Top 5 Losers";

                  const headerClass = `text-2xl font-black tracking-tight mb-4 flex items-center gap-3 ${
                    isTopGainer ? "text-emerald-400" : isTopLoser ? "text-rose-400" : "text-slate-100"
                  }`;

                  return (
                    <div key={group.key} className="space-y-2">
                      <h2 className={headerClass}>
                        <div className={`w-1.5 h-8 rounded-full ${isTopGainer ? "bg-emerald-500" : isTopLoser ? "bg-rose-500" : "bg-slate-700"}`} />
                        {group.commonHeader}
                      </h2>
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        {group.children.map((child) => (
                          <div key={child.key} className="space-y-4">
                            <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest ml-2">{child.header}</h3>
                            <div className="space-y-4">
                              {child.list.map((item, idx) => renderCard({ ...item, key: `${child.key}-${idx}` }))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }

                if (variant === "structured" && displayedCards.length >= 3 && group.key === "top-stocks-summary-values") {
                  // We handle summary cards and main card together when we encounter the first summary card
                  const summaryValues = group;
                  const summaryProfit = displayedCards.find(c => c.key === "top-stocks-summary-profit");
                  const mainCard = displayedCards.find(c => c.key === "top-stocks-main");
                  
                  if (summaryProfit && mainCard) {
                    return (
                      <div key="top-stocks-combined-group" className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                          {renderCard(summaryValues)}
                          {renderCard(summaryProfit)}
                        </div>
                        <div className="grid grid-cols-1 gap-4">
                          {renderCard(mainCard)}
                        </div>
                      </div>
                    );
                  }
                }

                // Skip individual rendering of cards already handled in the group above
                if (variant === "structured" && (group.key === "top-stocks-summary-profit" || group.key === "top-stocks-main")) {
                  return null;
                }

                return (
                  <div key={group.key} className="grid grid-cols-1 gap-4">
                    {renderCard(group)}
                  </div>
                );
              })}
            </div>
          )
        ) : (
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center border-2 border-dashed border-slate-800 rounded-3xl bg-slate-900/20">
            <div className="p-4 rounded-full bg-slate-800 shadow-sm mb-4">
              <Layers className="w-8 h-8 text-slate-600" />
            </div>
            <p className="text-slate-400 font-medium">Nothing to display for the selected view yet.</p>
            <p className="text-slate-500 text-xs mt-1">Try changing your filters or adding some transactions.</p>
          </div>
        )}
      </div>
    </section>
  );
};

export default DashboardCards;
