import React, { useState, useEffect, useRef } from "react";
import mfAPI from "../../../api/mfAPI.js";
import { API_URL } from "../../../config/apiConfig.js";
import { useAuth } from "../../../context/AuthContext.jsx";
import { Upload, X, Loader2, Zap, Mail } from "lucide-react";
import { toast } from "react-hot-toast";

const CASImportModal = ({ onClose }) => {
  const { session } = useAuth();
  const [accountName, setAccountName] = useState("");
  const [accountOptions, setAccountOptions] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [importMethod, setImportMethod] = useState(null); // null, 'upload', 'autofetch', 'gmailfetch'
  const [currentLog, setCurrentLog] = useState("");
  const logEndRef = useRef(null);

  // Clean up session if modal closes or component unmounts
  useEffect(() => {
    return () => {
      // In a real app, we might want to call a logout/cleanup endpoint
      // but here we just rely on server-side cleanup of stale sessions
    };
  }, []);

  useEffect(() => {
    let eventSource;
    if (loading && importMethod === "gmailfetch") {
      eventSource = new EventSource(`${API_URL}/cas/logs`);
      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        setCurrentLog(data.message);
      };
      eventSource.onerror = () => {
        eventSource.close();
      };
    }
    return () => {
      if (eventSource) eventSource.close();
    };
  }, [loading, importMethod]);

  useEffect(() => {
    // No longer strictly needed for single line but kept for consistency if it grows
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [currentLog]);

  useEffect(() => {
    const fetchAccounts = async () => {
      try {
        const data = await mfAPI.getMFAccountNames(session?.access_token);
        if (data) {
          setAccountOptions(data.sort());
        }
      } catch (error) {
        console.error("Error fetching account names:", error);
      }
    };
    fetchAccounts();
  }, [session?.access_token]);

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.type !== "application/pdf") {
        toast.error("Please upload a PDF file");
        return;
      }
      setSelectedFile(file);
    }
  };

  const handleProcessCAS = async () => {
    if (!accountName || !selectedFile) {
      toast.error("Please select account and file");
      return;
    }

    setLoading(true);
    const formData = new FormData();
    formData.append("file", selectedFile);
    formData.append("accountName", accountName);

    try {
      const result = await mfAPI.uploadCAS(formData, session?.access_token);

      toast.success(result.message || "CAS processed successfully");
      onClose();
    } catch (err) {
      console.error("CAS Import Error:", err);
      toast.error(err.response?.data?.error || err.message || "Something went wrong while processing CAS");
    } finally {
      setLoading(false);
    }
  };

  const handleAutoFetch = () => {
    // Open CAMS website in a new tab for manual processing
    window.open("https://www.camsonline.com/Investors/Statements/Consolidated-Account-Statement", "_blank");
    toast.success("Opening CAMS website for manual request...");
    onClose();
  };

