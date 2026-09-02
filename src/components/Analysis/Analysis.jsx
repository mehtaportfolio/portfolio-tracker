import { useState } from "react";
import DashboardTab from "./Dashboard.jsx";
import SummaryTab from "./summary.jsx";
import FreeStockTab from "./freestock.jsx";
import { 
  LayoutDashboard, 
  PieChart,
  TrendingUp
} from "lucide-react";

const TAB_CONFIG = [
  { id: "Dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "Stocks", label: "Free Stocks", icon: TrendingUp },
  { id: "Summary", label: "Summary", icon: PieChart },
];

export default function Analysis() {
  const [activeTab, setActiveTab] = useState(TAB_CONFIG[0].id);

  const renderActiveContent = () => {
    switch(activeTab) {
      case "Dashboard": return <DashboardTab />;
      case "Stocks": return <FreeStockTab />;
      case "Summary": return <SummaryTab />;
      default: return null;
    }
  };

  const isDarkMode = ["Dashboard", "Stocks", "Summary"].includes(activeTab);

  return (
    <div className={`p-4 sm:p-2 max-w-7xl mt-2 mx-auto w-full min-h-screen rounded-3xl transition-all duration-500 
      ${isDarkMode ? "bg-[#1e293b] border border-slate-700/50" : "bg-slate-50/30"}`}>
      <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-8 gap-4 px-2">
        <div>
          <h1 className="text-4xl font-black text-yellow-500 mb-2">
            Analysis
          </h1>
          <p className={`font-medium transition-colors duration-500 ${isDarkMode ? "text-slate-300" : "text-slate-800"}`}>Insights & Performance Overview</p>
        </div>
        
        <div className={`grid grid-cols-3 w-full backdrop-blur-sm p-1 rounded-2xl shadow-sm border transition-all duration-500 
          ${isDarkMode ? "bg-slate-800/50 border-slate-700" : "bg-white/50 border-slate-100"}`}>
          {TAB_CONFIG.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                className={`flex flex-col sm:flex-row items-center justify-center gap-1 sm:gap-2 px-1 sm:px-4 py-2 font-bold rounded-xl transition-all duration-300
                  ${
                    isActive
                      ? "bg-indigo-600 text-white shadow-lg shadow-indigo-200"
                      : isDarkMode
                        ? "text-slate-400 hover:text-indigo-400 hover:bg-slate-800/50"
                        : "text-slate-800 hover:text-indigo-600 hover:bg-white"
                  }`}
                onClick={() => setActiveTab(tab.id)}
              >
                <Icon className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${isActive ? "animate-pulse" : ""}`} />
                <span className="text-[11px] sm:text-xs uppercase whitespace-nowrap">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="bg-transparent">
        {renderActiveContent()}
      </div>
    </div>
  );
}