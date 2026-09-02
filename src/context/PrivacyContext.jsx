import React, { createContext, useContext, useState } from "react";

const PrivacyContext = createContext();

export const PrivacyProvider = ({ children }) => {
  const [isDataMasked, setIsDataMasked] = useState(() => {
    const saved = localStorage.getItem("eye_visible");
    return saved ? !JSON.parse(saved) : false; // true = masked, false = visible
  });

  const hideData = () => {
    setIsDataMasked(true);
    localStorage.setItem("eye_visible", JSON.stringify(false));
  };

  const showData = () => {
    setIsDataMasked(false);
    localStorage.setItem("eye_visible", JSON.stringify(true));
  };

  const toggleData = () => {
    setIsDataMasked((prev) => {
      const newState = !prev;
      localStorage.setItem("eye_visible", JSON.stringify(!newState));
      return newState;
    });
  };

  return (
    <PrivacyContext.Provider value={{ isDataMasked, hideData, showData, toggleData }}>
      {children}
    </PrivacyContext.Provider>
  );
};

export const usePrivacy = () => {
  const context = useContext(PrivacyContext);
  if (!context) {
    throw new Error("usePrivacy must be used within a PrivacyProvider");
  }
  return context;
};