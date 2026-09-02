import React, { useState, useEffect, useCallback } from "react";
import mfAPI from "../../../api/mfAPI.js";
import { useAuth } from "../../../context/AuthContext.jsx";
import { Activity, Search, Calendar, Filter, CheckCircle2, XCircle, SkipForward } from "lucide-react";

const MFLogs = () => {
    const { session } = useAuth();
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        serviceName: "",
        status: "",
        month: new Date().toISOString().substring(0, 7) // Default to current month YYYY-MM
    });

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        try {
            // Only pass month to API to get all logs for the month for local filtering and dynamic options
            const data = await mfAPI.getScriptLogs({ month: filters.month }, session);
            setLogs(data || []);
        } catch (error) {
            console.error("Error fetching logs:", error);
        } finally {
            setLoading(false);
        }
    }, [filters.month, session]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({ ...prev, [name]: value }));
    };

    // Derive unique values for filters from logs
    const uniqueServiceNames = [...new Set(logs.map(log => log.service_name))].filter(Boolean).sort();
    const uniqueStatuses = [...new Set(logs.map(log => log.status))].filter(Boolean).sort();

    // Filter logs locally
    const filteredLogs = logs.filter(log => {
        const matchService = !filters.serviceName || log.service_name === filters.serviceName;
        const matchStatus = !filters.status || log.status === filters.status;
        return matchService && matchStatus;
    });

    const getStatusIcon = (status) => {
        switch (status.toLowerCase()) {
            case 'success': return <CheckCircle2 size={16} className="text-emerald-400" />;
            case 'failed': return <XCircle size={16} className="text-rose-400" />;
            case 'skipped': return <SkipForward size={16} className="text-amber-400" />;
            default: return <Activity size={16} className="text-blue-400" />;
        }
    };

    const getStatusColor = (status) => {
        switch (status.toLowerCase()) {
            case 'success': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
            case 'failed': return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
            case 'skipped': return 'text-amber-400 bg-amber-500/10 border-amber-500/20';
            default: return 'text-blue-400 bg-blue-500/10 border-blue-500/20';
        }
    };

    // Generate month options for current and previous month
    const getMonthOptions = () => {
        const options = [];
        const now = new Date();
        for (let i = 0; i < 2; i++) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            const val = d.toISOString().substring(0, 7);
            const label = d.toLocaleString('default', { month: 'long', year: 'numeric' });
            options.push({ val, label });
        }
        return options;
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Filters Header */}
            <div className="bg-gray-800/20 backdrop-blur-xl p-6 rounded-[2rem] border border-gray-700/30">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Service Name Filter */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                            <Search size={12} /> Service Name
                        </label>
                        <select
                            name="serviceName"
                            value={filters.serviceName}
                            onChange={handleFilterChange}
                            className="w-full bg-gray-900/50 border border-gray-700/50 rounded-xl px-4 py-2.5 text-sm text-white font-bold focus:ring-2 focus:ring-purple-500/50 transition-all outline-none appearance-none"
                        >
                            <option value="" hidden>Service Name</option>
                            <option value="">All Services</option>
                            {uniqueServiceNames.map(name => (
                                <option key={name} value={name}>{name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Status Filter */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                            <Filter size={12} /> Status
                        </label>
                        <select
                            name="status"
                            value={filters.status}
                            onChange={handleFilterChange}
                            className="w-full bg-gray-900/50 border border-gray-700/50 rounded-xl px-4 py-2.5 text-sm text-white font-bold focus:ring-2 focus:ring-purple-500/50 transition-all outline-none appearance-none"
                        >
                            <option value="" hidden>Status</option>
                            <option value="">All Statuses</option>
                            {uniqueStatuses.map(status => (
                                <option key={status} value={status}>{status}</option>
                            ))}
                        </select>
                    </div>

                    {/* Month Filter */}
                    <div className="space-y-2">
                        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-widest flex items-center gap-2">
                            <Calendar size={12} /> Month
                        </label>
                        <select
                            name="month"
                            value={filters.month}
                            onChange={handleFilterChange}
                            className="w-full bg-gray-900/50 border border-gray-700/50 rounded-xl px-4 py-2.5 text-sm text-white font-bold focus:ring-2 focus:ring-purple-500/50 transition-all outline-none appearance-none"
                        >
                            {getMonthOptions().map(opt => (
                                <option key={opt.val} value={opt.val}>{opt.label}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* Logs Table */}
            <div className="bg-gray-800/20 backdrop-blur-xl rounded-[2.5rem] border border-gray-700/30 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-gray-700/50">
                                <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Service</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Status</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Details</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest">Run By</th>
                                <th className="px-6 py-4 text-[10px] font-bold text-gray-500 uppercase tracking-widest text-right">Date & Time</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700/30">
                            {loading ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-gray-500 font-bold uppercase tracking-widest">
                                        Loading logs...
                                    </td>
                                </tr>
                            ) : filteredLogs.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="px-6 py-12 text-center text-gray-500 font-bold uppercase tracking-widest">
                                        {logs.length === 0 ? "No logs found for this month" : "No logs matching selected filters"}
                                    </td>
                                </tr>
                            ) : (
                                filteredLogs.map((log) => (
                                    <tr key={log.id} className="hover:bg-gray-700/20 transition-all group">
                                        <td className="px-6 py-5 whitespace-nowrap">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-white tracking-tight">{log.service_name}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-5 whitespace-nowrap">
                                            <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-[10px] font-bold uppercase tracking-wider ${getStatusColor(log.status)}`}>
                                                {getStatusIcon(log.status)}
                                                {log.status}
                                            </div>
                                        </td>
                                        <td className="px-6 py-5">
                                            <span className="text-xs text-gray-400 font-medium line-clamp-2 max-w-md">
                                                {log.error_details || "-"}
                                            </span>
                                        </td>
                                        <td className="px-6 py-5 whitespace-nowrap">
                                            <span className="text-xs font-bold text-purple-400/80 uppercase tracking-tight">{log.run_by || "system"}</span>
                                        </td>
                                        <td className="px-6 py-5 text-right whitespace-nowrap">
                                            <div className="flex flex-col">
                                                <span className="text-sm font-bold text-gray-300 tabular-nums">
                                                    {new Date(log.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                </span>
                                                <span className="text-[10px] font-bold text-gray-500 tabular-nums">
                                                    {new Date(log.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default MFLogs;
