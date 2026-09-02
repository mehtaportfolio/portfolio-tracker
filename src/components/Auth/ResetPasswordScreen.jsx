import React, { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "../../supabaseClient.js";
import toast from "react-hot-toast";

const PASSWORD_MIN_LENGTH = 8;

function buildURLWithoutToken(searchParams) {
  const params = new URLSearchParams(searchParams);
  params.delete("token_hash");
  params.delete("type");
  params.delete("_token");
  params.delete("code");
  const newSearch = params.toString();
  const { origin, pathname } = window.location;
  return `${origin}${pathname}${newSearch ? `?${newSearch}` : ""}`;
}

export default function ResetPasswordScreen({ onClose }) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [tokenHash, setTokenHash] = useState(null);
  const [type, setType] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setTokenHash(params.get("token_hash"));
    setType(params.get("type"));

    const code = params.get("code");
    if (code) {
      supabase.auth.exchangeCodeForSession({ code }).catch(() => {
        // Silent error - user will see validation error on form submission
      });
    }
  }, []);

  const isValid = useMemo(() => {
    return (
      password.length >= PASSWORD_MIN_LENGTH &&
      password === confirmPassword
    );
  }, [password, confirmPassword]);

  const clearResetParams = useCallback(() => {
    const newUrl = buildURLWithoutToken(window.location.search);
    window.history.replaceState(null, "", newUrl);
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!tokenHash) {
      toast.error("Reset link is missing or expired. Request a new one.");
      return;
    }

    if (!isValid) {
      toast.error("Passwords must match and meet the minimum length.");
      return;
    }

    setSubmitting(true);

    const { error } = await supabase.auth.updateUser({ password });

    setSubmitting(false);

    if (error) {
      toast.error(error.message || "Failed to update password");
      return;
    }

    toast.success("Password updated. You can sign in now.");
    clearResetParams();
    if (typeof onClose === "function") {
      onClose();
    }
  };

  if (type !== "recovery" || !tokenHash) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
        <div className="max-w-sm w-full bg-white rounded-xl shadow-md p-6 space-y-4 text-center">
          <h1 className="text-2xl font-semibold">Link Invalid</h1>
          <p className="text-sm text-gray-500">
            The password reset link is invalid or has expired. Request a new password reset email.
          </p>
          <button
            type="button"
            onClick={onClose}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2 rounded-lg transition"
          >
            Back to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 px-4">
      <div className="max-w-sm w-full bg-white rounded-xl shadow-md p-8 space-y-6">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold">Reset Password</h1>
          <p className="text-sm text-gray-500">
            Enter a new password for your account.
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              New Password
            </label>
            <input
              type="password"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="new-password"
              minLength={PASSWORD_MIN_LENGTH}
              required
            />
            <p className="text-xs text-gray-400 mt-1">
              Must be at least {PASSWORD_MIN_LENGTH} characters.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirm Password
            </label>
            <input
              type="password"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-red-500"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              minLength={PASSWORD_MIN_LENGTH}
              required
            />
          </div>

          <button
            type="submit"
            disabled={submitting || !isValid}
            className="w-full bg-red-600 hover:bg-red-700 text-white font-medium py-2 rounded-lg transition disabled:opacity-50"
          >
            {submitting ? "Updating..." : "Update Password"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            clearResetParams();
            if (typeof onClose === "function") {
              onClose();
            }
          }}
          className="w-full text-sm text-gray-500 hover:text-gray-700"
        >
          Back to login
        </button>
      </div>
    </div>
  );
}