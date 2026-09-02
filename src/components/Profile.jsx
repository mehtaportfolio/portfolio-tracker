// src/components/Profile.js
import React, { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import JSZip from "jszip";
import { usePrivacy } from "../context/PrivacyContext.jsx";
import { useAuth } from "../context/AuthContext.jsx";
import { useMode } from "../context/ModeContext.jsx";
import { useNavigation } from "../context/NavigationContext.jsx";
import ModeDropdown from "./Auth/ModeDropdown.jsx";
import { useBiometricAuth } from "../hooks/useBiometricAuth.jsx";
import { BACKEND_URL } from "../config/apiConfig.js";
import { 
  FiUser, 
  FiSettings, 
  FiPlus,
  FiTrash2,
  FiEdit3,
  FiEye,
  FiX,
  FiChevronDown
} from "react-icons/fi";

// Import form components
import StockForm from "./Assets/Forms/StockForm.jsx";
import MFForm from "./Assets/Forms/MFForm.jsx";
import BdmForm from "./Assets/Forms/BdmForm.jsx";
import BankForm from "./Assets/Forms/BankForm.jsx";
import EPFForm from "./Assets/Forms/EPFForm.jsx";
import PPFForm from "./Assets/Forms/PPFForm.jsx";
import NPSForm from "./Assets/Forms/NPSForm.jsx";
import SIPForm from "./Assets/Forms/SIPForm.jsx";
import CashflowForm from "./Assets/Forms/CashflowForm.jsx";
import otherform from "./Assets/Forms/otherform.jsx";
import ChangePasswordModal from "./Auth/ChangePasswordModal.jsx";
import ChangeMasterPasswordModal from "./Auth/ChangeMasterPasswordModal.jsx";
import TwoFactorAuthModal from "./Auth/TwoFactorAuthModal.jsx";
import { subscribeToNotifications, unsubscribeFromNotifications, checkNotificationStatus } from "../utils/pushNotifications.jsx";

// Helper Component for iOS-style Section Header
const SectionHeader = ({ title }) => (
  <h2 className="px-4 mb-2 mt-6 text-[13px] font-semibold text-gray-400 uppercase tracking-tight">
    {title}
  </h2>
);

export default function Profile() {
  const { isDataMasked, showData } = usePrivacy();
  const { toggleModeDropdown, showModeDropdown } = useMode();
  const { profileSubTab, setProfileSubTab, profileSection, setProfileSection } = useNavigation();
  const [activeTab, setActiveTab] = useState("profile"); // "profile" or "settings"
  const [accounts, setAccounts] = useState([]);
  // eslint-disable-next-line no-unused-vars
  const [userMasterData, setUserMasterData] = useState([]);
  const [fullEditMode, setFullEditMode] = useState(null);
  const [fullEditValues, setFullEditValues] = useState({
    account_name: "",
    pan_card_number: "",
    broker_name: "",
    user_id: "",
    account_number: ""
  });
  const [loading, setLoading] = useState(false);
  const [tableNames, setTableNames] = useState([]);
  const [selectedTables, setSelectedTables] = useState([]);

  const [expandedSections, setExpandedSections] = useState({
    general: false,
    backup: false,
    import: false,
    security: false,
  });
  const [showImportModal, setShowImportModal] = useState(null);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showChangeMasterPasswordModal, setShowChangeMasterPasswordModal] = useState(false);
  const [show2FAModal, setShow2FAModal] = useState(false);
  const [showScriptLogsModal, setShowScriptLogsModal] = useState(false);
  const [scriptLogs, setScriptLogs] = useState([]);
  const [scriptLogsLoading, setScriptLogsLoading] = useState(false);
  const [scriptLogsMonth, setScriptLogsMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [scriptLogsServiceName, setScriptLogsServiceName] = useState('');
  const [scriptLogServiceOptions, setScriptLogServiceOptions] = useState([]);
  const [scriptLogsPage, setScriptLogsPage] = useState(1);
  const [scriptLogsTotalPages, setScriptLogsTotalPages] = useState(1);
  const [scriptLogsTotalCount, setScriptLogsTotalCount] = useState(0);
  const [is2FAEnabled, setIs2FAEnabled] = useState(false);

  const [showTableDropdown, setShowTableDropdown] = useState(false);
  const { user, session } = useAuth();
  const token = session?.access_token;
  const { biometricAvailable, registerBiometric, disableBiometric } = useBiometricAuth();
  const [isBiometricEnabled, setIsBiometricEnabled] = useState(false);
  const [isBiometricLoading, setIsBiometricLoading] = useState(false);
  const [notificationStatus, setNotificationStatus] = useState("loading");
  const [isNotificationLoading, setIsNotificationLoading] = useState(false);
  const [isTelegramEnabled, setIsTelegramEnabled] = useState(false);
  const [notificationTab, setNotificationTab] = useState("mobile"); // "mobile" or "telegram"
  const [profitThreshold, setProfitThreshold] = useState(() => {
    return localStorage.getItem("notification_profit_threshold") || "170";
  });
  const [profitThresholdLoading, setProfitThresholdLoading] = useState(false);

  const fetchProfileData = useCallback(async () => {
    if (!token) return;
    try {
      // Initialize telegram from localStorage first
      const localTelegram = localStorage.getItem("telegram_notifications_enabled") === "true";
      setIsTelegramEnabled(localTelegram);

      const response = await fetch(`${BACKEND_URL}/api/assets/profile`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      if (response.ok) {
        const { accounts: rawAccounts, userDetails } = await response.json();
        
        // 1. Handle Accounts
        setUserMasterData(rawAccounts || []);
        const transformedAccounts = (rawAccounts || []).map(record => ({
          id: record.id,
          account_name: record.account_name || 'Unnamed Account',
          pan_card_number: record.pan_card_number || '',
          user_id: record.user_id || '',
          broker_name: record.broker_name || '',
          account_number: record.account_number || '',
        }));
        setAccounts(transformedAccounts);

        // 2. Handle User Details / Notifications
        if (userDetails) {
          if (userDetails['profit%'] !== null) {
            setProfitThreshold(userDetails['profit%'].toString());
            localStorage.setItem("notification_profit_threshold", userDetails['profit%'].toString());
          }
          if (userDetails.telegram_enabled !== undefined) {
            const remoteTelegram = !!userDetails.telegram_enabled;
            setIsTelegramEnabled(remoteTelegram);
            localStorage.setItem("telegram_notifications_enabled", remoteTelegram.toString());
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch profile data:", err);
    }
  }, [token]);

  const handleEnableNotifications = useCallback(async () => {
    if (Notification.permission === 'denied') {
      toast.error("Notification permission denied! Please reset permissions in your browser settings. 🔒");
      return;
    }
    
    setIsNotificationLoading(true);
    try {
      const success = await subscribeToNotifications(profitThreshold);
      if (success) {
        setNotificationStatus("subscribed");
        localStorage.setItem("notification_profit_threshold", profitThreshold);
        
        // Persist to user_details via backend
        await fetch(`${BACKEND_URL}/api/assets/user-details`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
          },
          body: JSON.stringify({ 'profit%': parseFloat(profitThreshold) })
        });

        toast.success(`Push notifications enabled! 🔔 Threshold: ${profitThreshold}%`);
      }
    } catch (err) {
      if (err.message === 'SERVICE_WORKER_MISSING') {
        toast.error("Service Worker not active. Please refresh or use a production build. 🛠️");
      } else {
        toast.error("Failed to enable push notifications. Ensure permissions are granted. 🔔");
      }
    } finally {
      setIsNotificationLoading(false);
    }
  }, [profitThreshold, token]);

  const handleUpdateThreshold = useCallback(async () => {
    setIsNotificationLoading(true);
    try {
      const success = await subscribeToNotifications(profitThreshold);
      if (success) {
        localStorage.setItem("notification_profit_threshold", profitThreshold);
        
        // Persist to user_details via backend
        await fetch(`${BACKEND_URL}/api/assets/user-details`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}` 
          },
          body: JSON.stringify({ 'profit%': parseFloat(profitThreshold) })
        });

        toast.success(`Profit threshold updated to ${profitThreshold}%! 📈`);
      }
    } catch (err) {
      toast.error("Failed to update notification threshold");
    } finally {
      setIsNotificationLoading(false);
    }
  }, [profitThreshold, token]);

  const handleDisableNotifications = useCallback(async () => {
    const success = await unsubscribeFromNotifications();
    if (success) {
      setNotificationStatus("granted"); // Still has permission, just not subscribed
      toast.success("Push notifications disabled! 🔕");
    } else {
      toast.error("Failed to disable push notifications");
    }
  }, []);

  const handleSaveProfitThreshold = useCallback(async () => {
    if (!token) {
      toast.error("Not authenticated");
      return;
    }

    if (!profitThreshold || parseFloat(profitThreshold) < 0) {
      toast.error("Please enter a valid profit threshold");
      return;
    }

    setProfitThresholdLoading(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/assets/user-details`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ 'profit%': parseFloat(profitThreshold) })
      });

      if (response.ok) {
        localStorage.setItem("notification_profit_threshold", profitThreshold);
        toast.success(`✅ Profit threshold saved: ${profitThreshold}%`);
      } else {
        toast.error("Failed to save profit threshold");
      }
    } catch (err) {
      console.error("Error saving profit threshold:", err);
      toast.error("Failed to save profit threshold");
    } finally {
      setProfitThresholdLoading(false);
    }
  }, [profitThreshold, token]);

  const fetchScriptLogs = useCallback(async () => {
    if (!token) return;

    setScriptLogsLoading(true);
    try {
      const params = new URLSearchParams({
        month: scriptLogsMonth,
        page: String(scriptLogsPage),
        limit: '6',
      });
      if (scriptLogsServiceName.trim()) {
        params.set('serviceName', scriptLogsServiceName.trim());
      }

      const response = await fetch(`${BACKEND_URL}/api/cas/script-logs?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch script logs');
      }

      const payload = await response.json();
      const logs = Array.isArray(payload?.data) ? payload.data : [];
      const serviceNames = Array.isArray(payload?.serviceNames) ? payload.serviceNames : [];
      setScriptLogs(logs);
      setScriptLogServiceOptions(serviceNames);
      setScriptLogsTotalCount(Number(payload?.totalCount || logs.length || 0));
      setScriptLogsTotalPages(Number(payload?.totalPages || 1));
    } catch (error) {
      console.error('Failed to fetch script logs:', error);
      toast.error('Unable to load script logs');
    } finally {
      setScriptLogsLoading(false);
    }
  }, [scriptLogsMonth, scriptLogsPage, scriptLogsServiceName, token]);

  const handleToggleTelegram = async () => {
    const newValue = !isTelegramEnabled;
    // Optimistic update
    setIsTelegramEnabled(newValue);
    localStorage.setItem("telegram_notifications_enabled", newValue.toString());
    
    try {
      const response = await fetch(`${BACKEND_URL}/api/assets/user-details`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ telegram_enabled: newValue })
      });
      
      if (response.ok) {
        toast.success(`Telegram notifications ${newValue ? 'enabled' : 'disabled'}! 🚀`);
      } else {
        // Revert if it was a real unexpected error
        setIsTelegramEnabled(!newValue);
        localStorage.setItem("telegram_notifications_enabled", (!newValue).toString());
        toast.error("Failed to update Telegram settings");
      }
    } catch (err) {
      // Success already shown via optimistic update
      toast.success(`Telegram notifications ${newValue ? 'enabled' : 'disabled'} (local)! 🚀`);
    }
  };

  const checkPushStatus = useCallback(async () => {
    const status = await checkNotificationStatus();
    setNotificationStatus(status);
  }, []);

  useEffect(() => {
    fetchProfileData();
    checkPushStatus();
  }, [fetchProfileData, checkPushStatus]);

  useEffect(() => {
    if (showScriptLogsModal && token) {
      fetchScriptLogs();
    }
  }, [fetchScriptLogs, showScriptLogsModal, token]);

  const check2FAStatus = useCallback(async () => {
    try {
      if (user) {
        const is2FAEnabledInLS = localStorage.getItem(`2fa_enabled_${user.email}`) === "true";
        const is2FAEnabledInMeta = user.user_metadata?.twofa_enabled === true;
        setIs2FAEnabled(is2FAEnabledInLS || is2FAEnabledInMeta);
      }
    } catch (err) {}
  }, [user]);

  const checkBiometricStatus = useCallback(async () => {
    try {
      if (user) {
        const normalizedEmail = user.email.toLowerCase();
        const enabled = localStorage.getItem(`biometric_enabled_${normalizedEmail}`) === "true";
        setIsBiometricEnabled(enabled);
      }
    } catch (err) {}
  }, [user]);

  useEffect(() => {
    check2FAStatus();
    checkBiometricStatus();
    checkPushStatus();
    fetchProfileData();
  }, [check2FAStatus, checkBiometricStatus, checkPushStatus, fetchProfileData]);

  const [isRestarting, setIsRestarting] = useState(false);

  const handleRestartNotifications = async () => {
    setIsRestarting(true);
    try {
      const response = await fetch(`${BACKEND_URL}/api/notifications/restart?type=${notificationTab}`, { method: 'POST' });
      const result = await response.json();
      if (response.ok) toast.success(`${notificationTab === 'mobile' ? 'Mobile Push' : 'Telegram Alert'} service restarted! 🔄`);
      else toast.error(`Failed to restart: ${result.message || "Unknown error"}`);
    } catch (err) {
      toast.error("Network error while restarting");
    } finally {
      setIsRestarting(false);
    }
  };

  const handleTestNotification = async () => {
    try {
      console.log(`[Profile] Triggering test notification (${notificationTab}) with threshold: ${profitThreshold}`);
      const response = await fetch(`${BACKEND_URL}/api/notifications/trigger?force=true&threshold=${profitThreshold}&type=${notificationTab}`);
      if (response.ok) toast.success(`Test ${notificationTab} notification triggered!`);
      else toast.error("Failed to trigger test notification");
    } catch (err) {
      toast.error("Network error while triggering test");
    }
  };

  useEffect(() => {
    if (activeTab === "settings" && expandedSections.security) {
      checkPushStatus();
      
      // Attempt to register service worker if missing (helps in dev or edge cases)
      if ('serviceWorker' in navigator && !navigator.serviceWorker.controller) {
        navigator.serviceWorker.register('/service-worker.js').catch(console.error);
      }
    }
  }, [activeTab, expandedSections.security, checkPushStatus]);

  useEffect(() => {
    if (profileSubTab) {
      setActiveTab(profileSubTab);
      setProfileSubTab(null);
    }
    if (profileSection) {
      setExpandedSections(prev => ({ ...prev, [profileSection]: true }));
      setProfileSection(null);
    }
  }, [profileSubTab, profileSection, setProfileSubTab, setProfileSection]);

  const fetchTableNames = useCallback(() => {
    setTableNames([
      // existing tables (preserve order)
      "account_cashflows",
      "bank_transactions",
      "bdm_transactions",
      "bonus_split",
      "epf_transactions",
      "equity_charges",
      "fund_master",
      "fund_navs",
      "mf_explorer_funds",
      "mf_transactions",
      "nps_contributions",
      "nps_pension_fund_master",
      "nps_transactions",
      "other_transactions",
      "ppf_transactions",
      "recent_searches",
      "scheme_list",
      "sip_details",
      "stock_master",
      "stock_transactions",
      "user_details",
      "user_master",
      "watchlists",

      // newly added tables from the provided list
      "bank_balance_snapshots",
      "corporate_actions",
      "dividend_events",
      "fund_master_backend",
      "market_indices",
      "mf_cas",
      "mf_raw_cas",
      "nps_pdf",
      "nps_raw_temp",
      "push_subscriptions",
      "stock_mapping",
    ]);
  }, []);

  useEffect(() => {
    fetchProfileData();
    fetchTableNames();
  }, [fetchProfileData, fetchTableNames]);

  const toggleTableSelection = (tableName) => {
    setSelectedTables((prev) =>
      prev.includes(tableName) ? prev.filter((t) => t !== tableName) : [...prev, tableName]
    );
  };

  const toggleSelectAllTables = () => {
    if (selectedTables.length === tableNames.length) setSelectedTables([]);
    else setSelectedTables([...tableNames]);
  };

  const handleToggleBiometric = async () => {
    if (!window.PublicKeyCredential) {
      toast.error("WebAuthn not supported on this device");
      return;
    }
    if (!user?.email) return;
    setIsBiometricLoading(true);
    try {
      if (isBiometricEnabled) {
        if (disableBiometric(user.email)) setIsBiometricEnabled(false);
      } else {
        const password = prompt("Please enter your current password to enable biometric login:");
        if (!password) {
          toast.error("Password is required to enable biometric authentication");
          setIsBiometricLoading(false);
          return;
        }
        
        const normalizedEmail = user.email.toLowerCase();
        console.log(`[Biometric] Enabling for ${normalizedEmail}. Password length: ${password.length}`);
        localStorage.setItem(`biometric_password_${normalizedEmail}`, password);
        console.log(`[Biometric] Password saved to localStorage for key: biometric_password_${normalizedEmail}`);
        
        const success = await registerBiometric(normalizedEmail);
        if (success) {
          setIsBiometricEnabled(true);
          localStorage.setItem("last_biometric_email", normalizedEmail);
          console.log(`[Biometric] Registration successful. Enabled flag set to true.`);
          toast.success("Biometric authentication enabled! 🔐");
        } else {
          console.warn(`[Biometric] Registration failed or cancelled. Removing saved password.`);
          localStorage.removeItem(`biometric_password_${normalizedEmail}`);
        }
      }
    } catch (err) {
      toast.error("Failed to update biometric settings");
    } finally {
      setIsBiometricLoading(false);
    }
  };

  const addAccount = async () => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/assets/user-master`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({
          asset_type: 'equity', 
          account_name: 'New Account',
          broker_name: 'Broker Name'
        })
      });

      if (response.ok) {
        toast.success("New equity account added");
        fetchProfileData();
      } else {
        throw new Error('Failed to add account');
      }
    } catch (error) {
      toast.error("Failed to add account");
    }
  };

  const deleteAccount = async (id) => {
    if (window.confirm("Are you sure you want to delete this equity account?")) {
      try {
        const response = await fetch(`${BACKEND_URL}/api/assets/user-master/${id}`, {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
          toast.success("Equity account deleted");
          fetchProfileData();
        } else {
          throw new Error('Failed to delete account');
        }
      } catch (error) {
        toast.error("Failed to delete account");
      }
    }
  };

  const saveFullEdit = async (id) => {
    try {
      const response = await fetch(`${BACKEND_URL}/api/assets/user-master/${id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify(fullEditValues)
      });

      if (response.ok) {
        setFullEditMode(null);
        toast.success("Account updated successfully");
        fetchProfileData();
      } else {
        throw new Error('Update failed');
      }
    } catch (error) {
      toast.error("Update failed");
    }
  };

  const downloadTableAsCSV = async () => {
    if (selectedTables.length === 0) {
      toast.error("Please select at least one table");
      return;
    }
    try {
      setLoading(true);
      const response = await fetch(`${BACKEND_URL}/api/assets/export`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}` 
        },
        body: JSON.stringify({ tables: selectedTables })
      });

      if (!response.ok) throw new Error('Export failed');
      
      const bulkData = await response.json();
      const zip = new JSZip();
      let hasData = false;
      const emptyTables = [];

      // Ensure we include files for all selected tables (even if backend returned no rows)
      for (const tableName of selectedTables) {
        const data = bulkData && Object.prototype.hasOwnProperty.call(bulkData, tableName) ? bulkData[tableName] : [];
        if (data && data.length > 0) {
          const headers = Object.keys(data[0]);
          const csv = [headers.join(","), ...data.map(row => headers.map(h => {
            const v = row[h];
            return (typeof v === 'string' && (v.includes(',') || v.includes('"'))) ? `"${v.replace(/"/g, '""')}"` : (v || "");
          }).join(","))].join("\n");
          zip.file(`${tableName}.csv`, csv);
          hasData = true;
        } else {
          // create an empty placeholder CSV so the file is still present in the ZIP
          zip.file(`${tableName}.csv`, "No data\n");
          emptyTables.push(tableName);
        }
      }

      const blob = await zip.generateAsync({ type: "blob" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `portfolio_data_${Date.now()}.zip`;
      link.click();
      if (hasData) {
        toast.success("Data exported successfully");
        if (emptyTables.length > 0) toast((t) => <span>Note: {emptyTables.length} table(s) had no rows and were exported empty.</span>);
      } else {
        toast("No rows found for selected tables — exported empty files.");
      }
    } catch (err) {
      console.error("Export failed:", err);
      toast.error("Export failed");
    } finally {
      setLoading(false);
    }
  };

  const importForms = {
    stock: { component: StockForm, title: "Equity" },
    mf: { component: MFForm, title: "Mutual Funds" },
    bdm: { component: BdmForm, title: "BDM" },
    bank: { component: BankForm, title: "Bank Accounts" },
    epf: { component: EPFForm, title: "EPF Accounts" },
    ppf: { component: PPFForm, title: "PPF Accounts" },
    nps: { component: NPSForm, title: "NPS Accounts" },
    sip: { component: SIPForm, title: "SIP" },
    cashflow: { component: CashflowForm, title: "Equity Cashflow" },
    other: { component: otherform, title: "Other Transactions" },
  };

  const toggleSection = (section) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (showTableDropdown && !e.target.closest('[data-table-dropdown]')) {
        setShowTableDropdown(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [showTableDropdown]);

  return (
    <div className="flex flex-col h-full bg-gray-900 overflow-hidden">
      {/* iOS Style Navigation Header */}
      <div className="px-4 pt-0 pb-4 bg-gray-900/80 backdrop-blur-xl border-b border-gray-700 sticky top-0 z-30">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-3xl font-bold text-white tracking-tight">
            {activeTab === "profile" ? "Profile" : "Settings"}
          </h1>
          <div className="flex items-center gap-2">
            {isDataMasked && (
              <button 
                onClick={showData}
                className="p-2 rounded-full bg-gray-700/50 text-blue-400 active:bg-gray-700/80 transition-colors"
              >
                <FiEye size={20} />
              </button>
            )}
          </div>
        </div>

        {/* Segmented Control */}
        <div className="bg-gray-800 p-1 rounded-xl flex">
          <button
            onClick={() => setActiveTab("profile")}
            className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg text-[13px] font-semibold transition-all duration-200 ${
              activeTab === "profile" 
                ? "bg-gray-600 text-white shadow-sm scale-[1.02]" 
                : "text-gray-400 hover:text-gray-300"
            }`}
          >
            <FiUser size={16} />
            Profile
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-lg text-[13px] font-semibold transition-all duration-200 ${
              activeTab === "settings" 
                ? "bg-gray-600 text-white shadow-sm scale-[1.02]" 
                : "text-gray-400 hover:text-gray-300"
            }`}
          >
            <FiSettings size={16} />
            Settings
          </button>
        </div>
      </div>

      {/* Main Content Scroll Area */}
      <div className="flex-1 overflow-y-auto pb-32">
        <div className="max-w-2xl mx-auto px-4">
          
          {activeTab === "profile" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <SectionHeader title="Your Accounts" />
              
              <div className="bg-gray-800 rounded-xl shadow-sm border border-gray-700 overflow-hidden mb-6">
                {accounts.length > 0 ? (
                  accounts.map((account) => (
                    <div key={account.id} className="border-b last:border-b-0 border-gray-800">
                      {fullEditMode === account.id ? (
                        <div className="p-4 bg-blue-500/5 space-y-4">
                          <input 
                            className="w-full p-3 rounded-lg bg-gray-700 border border-gray-700 text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="Account Name"
                            value={fullEditValues.account_name}
                            onChange={(e) => setFullEditValues({...fullEditValues, account_name: e.target.value})}
                          />
                          <input 
                            className="w-full p-3 rounded-lg bg-gray-700 border border-gray-700 text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="Broker Name"
                            value={fullEditValues.broker_name}
                            onChange={(e) => setFullEditValues({...fullEditValues, broker_name: e.target.value})}
                          />
                          <input 
                            className="w-full p-3 rounded-lg bg-gray-700 border border-gray-700 text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="PAN Card"
                            value={fullEditValues.pan_card_number}
                            onChange={(e) => setFullEditValues({...fullEditValues, pan_card_number: e.target.value})}
                          />
                          <input 
                            className="w-full p-3 rounded-lg bg-gray-700 border border-gray-700 text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="User ID / Login ID"
                            value={fullEditValues.user_id}
                            onChange={(e) => setFullEditValues({...fullEditValues, user_id: e.target.value})}
                          />
                          <input 
                            className="w-full p-3 rounded-lg bg-gray-700 border border-gray-700 text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="Account Number"
                            value={fullEditValues.account_number}
                            onChange={(e) => setFullEditValues({...fullEditValues, account_number: e.target.value})}
                          />
                          <div className="flex gap-2">
                            <button 
                              onClick={() => saveFullEdit(account.id)}
                              className="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-semibold active:scale-95 transition-transform"
                            >
                              Save
                            </button>
                            <button 
                              onClick={() => setFullEditMode(null)}
                              className="flex-1 bg-gray-700/50 text-white border border-gray-700 py-2 rounded-lg text-sm active:scale-95 transition-transform"
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="p-4 flex items-center justify-between group hover:bg-gray-700/50 transition-colors">
                          <div>
                            <h3 className="font-semibold text-[17px] text-white">{account.account_name}</h3>
                            <p className="text-[13px] text-gray-400">
                              {account.broker_name || 'No Broker'} • {account.pan_card_number || 'No PAN'}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <button 
                              onClick={() => {
                                setFullEditMode(account.id);
                                setFullEditValues({...account});
                              }}
                              className="p-2 text-gray-400 hover:text-blue-400 active:scale-90 transition-all"
                            >
                              <FiEdit3 size={18} />
                            </button>
                            <button 
                              onClick={() => deleteAccount(account.id)}
                              className="p-2 text-gray-400 hover:text-red-400 active:scale-90 transition-all"
                            >
                              <FiTrash2 size={18} />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="p-8 text-center text-gray-500 italic">No accounts yet</div>
                )}
                <button
                  onClick={addAccount}
                  className="w-full py-4 flex items-center justify-center gap-2 text-blue-400 font-medium active:bg-white/5 transition-colors"
                >
                  <FiPlus size={20} />
                  Add New Account
                </button>
              </div>
            </div>
          )}

          {activeTab === "settings" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-4">
              {/* General Settings */}
              <div className="bg-gray-800 rounded-xl shadow-sm border border-gray-700 overflow-hidden">
                <button
                  onClick={() => toggleSection("general")}
                  className="w-full px-4 py-4 flex items-center justify-between hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">⚙️</span>
                    <span className="font-semibold text-white text-lg">General Settings</span>
                  </div>
                  <span className={`transform transition-transform duration-300 text-gray-400 ${expandedSections.general ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                </button>
                {expandedSections.general && (
                  <div className="px-4 pb-4 border-t border-gray-800 bg-gray-900/50 space-y-4 pt-4">
                    <div className="flex flex-col gap-3 relative" data-table-dropdown>
                      <button
                        onClick={() => toggleModeDropdown()}
                        className="w-full px-4 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors font-semibold text-sm flex items-center justify-center gap-2"
                      >
                        🔄 Switch Application Mode
                      </button>
                      {showModeDropdown && (
                        <div className="mt-2 animate-in zoom-in-95 duration-200">
                          <ModeDropdown />
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => {
                        setShowScriptLogsModal(true);
                        setScriptLogsPage(1);
                        setScriptLogsMonth(new Date().toISOString().slice(0, 7));
                      }}
                      className="w-full px-4 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-colors font-semibold text-sm flex items-center justify-center gap-2"
                    >
                      📋 View Script Logs
                    </button>
                  </div>
                )}
              </div>

              {/* Data Backup */}
              <div className={`bg-gray-800 rounded-xl shadow-sm border border-gray-700 ${expandedSections.backup ? 'overflow-visible' : 'overflow-hidden'}`}>
                <button
                  onClick={() => toggleSection("backup")}
                  className="w-full px-4 py-4 flex items-center justify-between hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">💾</span>
                    <span className="font-semibold text-white text-lg">Data Backup</span>
                  </div>
                  <span className={`transform transition-transform duration-300 text-gray-400 ${expandedSections.backup ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                </button>
                {expandedSections.backup && (
                  <div className="px-4 pb-4 border-t border-gray-800 bg-gray-900/50 pt-4 overflow-visible">
                    <div className="mb-4 relative" data-table-dropdown>
                      <p className="text-xs text-gray-400 mb-2 uppercase font-bold tracking-wider">Select Tables to Export</p>
                      
                      {/* Dropdown for Table Selection */}
                      <button
                        onClick={() => setShowTableDropdown(!showTableDropdown)}
                        className="w-full flex items-center justify-between px-4 py-3 bg-gray-700 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <span className="truncate">
                          {selectedTables.length === 0 
                            ? "Select Tables..." 
                            : selectedTables.length === tableNames.length 
                              ? "All Tables Selected" 
                              : `${selectedTables.length} Tables Selected`}
                        </span>
                        <FiChevronDown className={`transition-transform duration-200 ${showTableDropdown ? 'rotate-180' : ''}`} />
                      </button>

                      {showTableDropdown && (
                        <div className="absolute top-full left-0 right-0 mt-2 z-[100] bg-gray-800 border border-gray-700 rounded-xl shadow-2xl max-h-[400px] overflow-y-auto custom-scrollbar animate-in zoom-in-95 duration-200 ring-1 ring-black/50">
                          <div className="p-2 border-b border-gray-800 sticky top-0 bg-gray-800 flex justify-between items-center">
                            <button
                              onClick={toggleSelectAllTables}
                              className="text-xs text-blue-400 hover:text-blue-300 font-bold px-2 py-1"
                            >
                              {selectedTables.length === tableNames.length ? "Deselect All" : "Select All"}
                            </button>
                            <span className="text-[10px] text-gray-500 font-bold uppercase tracking-widest mr-2">
                              {selectedTables.length} Selected
                            </span>
                          </div>
                          <div className="p-1">
                            {(() => {
                              const sorted = [...tableNames].sort((a, b) => {
                                const da = a.replace(/_/g, ' ');
                                const db = b.replace(/_/g, ' ');
                                return da.localeCompare(db, undefined, { sensitivity: 'base' });
                              });
                              return sorted.map((table, idx) => (
                                <button
                                  key={table}
                                  onClick={() => toggleTableSelection(table)}
                                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-700/50 transition-colors text-left"
                                >
                                  <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${
                                    selectedTables.includes(table) 
                                      ? "bg-blue-600 border-blue-600 text-white" 
                                      : "border-gray-600 text-transparent"
                                  }`}>
                                    <FiX size={12} className="rotate-45" />
                                  </div>
                                  <span className="text-sm text-gray-200">
                                    <span className="text-gray-400 mr-3">{idx + 1}.</span>
                                    {table.replace(/_/g, " ")}
                                  </span>
                                </button>
                              ));
                            })()}
                          </div>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={downloadTableAsCSV}
                      disabled={loading || selectedTables.length === 0}
                      className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {loading ? "⌛ Exporting..." : "📥 Download Selected as ZIP"}
                    </button>
                  </div>
                )}
              </div>

              {/* Data Import */}
              <div className="bg-gray-800 rounded-xl shadow-sm border border-gray-700 overflow-hidden">
                <button
                  onClick={() => toggleSection("import")}
                  className="w-full px-4 py-4 flex items-center justify-between hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">📤</span>
                    <span className="font-semibold text-white text-lg">Add New Entries</span>
                  </div>
                  <span className={`transform transition-transform duration-300 text-gray-400 ${expandedSections.import ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                </button>
                {expandedSections.import && (
                  <div className="px-4 pb-4 border-t border-gray-800 bg-gray-900/50 pt-4">
                    <div className="grid grid-cols-2 gap-3">
                      {Object.entries(importForms).map(([key, { title }]) => (
                        <button
                          key={key}
                          onClick={() => setShowImportModal(key)}
                          className="px-4 py-3 bg-gray-700 text-white rounded-lg hover:bg-gray-600 transition-all text-sm font-semibold border border-gray-800 active:scale-95"
                        >
                          {title}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Security & Authentication */}
              <div className="bg-gray-800 rounded-xl shadow-sm border border-gray-700 overflow-hidden">
                <button
                  onClick={() => toggleSection("security")}
                  className="w-full px-4 py-4 flex items-center justify-between hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl">🛡️</span>
                    <span className="font-semibold text-white text-lg">Security & Privacy</span>
                  </div>
                  <span className={`transform transition-transform duration-300 text-gray-400 ${expandedSections.security ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                </button>
                {expandedSections.security && (
                  <div className="px-4 pb-4 border-t border-gray-800 bg-gray-900/50 space-y-3 pt-4">
                    <button 
                      onClick={() => setShowChangePasswordModal(true)}
                      className="w-full px-4 py-3 bg-orange-600/90 text-white rounded-lg hover:bg-orange-600 transition-colors font-semibold text-sm flex items-center justify-center gap-2">
                      🔑 Change Sign-in Password
                    </button>
                    <button 
                      onClick={() => setShowChangeMasterPasswordModal(true)}
                      className="w-full px-4 py-3 bg-blue-600/90 text-white rounded-lg hover:bg-blue-600 transition-colors font-semibold text-sm flex items-center justify-center gap-2">
                      🔐 Change Master Password
                    </button>
                    <button 
                      onClick={() => setShow2FAModal(true)}
                      className={`w-full px-4 py-3 rounded-lg transition-colors font-semibold text-sm flex items-center justify-center gap-2 ${
                        is2FAEnabled
                          ? "bg-green-600/90 hover:bg-green-600 text-white"
                          : "bg-purple-600/90 hover:bg-purple-600 text-white"
                      }`}>
                      {is2FAEnabled ? "✅" : "📱"} {is2FAEnabled ? "2FA Enabled" : "Enable 2FA (Two-Factor)"}
                    </button>
                    {biometricAvailable && (
                      <button 
                        onClick={handleToggleBiometric}
                        disabled={isBiometricLoading}
                        className={`w-full px-4 py-3 rounded-lg transition-colors font-semibold text-sm flex items-center justify-center gap-2 ${
                          isBiometricEnabled
                            ? "bg-blue-600/90 hover:bg-blue-600 text-white"
                            : "bg-indigo-600/90 hover:bg-indigo-600 text-white"
                        } disabled:opacity-60`}>
                        {isBiometricLoading ? "⌛ Processing..." : (isBiometricEnabled ? "✅ Biometric Enabled" : "👆 Enable Biometric login")}
                      </button>
                    )}
                    
                    {/* Profit % Threshold Setting */}
                    <div className="border-t border-gray-700 pt-3 mt-3">
                      <label className="text-xs text-gray-400 font-bold uppercase tracking-wider block mb-2 px-1">📈 Profit % Threshold</label>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          value={profitThreshold}
                          onChange={(e) => setProfitThreshold(e.target.value)}
                          placeholder="Enter profit threshold (e.g., 10)"
                          step="0.01"
                          min="0"
                          className="flex-1 px-4 py-3 bg-gray-700 border border-gray-600 rounded-lg text-white text-sm focus:ring-2 focus:ring-green-500 outline-none transition-all"
                        />
                        <button
                          onClick={handleSaveProfitThreshold}
                          disabled={profitThresholdLoading}
                          className="px-4 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:opacity-60 text-white rounded-lg transition-colors font-semibold text-sm whitespace-nowrap active:scale-95"
                        >
                          {profitThresholdLoading ? "⌛ Saving..." : "💾 Save"}
                        </button>
                      </div>
                      <p className="text-[10px] text-gray-500 mt-2 px-1">This value will be saved to your user profile in the database</p>
                    </div>
                    
                    <div className="pt-2">
                      <p className="text-[10px] text-gray-500 mb-2 uppercase font-bold tracking-widest text-center">Notifications</p>
                      
                      {/* Mobile / Telegram Switch */}
                      <div className="flex bg-gray-700/50 p-1 rounded-xl mb-4 border border-gray-700/50">
                        <button
                          onClick={() => setNotificationTab("mobile")}
                          className={`flex-1 py-2 rounded-lg text-[11px] font-bold transition-all duration-200 ${
                            notificationTab === "mobile" 
                              ? "bg-gray-600 text-white shadow-sm" 
                              : "text-gray-400 hover:text-gray-300"
                          }`}
                        >
                          📱 Mobile Push
                        </button>
                        <button
                          onClick={() => setNotificationTab("telegram")}
                          className={`flex-1 py-2 rounded-lg text-[11px] font-bold transition-all duration-200 ${
                            notificationTab === "telegram" 
                              ? "bg-gray-600 text-white shadow-sm" 
                              : "text-gray-400 hover:text-gray-300"
                          }`}
                        >
                          ✈️ Telegram Alert
                        </button>
                      </div>

                      <div className="flex flex-col gap-2">
                        <div className="flex flex-col gap-1 mb-2">
                          <label className="text-[11px] text-gray-400 font-semibold px-1">PROFIT % THRESHOLD</label>
                          <div className="flex gap-2">
                            <input
                              type="number"
                              value={profitThreshold}
                              onChange={(e) => {
                                const value = e.target.value;
                                setProfitThreshold(value);
                                localStorage.setItem("notification_profit_threshold", value);
                              }}
                              placeholder="Threshold % (e.g., 5)"
                              className="flex-1 px-4 py-3 bg-gray-700 border border-gray-700 rounded-lg text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                            />
                            { (notificationStatus === "subscribed" || notificationStatus === "granted") && (
                              <button 
                                onClick={handleUpdateThreshold}
                                className="px-4 py-3 bg-blue-600/90 hover:bg-blue-600 text-white rounded-lg transition-colors font-semibold text-sm whitespace-nowrap active:scale-95"
                              >
                                📈 Update
                              </button>
                            )}
                          </div>
                        </div>

                        {notificationTab === "mobile" ? (
                          <>
                            <button 
                              onClick={notificationStatus === "subscribed" ? handleDisableNotifications : handleEnableNotifications}
                              disabled={notificationStatus === "unsupported" || notificationStatus === "ios_not_pwa" || notificationStatus === "loading" || isNotificationLoading}
                              className={`w-full px-4 py-3 rounded-lg transition-colors font-semibold text-sm flex items-center justify-center gap-2 ${
                                notificationStatus === "subscribed"
                                  ? "bg-red-600/90 hover:bg-red-600 text-white"
                                  : "bg-teal-500/90 hover:bg-teal-500 text-white"
                              } disabled:opacity-50`}>
                              {isNotificationLoading ? "⌛ Processing..." : (
                                notificationStatus === "ios_not_pwa" 
                                  ? "📱 Install App to Enable Push" 
                                  : (notificationStatus === "subscribed" ? "🔕 Disable Push Service" : "🔔 Enable Push Service")
                              )}
                            </button>
                            {notificationStatus === "subscribed" && (
                              <>
                                <button 
                                  onClick={handleTestNotification}
                                  className="w-full px-4 py-3 bg-teal-600/90 hover:bg-teal-600 text-white rounded-lg transition-colors font-semibold text-sm flex items-center justify-center gap-2">
                                  🔔 Send Test Alert
                                </button>
                                <button 
                                  onClick={handleRestartNotifications}
                                  disabled={isRestarting}
                                  className="w-full px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors font-semibold text-sm flex items-center justify-center gap-2">
                                  {isRestarting ? "⌛ Restarting..." : `🔄 Restart ${notificationTab === 'mobile' ? 'Push' : 'Telegram'} Service`}
                                </button>
                              </>
                            )}
                          </>
                        ) : (
                          <>
                            <button 
                              onClick={handleToggleTelegram}
                              className={`w-full px-4 py-3 rounded-lg transition-colors font-semibold text-sm flex items-center justify-center gap-2 ${
                                isTelegramEnabled
                                  ? "bg-red-600/90 hover:bg-red-600 text-white"
                                  : "bg-blue-600/90 hover:bg-blue-600 text-white"
                              }`}>
                              {isTelegramEnabled ? "🔕 Disable Telegram Alert" : "✈️ Enable Telegram Alert"}
                            </button>
                            {isTelegramEnabled && (
                              <>
                                <button 
                                  onClick={handleTestNotification}
                                  className="w-full px-4 py-3 bg-blue-600/90 hover:bg-blue-600 text-white rounded-lg transition-colors font-semibold text-sm flex items-center justify-center gap-2">
                                  🔔 Send Test Alert
                                </button>
                                <button 
                                  onClick={handleRestartNotifications}
                                  disabled={isRestarting}
                                  className="w-full px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors font-semibold text-sm flex items-center justify-center gap-2">
                                  {isRestarting ? "⌛ Restarting..." : `🔄 Restart ${notificationTab === 'mobile' ? 'Push' : 'Telegram'} Service`}
                                </button>
                              </>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showImportModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-gray-900 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-hidden flex flex-col shadow-2xl border border-gray-700">
            <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-gray-900">
              <h2 className="text-xl font-bold text-white">Import {importForms[showImportModal].title}</h2>
              <button onClick={() => setShowImportModal(null)} className="p-2 hover:bg-gray-700/50 rounded-full text-gray-400">
                <FiX size={24} />
              </button>
            </div>
            <div className="p-4 overflow-y-auto custom-scrollbar">
              {React.createElement(importForms[showImportModal].component, {
                onClose: () => {
                  setShowImportModal(null);
                  fetchProfileData();
                }
              })}
            </div>
          </div>
        </div>
      )}

      {showChangePasswordModal && (
        <ChangePasswordModal isOpen={true} onClose={() => setShowChangePasswordModal(false)} />
      )}
      {showChangeMasterPasswordModal && (
        <ChangeMasterPasswordModal isOpen={true} onClose={() => setShowChangeMasterPasswordModal(false)} />
      )}
      {show2FAModal && (
        <TwoFactorAuthModal 
          isOpen={true} 
          onClose={() => {
            setShow2FAModal(false);
            check2FAStatus();
          }} 
        />
      )}

      {showScriptLogsModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="bg-gray-900 rounded-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden border border-gray-700 shadow-2xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
              <div>
                <h2 className="text-lg font-bold text-white">Script Logs</h2>
                <p className="text-xs text-gray-400">Service status history from the backend</p>
              </div>
              <button
                onClick={() => setShowScriptLogsModal(false)}
                className="p-2 hover:bg-gray-700/50 rounded-full text-gray-400"
              >
                <FiX size={20} />
              </button>
            </div>
            <div className="p-4 overflow-auto max-h-[70vh]">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between mb-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <div>
                    <label className="block text-[11px] uppercase tracking-wider text-gray-400 mb-1">Month</label>
                    <select
                      value={scriptLogsMonth}
                      onChange={(e) => {
                        setScriptLogsMonth(e.target.value);
                        setScriptLogsPage(1);
                      }}
                      className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white"
                    >
                      {Array.from({ length: 12 }, (_, index) => {
                        const date = new Date();
                        date.setMonth(date.getMonth() - index);
                        const value = date.toISOString().slice(0, 7);
                        return (
                          <option key={value} value={value}>
                            {date.toLocaleString('en-US', { month: 'long', year: 'numeric' })}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[11px] uppercase tracking-wider text-gray-400 mb-1">Service Name</label>
                    <select
                      value={scriptLogsServiceName}
                      onChange={(e) => {
                        setScriptLogsServiceName(e.target.value);
                        setScriptLogsPage(1);
                      }}
                      className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white min-w-[200px]"
                    >
                      <option value="">All Services</option>
                      {scriptLogServiceOptions.map((serviceName) => (
                        <option key={serviceName} value={serviceName}>
                          {serviceName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="text-sm text-gray-400">
                  Showing {scriptLogs.length} of {scriptLogsTotalCount} log{scriptLogsTotalCount === 1 ? '' : 's'}
                </div>
              </div>

              {scriptLogsLoading ? (
                <div className="text-center py-8 text-gray-400">Loading logs...</div>
              ) : scriptLogs.length === 0 ? (
                <div className="text-center py-8 text-gray-400">No script logs found.</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm text-left text-gray-300">
                    <thead className="bg-gray-800 text-gray-400 uppercase text-[11px] tracking-wider">
                      <tr>
                        <th className="px-3 py-2">#</th>
                        <th className="px-3 py-2">Service</th>
                        <th className="px-3 py-2">Status</th>
                        <th className="px-3 py-2">Error Details</th>
                        <th className="px-3 py-2">Created At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scriptLogs.map((log, index) => (
                        <tr key={log.id} className="border-t border-gray-800 hover:bg-gray-800/50">
                          <td className="px-3 py-2 whitespace-nowrap text-gray-400">{(scriptLogsPage - 1) * 6 + index + 1}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-white">{log.service_name || '-'}</td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <span className={`px-2 py-1 rounded-full text-[11px] font-semibold ${
                              log.status === 'success' ? 'bg-green-600/20 text-green-400' : 'bg-red-600/20 text-red-400'
                            }`}>
                              {log.status || '-'}
                            </span>
                          </td>
                          <td className="px-3 py-2 max-w-[320px] whitespace-pre-wrap text-gray-400">{log.error_details || '-'}</td>
                          <td className="px-3 py-2 whitespace-nowrap text-gray-400">{log.created_at ? new Date(log.created_at).toLocaleString() : '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between border-t border-gray-800 mt-4">
                <div className="text-sm text-gray-400">
                  Page {scriptLogsPage} of {scriptLogsTotalPages}
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setScriptLogsPage((page) => Math.max(page - 1, 1))}
                    disabled={scriptLogsPage === 1}
                    className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setScriptLogsPage((page) => Math.min(page + 1, scriptLogsTotalPages))}
                    disabled={scriptLogsPage >= scriptLogsTotalPages}
                    className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-2 text-sm text-white disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
