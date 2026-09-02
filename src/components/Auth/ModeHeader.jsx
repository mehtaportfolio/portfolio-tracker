import React from "react";
import { useMode } from "../../context/ModeContext.jsx";
import ModeDropdown from "./ModeDropdown.jsx";
import { useMarketIndicesLastUpdated } from "../../hooks/useMarketIndicesLastUpdated.js";

export default function ModeHeader() {
  const { showModeDropdown, toggleModeDropdown } = useMode();
  const lastUpdated = useMarketIndicesLastUpdated();

return (
  <div className="w-full flex flex-col">
    
    <div className="flex items-center justify-between w-full">
      
      {/* LEFT SIDE: Title + Dropdown */}
      <div className="relative inline-block min-w-0">
        <button
          onClick={toggleModeDropdown}
          className="text-3xl sm:text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-purple-500 via-pink-500 to-yellow-500 hover:opacity-80 transition-opacity truncate"
        >
          Wealth Dashboard
        </button>

        {showModeDropdown && <ModeDropdown />}
      </div>

      {/* RIGHT SIDE: Last Updated */}
      {lastUpdated && (
        <div className="text-right shrink-0 pl-2">
          <span className="text-[10px] sm:text-xs font-medium text-gray-300 tracking-tight whitespace-nowrap">
            ({lastUpdated})
          </span>
        </div>
      )}

    </div>

  </div>
);
}
