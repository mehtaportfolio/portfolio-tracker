import React, { useEffect, useState } from "react";
import { Plus, RefreshCw, X, Loader2, Zap } from "lucide-react";
import { useMFDataOptimized } from "../../../hooks/useMFDataOptimized.js";
import { API_URL } from "../../../config/apiConfig.js";

// 🔹 Import MF subpages
import MFPortfolio from "./MFPortfolio.jsx";
import MFHoldings from "./MFHoldings.jsx";
import MFClosedHoldings from "./MFClosedHoldings.jsx";
import MFExplore from "./MFExplore.jsx";
import MFSIP from "./MFSIP.jsx";
import MFLogs from "./MFLogs.jsx";
import MFForm from "../Forms/MFForm.jsx";
import SIPForm from "../Forms/SIPForm.jsx";

const MutualFunds = () => {
  const [activeTab, setActiveTab] = useState(() => {
    return sessionStorage.getItem("mf_active_tab") || "portfolio";
  });

  useEffect(() => {
    sessionStorage.setItem("mf_active_tab", activeTab);
  }, [activeTab]);

  const [showForm, setShowForm] = useState(false);
  const [showSipForm, setShowSipForm] = useState(false);
  const [editingSip, setEditingSip] = useState(null);
  const [isAnyFormOpen, setIsAnyFormOpen] = useState(false);
  const [mfRefreshToken, setMfRefreshToken] = useState(0);
  const [showNavModal, setShowNavModal] = useState(false);
  const [fetchDate, setFetchDate] = useState(new Date().toISOString().split('T')[0]);
  const [isFetchingNav, setIsFetchingNav] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [fetchSummary, setFetchSummary] = useState(null);

  // ✅ Fetch MF data from optimized backend hook
  const { 
    mfTxns, 
    fundMaster, 
    sipDetails,
    sipAccountAmounts,
    accountSummaries,
    loading, 
    error 
  } = useMFDataOptimized(mfRefreshToken);

  const handleFetchNav = async () => {
    setIsFetchingNav(true);
    setFetchSummary(null);
    try {
      const response = await fetch(`${API_URL}/fetch-nav-by-date`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date: fetchDate })
      });
      const data = await response.json();
      if (data.status === 'success') {
        setFetchSummary(data.summary);
        setMfRefreshToken(prev => prev + 1);
      } else {
        alert(`Error: ${data.message}`);
      }
    } catch (err) {
      console.error("Fetch NAV error:", err);
      alert("Failed to fetch NAV. Please check console.");
    } finally {
      setIsFetchingNav(false);
    }
  };

  const handleManualSync = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch(`${API_URL.replace('/api', '')}/api/amfi/trigger`);
      const data = await response.json();
      if (data.status === 'success') {
        alert("Manual Sync Triggered: " + data.message);
        setMfRefreshToken(prev => prev + 1);
      } else {
        alert("Sync Failed: " + data.message);
      }
    } catch (err) {
      console.error("Sync error:", err);
      alert("Failed to trigger sync.");
    } finally {
      setIsSyncing(false);
    }
  };

  // Cache invalidation listener
  useEffect(() => {
    const handleCacheInvalidation = (e) => {
      if (e.detail?.assetType === 'mf') {
        setMfRefreshToken(prev => prev + 1);
      }
    };
    window.addEventListener('portfolio-cache-invalidated', handleCacheInvalidation);
    return () => window.removeEventListener('portfolio-cache-invalidated', handleCacheInvalidation);
  }, []);

  // 🔹 Define tab keys + labels
  const tabs = ["portfolio", "holdings", "closed", "sip", "explore", "logs"];
  const tabLabels = {
    portfolio: "Portfolio",
    holdings: "Holdings",
    closed: "Closed", // ✅ New tab
    sip: "SIP Details",
    explore: "Explore Funds",
    logs: "Log",
  };

  return (
    <div className="w-full max-w-screen-xl mx-auto pt-2 sm:pt-1 sm:p-6 min-h-screen pb-24">
      {/* Tabs + Refresh */}
      <div className="flex flex-wrap items-center gap-2">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`shrink-0 px-2 py-1.5 sm:px-4 sm:py-2 text-sm sm:text-base border rounded-md transition-all duration-200 ${
              activeTab === tab
                ? "bg-purple-700 text-white border-purple-700 shadow-md"
                : "bg-white text-gray-700 border-gray-300 hover:bg-gray-100"
            }`}
          >
            {tabLabels[tab]}
          </button>
        ))}

        <button
          onClick={() => setShowNavModal(true)}
          className="p-2 bg-white border border-gray-300 rounded-md hover:bg-gray-100 transition-all text-purple-700 shadow-sm"
          title="Fetch NAV by Date"
        >
          <RefreshCw size={20} />
        </button>
      </div>

      {/* Loading/Error State */}
      {loading && (
        <div className="flex justify-center items-center py-12">
          <div className="text-gray-400">Loading MF data...</div>
        </div>
      )}

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          Error loading MF data: {error}
        </div>
      )}

      {/* Tab content */}
      {!loading && !error && (
        <>
          {activeTab === "portfolio" && (
            <MFPortfolio 
              txns={mfTxns} 
              funds={fundMaster} 
              sips={sipDetails}
              sipAccountAmounts={sipAccountAmounts}
              setIsAnyFormOpen={setIsAnyFormOpen} 
            />
          )}
          {activeTab === "holdings" && <MFHoldings txns={mfTxns} funds={fundMaster} setIsAnyFormOpen={setIsAnyFormOpen} />}
          {activeTab === "sip" && (
            <MFSIP
              sipDetails={sipDetails}
              fundMaster={fundMaster}
              accountSummaries={accountSummaries}
              onEditSip={(sip) => {
                setEditingSip(sip);
                setShowSipForm(true);
              }}
              onAddSip={() => setShowSipForm(true)}
              setIsAnyFormOpen={setIsAnyFormOpen}
            />
          )}
          {activeTab === "closed" && <MFClosedHoldings txns={mfTxns} funds={fundMaster} />}
          {activeTab === "explore" && <MFExplore funds={fundMaster} />}
          {activeTab === "logs" && <MFLogs />}
        </>
      )}

      {/* Floating + button */}
      {activeTab !== "explore" && !loading && (
        <button
          onClick={() => activeTab === "sip" ? setShowSipForm(true) : setShowForm(true)}
          className={`fixed z-[60] right-4 sm:right-6 bottom-[60px] sm:bottom-8 md:bottom-10 lg:bottom-[70px] xl:bottom-[80px]
            bg-purple-700 text-white rounded-full w-12 h-12 sm:w-16 sm:h-16 flex items-center justify-center
            shadow-lg hover:bg-purple-800 transition-opacity duration-300 ${(showForm || showSipForm || isAnyFormOpen) ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
        >
          <Plus size={28} className="sm:hidden" strokeWidth={3} />
          <Plus size={30} className="hidden sm:block" strokeWidth={3} />
        </button>
      )}

      {showForm && (
        <MFForm
          onClose={() => {
            setShowForm(false);
          }}
          onSuccess={() => {
            setShowForm(false);
          }}
        />
      )}

      {showSipForm && (
        <SIPForm
          editingSip={editingSip}
          onClose={() => {
            setShowSipForm(false);
            setEditingSip(null);
          }}
          onSuccess={() => {
            setShowSipForm(false);
            setEditingSip(null);
          }}
        />
      )}

      {/* NAV Fetch Modal */}
      {showNavModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <RefreshCw size={18} className="text-purple-600" />
                Fetch NAV by Date
              </h3>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleManualSync}
                  disabled={isSyncing}
                  title="Trigger Manual AMFI Sync"
                  className={`p-2 rounded-full transition-colors ${
                    isSyncing ? 'text-gray-400 cursor-not-allowed' : 'text-amber-500 hover:bg-amber-50 hover:text-amber-600'
                  }`}
                >
                  <Zap size={20} className={isSyncing ? 'animate-pulse' : ''} />
                </button>
                <button 
                  onClick={() => {
                    setShowNavModal(false);
                    setFetchSummary(null);
                  }}
                  className="text-gray-500 hover:text-gray-700 p-2 rounded-full hover:bg-gray-100 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
            
            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Date
              </label>
              <input
                type="date"
                value={fetchDate}
                onChange={(e) => setFetchDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 transition-all outline-none"
              />
              <p className="mt-2 text-xs text-gray-500">
                Fetches NAV from mfapi.in for the selected date or the nearest previous trading day.
              </p>

              {fetchSummary && (
                <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <h4 className="text-sm font-bold text-gray-800 mb-2">Fetch Summary:</h4>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-white p-2 rounded border border-gray-100">
                      <div className="text-xs text-gray-500">Total</div>
                      <div className="text-lg font-bold text-purple-700">{fetchSummary.total}</div>
                    </div>
                    <div className="bg-white p-2 rounded border border-gray-100">
                      <div className="text-xs text-gray-500">Success</div>
                      <div className="text-lg font-bold text-green-600">{fetchSummary.success}</div>
                    </div>
                    <div className="bg-white p-2 rounded border border-gray-100">
                      <div className="text-xs text-gray-500">Failed</div>
                      <div className="text-lg font-bold text-red-500">{fetchSummary.failed}</div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="p-4 border-t bg-gray-50 flex gap-3">
              <button
                onClick={() => {
                  setShowNavModal(false);
                  setFetchSummary(null);
                }}
                className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleFetchNav}
                disabled={isFetchingNav}
                className={`flex-[2] flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-700 rounded-lg hover:bg-purple-800 transition-all shadow-md active:scale-95 ${
                  isFetchingNav ? 'opacity-70 cursor-not-allowed' : ''
                }`}
              >
                {isFetchingNav ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Fetching...
                  </>
                ) : (
                  <>
                    <RefreshCw size={18} />
                    Fetch NAV
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default MutualFunds;
