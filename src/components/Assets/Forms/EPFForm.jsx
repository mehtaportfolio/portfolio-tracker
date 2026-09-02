import React, { useState, useEffect } from "react";
import assetAPI from "../../../api/assetAPI.js";
import { useNavigation } from "../../../context/NavigationContext.jsx";
import { X } from "lucide-react";

const EpfForm = ({ onClose, onSuccess }) => {
  const { setIsBottomBarHidden } = useNavigation();
  const [form, setForm] = useState({
    company_name: "SMPL-MP",
    company_name_input: "",
    contribution_date: "",
    employee_share: "7181",
    employer_share: "550",
    pension_share: "1250",
    invest_type: "deposit",
  });

  useEffect(() => {
    setIsBottomBarHidden(true);
    return () => setIsBottomBarHidden(false);
  }, [setIsBottomBarHidden]);

  const [companies, setCompanies] = useState([]);

  // Fetch unique company names
  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const uniqueCompanies = await assetAPI.getDistinctNames('epf', 'company_name');
        setCompanies(uniqueCompanies);
      } catch (error) {
        console.error("❌ Error fetching companies:", error.message);
      }
    };

    fetchCompanies();
  }, []);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async () => {
    let companyName = form.company_name;
    if (companyName === "new") {
      companyName = form.company_name_input?.trim();
      if (!companyName) return alert("⚠️ Company name is required!");
    }

    if (
      !companyName ||
      !form.contribution_date ||
      !form.employee_share ||
      !form.employer_share ||
      !form.invest_type
    ) {
      return alert("⚠️ Please fill all required fields");
    }

    try {
      await assetAPI.addTransaction('epf', {
        company_name: companyName,
        contribution_date: form.contribution_date,
        employee_share: parseFloat(form.employee_share),
        employer_share: parseFloat(form.employer_share),
        pension_share: parseFloat(form.pension_share),
        invest_type: form.invest_type,
        created_at: new Date().toISOString(),
      });

      alert("✅ EPF record successfully inserted!");
      await assetAPI.invalidateCache('epf');
      try { localStorage.setItem('epf_form_last_v1', JSON.stringify(form)); } catch {}
      setForm({
        company_name: "",
        company_name_input: "",
        contribution_date: "",
        employee_share: "",
        employer_share: "",
        pension_share: "",
        invest_type: "",
      });
      if (onSuccess) onSuccess();
    } catch (error) {
      console.error("❌ Error inserting EPF record:", error.message);
      alert("Failed to save EPF record: " + error.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-2" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-800 rounded-[2.5rem] shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-300" onClick={(e) => e.stopPropagation()}>
        <div className="w-12 h-1.5 bg-gray-700 rounded-full mx-auto mt-2 mb-2 flex-shrink-0" />
        
        <div className="px-8 py-6 border-b border-gray-800 flex items-center justify-between">
          <h3 className="text-2xl font-bold text-white tracking-tight">Add EPF Record</h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-800 rounded-xl transition-colors text-gray-400 hover:text-white">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-5">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-400 ml-1">Company Name</label>
            {form.company_name === "new" ? (
              <input
                className="w-full bg-gray-800 border border-gray-700 text-white p-3.5 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                type="text"
                name="company_name_input"
                placeholder="Enter new company name"
                value={form.company_name_input}
                onChange={handleChange}
                required
              />
            ) : (
              <select
                className="w-full bg-gray-800 border border-gray-700 text-white p-3.5 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all appearance-none cursor-pointer"
                name="company_name"
                value={form.company_name}
                onChange={handleChange}
                required
              >
                <option value="" className="bg-gray-900">Select Company</option>
                {companies.map((name) => (
                  <option key={name} value={name} className="bg-gray-900">{name}</option>
                ))}
                <option value="new" className="bg-gray-900">➕ Add New Company</option>
              </select>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-400 ml-1">Invest Type</label>
              <select
                className="w-full bg-gray-800 border border-gray-700 text-white p-3.5 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all appearance-none cursor-pointer"
                name="invest_type"
                value={form.invest_type}
                onChange={handleChange}
                required
              >
                <option value="" className="bg-gray-900">Select Type</option>
                <option value="deposit" className="bg-gray-900">Deposit</option>
                <option value="interest" className="bg-gray-900">Interest</option>
                <option value="withdrawal" className="bg-gray-900">Withdrawal</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-400 ml-1">Date</label>
              <input
                className="w-full bg-gray-800 border border-gray-700 text-white p-3.5 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all [color-scheme:dark]"
                type="date"
                name="contribution_date"
                value={form.contribution_date}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-400 ml-1">Employee Share</label>
            <input
              className="w-full bg-gray-800 border border-gray-700 text-white p-3.5 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
              type="number"
              step="0.01"
              name="employee_share"
              value={form.employee_share}
              onChange={handleChange}
              placeholder="0.00"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-400 ml-1">Employer Share</label>
              <input
                className="w-full bg-gray-800 border border-gray-700 text-white p-3.5 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                type="number"
                step="0.01"
                name="employer_share"
                value={form.employer_share}
                onChange={handleChange}
                placeholder="0.00"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-400 ml-1">Pension Share</label>
              <input
                className="w-full bg-gray-800 border border-gray-700 text-white p-3.5 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all"
                type="number"
                step="0.01"
                name="pension_share"
                value={form.pension_share}
                onChange={handleChange}
                placeholder="0.00"
                required
              />
            </div>
          </div>
        </div>

        <div className="px-8 py-6 border-t border-gray-800 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3.5 rounded-xl text-sm font-medium text-gray-300 bg-gray-800 hover:bg-gray-700 transition-all border border-gray-700"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="flex-1 px-6 py-3.5 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition-all shadow-lg shadow-blue-900/20"
          >
            Save Record
          </button>
        </div>
      </div>
    </div>
  );
};

export default EpfForm;
