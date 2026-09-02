// src/components/AssetList.js
import React, { useState, useEffect } from "react";
import { 
  FiTrendingUp, 
  FiPieChart, 
  FiBriefcase, 
  FiTarget, 
  FiShield, 
  FiCreditCard, 
  FiRefreshCw, 
  FiActivity 
} from "react-icons/fi";
import Stock from "./Assets/Stock/Stock.jsx";
import MF from "./Assets/MF/MF.jsx";
import Bank from "./Assets/Bank/Bank.jsx";
import EPF from "./Assets/EPF.jsx";
import PPF from "./Assets/PPF.jsx";
import NPS from "./Assets/NPS/NPS.jsx";
import Links from "./Assets/Links.jsx"; // ✅ Import Links component
import { useNavigation } from "../context/NavigationContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { BACKEND_URL } from "../config/apiConfig.js";
import BDM from "./Assets/BDM.jsx";


function AssetList() {
  const { assetType, setAssetType, navigateToTab } = useNavigation();
  const { session } = useAuth();
  const token = session?.access_token;
  const selectedType = assetType;
  const [lastUpdate, setLastUpdate] = useState(null);

  useEffect(() => {
    const fetchLastUpdate = async () => {
      if (!selectedType || !["stock", "mf", "nps"].includes(selectedType) || !token) {
        setLastUpdate(null);
        return;
      }

      try {
        const backendUrl = BACKEND_URL;
        const response = await fetch(`${backendUrl}/api/assets/latest-updates`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        
        if (!response.ok) throw new Error('Failed to fetch last update');
        
        const updates = await response.json();
        const updatedAt = updates[selectedType];

        if (updatedAt) {
          const latest = new Date(updatedAt);
          // Use UTC methods to extract values as they are in the DB string
          // since the DB values are already IST but stored with +00 offset
          const day = String(latest.getUTCDate()).padStart(2, '0');
          const month = String(latest.getUTCMonth() + 1).padStart(2, '0');
          const year = String(latest.getUTCFullYear()).slice(-2);
          const hours = String(latest.getUTCHours()).padStart(2, '0');
          const minutes = String(latest.getUTCMinutes()).padStart(2, '0');
          setLastUpdate(`${day}-${month}-${year}; ${hours}:${minutes}`);
        } else {
          setLastUpdate(null);
        }
      } catch (err) {
        console.error("Error fetching last update:", err);
        setLastUpdate(null);
      }
    };

    fetchLastUpdate();
  }, [selectedType, token]);

  const assetTypes = [
    { key: "stock", label: "Equity", headerLabel: "Equity Market", description: "Stocks & ETFs", icon: FiTrendingUp, color: "from-blue-500/20 to-indigo-600/20", iconColor: "text-blue-400" },
    { key: "mf", label: "MF", headerLabel: "Mutual Funds", description: "Mutual Funds", icon: FiPieChart, color: "from-red-500/20 to-orange-600/20", iconColor: "text-red-400" },
    { key: "epf", label: "EPF", headerLabel: "Employee Provident Fund", description: "Employee PF", icon: FiBriefcase, color: "from-purple-500/20 to-pink-600/20", iconColor: "text-purple-400" },    
    { key: "nps", label: "NPS", headerLabel: "National Pension Scheme", description: "NPS", icon: FiTarget, color: "from-cyan-600/20 to-cyan-400/20", iconColor: "text-cyan-400" },
    { key: "ppf", label: "Deposit", headerLabel: "PPF & Fixed Deposits", description: "PPF + FD", icon: FiShield, color: "from-yellow-500/20 to-red-600/20", iconColor: "text-yellow-400" },
    { key: "bank", label: "Bank", headerLabel: "Bank Accounts", description: "Accounts", icon: FiCreditCard, color: "from-green-500/20 to-teal-600/20", iconColor: "text-green-400" },
    { key: "links", label: "Refresh", headerLabel: "Links for Refresh Data", description: "Links", icon: FiRefreshCw, color: "from-gray-500/20 to-slate-600/20", iconColor: "text-gray-400" },
    { key: "bdm", label: "BDM", headerLabel: "BDM Transactions", description: "Transactions", icon: FiActivity, color: "from-red-800/20 to-red-600/20", iconColor: "text-red-500" },
  ];

  const handleAssetTypeSelect = (type) => {
    setAssetType(type);
  };

  const renderContent = () => {
    switch (selectedType) {
      case "stock":
        return <Stock />;
      case "mf":
        return <MF />;
      case "bank":
        return <Bank />;
      case "epf":
        return <EPF />;
      case "ppf":
        return <PPF />;
      case "nps":
        return <NPS />;
      case "links":
        return <Links />;
      case "bdm":
        return <BDM />;
      default:
        return <Stock />;
    }
  };

  if (selectedType === null) {
    // Show asset type selection list
    return (
      <div className="flex flex-col h-full p-4 sm:p-8 max-w-7xl mx-auto w-full">
        <h2 className="text-3xl font-bold mb-10 text-white text-center tracking-tight">
          Portfolio <span className="text-gray-500">Assets</span>
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
          {assetTypes.map((type) => (
            <button
              key={type.key}
              onClick={() => handleAssetTypeSelect(type.key)}
              className={`group relative flex flex-col items-center justify-between p-6 rounded-[2rem] bg-gradient-to-br ${type.color} backdrop-blur-md border border-white/5 shadow-xl transition-all duration-300 hover:scale-[1.03] active:scale-95 overflow-hidden`}
            >
              {/* Background Glow */}
              <div className={`absolute inset-0 bg-gradient-to-br ${type.color} opacity-0 group-hover:opacity-40 transition-opacity duration-500`} />
              
              <div className={`p-4 rounded-2xl bg-gray-900/50 shadow-inner ${type.iconColor} mb-4 group-hover:scale-110 transition-transform duration-300`}>
                <type.icon size={28} />
              </div>
              
              <div className="text-center z-10">
                <h3 className="text-lg font-semibold text-white mb-1 group-hover:tracking-wide transition-all duration-300">
                  {type.label}
                </h3>
                <p className="text-xs text-gray-400 font-medium">
                  {type.description}
                </p>
              </div>

              {/* iOS Style Inner Ring */}
              <div className="absolute inset-0 rounded-[2rem] border border-white/10 pointer-events-none" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  const selectedAsset = assetTypes.find(t => t.key === selectedType);

 return (
  <div className="flex flex-col h-full">
    {/* Header */}
    <div
      className="bg-gray-900/50 backdrop-blur-lg border-b border-white/10 px-4 py-2 cursor-pointer sticky top-0 z-30 transition-all duration-300"
      onClick={() => navigateToTab("dashboard", "Portfolio")}
    >
      <div className="w-full max-w-7xl mx-auto grid grid-cols-1 sm:grid-cols-3 items-center gap-1">
        <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight justify-self-center sm:col-start-2 text-center">
          {selectedAsset.headerLabel}
        </h2>
        {lastUpdate && (
          <span className="text-[12px] sm:text-xs font-medium text-white/90 whitespace-nowrap justify-self-end">
            ({lastUpdate})
          </span>
        )}
      </div>
    </div>

    {/* Content */}
    <div className="p-4 sm:p-6 max-w-7xl mx-auto w-full">
      {renderContent()}
    </div>
  </div>
);

}

export default AssetList;
