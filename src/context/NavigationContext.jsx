// src/context/NavigationContext.js
import React, { createContext, useContext, useState } from "react";
import { useMode } from "./ModeContext.jsx";

const NavigationContext = createContext();

export const NavigationProvider = ({ children }) => {
  const { isHomeActive, setIsHomeActive } = useMode();
  const [activeTab, setActiveTab] = useState("dashboard");
  const [assetType, setAssetType] = useState(null);
  const [initialSubTab, setInitialSubTab] = useState(null);
  const [profileSubTab, setProfileSubTab] = useState(null);
  const [profileSection, setProfileSection] = useState(null);
  const [assetsRefresh, setAssetsRefresh] = useState(false);
  const [dashboardRefresh, setDashboardRefresh] = useState(false);
  const [isBottomBarHidden, setIsBottomBarHidden] = useState(false);

  const navigateToAsset = (type, subTab = null) => {
    setActiveTab("assets");
    setIsHomeActive(false);
    setAssetType(type);
    setInitialSubTab(subTab);
  };

  const navigateToTab = (tab, subTab = null, section = null) => {
    setActiveTab(tab);
    setIsHomeActive(false);
    if (tab === "profile") {
      setProfileSubTab(subTab);
      setProfileSection(section);
    } else {
      if (tab !== "assets") {
        setAssetType(null);
      }
      setInitialSubTab(subTab);
    }
  };

  const refreshAssets = () => {
    setAssetsRefresh(!assetsRefresh);
  };

  const refreshDashboard = () => {
    setDashboardRefresh(!dashboardRefresh);
  };

  return (
    <NavigationContext.Provider
      value={{
        activeTab,
        setActiveTab,
        assetType,
        setAssetType,
        initialSubTab,
        setInitialSubTab,
        profileSubTab,
        setProfileSubTab,
        profileSection,
        setProfileSection,
        assetsRefresh,
        dashboardRefresh,
        navigateToAsset,
        navigateToTab,
        refreshAssets,
        refreshDashboard,
        isBottomBarHidden,
        setIsBottomBarHidden,
        isHomeActive,
        setIsHomeActive,
      }}
    >
      {children}
    </NavigationContext.Provider>
  );
};

export const useNavigation = () => useContext(NavigationContext);