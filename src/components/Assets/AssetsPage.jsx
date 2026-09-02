// src/components/Assets/AssetsPage.js
import React, { useState } from "react";
import AssetTabs from "./AssetTabs.jsx";
import Bank from "./Bank.js";
import Stock from "./Stock.js";
import MF from "./MF.js";
import NPS from "./NPS.js";
import EPF from "./EPF.jsx";
import PPF from "./PPF.jsx";
import Links from "./Links.jsx";
// import MutualFunds, FD, etc. as you build them

const AssetsPage = () => {
  const [activeTab, setActiveTab] = useState("bank");

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto w-full">
      {/* Tabs */}
      <AssetTabs activeTab={activeTab} setActiveTab={setActiveTab} />

      {/* Tab Content */}
      {activeTab === "bank" && <Bank />}
      {activeTab === "stock" && <Stock />}
      {activeTab === "mf" && <MF />}
      {activeTab === "nps" && <NPS />}
      {activeTab === "epf" && <EPF />}
      {activeTab === "ppf" && <PPF />}
      {activeTab === "links" && <Links />}
     </div>
  );
};

export default AssetsPage;
