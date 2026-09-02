import React, { useState, useRef, useEffect } from "react";
import { FiArrowLeft } from "react-icons/fi";
import toast from "react-hot-toast";
import { useAuth } from "../../context/AuthContext.jsx";
import { verify6DigitCode } from "../../utils/totp.js";

export default function TOTPVerificationScreen({ onVerify, onCancel, userEmail, onUseBackupCode }) {
  const { user } = useAuth();
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (code.length !== 6) {
      toast.error("Please enter a 6-digit code");
      return;
    }

    if (!/^\d+$/.test(code)) {
      toast.error("Code must contain only digits");
      return;
    }

    setVerifying(true);

    try {
      // Normalize email for consistent localStorage keys
      const normalizedEmail = userEmail.toLowerCase();
      
      let storedSecret = localStorage.getItem(`2fa_secret_${normalizedEmail}`);
      
      // If not in localStorage, try to get from user metadata
      if (!storedSecret) {
        // user object from useAuth should have user_metadata if already fetched
        // but if it's not available, we might need a way to fetch it
        storedSecret = user?.user_metadata?.twofa_secret;
        
        // Sync to localStorage for future use
        if (storedSecret) {
          localStorage.setItem(`2fa_secret_${normalizedEmail}`, storedSecret);
        }
      }
      
      if (!storedSecret) {
        toast.error("2FA secret not found. Please set up 2FA again.");
        onCancel();
        setVerifying(false);
        return;
      }

      const isValid = await verify6DigitCode(storedSecret, code);
      
      if (isValid) {
        toast.success("2FA verified!");
        onVerify();
      } else {
        toast.error("Invalid TOTP code. Please try again.");
        setCode("");
      }
    } catch (err) {
      toast.error("Verification failed");
    }

    setVerifying(false);
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-xl p-8 sm:p-10 border border-white/60">
          {/* Header */}
          <div className="space-y-2 mb-8">
            <h2 className="text-2xl sm:text-3xl font-semibold text-slate-900 text-center">
              🔐 Verify Your Identity
            </h2>
            <p className="text-sm sm:text-base text-center text-slate-500">
              Enter the 6-digit code from your authenticator app
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="block text-sm font-medium text-slate-600" htmlFor="totp-code">
                Authentication Code
              </label>
              <input
                ref={inputRef}
                id="totp-code"
                type="text"
                inputMode="numeric"
                maxLength="6"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-2xl tracking-widest font-mono text-slate-900 shadow-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                required
                disabled={verifying}
              />
              <p className="text-xs text-slate-400 text-center">
                Codes are 6 digits and refresh every 30 seconds
              </p>
            </div>

            <button
              type="submit"
              disabled={verifying || code.length !== 6}
              className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold py-3 rounded-xl shadow-lg transition focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:opacity-60"
            >
              {verifying ? "Verifying..." : "Verify"}
            </button>

            <button
              type="button"
              onClick={onCancel}
              disabled={verifying}
              className="w-full flex items-center justify-center gap-2 text-slate-600 hover:text-slate-900 font-medium py-2 transition"
            >
              <FiArrowLeft aria-hidden="true" />
              Back to Login
            </button>
          </form>

          <div className="mt-6 space-y-2">
            <p className="text-xs text-slate-400 text-center">
              Can't access your authenticator app?
            </p>
            <button
              type="button"
              onClick={onUseBackupCode}
              disabled={verifying}
              className="w-full text-center text-sm text-blue-600 hover:text-blue-700 font-medium underline transition disabled:opacity-60"
            >
              Use master password instead
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
