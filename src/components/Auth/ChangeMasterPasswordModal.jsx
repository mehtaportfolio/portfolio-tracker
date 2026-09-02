import React, { useState } from "react";
import { FiEye, FiEyeOff } from "react-icons/fi";
import authAPI from "../../api/authAPI.js";
import { useAuth } from "../../context/AuthContext.jsx";
import toast from "react-hot-toast";

export default function ChangeMasterPasswordModal({ onClose }) {
  const { session } = useAuth();
  const token = session?.access_token;
  const [currentMasterPassword, setCurrentMasterPassword] = useState("");
  const [newMasterPassword, setNewMasterPassword] = useState("");
  const [confirmMasterPassword, setConfirmMasterPassword] = useState("");
  const [showCurrentMasterPassword, setShowCurrentMasterPassword] = useState(false);
  const [showNewMasterPassword, setShowNewMasterPassword] = useState(false);
  const [showConfirmMasterPassword, setShowConfirmMasterPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChangeMasterPassword = async (e) => {
    e.preventDefault();

    // Validation
    if (!currentMasterPassword.trim()) {
      toast.error("Please enter your current master password");
      return;
    }
    if (!newMasterPassword.trim()) {
      toast.error("Please enter your new master password");
      return;
    }
    if (newMasterPassword.length < 6) {
      toast.error("New master password must be at least 6 characters");
      return;
    }
    if (newMasterPassword !== confirmMasterPassword) {
      toast.error("Master passwords do not match");
      return;
    }
    if (currentMasterPassword === newMasterPassword) {
      toast.error("New master password must be different from current password");
      return;
    }

    try {
      setLoading(true);

      if (!token) {
        toast.error("Authentication required");
        return;
      }

      // Verify current password via API
      const verifyResult = await authAPI.verifyMasterPassword(token, currentMasterPassword);
      if (!verifyResult.success) {
        toast.error(verifyResult.message || "Current master password is incorrect");
        return;
      }

      // Update password via API
      const updateResult = await authAPI.updateUserDetails(token, { user_password: newMasterPassword });
      if (!updateResult.success) {
        toast.error(updateResult.message || "Failed to update master password");
        return;
      }

      toast.success("Master password changed successfully!");
      onClose();
    } catch (err) {
      toast.error(err.message || "An error occurred while changing master password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[110] p-6 animate-in fade-in duration-300">
      <div className="bg-[#1c1c1e] rounded-[32px] shadow-2xl max-w-md w-full border border-white/10 animate-in zoom-in-95 duration-300 overflow-hidden">
        <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <span className="text-orange-500">🔐</span> Change Master Password
          </h2>
          <button
            onClick={onClose}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-white/5 text-gray-400 hover:text-white transition-colors"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleChangeMasterPassword} className="p-8 space-y-6">
          <div className="space-y-2">
            <label className="block text-[13px] font-semibold text-gray-400 ml-1">
              Current Master Password
            </label>
            <div className="relative">
              <input
                type={showCurrentMasterPassword ? "text" : "password"}
                value={currentMasterPassword}
                onChange={(e) => setCurrentMasterPassword(e.target.value)}
                placeholder="Enter current master password"
                className="w-full bg-[#2c2c2e] text-white px-5 py-3.5 pr-12 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all placeholder:text-gray-600"
              />
              <button
                type="button"
                onClick={() => setShowCurrentMasterPassword(!showCurrentMasterPassword)}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
              >
                {showCurrentMasterPassword ? <FiEyeOff size={20} /> : <FiEye size={20} />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-[13px] font-semibold text-gray-400 ml-1">
              New Master Password
            </label>
            <div className="relative">
              <input
                type={showNewMasterPassword ? "text" : "password"}
                value={newMasterPassword}
                onChange={(e) => setNewMasterPassword(e.target.value)}
                placeholder="Enter new master password"
                className="w-full bg-[#2c2c2e] text-white px-5 py-3.5 pr-12 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all placeholder:text-gray-600"
              />
              <button
                type="button"
                onClick={() => setShowNewMasterPassword(!showNewMasterPassword)}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
              >
                {showNewMasterPassword ? <FiEyeOff size={20} /> : <FiEye size={20} />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-[13px] font-semibold text-gray-400 ml-1">
              Confirm New Master Password
            </label>
            <div className="relative">
              <input
                type={showConfirmMasterPassword ? "text" : "password"}
                value={confirmMasterPassword}
                onChange={(e) => setConfirmMasterPassword(e.target.value)}
                placeholder="Confirm new master password"
                className="w-full bg-[#2c2c2e] text-white px-5 py-3.5 pr-12 rounded-2xl focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all placeholder:text-gray-600"
              />
              <button
                type="button"
                onClick={() => setShowConfirmMasterPassword(!showConfirmMasterPassword)}
                className="absolute right-4 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
              >
                {showConfirmMasterPassword ? <FiEyeOff size={20} /> : <FiEye size={20} />}
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
              className="flex-1 py-4 bg-orange-500 text-white rounded-2xl hover:bg-orange-400 transition-all font-bold text-[15px] shadow-lg shadow-orange-500/20 disabled:bg-gray-700 disabled:text-gray-500 disabled:shadow-none"
            >
              {loading ? "Updating..." : "Update Password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}