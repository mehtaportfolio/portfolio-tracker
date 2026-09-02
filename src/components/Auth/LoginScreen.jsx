import React, { useState, useEffect } from "react";
import { FiEye, FiEyeOff, FiTrendingUp, FiArrowLeft } from "react-icons/fi";
import { useAuth } from "../../context/AuthContext.jsx";
import { useNavigation } from "../../context/NavigationContext.jsx";
import toast from "react-hot-toast";
import TOTPVerificationScreen from "./TOTPVerificationScreen.jsx";

export default function LoginScreen() {
  const { user, signIn, signOut, updateUserMetadata, fetchUserDetails } = useAuth();
  const { setIsHomeActive } = useNavigation();
  const [email, setEmail] = useState(user?.email || "");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [show2FAVerification, setShow2FAVerification] = useState(false);
  const [showMasterPasswordInput, setShowMasterPasswordInput] = useState(false);
  const [masterPassword, setMasterPassword] = useState("");
  const [showMasterPassword, setShowMasterPassword] = useState(false);

  // Check sessionStorage for pending 2FA on mount
  useEffect(() => {
    const pending2FA = sessionStorage.getItem("pending_2fa_email");
    const pending2FAPassword = sessionStorage.getItem("pending_2fa_password");
    
    if (pending2FA && pending2FAPassword) {
      setEmail(pending2FA);
      setPassword(pending2FAPassword);
      setShow2FAVerification(true);
    }
  }, []);

  const check2FAEnabled = async (currentUser, userEmail) => {
    try {
      // Normalize email for consistent localStorage keys
      const normalizedEmail = userEmail.toLowerCase();
      
      // Check for BOTH twofa_enabled AND twofa_secret in metadata
      const has2FAEnabled = currentUser?.user_metadata?.twofa_enabled === true;
      const has2FASecret = currentUser?.user_metadata?.twofa_secret && currentUser.user_metadata.twofa_secret.length > 0;
      
      // If 2FA enabled but no secret, it's a broken state - clear it
      if (has2FAEnabled && !has2FASecret) {
        // Clear the broken 2FA flag
        await updateUserMetadata({
          twofa_enabled: false,
          twofa_secret: null,
          twofa_enabled_at: null,
        });
        
        // Clear localStorage
        localStorage.removeItem(`2fa_enabled_${normalizedEmail}`);
        localStorage.removeItem(`2fa_secret_${normalizedEmail}`);
        localStorage.removeItem(`2fa_backup_codes_${normalizedEmail}`);
        
        // Clear sessionStorage
        sessionStorage.removeItem("pending_2fa_email");
        sessionStorage.removeItem("pending_2fa_password");
        
        toast.error("2FA was incomplete. Please set it up again.");
        return false;
      }
      
      if (has2FAEnabled && has2FASecret) {
        // Sync to localStorage for faster future checks
        localStorage.setItem(`2fa_enabled_${normalizedEmail}`, "true");
        localStorage.setItem(`2fa_secret_${normalizedEmail}`, currentUser.user_metadata.twofa_secret);
        
        return true;
      }
    } catch (err) {
      // Silent error handling
    }

    return false;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSubmitting(true);

    const { data, error } = await signIn({ email, password });
    if (error) {
      toast.error(error.message || "Login failed");
      setSubmitting(false);
      return;
    }

    // Store password temporarily for biometric registration later if needed
    sessionStorage.setItem("last_entered_password", password);

    // Check if 2FA is enabled
    // We use data.user if available from signIn result
    const is2FAEnabled = await check2FAEnabled(data.user, email);
    
    if (is2FAEnabled) {
      // Save credentials to sessionStorage BEFORE signing out
      sessionStorage.setItem("pending_2fa_email", email);
      sessionStorage.setItem("pending_2fa_password", password);
      
      // Sign out immediately so App.js doesn't redirect to dashboard
      await signOut();
      setShow2FAVerification(true);
      toast.success("Please verify with your authenticator app");
    } else {
      setIsHomeActive(false); // Switch from Home to Dashboard/Data on success
      toast.success("Welcome Mehta!");
    }
    setSubmitting(false);
  };

  const togglePasswordVisibility = () => {
    setShowPassword((previous) => !previous);
  };

  const handleMasterPasswordSubmit = async (e) => {
    e.preventDefault();

    if (!masterPassword.trim()) {
      toast.error("Please enter your master password");
      return;
    }

    try {
      setSubmitting(true);

      // Query the user_details table to get the stored master password
      const { data, error } = await fetchUserDetails(email);

      if (error) {
        console.error("Query error:", error);
        toast.error("Failed to verify master password: " + error.message);
        setMasterPassword("");
        return;
      }

      if (!data) {
        toast.error("User details not found");
        setMasterPassword("");
        return;
      }

      // Compare entered master password with stored password
      if (masterPassword !== data.user_password) {
        toast.error("Invalid master password");
        setMasterPassword("");
        return;
      }

      // Master password verified - Now re-authenticate using the same method as TOTP
      // Use state variables first, fallback to sessionStorage if state is lost (e.g. on refresh)
      const currentEmail = email || sessionStorage.getItem("pending_2fa_email");
      const currentPassword = password || sessionStorage.getItem("pending_2fa_password");
      
      if (!currentEmail || !currentPassword) {
        toast.error("Session expired or credentials lost. Please login again.");
        setMasterPassword("");
        setShowMasterPasswordInput(false);
        setShow2FAVerification(false);
        return;
      }

      // Re-authenticate using the useAuth hook (same as TOTP verification does)
      const { error: signInError } = await signIn({ email: currentEmail, password: currentPassword });

      if (signInError) {
        toast.error("Re-authentication failed: " + signInError.message);
        setMasterPassword("");
        return;
      }

      // Clear sessionStorage after successful login
      sessionStorage.removeItem("pending_2fa_email");
      sessionStorage.removeItem("pending_2fa_password");
      sessionStorage.removeItem("last_entered_password");
      
      setShowMasterPasswordInput(false);
      setShow2FAVerification(false);
      setIsHomeActive(false); // Switch to Dashboard/Assets (trial mode) on success
      toast.success("Login successful! 🎉");
    } catch (err) {
      console.error("Master password verification error:", err);
      toast.error("Master password verification failed: " + err.message);
      setMasterPassword("");
    } finally {
      setSubmitting(false);
    }
  };

  if (showMasterPasswordInput) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 px-4 py-10">
        <div className="w-full max-w-md">
          <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-xl p-8 sm:p-10 border border-white/60">
            <div className="space-y-2 mb-8">
              <h2 className="text-2xl sm:text-3xl font-semibold text-slate-900 text-center">
                🔐 Master Password
              </h2>
              <p className="text-sm sm:text-base text-center text-slate-500">
                Enter your master password to bypass 2FA
              </p>
            </div>

            <form onSubmit={handleMasterPasswordSubmit} className="space-y-5">
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-600" htmlFor="master-password">
                  Master Password
                </label>
                <div className="relative">
                  <input
                    id="master-password"
                    type={showMasterPassword ? "text" : "password"}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-12 text-slate-900 shadow-sm focus:border-blue-400 focus:ring-2 focus:ring-blue-200"
                    value={masterPassword}
                    onChange={(e) => setMasterPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    disabled={submitting}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={() => setShowMasterPassword(!showMasterPassword)}
                    className="absolute inset-y-0 right-0 px-4 flex items-center text-slate-400 hover:text-slate-600"
                    aria-label={showMasterPassword ? "Hide password" : "Show password"}
                    disabled={submitting}
                  >
                    {showMasterPassword ? <FiEyeOff aria-hidden="true" /> : <FiEye aria-hidden="true" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting || !masterPassword.trim()}
                className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold py-3 rounded-xl shadow-lg transition focus:outline-none focus:ring-4 focus:ring-blue-200 disabled:opacity-60"
              >
                {submitting ? "Verifying..." : "Verify"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowMasterPasswordInput(false);
                  setShow2FAVerification(true);
                  setMasterPassword("");
                }}
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 text-slate-600 hover:text-slate-900 font-medium py-2 transition"
              >
                <FiArrowLeft aria-hidden="true" />
                Back to 2FA Code
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  if (show2FAVerification) {
    return (
      <TOTPVerificationScreen
        userEmail={email}
        onVerify={async () => {
          // Re-authenticate with email and password after TOTP verification
          const { error } = await signIn({ email, password });
          if (error) {
            toast.error("Re-authentication failed: " + error.message);
            setShow2FAVerification(false);
            setPassword("");
          } else {
            // Clear sessionStorage after successful login
            sessionStorage.removeItem("pending_2fa_email");
            sessionStorage.removeItem("pending_2fa_password");
            setShow2FAVerification(false);
            setIsHomeActive(false); // Switch from Home to Dashboard/Data on success
            toast.success("Welcome Mehta!");
          }
        }}
        onCancel={async () => {
          // Go back to login form
          sessionStorage.removeItem("pending_2fa_email");
          sessionStorage.removeItem("pending_2fa_password");
          setShow2FAVerification(false);
          setEmail("");
          setPassword("");
          toast.success("Please enter your credentials again.");
        }}
        onUseBackupCode={() => {
          setShow2FAVerification(false);
          setShowMasterPasswordInput(true);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 px-4 py-10">
      <div className="w-full max-w-5xl flex flex-col lg:flex-row items-center gap-10 lg:gap-16">
        {/* Left marketing panel */}
        <div className="w-full lg:w-1/2 text-center lg:text-left text-white space-y-6">
          <div className="inline-flex items-center gap-3 bg-white/10 backdrop-blur-md px-4 py-2 rounded-full text-sm text-slate-200">
            <FiTrendingUp className="text-pink-400" aria-hidden="true" />
            <span className="uppercase tracking-wide">Next-gen wealth dashboard</span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-bold leading-tight">
            Stay on top of your portfolio with secure and vibrant insights.
          </h1>
       </div>

        {/* Right login card */}
        <div className="w-full lg:w-2/5">
          <div className="bg-white/90 backdrop-blur-xl rounded-3xl shadow-xl p-8 sm:p-10 border border-white/60">
            <div className="space-y-2">
              <h2 className="text-2xl sm:text-3xl font-semibold text-slate-900 text-center">Welcome Mehta 👋</h2>
              <p className="text-sm sm:text-base text-center text-slate-500">
                Enter your credentials to access your personalized wealth cockpit.
              </p>
            </div>

            <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-600" htmlFor="login-email">
                  Email address
                </label>
                <input
                  id="login-email"
                  type="email"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 shadow-sm focus:border-pink-400 focus:ring-2 focus:ring-pink-200"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="username"
                  placeholder="you@example.com"
                  required
                />
              </div>

              <div className="space-y-2">
                <label className="block text-sm font-medium text-slate-600" htmlFor="login-password">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="login-password"
                    type={showPassword ? "text" : "password"}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-12 text-slate-900 shadow-sm focus:border-pink-400 focus:ring-2 focus:ring-pink-200"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    required
                  />
                  <button
                    type="button"
                    onClick={togglePasswordVisibility}
                    className="absolute inset-y-0 right-0 px-4 flex items-center text-slate-400 hover:text-slate-600"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <FiEyeOff aria-hidden="true" /> : <FiEye aria-hidden="true" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-gradient-to-r from-pink-500 via-red-500 to-orange-500 hover:from-pink-600 hover:via-red-600 hover:to-orange-600 text-white font-semibold py-3 rounded-xl shadow-lg transition focus:outline-none focus:ring-4 focus:ring-pink-200 disabled:opacity-60"
              >
                {submitting ? "Signing in..." : "Sign In"}
              </button>
            </form>

            <p className="mt-6 text-xs sm:text-sm text-slate-400 text-center">
              Secured with verified authentication. We never store your password locally.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
