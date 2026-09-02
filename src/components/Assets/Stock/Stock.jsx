import React, { useCallback, useEffect, useState } from "react";
import { stockAPI } from "../../../api/stockAPI.js";
import Portfolio from "./Portfolio.jsx";
import Holdings from "./Holdings.jsx";
import ETF from "./ETF.jsx";
import Closed from "./Closed.jsx";
import Watchlists from "./Watchlists.jsx";
import DDTab from "./DDTab.jsx";
import StockForm from "../Forms/StockForm.jsx";
import StockTradingViewLink from "./StockTradingViewLink.jsx";
import { Plus} from "lucide-react";
import { EquityVisibilityProvider } from "../../../context/EquityVisibility.jsx";
import { useNavigation } from "../../../context/NavigationContext.jsx";
import BonusSplit from "./BonusSplit.jsx";
import StockMaster from "./Stock_Master.jsx";
import StockMap from "./StockMap.jsx";	

const Stock = () => {
  const { initialSubTab, setInitialSubTab, refreshDashboard, refreshAssets } = useNavigation();
  const [activeTab, setActiveTab] = useState(initialSubTab || "portfolio");

  useEffect(() => {
    if (initialSubTab) {
      setActiveTab(initialSubTab);
      setInitialSubTab(null);
    }
  }, [initialSubTab, setInitialSubTab]);
  const [stockMaster, setStockMaster] = useState([]);
  const [showForm, setShowForm] = useState(false);

  const fetchStockMaster = useCallback(async () => {
    try {
      const data = await stockAPI.fetchStockMaster();
      setStockMaster(data || []);
    } catch (error) {
      console.error("Error fetching stock master:", error);
    }
  }, []);

  useEffect(() => {
    fetchStockMaster();
  }, [fetchStockMaster]);

  // 🔹 Define tab keys + labels
  const tabs = ["portfolio", "stock", "etf", "closed", "DD", "chart", "watchlists", "bonus_split", "stock_master", "stock_map"];
  const tabLabels = {
    portfolio: "Portfolio",
    stock: "Stock",
    watchlists: "Watchlists",
    etf: "ETF",
    closed: "Closed",
    DD: "DD",
    chart: "Price Chart",
    bonus_split: "Bonus/Split",
    stock_master: "Stock Master",
    stock_map: "Stock Map",
  };

  return (
    <EquityVisibilityProvider>
      <div className="px-0 sm:px-2 pt-2 pb-2">
        {/* Tabs + Refresh */}
        <div className="flex flex-wrap items-center gap-2">
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-2 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base border rounded-md transition-all duration-200 ${
                activeTab === tab
                  ? "bg-blue-600 text-white border-black shadow-md"
                  : "bg-white text-gray-700 border-black hover:bg-gray-100"
              }`}
            >
              {tabLabels[tab]}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="mt-3">
          {activeTab === "portfolio" && <Portfolio />}
          {activeTab === "stock" && (
            <Holdings />
          )}
          
          {activeTab === "etf" && <ETF />}
          {activeTab === "closed" && <Closed />}
          {activeTab === "DD" && <DDTab />}
          {activeTab === "chart" && <StockTradingViewLink />}
          {activeTab === "watchlists" && (
            <Watchlists stockMaster={stockMaster} />
          )}
          {activeTab === "bonus_split" && <BonusSplit />}
          {activeTab === "stock_master" && <StockMaster />}
          {activeTab === "stock_map" && <StockMap />}
        </div>

        {/* Floating + button (hidden on DD tab) */}
        {activeTab !== "DD" && (
  showForm ? (
    <StockForm
      onClose={() => setShowForm(false)}
      onSuccess={() => {
        refreshDashboard();
        refreshAssets();
      }}
    />
  ) : (
    <button
      onClick={() => setShowForm(true)}
      className="fixed z-[60] right-3 bottom-16 sm:right-6 sm:bottom-10 
                 bg-blue-700 text-white rounded-full w-12 h-12 sm:w-16 sm:h-16 
                 flex items-center justify-center shadow-lg hover:bg-blue-800"
    >
      <Plus size={24} strokeWidth={3} className="sm:size-7" />
    </button>
  )
)}

      </div>
    </EquityVisibilityProvider>
  );
};

export default Stock;
