// src/components/Assets/AssetTabs.js
import React from "react";

const AssetTabs = ({ activeTab, setActiveTab }) => {
  // keep values for logic
  const tabs = ["stock", "mf", "bank", "epf", "ppf", "nps", "links"];

  // mapping for display labels
  const tabLabels = {
    stock: "EQUITY",
    mf: "MF",
    bank: "BANK",
    epf: "EPF",
    ppf: "PPF",
    nps: "NPS",
    links: "LINKS",
  };

  return (
    <div className="border-b border-gray-300 bg-white shadow-sm">
      <div className="flex gap-2 overflow-x-auto no-scrollbar px-2 sm:px-4">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 sm:flex-none px-3 py-2 text-sm font-medium whitespace-nowrap transition-all
              ${
                activeTab === tab
                  ? "border-b-2 border-red-600 text-red-600"
                  : "text-gray-600 hover:text-gray-800"
              }`}
          >
            {tabLabels[tab]}
          </button>
        ))}
      </div>
    </div>
  );
};

export default AssetTabs;
