import React, { useState, useEffect } from "react";
import { stockAPI } from "../../../api/stockAPI.js";
import { BACKEND_URL } from "../../../config/apiConfig.js";
import { RefreshCw, Key, AlertCircle, ShoppingCart } from "lucide-react";
import SellModal from "./SellModal.jsx";

const EPIcon = () => {
  const [statuses, setStatuses] = useState({
    PM: false,
    PDM: false,
    PSM: false,
  });
  const [angelOneStatus, setAngelOneStatus] = useState("idle"); // idle, checking, online, offline
  const [showSellModal, setShowSellModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [selectedBroker, setSelectedBroker] = useState(null);
  const [brokerName, setBrokerName] = useState(null);
  const [equityType, setEquityType] = useState(null);
  const [currentZerodhaAccount, setCurrentZerodhaAccount] = useState("PSM");
  const [isAutomating, setIsAutomating] = useState(false);

  const fetchTokenStatuses = async () => {
    try {
      const result = await stockAPI.getZerodhaTokenStatus();
      setStatuses(result);
    } catch (err) {
      console.error("Error fetching token statuses:", err);
    }
  };

  useEffect(() => {
    fetchTokenStatuses();
  }, []);

  const handleLogin = (account) => {
    const loginUrl = `${BACKEND_URL}/api/zerodha/login?account=${account}`;
    
    const width = 600;
    const height = 700;
    const left = window.screen.width / 2 - width / 2;
    const top = window.screen.height / 2 - height / 2;
    
    const win = window.open(
      loginUrl, 
      `ZerodhaLogin_${account}`, 
      `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
    );

    const timer = setInterval(() => {
      if (win.closed) {
        clearInterval(timer);
        fetchTokenStatuses();
      }
    }, 1000);
  };

  const handleAutomateLogin = async (account) => {
    setIsAutomating(true);
    try {
      const data = await stockAPI.automateZerodhaLogin(account);
      alert(data.message || "Automated login successful!");
      fetchTokenStatuses();
    } catch (err) {
      console.error("Automation error:", err);
      alert(err.message || "Error during automated login.");
    } finally {
      setIsAutomating(false);
    }
  };

  const onLoginClick = (account) => {
    const choice = window.confirm("Zerodha Login:\n\nClick 'OK' for Automated Login\nClick 'Cancel' for Manual Login");
    if (choice) {
      handleAutomateLogin(account);
    } else {
      handleLogin(account);
    }
  };

  const handleSync = async (account) => {
    try {
      const data = await stockAPI.syncZerodhaTrades(account);
      alert(data.message || `Successfully synced trades for ${account}`);
    } catch (err) {
      console.error("Sync error:", err);
      alert(err.message || "Error syncing trades. Check console for details.");
    }
  };

  const handleAngelOneHealth = async () => {
    setAngelOneStatus("checking");
    try {
      const data = await stockAPI.checkAngelOneHealth();
      setAngelOneStatus("online");
      alert(data.message || "Angel One server is healthy and online!");
    } catch (err) {
      console.error("Angel One health check error:", err);
      setAngelOneStatus("offline");
      alert(err.message || "Error checking Angel One server health via proxy.");
    }
  };

  const handleAngelOneSync = async () => {
    try {
      const data = await stockAPI.syncAngelOneTrades();
      alert(data.message || "Successfully synced Angel One trades");
    } catch (err) {
      console.error("Angel One sync error:", err);
      alert(err.message || "Error syncing Angel One trades. Check console for details.");
    }
  };

  const openSellModal = (account, broker, bName, type = null) => {
    setSelectedAccount(account);
    setSelectedBroker(broker);
    setBrokerName(bName);
    setEquityType(type);
    setShowSellModal(true);
  };

  return (
    <div className="flex flex-col gap-5 p-2 bg-transparent">
      {showSellModal && (
        <SellModal 
          onClose={() => setShowSellModal(false)} 
          accountName={selectedAccount} 
          broker={selectedBroker} 
          brokerName={brokerName}
          equityType={equityType}
        />
      )}
      <div className="grid grid-cols-1 gap-4">
        {/* Zerodha Section */}
        <div className="group flex flex-col bg-[#262626] border border-[#3d3d3d] p-5 rounded-[1.5rem] shadow-sm hover:border-blue-500/30 transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full shadow-lg ${statuses[currentZerodhaAccount] ? "bg-emerald-500 shadow-emerald-500/20" : "bg-rose-500 shadow-rose-500/20"}`} />
              <div className="flex items-center gap-3">
                <span className="text-lg font-bold text-white tracking-tight">Zerodha</span>
                <select 
                  value={currentZerodhaAccount}
                  onChange={(e) => setCurrentZerodhaAccount(e.target.value)}
                  className="bg-[#1c1c1c] border border-[#3d3d3d] rounded-lg px-3 py-1.5 text-xs text-gray-300 font-semibold focus:outline-none focus:border-red-500/50 cursor-pointer hover:bg-[#252525] transition-all"
                >
                  <option value="PM" className="bg-[#262626]">PM</option>
                  <option value="PDM" className="bg-[#262626]">PDM</option>
                  <option value="PSM" className="bg-[#262626]">PSM</option>
                </select>
              </div>
            </div>
            {statuses[currentZerodhaAccount] ? (
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-500 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
                Live
              </span>
            ) : (
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-500 bg-rose-500/10 px-2.5 py-1 rounded-full border border-rose-500/20">
                Expired
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={() => onLoginClick(currentZerodhaAccount)}
              disabled={isAutomating}
              className={`flex flex-col items-center justify-center gap-1 py-3 rounded-2xl text-[10px] font-semibold transition-all active:scale-95 border ${
                isAutomating ? "bg-[#1c1c1c] text-orange-400 border-orange-500/30 animate-pulse" :
                statuses[currentZerodhaAccount] 
                  ? "bg-emerald-600/20 text-emerald-500 border-emerald-500/30 hover:bg-emerald-600/30" 
                  : "bg-[#1c1c1c] text-white border-[#3d3d3d] hover:bg-[#333333] group-hover:bg-[#333333]"
              }`}
            >
              {isAutomating ? (
                <RefreshCw size={14} className="animate-spin" />
              ) : (
                <Key size={14} className={statuses[currentZerodhaAccount] ? "text-emerald-500" : "text-gray-400"} />
              )}
              {isAutomating ? "Fetching..." : (statuses[currentZerodhaAccount] ? "Authenticated" : "Login")}
            </button>
            <button
              onClick={() => handleSync(currentZerodhaAccount)}
              disabled={!statuses[currentZerodhaAccount]}
              className={`flex flex-col items-center justify-center gap-1 py-3 rounded-2xl text-[10px] font-semibold transition-all active:scale-95 ${
                statuses[currentZerodhaAccount] 
                  ? "bg-blue-600 text-white hover:bg-blue-700 shadow-lg shadow-blue-900/20" 
                  : "bg-[#1c1c1c] text-gray-500 cursor-not-allowed border border-[#3d3d3d]"
              }`}
            >
              <RefreshCw size={14} className={statuses[currentZerodhaAccount] ? "animate-spin-slow" : "text-gray-600"} />
              Sync
            </button>
            <button
              onClick={() => openSellModal(currentZerodhaAccount, "Zerodha", "zerodha")}
              disabled={!statuses[currentZerodhaAccount]}
              className={`flex flex-col items-center justify-center gap-1 py-3 rounded-2xl text-[10px] font-semibold transition-all active:scale-95 ${
                statuses[currentZerodhaAccount] 
                  ? "bg-[#1c1c1c] text-white hover:bg-[#333333] border border-[#3d3d3d]" 
                  : "bg-[#1c1c1c] text-gray-500 cursor-not-allowed border border-[#3d3d3d]"
              }`}
            >
              <ShoppingCart size={14} className={statuses[currentZerodhaAccount] ? "text-orange-500" : "text-gray-600"} />
              Sell
            </button>
          </div>
        </div>

        {/* Angel One Section */}
        <div className="group flex flex-col bg-[#262626] border border-[#3d3d3d] p-5 rounded-[1.5rem] shadow-sm hover:border-orange-500/30 transition-all duration-300">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full shadow-lg ${
                angelOneStatus === "online" ? "bg-emerald-500 shadow-emerald-500/20" : 
                angelOneStatus === "offline" ? "bg-rose-500 shadow-rose-500/20" :
                "bg-orange-500 shadow-orange-500/20"
              }`} />
              <span className="text-lg font-bold text-white tracking-tight">Angel One</span>
            </div>
            <div className="flex items-center gap-2">
              {angelOneStatus === "checking" && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-orange-400 animate-pulse">
                  Checking...
                </span>
              )}
              <span className="text-[10px] font-bold uppercase tracking-wider text-orange-500 bg-orange-500/10 px-2.5 py-1 rounded-full border border-orange-500/20">
                Direct Sync
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={handleAngelOneHealth}
              disabled={angelOneStatus === "checking"}
              className="flex flex-col items-center justify-center gap-1 py-3 rounded-2xl bg-[#1c1c1c] text-white text-[10px] font-semibold hover:bg-[#333333] border border-[#3d3d3d] transition-all active:scale-95 group-hover:bg-[#333333]"
            >
              <AlertCircle size={14} className={
                angelOneStatus === "online" ? "text-emerald-500" : 
                angelOneStatus === "offline" ? "text-rose-500" : 
                "text-gray-400"
              } />
              Health
            </button>
            <button
              onClick={handleAngelOneSync}
              className="flex flex-col items-center justify-center gap-1 py-3 rounded-2xl bg-orange-600 text-white text-[10px] font-semibold hover:bg-orange-700 shadow-lg shadow-orange-900/20 transition-all active:scale-95"
            >
              <RefreshCw size={14} className={angelOneStatus === "checking" ? "animate-spin" : ""} />
              Sync
            </button>
            <button
              onClick={() => openSellModal("PM", "Angel", "angel", ["etf", "stocks"])}
              className="flex flex-col items-center justify-center gap-1 py-3 rounded-2xl bg-[#1c1c1c] text-white text-[10px] font-semibold hover:bg-[#333333] border border-[#3d3d3d] transition-all active:scale-95"
            >
              <ShoppingCart size={14} className="text-orange-500" />
              Sell
            </button>
          </div>
        </div>
      </div>
      
      <div className="flex items-start gap-3 px-3 py-4 bg-blue-500/5 rounded-2xl border border-blue-500/10">
        <AlertCircle size={16} className="text-blue-400 mt-0.5 flex-shrink-0" />
        <p className="text-[11px] leading-relaxed text-gray-400">
          logins are automated. Active tokens are marked with green indicators and expire at midnight.
        </p>
      </div>
    </div>
  );
};

export default EPIcon;
