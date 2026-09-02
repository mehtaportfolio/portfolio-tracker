// src/context/EquityVisibility.js
import React, { createContext, useContext, useState } from "react";

const EquityVisibilityContext = createContext();

export const EquityVisibilityProvider = ({ children }) => {
  const [hidden, setHidden] = useState(false);
  const toggleHidden = () => setHidden((prev) => !prev);

  return (
    <EquityVisibilityContext.Provider value={{ hidden, toggleHidden }}>
      {children}
    </EquityVisibilityContext.Provider>
  );
};

export const useEquityVisibility = () => useContext(EquityVisibilityContext);
