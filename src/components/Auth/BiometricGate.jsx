import React, { useState, useEffect } from "react";
import BiometricPrompt from "./BiometricPrompt.jsx";
import LoginScreen from "./LoginScreen.jsx";
import toast from "react-hot-toast";
import { useNavigation } from "../../context/NavigationContext.jsx";
import { useAuth } from "../../context/AuthContext.jsx";

export default function BiometricGate() {
  const [showBiometric, setShowBiometric] = useState(false);
  const [biometricEmail, setBiometricEmail] = useState("");
  const [biometricLoading, setBiometricLoading] = useState(true);
  const { setIsHomeActive } = useNavigation();
  const { signIn, user } = useAuth();

  useEffect(() => {
    const checkBiometricAtEntry = async () => {
      try {
        const lastUsedEmail = localStorage.getItem("last_biometric_email") || user?.email;

        if (lastUsedEmail) {
          const normalizedEmail = lastUsedEmail.toLowerCase();
          const biometricEnabledKey = `biometric_enabled_${normalizedEmail}`;
          const biometricEnabledValue = localStorage.getItem(biometricEnabledKey);
          const biometricEnabledForEmail = biometricEnabledValue === "true";

          if (biometricEnabledForEmail) {
            const hasPassword = localStorage.getItem(`biometric_password_${normalizedEmail}`);
            console.log(`[Gate] Biometric enabled for ${normalizedEmail}. Password in storage: ${!!hasPassword}`);
            
            if (!hasPassword) {
              console.warn(`[Gate] Biometric enabled but password missing for ${normalizedEmail}. Cleaning up.`);
              localStorage.removeItem(biometricEnabledKey);
              localStorage.removeItem(`biometric_credential_${normalizedEmail}`);
              setBiometricLoading(false);
              return;
            }

            setBiometricEmail(normalizedEmail);
            setShowBiometric(true);
            setBiometricLoading(false); // Done loading initial check
            return; // Exit early as we found what we need
          } else {
            console.log("Biometric NOT enabled for", normalizedEmail);
          }
        } else {
          console.log("No last_biometric_email found");
        }
      } catch (err) {
        console.error("Biometric check error:", err);
      } finally {
        setBiometricLoading(false);
      }
    };

    checkBiometricAtEntry();
  }, [user?.email]);

  const handleBiometricSuccess = async (result) => {
    const { email, password } = result;
    const normalizedEmail = email.toLowerCase();
    
    try {
      console.log(`[Gate] Biometric success for ${normalizedEmail}. Password present: ${!!password}`);
      setBiometricLoading(true);
      
      const { error } = await signIn({ email, password });
      
      if (error) {
        console.error("[Gate] Sign in error:", error);
        
        // If the login fails but the biometric part succeeded, it might be WRONG credentials
        // But only clear if it's NOT a network error
        const isNetworkError = error.code === 'ERR_NETWORK' || error.message?.includes('Network Error');
        
        if (!isNetworkError) {
          console.warn("[Gate] Invalid credentials. Clearing biometric setup.");
          localStorage.removeItem(`biometric_password_${normalizedEmail}`);
          localStorage.removeItem(`biometric_enabled_${normalizedEmail}`);
          localStorage.removeItem(`biometric_credential_${normalizedEmail}`);
        }
        throw error;
      }

      // Clear the temporary password from sessionStorage if it was used
      sessionStorage.removeItem("last_entered_password");

      setShowBiometric(false);
      setIsHomeActive(false); // Switch from Home to Dashboard/Data on success
      toast.success("Welcome back!");
    } catch (err) {
      console.error("[Gate] Biometric success handler error:", err);
      
      const isNetworkError = err.code === 'ERR_NETWORK' || err.message?.includes('Network Error');
      if (isNetworkError) {
        toast.error("Network error: Please check if the server is running");
      } else {
        toast.error("Biometric login failed: " + (err.message || "Invalid credentials"));
      }
      
      // Don't automatically hide on network error, let user retry or cancel
      if (!isNetworkError) {
         setShowBiometric(false);
      }
    } finally {
      setBiometricLoading(false);
    }
  };

  const handleBiometricCancel = () => {
    console.log("Biometric cancelled by user");
    setShowBiometric(false);
  };

  const handleBiometricError = (errorMessage) => {
    toast.error(errorMessage);
    setShowBiometric(false);
  };

  if (biometricLoading && !showBiometric) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <span className="text-gray-400">Checking credentials...</span>
      </div>
    );
  }

  if (showBiometric) {
    return (
      <BiometricPrompt
        userEmail={biometricEmail}
        onSuccess={handleBiometricSuccess}
        onCancel={handleBiometricCancel}
        onError={handleBiometricError}
      />
    );
  }

  return <LoginScreen />;
}
