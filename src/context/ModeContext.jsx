import React, { createContext, useContext, useState, useEffect } from "react";
import { useAuth } from "./AuthContext.jsx";

const ModeContext = createContext();

export const ModeProvider = ({ children }) => {
  const { user } = useAuth();
  const [mode, setMode] = useState(null); // "trial" or "data"
  const [priceSource, setPriceSource] = useState('live'); // "stock_master", "stock_mapping", or "live"
  const [indexSource, setIndexSource] = useState('market_indices'); // "market_indices" or "stock_master"
  const [priceLoading, setPriceLoading] = useState(false);
  const [passwordAttempts, setPasswordAttempts] = useState(0);
  const [showModeDropdown, setShowModeDropdown] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isPasswordVerified, setIsPasswordVerified] = useState(false);
  const [isHomeActive, setIsHomeActive] = useState(true);

  const userKey = user?.email?.toLowerCase();

  useEffect(() => {
    if (!userKey) {
      setLoading(false);
      return;
    }

    setMode("trial"); // Always start in trial mode on app open as requested
    setPasswordAttempts(0);
    setIsPasswordVerified(true);
    setIsHomeActive(false); // Start on Dashboard/Assets in trial mode
    setShowModeDropdown(false);
    setLoading(false);
  }, [userKey]);

  const selectMode = (selectedMode) => {
    if (selectedMode === "trial" || selectedMode === "data") {
      setMode(selectedMode);
      localStorage.setItem(`app_mode_${userKey}`, selectedMode);
      setShowModeDropdown(false);
      setPasswordAttempts(0);
      setIsPasswordVerified(selectedMode === "trial");
      setIsHomeActive(false); // Default to Dashboard/Assets for both modes initially
    }
  };

  const switchMode = (newMode) => {
    if (newMode === "trial" || newMode === "data") {
      setMode(newMode);
      localStorage.setItem(`app_mode_${userKey}`, newMode);
      setShowModeDropdown(false);
      setPasswordAttempts(0);
      setIsPasswordVerified(newMode === "trial");
      setIsHomeActive(false); // Default to Dashboard/Assets for both modes initially
    }
  };

  const toggleModeDropdown = () => {
    setShowModeDropdown(!showModeDropdown);
  };

  const incrementPasswordAttempts = () => {
    setPasswordAttempts((prev) => prev + 1);
  };

  const resetPasswordAttempts = () => {
    setPasswordAttempts(0);
  };

  const verifyPassword = () => {
    setIsPasswordVerified(true);
    setIsHomeActive(true); // Default to Home page after master password verification as requested
  };

  const selectPriceSource = (source) => {
    if (source === 'stock_master' || source === 'stock_mapping' || source === 'live') {
      setPriceLoading(true);
      setPriceSource(source);
      setTimeout(() => {
        setPriceLoading(false);
      }, 2500);
    }
  };

  const togglePriceSource = () => {
    setPriceLoading(true);
    setPriceSource(prev => {
      let newValue;
      if (prev === 'stock_master') newValue = 'stock_mapping';
      else if (prev === 'stock_mapping') newValue = 'live';
      else newValue = 'stock_master';
      
      console.log(`[ModeContext] Toggling priceSource: "${prev}" -> "${newValue}"`);
      return newValue;
    });
    
    // Explicit 2.5s delay for loading indication as requested
    setTimeout(() => {
      setPriceLoading(false);
    }, 2500);
  };

  const toggleIndexSource = () => {
    setIndexSource(prev => {
      const newValue = prev === 'market_indices' ? 'stock_master' : 'market_indices';
      console.log(`[ModeContext] Toggling indexSource: "${prev}" -> "${newValue}"`);
      return newValue;
    });
  };

  return (
    <ModeContext.Provider
      value={{
        mode,
        priceSource,
        indexSource,
        priceLoading,
        passwordAttempts,
        showModeDropdown,
        selectMode,
        switchMode,
        selectPriceSource,
        togglePriceSource,
        toggleIndexSource,
        toggleModeDropdown,
        incrementPasswordAttempts,
        resetPasswordAttempts,
        loading,
        isPasswordVerified,
        verifyPassword,
        isHomeActive,
        setIsHomeActive,
      }}
    >
      {children}
    </ModeContext.Provider>
  );
};

export const useMode = () => {
  const context = useContext(ModeContext);
  if (!context) {
    throw new Error("useMode must be used within a ModeProvider");
  }
  return context;
};
