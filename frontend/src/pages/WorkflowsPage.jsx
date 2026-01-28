import React, { useState, useEffect } from 'react';
import axios from '../api/axios';
import { RefreshCw, Filter, ChevronLeft, ChevronRight, Activity, FileText, CheckCircle, Clock } from 'lucide-react';

const WorkflowsPage = () => {
    const [processes, setProcesses] = useState([]);
    const [selectedProcess, setSelectedProcess] = useState('');
    const [workflows, setWorkflows] = useState([]);
    const [loadingProcesses, setLoadingProcesses] = useState(false);
    const [loadingWorkflows, setLoadingWorkflows] = useState(false);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [totalResults, setTotalResults] = useState(0); // If API returns total

    // Fetch Processes on Mount
    useEffect(() => {
        const fetchProcesses = async () => {
            setLoadingProcesses(true);
            try {
                const response = await axios.get('/workflows/processes');
                setProcesses(response.data || []);
            } catch (error) {
                console.error("Error fetching processes", error);
                // Fallback mock data for demo if backend fails or empty
                // setProcesses([{ object_name: 'LoanApprovalProcess' }, { object_name: 'AccountOpening' }]);
            } finally {
                setLoadingProcesses(false);
            }
        };
        fetchProcesses();
    }, []);

    // Fetch Workflows when Process or Page changes
    useEffect(() => {
        if (!selectedProcess) return;

        const fetchWorkflows = async () => {
            setLoadingWorkflows(true);
            try {
                const response = await axios.get('/workflows/instances', {
                    params: {
                        processName: selectedProcess,
                        page: page,
                        size: pageSize
                    }
                });
                
                // Parse DQL Response structure
                // DQL response usually has { entries: [ { content: { properties: { ... } } } ] }
                const rawEntries = response.data.entries || [];
                const parsedWorkflows = rawEntries.map(entry => entry.content?.properties || {});
                setWorkflows(parsedWorkflows);
                
                // Try to estimate total if provided, otherwise simple pagination
                if(response.data.total) {
                    setTotalResults(response.data.total);
                }

            } catch (error) {
                console.error("Error fetching workflows", error);
                setWorkflows([]);
            } finally {
                setLoadingWorkflows(false);
            }
        };

        fetchWorkflows();
    }, [selectedProcess, page, pageSize]);

    const handleProcessChange = (e) => {
        setSelectedProcess(e.target.value);
        setPage(1); // Reset to first page
    };

    // Helper to map task status code to Label/Color
    const getTaskStatusInfo = (code) => {
        // dmi_workitem r_runtime_state: 0=Dormant, 1=Acquired, 2=Paused, 3=Completed, 4=Terminated. 
        // Note: Code meanings can vary by version, using generic assumptions or string parsing if DQL returned string.
        // If DQL returned integer:
        switch(code) {
            case 0: return { label: 'Dormant', color: 'bg-gray-100 text-gray-600' };
            case 1: return { label: 'Acquired', color: 'bg-blue-100 text-blue-700' };
            case 2: return { label: 'Paused', color: 'bg-yellow-100 text-yellow-700' };
            case 3: return { label: 'Completed', color: 'bg-green-100 text-green-700' };
            case 4: return { label: 'Terminated', color: 'bg-red-100 text-red-700' };
            default: return { label: `Status ${code}`, color: 'bg-slate-100 text-slate-600' };
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
                        <Activity className="text-[#0A66C2]" />
                        Running Workflows
                    </h1>
                    <p className="text-slate-500 mt-1">Monitor and track active process instances across the enterprise.</p>
                </div>
                
                {/* Process Filter Dropdown */}
                <div className="relative min-w-[280px]">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Filter className="h-4 w-4 text-slate-400" />
                    </div>
                    <select
                        value={selectedProcess}
                        onChange={handleProcessChange}
                        disabled={loadingProcesses}
                        className="block w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#0A66C2] shadow-sm appearance-none cursor-pointer transition-all"
                    >
                        <option value="">-- Select a Process --</option>
                        {loadingProcesses ? (
                            <option>Loading processes...</option>
                        ) : (
                            processes.map((proc, index) => (
                                <option key={index} value={proc.object_name}>
                                    {proc.title || proc.object_name}
                                </option>
                            ))
                        )}
                    </select>
                </div>
            </div>

            {/* Main Content Area */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                {!selectedProcess ? (
                    <div className="p-16 text-center text-slate-400 bg-slate-50/50">
                        <Filter className="mx-auto h-12 w-12 text-slate-300 mb-3" />
                        <p className="text-lg font-medium text-slate-500">Select a process to view workflows</p>
                        <p className="text-sm">Choose a process from the dropdown above to filter the grid.</p>
                    </div>
                ) : (
                    <>
                        {/* Data Grid */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="px-6 py-4 font-semibold text-slate-700">Process Name</th>
                                        <th className="px-6 py-4 font-semibold text-slate-700">Display Name</th>
                                        <th className="px-6 py-4 font-semibold text-slate-700">Status</th>
                                        <th className="px-6 py-4 font-semibold text-slate-700">Started Date</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {loadingWorkflows ? (
                                        [...Array(5)].map((_, i) => (
                                            <tr key={i} className="animate-pulse">
                                                <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded w-3/4"></div></td>
                                                <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded w-1/2"></div></td>
                                                <td className="px-6 py-4"><div className="h-6 bg-slate-100 rounded-full w-24"></div></td>
                                                <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded w-1/2"></div></td>
                                            </tr>
                                        ))
                                    ) : workflows.length === 0 ? (
                                        <tr>
                                            <td colSpan="4" className="px-6 py-12 text-center text-slate-500">
                                                No active workflows found for this process.
                                            </td>
                                        </tr>
                                    ) : (
                                        workflows.map((wf, idx) => {
                                            // Fallback for status if standard REST returns numeric or string
                                            const statusVal = wf.r_runtime_state !== undefined ? wf.r_runtime_state : 1; 
                                            const status = getTaskStatusInfo(statusVal);
                                            
                                            return (
                                                <tr key={idx} className="hover:bg-slate-50/80 transition-colors group">
                                                    <td className="px-6 py-4 font-medium text-slate-900 group-hover:text-[#0A66C2] transition-colors">
                                                        {wf.object_name}
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-600">
                                                        {wf.title || '-'}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${status.color}`}>
                                                            {status.label === 'Completed' ? <CheckCircle size={12}/> : <Clock size={12}/>}
                                                            {status.label}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-600">
                                                        {wf.r_start_date ? new Date(wf.r_start_date).toLocaleString() : '-'}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination Footer */}
                        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100 bg-slate-50/30">
                            <span className="text-sm text-slate-500">
                                Page <span className="font-medium text-slate-900">{page}</span>
                                {loadingWorkflows && <span className="ml-2 opacity-50 text-xs">Refreshing...</span>}
                            </span>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setPage(Math.max(1, page - 1))}
                                    disabled={page === 1 || loadingWorkflows}
                                    className="p-2 border border-slate-200 rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed text-slate-600 transition-colors shadow-sm"
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                <button
                                    onClick={() => setPage(page + 1)}
                                    // Disable next if we have fewer items than page size (simple logic)
                                    disabled={workflows.length < pageSize || loadingWorkflows}
                                    className="p-2 border border-slate-200 rounded-lg hover:bg-white disabled:opacity-50 disabled:cursor-not-allowed text-slate-600 transition-colors shadow-sm"
                                >
                                    <ChevronRight size={16} />
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default WorkflowsPage;
