import React, { useEffect, useState } from "react";
import Dashboard from "./components/Dashboard/Dashboard.jsx";
import AssetList from "./components/AssetList.jsx";
import Analysis from "./components/Analysis/Analysis.jsx";
import Profile from "./components/Profile.jsx";
import OrderEntry from "./components/OrderEntry.jsx";
import GlobalPrivacyMask from "./GlobalPrivacyMask.jsx";
import PriceSourceToggle from "./components/Auth/PriceSourceToggle.jsx";
import IndexSourceToggle from "./components/Auth/IndexSourceToggle.jsx";
import { Toaster } from "react-hot-toast";
import { useNavigation } from "./context/NavigationContext.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import { useMode } from "./context/ModeContext.jsx";
import BiometricGate from "./components/Auth/BiometricGate.jsx";
import ResetPasswordScreen from "./components/Auth/ResetPasswordScreen.jsx";
import PasswordVerificationModal from "./components/Auth/PasswordVerificationModal.jsx";
import BackgroundDividendService from "./components/BackgroundDividendService.jsx";
import BottomBar from "./components/BottomBar.jsx";
import MarketTicker from "./components/Assets/Stock/MarketTicker.jsx";
import Home from "./components/Home.jsx";
import { FiHome } from "react-icons/fi";

function AppShell() {
  const { activeTab, assetsRefresh } = useNavigation();
  const { user, loading, isLocked } = useAuth();
  const { mode, loading: modeLoading, priceLoading, isPasswordVerified, isHomeActive, setIsHomeActive } = useMode();
  const [showResetScreen, setShowResetScreen] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const type = params.get("type");
    const tokenHash = params.get("token_hash");

    if (type === "recovery" && tokenHash) {
      setShowResetScreen(true);
    }
  }, []);

  if (loading || modeLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <span className="text-gray-500">Checking credentials...</span>
      </div>
    );
  }

  if (showResetScreen) {
    return <ResetPasswordScreen onClose={() => setShowResetScreen(false)} />;
  }

  if (!user || isLocked) {
    return <BiometricGate />;
  }

  if (mode === "data" && !isPasswordVerified) {
    return <PasswordVerificationModal />;
  }
	
  return (
    <div className="relative min-h-screen font-sans bg-gray-900">
      <Toaster position="top-right" reverseOrder={false} />
      <BackgroundDividendService />

      {priceLoading && (
        <div className="fixed inset-0 bg-gray-900/80 backdrop-blur-sm z-[100] flex flex-col items-center justify-center transition-all duration-500">
          <div className="relative">
            <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin-slow"></div>
            </div>
          </div>
          <p className="mt-4 text-gray-300 font-medium animate-pulse tracking-wider text-sm uppercase">Fetching live prices...</p>
        </div>
      )}

      <div className="fixed top-0 left-0 right-0 bg-gray-900 border-b border-gray-700 z-40">
        <MarketTicker />
        <div className="max-w-7xl mx-auto flex items-center justify-between p-3 px-4">
          <div className="flex items-center gap-2">
            {mode !== "trial" && (
              <button
                onClick={() => setIsHomeActive(!isHomeActive)}
                className={`p-1.5 rounded-md transition-all duration-300 ${
                  isHomeActive 
                    ? "bg-white text-gray-900 shadow-lg scale-110" 
                    : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
                }`}
                title="Home"
              >
                <FiHome size={20} />
              </button>
            )}
            <PriceSourceToggle />
            <IndexSourceToggle />
          </div>
          <GlobalPrivacyMask />
        </div>
      </div>

      <div className="pb-20 pt-24 sm:pt-20">
        {isHomeActive ? (
          <Home />
        ) : (
          <>
            <div style={{ display: activeTab === "dashboard" ? "block" : "none" }}>
              <Dashboard />
            </div>
            <div style={{ display: activeTab === "assets" ? "block" : "none" }}>
              <AssetList key={assetsRefresh} />
            </div>
            <div style={{ display: activeTab === "analysis" ? "block" : "none" }}>
              <Analysis />
            </div>
            <div style={{ display: activeTab === "order-entry" ? "block" : "none" }}>
              <OrderEntry />
            </div>
            <div style={{ display: activeTab === "profile" ? "block" : "none" }}>
              <Profile />
            </div>
          </>
        )}
      </div>

      <BottomBar />
    </div>
  );
}

function App() {
  useEffect(() => {
    console.log("ENV:", import.meta.env.VITE_BACKEND_URL || import.meta.env.VITE_API_URL);
  }, []);

  return <AppShell />;
}

export default App;
