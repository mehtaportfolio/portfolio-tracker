import React, { useState, useEffect, useCallback } from "react";
import { FiCopy, FiCheck } from "react-icons/fi";
import { useAuth } from "../../context/AuthContext.jsx";
import toast from "react-hot-toast";
import { generateTOTPSecret, verify6DigitCode } from "../../utils/totp.js";

export default function TwoFactorAuthModal({ onClose, is2FAEnabled = false }) {
  const { user, updateUserMetadata } = useAuth();
  const [step, setStep] = useState(1); // 1: Setup, 2: Verify, 3: Backup Codes, 4: Success
  const [qrCode, setQrCode] = useState(null);
  const [secret, setSecret] = useState(null);
  const [verificationCode, setVerificationCode] = useState("");
  const [backupCodes, setBackupCodes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);
  const [disableConfirm, setDisableConfirm] = useState("");

  // Generate TOTP setup locally
  const generateManualTOTPSetup = useCallback((currentUser) => {
    const generatedSecret = generateTOTPSecret();
    setSecret(generatedSecret);

    // Generate QR code URL using standard TOTP format
    const issuer = "PortfolioTracker";
    const accountName = currentUser.email;
    const otpauthUrl = `otpauth://totp/${issuer}:${accountName}?secret=${generatedSecret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;

    // Use QR code API to generate the QR code
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
      otpauthUrl
    )}`;
    setQrCode(qrCodeUrl);
  }, []);

  const initiate2FASetup = useCallback(async () => {
    if (!user) {
      toast.error("User not found");
      return;
    }
    generateManualTOTPSetup(user);
  }, [user, generateManualTOTPSetup]);

  // Initialize 2FA setup
  useEffect(() => {
    if (!is2FAEnabled) {
      initiate2FASetup();
    }
  }, [is2FAEnabled, initiate2FASetup]);

  const handleVerifyCode = async (e) => {
    e.preventDefault();

    if (!verificationCode.trim() || verificationCode.length !== 6) {
      toast.error("Please enter a valid 6-digit code");
      return;
    }

    if (!/^\d+$/.test(verificationCode)) {
      toast.error("Code must contain only digits");
      return;
    }

    try {
      setLoading(true);
      
      // Verify the code actually matches the TOTP secret
      const isValidCode = await verify6DigitCode(secret, verificationCode);
      
      if (!isValidCode) {
        toast.error("Invalid TOTP code. Please check your authenticator app and try again.");
        setLoading(false);
        return;
      }

      if (!user) {
        toast.error("User not found");
        return;
      }

      // Store 2FA data in user metadata using backend API
      const { error: updateError } = await updateUserMetadata({
        twofa_enabled: true,
        twofa_secret: secret,
        twofa_enabled_at: new Date().toISOString(),
      });

      if (updateError) {
        toast.error("Failed to save 2FA settings: " + updateError.message);
        setLoading(false);
        return;
      }

      // Also save to localStorage for faster checks (normalize email to lowercase)
      localStorage.setItem(`2fa_enabled_${user.email.toLowerCase()}`, "true");
      localStorage.setItem(`2fa_secret_${user.email.toLowerCase()}`, secret);

      // Generate backup codes
      const codes = generateBackupCodes();
      setBackupCodes(codes);

      // Store backup codes locally
      localStorage.setItem(
        `2fa_backup_codes_${user.email.toLowerCase()}`,
        JSON.stringify(codes)
      );

      setStep(3);
      toast.success("2FA verified successfully! 🎉");
    } catch (err) {
      toast.error(err.message || "Error verifying code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const generateBackupCodes = () => {
    const codes = [];
    for (let i = 0; i < 10; i++) {
      const code = Array(8)
        .fill(0)
        .map(() => Math.floor(Math.random() * 10))
        .join("");
      codes.push(code);
    }
    return codes;
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedSecret(true);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopiedSecret(false), 2000);
  };

  const copyAllBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join("\n"));
    toast.success("All backup codes copied!");
  };

  const handleDisable2FA = async () => {
    if (disableConfirm !== "DISABLE") {
      toast.error('Type "DISABLE" to confirm');
      return;
    }

    try {
      setLoading(true);

      if (!user) {
        toast.error("User not found");
        return;
      }

      // Remove 2FA from user metadata using backend API
      const { error: updateError } = await updateUserMetadata({
        twofa_enabled: false,
        twofa_secret: null,
      });

      if (updateError) {
        toast.error("Failed to disable 2FA: " + updateError.message);
        return;
      }

      // Remove from localStorage
      localStorage.removeItem(`2fa_enabled_${user.email.toLowerCase()}`);
      localStorage.removeItem(`2fa_backup_codes_${user.email.toLowerCase()}`);
      localStorage.removeItem(`2fa_secret_${user.email.toLowerCase()}`);

      toast.success("2FA has been disabled");
      onClose();
    } catch (err) {
      toast.error("Error disabling 2FA");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <h2 className="text-2xl font-bold text-gray-900">
            🔐 Two-Factor Authentication
          </h2>
          <button
            onClick={onClose}
            className="text-gray-600 hover:text-gray-900 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {/* Step 1: Setup */}
          {step === 1 && !is2FAEnabled && (
            <div className="space-y-5">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <p className="text-sm text-gray-700">
                  <strong>Step 1:</strong> Scan the QR code with your authenticator
                  app (Google Authenticator, Microsoft Authenticator, or Authy)
                </p>
              </div>

              {loading ? (
                <div className="flex justify-center items-center h-64">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
                </div>
              ) : qrCode ? (
                <div className="flex flex-col items-center space-y-4">
                  <img
                    src={qrCode}
                    alt="2FA QR Code"
                    className="border-4 border-gray-200 p-2"
                  />
                  <div className="w-full bg-gray-50 p-4 rounded-lg">
                    <p className="text-xs font-semibold text-gray-600 mb-2">
                      Or enter this code manually:
                    </p>
                    <div className="flex items-center justify-between bg-white p-2 rounded border border-gray-300">
                      <code className="font-mono text-sm font-bold text-gray-900">
                        {secret}
                      </code>
                      <button
                        type="button"
                        onClick={() => copyToClipboard(secret)}
                        className="text-gray-500 hover:text-orange-600 ml-2"
                      >
                        {copiedSecret ? (
                          <FiCheck size={16} />
                        ) : (
                          <FiCopy size={16} />
                        )}
                      </button>
                    </div>
                  </div>

                  <button
                    onClick={() => setStep(2)}
                    className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-semibold"
                  >
                    Next: Verify Code
                  </button>
                </div>
              ) : (
                <div className="text-center py-8">
                  <p className="text-gray-500">Loading...</p>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Verify Code */}
          {step === 2 && (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                <p className="text-sm text-gray-700">
                  <strong>Step 2:</strong> Enter the 6-digit code from your
                  authenticator app
                </p>
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-semibold text-gray-700">
                  Verification Code
                </label>
                <input
                  type="text"
                  value={verificationCode}
                  onChange={(e) =>
                    setVerificationCode(e.target.value.slice(0, 6))
                  }
                  placeholder="000000"
                  maxLength="6"
                  className="w-full px-4 py-3 text-center text-2xl font-bold tracking-widest border-2 border-gray-300 rounded-lg focus:outline-none focus:border-orange-600"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex-1 px-4 py-2 bg-gray-300 text-gray-900 rounded-lg hover:bg-gray-400 transition-colors font-semibold"
                  disabled={loading}
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={loading || verificationCode.length !== 6}
                  className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-semibold disabled:bg-orange-400 disabled:cursor-not-allowed"
                >
                  {loading ? "Verifying..." : "Verify"}
                </button>
              </div>
            </form>
          )}

          {/* Step 3: Backup Codes */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                <p className="text-sm text-gray-700">
                  <strong>⚠️ Important:</strong> Save these backup codes in a
                  safe place. Use them to recover your account if you lose access
                  to your authenticator app.
                </p>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg space-y-2 max-h-64 overflow-y-auto">
                {backupCodes.map((code, idx) => (
                  <code
                    key={idx}
                    className="block font-mono text-sm text-gray-700 p-2 bg-white rounded border border-gray-200"
                  >
                    {code.replace(/(.{4})/, "$1-")}
                  </code>
                ))}
              </div>

              <button
                onClick={copyAllBackupCodes}
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-semibold flex items-center justify-center gap-2"
              >
                <FiCopy size={16} /> Copy All Codes
              </button>

              <button
                onClick={() => {
                  setStep(4);
                  toast.success("2FA enabled successfully!");
                }}
                className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-semibold"
              >
                Done
              </button>
            </div>
          )}

          {/* Step 4: Success */}
          {step === 4 && (
            <div className="space-y-4 text-center">
              <div className="text-6xl mb-4">✅</div>
              <h3 className="text-xl font-bold text-gray-900">
                2FA Enabled Successfully!
              </h3>
              <p className="text-gray-600">
                Your account is now protected with two-factor authentication.
              </p>
              <button
                onClick={onClose}
                className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-semibold"
              >
                Close
              </button>
            </div>
          )}

          {/* Disable 2FA (if already enabled) */}
          {is2FAEnabled && (
            <div className="space-y-4 mt-6 pt-6 border-t border-gray-200">
              <div className="bg-red-50 p-4 rounded-lg border border-red-200">
                <p className="text-sm font-semibold text-gray-700 mb-3">
                  ⚠️ Disable 2FA
                </p>
                <p className="text-xs text-gray-600 mb-4">
                  Type "DISABLE" below to disable two-factor authentication.
                </p>
                <input
                  type="text"
                  value={disableConfirm}
                  onChange={(e) => setDisableConfirm(e.target.value)}
                  placeholder='Type "DISABLE"'
                  className="w-full px-3 py-2 border border-red-300 rounded focus:outline-none focus:ring-1 focus:ring-red-500"
                />
                <button
                  onClick={handleDisable2FA}
                  disabled={loading || disableConfirm !== "DISABLE"}
                  className="w-full mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-semibold disabled:bg-red-400 disabled:cursor-not-allowed"
                >
                  {loading ? "Disabling..." : "Disable 2FA"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