const handleAutoCAS = async () => {
  if (!accountName) {
    toast.error("Please select an account.");
    return;
  }

  try {
    setLoading(true);

const response = await mfAPI.autoGenerateCAS(
    accountName,
    session?.access_token
);

if (response.success) {
  toast.success(response.message);

  if (response.referenceNumber) {
    toast.success(
      `Reference No: ${response.referenceNumber}`,
      { duration: 5000 }
    );
  }
} else {
  toast.error(response.message || "Auto CAS failed.");
}


  } catch (error) {
    console.error(error);

    toast.error(
      error.response?.data?.message ||
      error.message ||
      "Failed to generate CAS."
    );
  } finally {
    setLoading(false);
  }
};

  const handleGmailFetch = async () => {
    if (!accountName) {
      toast.error("Please select an account");
      return;
    }

    setCurrentLog("");
    setLoading(true);
    try {
      const result = await mfAPI.gmailFetchCAS(accountName, session?.access_token);
      toast.success(result.message || "Gmail fetch and processing completed!");
    } catch (err) {
      console.error("Gmail Fetch Error:", err);
      toast.error(err.response?.data?.error || err.message || "Failed to fetch from Gmail");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-60 z-[70] p-4"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-800 rounded-[2rem] shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col p-6 animate-in fade-in zoom-in-95 duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-between items-center mb-6 flex-shrink-0">
          <h3 className="text-xl font-bold text-white">Import CAS</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            disabled={loading}
          >
            <X size={24} />
          </button>
        </div>

        <div className="space-y-6 overflow-y-auto pr-1 custom-scrollbar">
          {/* Account Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Select Account
            </label>
            <select
              value={accountName}
              onChange={(e) => {
                setAccountName(e.target.value);
                if (!e.target.value) setImportMethod(null);
              }}
              disabled={loading}
              className="bg-gray-800 border border-gray-700 text-white rounded-xl p-3.5 w-full focus:ring-2 focus:ring-blue-500/20 outline-none appearance-none cursor-pointer disabled:opacity-50"
            >
              <option value="">Select Account</option>
              {accountOptions.map((acc, idx) => (
                <option key={idx} value={acc}>
                  {acc}
                </option>
              ))}
            </select>
          </div>

          {accountName && !importMethod && (
            <div className="grid grid-cols-4 gap-3">
              <button
                onClick={() => setImportMethod("upload")}
                className="flex flex-col items-center justify-center gap-2 bg-gray-800 border border-gray-700 p-4 rounded-2xl hover:bg-gray-700 transition-all group"
              >
                <Upload size={24} className="text-blue-500 group-hover:scale-110 transition-transform" />
                <span className="text-[11px] font-semibold text-white">Upload</span>
              </button>
              <button
                onClick={() => setImportMethod("autofetch")}
                className="flex flex-col items-center justify-center gap-2 bg-gray-800 border border-gray-700 p-4 rounded-2xl hover:bg-gray-700 transition-all group"
              >
                <Zap size={24} className="text-yellow-500 group-hover:scale-110 transition-transform" />
                <span className="text-[11px] font-semibold text-white">CAMS</span>
              </button>
<button
  onClick={() => setImportMethod("autocas")}
  className="flex flex-col items-center justify-center gap-2 bg-gray-800 border border-gray-700 p-4 rounded-2xl hover:bg-gray-700 transition-all group"
>
  <Zap
    size={24}
    className="text-green-500 group-hover:scale-110 transition-transform"
  />
  <span className="text-[11px] font-semibold text-white">
    Auto CAS
  </span>
</button>


              <button
                onClick={() => setImportMethod("gmailfetch")}
                className="flex flex-col items-center justify-center gap-2 bg-gray-800 border border-gray-700 p-4 rounded-2xl hover:bg-gray-700 transition-all group"
              >
                <Mail size={24} className="text-pink-500 group-hover:scale-110 transition-transform" />
                <span className="text-[11px] font-semibold text-white">Gmail</span>
              </button>
            </div>
          )}

          {importMethod === "upload" && (
            <>
              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">
                  CAS Input File (PDF)
                </label>
                <div className="relative">
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleFileChange}
                    className="hidden"
                    id="cas-file-upload"
                    disabled={loading}
                  />
                  <label
                    htmlFor="cas-file-upload"
                    className={`flex flex-col items-center justify-center gap-2 bg-gray-800 border-2 border-dashed border-gray-700 text-gray-400 rounded-xl p-8 cursor-pointer hover:border-blue-500/50 hover:bg-gray-800/80 transition-all group ${
                      loading ? "opacity-50 cursor-not-allowed" : ""
                    }`}
                  >
                    <Upload size={24} className="group-hover:text-blue-500 transition-colors" />
                    <span className="text-center break-all">
                      {selectedFile ? selectedFile.name : "Click to upload CAS PDF file"}
                    </span>
                  </label>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-3 pt-4 border-t border-gray-800">
                <button
                  onClick={handleProcessCAS}
                  disabled={!accountName || !selectedFile || loading}
                  className="w-full py-3.5 rounded-xl bg-pink-600 text-white font-bold hover:bg-pink-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-pink-900/20 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 size={20} className="animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "Process CAS"
                  )}
                </button>
                <button
                  onClick={() => setImportMethod(null)}
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl bg-gray-800 text-gray-300 font-medium hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  Back
                </button>
              </div>
            </>
          )}

          {importMethod === "autofetch" && (
            <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
              <div className="bg-blue-500/10 border border-blue-500/20 p-5 rounded-2xl">
                <div className="flex items-center gap-3 mb-4">
                  <Zap size={24} className="text-yellow-500" />
                  <h4 className="text-white font-bold text-lg">Manual CAMS Request</h4>
                </div>
                <p className="text-sm text-gray-400 leading-relaxed">
                  Clicking the button below will open the CAMS website in a new tab. 
                  Please fill in your details manually to receive the CAS statement on your email.
                </p>
              </div>

              <div className="flex flex-col gap-3 pt-4 border-t border-gray-800">
                <button
                  onClick={handleAutoFetch}
                  className="w-full py-3.5 rounded-xl bg-blue-600 text-white font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-900/20 flex items-center justify-center gap-2"
                >
                  Go to CAMS Website
                </button>
                <button
                  onClick={() => setImportMethod(null)}
                  className="w-full py-3.5 rounded-xl bg-gray-800 text-gray-300 font-medium hover:bg-gray-700 transition-colors"
                >
                  Back
                </button>
              </div>
            </div>
          )}


{importMethod === "autocas" && (
  <div className="space-y-6 animate-in fade-in slide-in-from-top-2 duration-300">
    <div className="bg-green-500/10 border border-green-500/20 p-5 rounded-2xl">
      <div className="flex items-center gap-3 mb-4">
        <Zap size={24} className="text-green-500" />
        <h4 className="text-white font-bold text-lg">
          Automatic CAMS Request
        </h4>
      </div>

      <p className="text-sm text-gray-400 leading-relaxed">
        A CAMS Consolidated Account Statement will be generated automatically
        for the selected account using the configured credentials.
      </p>

      <div className="mt-4 bg-gray-900 rounded-xl p-3 border border-gray-700">
        <div className="text-xs text-gray-500 uppercase mb-1">
          Selected Account
        </div>

        <div className="text-white font-semibold">
          {accountName}
        </div>
      </div>
    </div>

    <div className="flex flex-col gap-3 pt-4 border-t border-gray-800">
      <button
        onClick={handleAutoCAS}
        disabled={loading}
        className="w-full py-3.5 rounded-xl bg-green-600 text-white font-bold hover:bg-green-700 transition-colors shadow-lg shadow-green-900/20 flex items-center justify-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 size={20} className="animate-spin" />
            Generating...
          </>
        ) : (
          "Generate CAS"
        )}
      </button>

      <button
        onClick={() => setImportMethod(null)}
        disabled={loading}
        className="w-full py-3.5 rounded-xl bg-gray-800 text-gray-300 font-medium hover:bg-gray-700 transition-colors"
      >
        Back
      </button>
    </div>
  </div>
)}

          {importMethod === "gmailfetch" && (
            <div className="space-y-6">
              <div className="bg-pink-500/10 border border-pink-500/20 p-5 rounded-2xl">
                <div className="flex items-center gap-3 mb-4">
                  <Mail size={24} className="text-pink-500" />
                  <h4 className="text-white font-bold text-lg">Gmail Import</h4>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed">
                  We will search your Gmail for the latest CAS statement from CAMS and process it automatically.
                </p>
              </div>

              {currentLog && (
                <div className="bg-black/40 border border-gray-800 rounded-2xl p-4 font-mono text-xs">
                  <div className="flex items-center gap-2 mb-2 text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    Status Update
                  </div>
                  <div className="text-gray-300 leading-relaxed break-words min-h-[1.5em] flex items-center">
                    {currentLog}
                  </div>
                </div>
              )}

              <div className="flex flex-col gap-3 pt-4 border-t border-gray-800">
                <button
                  onClick={handleGmailFetch}
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl bg-pink-600 text-white font-bold hover:bg-pink-700 transition-colors shadow-lg shadow-pink-900/20 flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 size={20} className="animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "Process Gmail"
                  )}
                </button>
                <button
                  onClick={() => setImportMethod(null)}
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl bg-gray-800 text-gray-300 font-medium hover:bg-gray-700 transition-colors disabled:opacity-50"
                >
                  Back
                </button>
              </div>
            </div>
          )}

          {!importMethod && (
            <div className="flex flex-col gap-3 pt-4 border-t border-gray-800">
              <button
                onClick={onClose}
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-gray-800 text-gray-300 font-medium hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CASImportModal;
