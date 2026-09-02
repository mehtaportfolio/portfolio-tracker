import React, { useState, useEffect, useRef } from "react";
import { FiEye, FiEyeOff } from "react-icons/fi";
import authAPI from "../../api/authAPI.js";
import { useMode } from "../../context/ModeContext.jsx";
import { useNavigation } from "../../context/NavigationContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";
import toast from "react-hot-toast";
import ChangeDataModePasswordModal from "./ChangeDataModePasswordModal.jsx";

export default function PasswordVerificationModal() {
  const isWebkitTextSecuritySupported = typeof document !== 'undefined' && 'WebkitTextSecurity' in document.documentElement.style;
  const { mode, passwordAttempts, incrementPasswordAttempts, resetPasswordAttempts, verifyPassword } = useMode();
  const { setIsHomeActive } = useNavigation();
  const { session } = useAuth();
  const token = session?.access_token;
  const [otp, setOtp] = useState(new Array(6).fill(""));
  const [loading, setLoading] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const maxAttempts = 3;
  const inputRefs = useRef([]);

  const handleVerify = async (e, passwordOverride) => {
    if (e) e.preventDefault();
    
    const password = passwordOverride || otp.join("");
    
    if (password.length !== 6) {
      toast.error("Please enter complete 6-digit password");
      return;
    }

    setLoading(true);

    try {
      if (!token) {
        toast.error("Authentication required");
        setLoading(false);
        return;
      }

      const result = await authAPI.verifyMasterPIN(token, password);

      if (result.success) {
        resetPasswordAttempts();
        verifyPassword();
        setIsHomeActive(true); // Default to Home page after master password verification as requested
        toast.success("Password verified!");
        setOtp(new Array(6).fill(""));
      } else {
        incrementPasswordAttempts();
        const remainingAttempts = maxAttempts - passwordAttempts - 1;
        if (remainingAttempts > 0) {
          toast.error(result.message || `Incorrect password. ${remainingAttempts} attempts remaining`);
        }
        setOtp(new Array(6).fill(""));
        if(inputRefs.current[0]) inputRefs.current[0].focus();
      }
    } catch (err) {
      console.error("Error verifying password:", err);
      toast.error("Verification failed");
      incrementPasswordAttempts();
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (passwordAttempts >= maxAttempts) {
      toast.error("Too many failed attempts. Closing app...");
      setTimeout(() => {
        window.close();
      }, 2000);
    }
  }, [passwordAttempts]);

  // Focus first input on mount
  useEffect(() => {
    if (mode === "data" && inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, [mode]);

  const handleChange = (element, index) => {
    let value = element.value;
    
    // If masked, remove the mask character to get the actual input
    if (!showPassword && value.includes("●")) {
      value = value.replace(/●/g, "");
    }

    if (value === "") {
      const newOtp = [...otp];
      newOtp[index] = "";
      setOtp(newOtp);
      return;
    }

    const lastChar = value.substring(value.length - 1);
    if (isNaN(lastChar)) return;

    const newOtp = [...otp];
    newOtp[index] = lastChar;
    setOtp(newOtp);

    // Focus next input
    if (lastChar && index < 5) {
      inputRefs.current[index + 1].focus();
    } else if (lastChar && index === 5) {
      const fullPassword = newOtp.join("");
      if (fullPassword.length === 6) {
        handleVerify(null, fullPassword);
      }
    }
  };

  const handleKeyDown = (e, index) => {
    if (e.key === "Backspace" && !otp[index] && index > 0) {
      inputRefs.current[index - 1].focus();
    }
    if (e.key === "Enter" && index === 5) {
        handleVerify(e);
    }
  };

  const handlePaste = (e) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData("text").slice(0, 6).split("");
    if (pastedData.some(char => isNaN(char))) return;
    
    const newOtp = [...otp];
    pastedData.forEach((value, index) => {
        if (index < 6) newOtp[index] = value;
    });
    setOtp(newOtp);
    
    const fullPassword = newOtp.join("");
    if (fullPassword.length === 6) {
        handleVerify(null, fullPassword);
    } else if (pastedData.length < 6) {
        inputRefs.current[pastedData.length].focus();
    } else {
        inputRefs.current[5].focus();
    }
  };

  if (mode !== "data") {
    return null;
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 z-[100] animate-in fade-in duration-300">
        <div className="bg-[#1c1c1e] rounded-[32px] shadow-2xl p-8 max-w-sm w-full transform transition-all border border-white/10 animate-in zoom-in-95 duration-300">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-white mb-2">Data Mode Access</h2>
            <p className="text-gray-400 text-[15px]">
              Enter your 6-digit security PIN
            </p>
          </div>

          <form onSubmit={handleVerify} className="space-y-8">
            <div className="flex items-center justify-between gap-3 mb-6">
              <div className="flex justify-between gap-2.5 flex-1">
                {otp.map((data, index) => (
                  <input
                    key={index}
                    type={showPassword ? "text" : (isWebkitTextSecuritySupported ? "text" : "password")}
                    style={{ WebkitTextSecurity: showPassword ? "none" : "disc" }}
                    maxLength={showPassword ? 1 : 2}
                    ref={(input) => (inputRefs.current[index] = input)}
                    value={data ? (showPassword ? data : "●") : ""}
                    onChange={(e) => handleChange(e.target, index)}
                    onKeyDown={(e) => handleKeyDown(e, index)}
                    onPaste={handlePaste}
                    disabled={loading || passwordAttempts >= maxAttempts}
                    className="w-10 h-14 bg-[#2c2c2e] border-none rounded-2xl text-center text-xl font-semibold text-white focus:ring-2 focus:ring-green-500/50 focus:outline-none transition-all duration-200 disabled:opacity-50"
                    inputMode="numeric"
                  />
                ))}
              </div>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="p-2 text-gray-400 hover:text-white transition-colors"
                title={showPassword ? "Hide PIN" : "Show PIN"}
              >
                {showPassword ? <FiEyeOff size={22} /> : <FiEye size={22} />}
              </button>
            </div>

            <div className="text-[13px] text-gray-400 text-center mb-2">
              Attempts remaining: <span className="font-semibold text-red-400">{maxAttempts - passwordAttempts}</span>/{maxAttempts}
            </div>

            <button
              type="submit"
              disabled={loading || passwordAttempts >= maxAttempts || otp.join("").length !== 6}
              className="w-full bg-green-500 hover:bg-green-400 disabled:bg-gray-700 disabled:text-gray-500 text-white font-bold py-4 px-4 rounded-2xl shadow-xl transform transition hover:scale-[1.02] active:scale-[0.98] duration-200 text-[17px]"
            >
              {loading ? "Verifying..." : "Unlock Data"}
            </button>
          </form>

          <div className="mt-8 text-center">
            <button
              onClick={() => setShowChangePasswordModal(true)}
              className="text-[14px] text-gray-500 hover:text-green-400 transition-colors duration-200 flex items-center justify-center gap-1 mx-auto font-medium"
            >
              <span>Forgot PIN?</span>
            </button>
          </div>
        </div>
      </div>

      {showChangePasswordModal && (
        <ChangeDataModePasswordModal onClose={() => setShowChangePasswordModal(false)} />
      )}
    </>
  );
}
