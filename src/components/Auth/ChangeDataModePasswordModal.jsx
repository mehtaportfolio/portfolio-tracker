import React, { useState } from "react";
import { FiEye, FiEyeOff } from "react-icons/fi";
import authAPI from "../../api/authAPI.js";
import { useAuth } from "../../context/AuthContext.jsx";
import toast from "react-hot-toast";

export default function ChangeDataModePasswordModal({ onClose }) {
  const { session } = useAuth();
  const token = session?.access_token;
  const isWebkitTextSecuritySupported = typeof document !== "undefined" && "WebkitTextSecurity" in document.documentElement.style;
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async (e) => {
    e.preventDefault();

    if (!currentPassword.trim()) {
      toast.error("Please enter your current password");
      return;
    }
    if (!newPassword.trim()) {
      toast.error("Please enter your new password");
      return;
    }
    if (!/^\d{6}$/.test(newPassword)) {
      toast.error("New password must be exactly 6 digits");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (currentPassword === newPassword) {
      toast.error("New password must be different from current password");
      return;
    }

    try {
      setLoading(true);

      if (!token) {
        toast.error("Authentication required");
        return;
      }

      const result = await authAPI.updateMasterPIN(token, currentPassword, newPassword);

      if (result.success) {
        toast.success("PIN changed successfully!");
        onClose();
      } else {
        toast.error(result.message || "Failed to update PIN");
      }
    } catch (err) {
      toast.error(err.message || "An error occurred while changing password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-6 animate-in fade-in duration-300">
      <div className="bg-[#1c1c1e] rounded-[32px] shadow-2xl max-w-md w-full border border-white/10 animate-in zoom-in-95 duration-300 overflow-hidden">
        <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="text-green-500">🔑</span> Change Data Mode PIN
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 text-gray-400 hover:text-white transition-colors"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleChangePassword} className="p-8 space-y-6">
          <div className="space-y-2">
            <label className="block text-[13px] font-semibold text-gray-400 ml-1">
              Current PIN
            </label>
            <div className="relative">
              <input
                type={showCurrentPassword ? "text" : (isWebkitTextSecuritySupported ? "text" : "password")}
                style={{ WebkitTextSecurity: showCurrentPassword ? "none" : "disc" }}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current PIN"
                className="w-full bg-[#2c2c2e] text-white px-5 py-3.5 pr-12 rounded-2xl focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all placeholder:text-gray-600"
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
              >
                {showCurrentPassword ? <FiEyeOff size={20} /> : <FiEye size={20} />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-[13px] font-semibold text-gray-400 ml-1">
              New PIN
            </label>
            <div className="relative">
              <input
                type={showNewPassword ? "text" : (isWebkitTextSecuritySupported ? "text" : "password")}
                style={{ WebkitTextSecurity: showNewPassword ? "none" : "disc" }}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter 6-digit PIN"
                className="w-full bg-[#2c2c2e] text-white px-5 py-3.5 pr-12 rounded-2xl focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all placeholder:text-gray-600"
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
              >
                {showNewPassword ? <FiEyeOff size={20} /> : <FiEye size={20} />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-[13px] font-semibold text-gray-400 ml-1">
              Confirm New PIN
            </label>
            <div className="relative">
              <input
                type={showConfirmPassword ? "text" : (isWebkitTextSecuritySupported ? "text" : "password")}
                style={{ WebkitTextSecurity: showConfirmPassword ? "none" : "disc" }}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm 6-digit PIN"
                className="w-full bg-[#2c2c2e] text-white px-5 py-3.5 pr-12 rounded-2xl focus:outline-none focus:ring-2 focus:ring-green-500/50 transition-all placeholder:text-gray-600"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
              >
                {showConfirmPassword ? <FiEyeOff size={20} /> : <FiEye size={20} />}
              </button>
            </div>
          </div>

          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-4 bg-white/5 text-white rounded-2xl hover:bg-white/10 transition-all font-bold text-[15px]"
              disabled={loading}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-4 bg-green-500 text-white rounded-2xl hover:bg-green-400 transition-all font-bold text-[15px] shadow-lg shadow-green-500/20 disabled:bg-gray-700 disabled:text-gray-500 disabled:shadow-none"
            >
              {loading ? "Updating..." : "Update PIN"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
