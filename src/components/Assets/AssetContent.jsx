import React from "react";
import BankForm from "./Forms/BankForm.jsx";
import StockForm from "./Forms/StockForm.jsx";
import MutualFundForm from "./Forms/MFForm.jsx";
import EPFForm from "./Forms/EPFForm.jsx";
import PPFForm from "./Forms/PPFForm.jsx";
import NPSForm from "./Forms/NPSForm.jsx";
import { useNavigation } from "../../context/NavigationContext.jsx";

const AssetContent = ({ activeTab }) => {
  const { refreshDashboard, refreshAssets } = useNavigation();
  
  const handleFormSuccess = () => {
    refreshDashboard();
    refreshAssets();
  };

  return (
    <div className="p-4">
      {activeTab === "bank" && <BankForm />}
      {activeTab === "stock" && <StockForm onSuccess={handleFormSuccess} />}
      {activeTab === "mf" && <MutualFundForm />}
      {activeTab === "epf" && <EPFForm />}
      {activeTab === "ppf" && <PPFForm />}
      {activeTab === "nps" && <NPSForm />}
    </div>
  );
};

export default AssetContent;
