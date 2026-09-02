import React, { useState, useEffect, useCallback, useRef } from "react";
import { FiX, FiAlertCircle, FiCheck } from "react-icons/fi";
import { FaFingerprint } from "react-icons/fa";
import { useBiometricAuth } from "../../hooks/useBiometricAuth.jsx";

/**
 * BiometricPrompt - Floating overlay component for biometric authentication
 * Shows on app open if biometric is enabled for the user
 */
export default function BiometricPrompt({ userEmail, onSuccess, onCancel, onError }) {
  const { authenticateWithBiometric, isAuthenticating } = useBiometricAuth();
  const [stage, setStage] = useState("ready");
  const [errorMessage, setErrorMessage] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const hasInitiatedRef = useRef(false);

  const MAX_RETRIES = 3;

  const handleBiometricAuth = useCallback(async () => {
    try {
      setStage("authenticating");
      setErrorMessage("");

      const result = await authenticateWithBiometric(userEmail);

      if (result?.success) {
        setStage("success");
        // toast.success("Biometric authentication successful!");
        
        setTimeout(() => {
          if (onSuccess) onSuccess(result);
        }, 800);
      }
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error("Biometric auth error:", error);

        let userMessage = error.message || "Biometric authentication failed";

        if (error.name === "NotAllowedError") {
          userMessage = "Biometric authentication cancelled";
        } else if (error.message?.includes("cancelled")) {
          userMessage = "Authentication cancelled";
        } else if (error.message?.includes("not registered")) {
          userMessage = "Biometric not registered";
        } else if (error.message?.includes("timeout")) {
          userMessage = "Authentication timed out";
        }

        setErrorMessage(userMessage);
        setRetryCount((prev) => {
          const newCount = prev + 1;
          if (newCount >= MAX_RETRIES) {
            setStage("error");
            if (onError) onError(userMessage);
          } else {
            setStage("ready");
          }
          return newCount;
        });
      }
    }
  }, [authenticateWithBiometric, userEmail, onSuccess, onError]);

  useEffect(() => {
    if (!hasInitiatedRef.current) {
      hasInitiatedRef.current = true;
      handleBiometricAuth();
    }
  }, [handleBiometricAuth]);

  const handleRetry = () => {
    handleBiometricAuth();
  };

  const handleCancel = () => {
    setStage("ready");
    if (onCancel) onCancel();
  };

  return (
    <div className="fixed inset-0 bg-gray-900/90 backdrop-blur-md flex items-center justify-center z-[9999] pointer-events-auto p-6">
      <div className="relative bg-gray-800 border border-gray-700 rounded-[2.5rem] shadow-2xl p-10 w-full max-w-sm mx-auto animate-scale-in overflow-hidden">
        {/* Apple Style Shine Effect */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-blue-500/10 blur-3xl rounded-full"></div>
        <div className="absolute -bottom-24 -right-24 w-48 h-48 bg-indigo-500/10 blur-3xl rounded-full"></div>

        {/* Close Button */}
        <button
          onClick={handleCancel}
          className="absolute top-6 right-6 text-gray-500 hover:text-gray-300 transition-colors p-1"
          aria-label="Cancel biometric"
          disabled={isAuthenticating}
        >
          <FiX size={20} />
        </button>

        {/* Ready State */}
        {stage === "ready" && (
          <div className="text-center space-y-8 py-4">
            <div className="flex justify-center">
              <div className="relative group cursor-pointer" onClick={handleBiometricAuth}>
                <div className="absolute inset-0 bg-blue-500/20 rounded-full blur-xl group-hover:bg-blue-500/30 transition-all duration-500"></div>
                <div className="relative bg-gray-700/50 p-6 rounded-full border border-gray-600 shadow-inner group-active:scale-95 transition-transform duration-200">
                  <FaFingerprint size={56} className="text-blue-400" />
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-white tracking-tight">Biometric Sign In</h2>
              <p className="text-gray-400 text-sm leading-relaxed px-4">
                Unlock your portfolio securely using your fingerprint or face recognition
              </p>
            </div>

            <div className="pt-4">
              <button
                onClick={handleBiometricAuth}
                disabled={isAuthenticating}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3.5 rounded-2xl transition-all shadow-lg shadow-blue-900/20 active:scale-[0.98] disabled:opacity-50"
              >
                {isAuthenticating ? "Authenticating..." : "Use Biometric"}
              </button>
            </div>

            {retryCount > 0 && retryCount < MAX_RETRIES && (
              <p className="text-xs text-red-400 font-medium">
                Try again (Attempt {retryCount} of {MAX_RETRIES})
              </p>
            )}
          </div>
        )}

        {/* Authenticating State */}
        {stage === "authenticating" && (
          <div className="text-center space-y-8 py-4">
            <div className="flex justify-center">
              <div className="relative">
                <div className="absolute inset-0 bg-blue-500/30 rounded-full animate-ping opacity-20"></div>
                <div className="absolute inset-0 bg-blue-400/20 rounded-full blur-2xl animate-pulse"></div>
                <div className="relative bg-gray-700/50 p-6 rounded-full border border-blue-500/30 shadow-inner">
                  <FaFingerprint size={56} className="text-blue-400 animate-pulse" />
                </div>
              </div>
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-white tracking-tight">Authenticating</h2>
              <p className="text-gray-400 text-sm leading-relaxed">
                Scanning your biometric data...
              </p>
            </div>

            <div className="flex justify-center pt-2">
              <div className="flex space-x-1.5">
                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce"></div>
              </div>
            </div>
          </div>
        )}

        {/* Success State */}
        {stage === "success" && (
          <div className="text-center space-y-8 py-4 animate-scale-up">
            <div className="flex justify-center">
              <div className="relative">
                <div className="absolute inset-0 bg-green-500/20 rounded-full blur-2xl"></div>
                <div className="relative bg-gray-700/50 p-6 rounded-full border border-green-500/50 shadow-inner shadow-green-900/20">
                  <FiCheck size={56} className="text-green-400" />
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-semibold text-white tracking-tight">Authenticated</h2>
              <p className="text-green-400/80 text-sm font-medium">Access granted successfully</p>
            </div>
          </div>
        )}

        {/* Error State */}
        {stage === "error" && (
          <div className="text-center space-y-8 py-4">
            <div className="flex justify-center">
              <div className="relative">
                <div className="absolute inset-0 bg-red-500/20 rounded-full blur-2xl"></div>
                <div className="relative bg-gray-700/50 p-6 rounded-full border border-red-500/50 shadow-inner">
                  <FiAlertCircle size={56} className="text-red-400" />
                </div>
              </div>
            </div>
            <div className="space-y-2 px-2">
              <h2 className="text-2xl font-semibold text-white tracking-tight">Verification Failed</h2>
              <p className="text-gray-400 text-sm">{errorMessage}</p>
              <p className="text-gray-500 text-xs mt-2 italic">
                Please sign in with your password to continue
              </p>
            </div>

            <div className="pt-2">
              <button
                onClick={handleCancel}
                className="w-full bg-gray-700 hover:bg-gray-600 text-white font-medium py-3.5 rounded-2xl transition-all active:scale-[0.98] border border-gray-600"
              >
                Use Password
              </button>
            </div>
          </div>
        )}

        {/* Retry Option for Failed Single Attempt */}
        {stage === "ready" && retryCount < MAX_RETRIES && retryCount > 0 && (
          <div className="mt-4 flex gap-3 px-2 pb-2">
            <button
              onClick={handleRetry}
              className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-medium py-2.5 rounded-xl transition-all border border-gray-600 text-sm"
            >
              Try Again
            </button>
            <button
              onClick={handleCancel}
              className="flex-1 bg-transparent border border-gray-600 text-gray-400 hover:text-gray-200 py-2.5 rounded-xl transition-all text-sm"
            >
              Use Password
            </button>
          </div>
        )}

        {/* Footer hint */}
        <div className="mt-4 text-center">
           <span className="text-[10px] text-gray-600 uppercase tracking-widest font-semibold">Secure Authentication</span>
        </div>
      </div>

      <style>{`
        @keyframes scale-in {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }
        @keyframes scale-up {
          0% { transform: scale(1); }
          50% { transform: scale(1.05); }
          100% { transform: scale(1); }
        }
        .animate-scale-in {
          animation: scale-in 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .animate-scale-up {
          animation: scale-up 0.5s ease-out;
        }
      `}</style>
    </div>
  );
}