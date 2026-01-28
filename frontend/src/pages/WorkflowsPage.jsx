import React, { useState, useEffect } from 'react';
import axios from '../api/axios';
import { RefreshCw, Filter, ChevronLeft, ChevronRight, Activity, FileText, CheckCircle, Clock, ChevronsLeft, ChevronsRight } from 'lucide-react';

const WorkflowsPage = () => {
    const [processes, setProcesses] = useState([]);
    const [selectedProcess, setSelectedProcess] = useState('');
    const [workflows, setWorkflows] = useState([]);
    const [loadingProcesses, setLoadingProcesses] = useState(false);
    const [loadingWorkflows, setLoadingWorkflows] = useState(false);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    
    // Pagination state
    const [hasNextPage, setHasNextPage] = useState(false);
    const [hasPrevPage, setHasPrevPage] = useState(false);
    const [totalEstimate, setTotalEstimate] = useState(null); // Will show "X+" if there are more pages

    // Fetch Processes on Mount
    useEffect(() => {
        const fetchProcesses = async () => {
            setLoadingProcesses(true);
            try {
                const response = await axios.get('/workflows/processes');
                setProcesses(response.data || []);
            } catch (error) {
                console.error("Error fetching processes", error);
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
                
                // Parse REST Response structure
                const rawEntries = response.data.entries || [];
                const parsedWorkflows = rawEntries.map(entry => entry.content?.properties || {});
                setWorkflows(parsedWorkflows);
                
                // Check pagination links
                const links = response.data.links || [];
                const hasNext = links.some(link => link.rel === 'next');
                const hasPrev = page > 1;
                
                setHasNextPage(hasNext);
                setHasPrevPage(hasPrev);
                
                // Estimate total: current page items + indicator if there's more
                const currentPageCount = parsedWorkflows.length;
                const minTotal = (page - 1) * pageSize + currentPageCount;
                setTotalEstimate(hasNext ? `${minTotal}+` : minTotal.toString());

            } catch (error) {
                console.error("Error fetching workflows", error);
                setWorkflows([]);
                setHasNextPage(false);
                setHasPrevPage(page > 1);
                setTotalEstimate(null);
            } finally {
                setLoadingWorkflows(false);
            }
        };

        fetchWorkflows();
    }, [selectedProcess, page, pageSize]);

    const handleProcessChange = (e) => {
        setSelectedProcess(e.target.value);
        setPage(1); // Reset to first page
        setTotalEstimate(null);
    };

    const goToFirstPage = () => setPage(1);
    const goToPrevPage = () => setPage(Math.max(1, page - 1));
    const goToNextPage = () => setPage(page + 1);

    // Helper to map workflow status code to Label/Color
    const getStatusInfo = (code) => {
        // dm_workflow r_runtime_state: 0=Dormant, 1=Running, 2=Finished, 3=Halted, 4=Terminated
        switch(code) {
            case 0: return { label: 'Dormant', color: 'bg-gray-100 text-gray-600' };
            case 1: return { label: 'Running', color: 'bg-blue-100 text-blue-700' };
            case 2: return { label: 'Finished', color: 'bg-green-100 text-green-700' };
            case 3: return { label: 'Halted', color: 'bg-yellow-100 text-yellow-700' };
            case 4: return { label: 'Terminated', color: 'bg-red-100 text-red-700' };
            default: return { label: `State ${code}`, color: 'bg-slate-100 text-slate-600' };
        }
    };

    // Calculate display range
    const rangeStart = (page - 1) * pageSize + 1;
    const rangeEnd = (page - 1) * pageSize + workflows.length;

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
                        {/* Count Badge */}
                        {totalEstimate && !loadingWorkflows && (
                            <div className="px-6 py-3 bg-gradient-to-r from-blue-50 to-slate-50 border-b border-slate-100 flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-semibold bg-[#0A66C2] text-white">
                                        {totalEstimate}
                                    </span>
                                    <span className="text-sm text-slate-600">
                                        workflow{totalEstimate !== '1' ? 's' : ''} found
                                    </span>
                                </div>
                                <span className="text-xs text-slate-400">
                                    Showing {rangeStart}-{rangeEnd}
                                </span>
                            </div>
                        )}

                        {/* Data Grid */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="px-6 py-4 font-semibold text-slate-700">#</th>
                                        <th className="px-6 py-4 font-semibold text-slate-700">Workflow Name</th>
                                        <th className="px-6 py-4 font-semibold text-slate-700">Creator</th>
                                        <th className="px-6 py-4 font-semibold text-slate-700">Status</th>
                                        <th className="px-6 py-4 font-semibold text-slate-700">Started Date</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {loadingWorkflows ? (
                                        [...Array(5)].map((_, i) => (
                                            <tr key={i} className="animate-pulse">
                                                <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded w-8"></div></td>
                                                <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded w-3/4"></div></td>
                                                <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded w-1/2"></div></td>
                                                <td className="px-6 py-4"><div className="h-6 bg-slate-100 rounded-full w-20"></div></td>
                                                <td className="px-6 py-4"><div className="h-4 bg-slate-100 rounded w-32"></div></td>
                                            </tr>
                                        ))
                                    ) : workflows.length === 0 ? (
                                        <tr>
                                            <td colSpan="5" className="px-6 py-12 text-center text-slate-500">
                                                No workflows found for this process.
                                            </td>
                                        </tr>
                                    ) : (
                                        workflows.map((wf, idx) => {
                                            const status = getStatusInfo(wf.r_runtime_state);
                                            const rowNum = (page - 1) * pageSize + idx + 1;
                                            
                                            return (
                                                <tr key={wf.r_object_id || idx} className="hover:bg-slate-50/80 transition-colors group">
                                                    <td className="px-6 py-4 text-slate-400 font-mono text-xs">
                                                        {rowNum}
                                                    </td>
                                                    <td className="px-6 py-4 font-medium text-slate-900 group-hover:text-[#0A66C2] transition-colors">
                                                        {wf.object_name}
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-600">
                                                        {wf.r_creator_name || '-'}
                                                    </td>
                                                    <td className="px-6 py-4">
                                                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${status.color}`}>
                                                            {status.label === 'Finished' ? <CheckCircle size={12}/> : <Clock size={12}/>}
                                                            {status.label}
                                                        </span>
                                                    </td>
                                                    <td className="px-6 py-4 text-slate-600 text-sm">
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
                            <div className="flex items-center gap-4">
                                <span className="text-sm text-slate-500">
                                    Page <span className="font-semibold text-slate-900">{page}</span>
                                </span>
                                <select
                                    value={pageSize}
                                    onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                                    className="text-sm border border-slate-200 rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                                >
                                    <option value={5}>5 per page</option>
                                    <option value={10}>10 per page</option>
                                    <option value={25}>25 per page</option>
                                    <option value={50}>50 per page</option>
                                </select>
                            </div>
                            
                            <div className="flex items-center gap-1">
                                {/* First Page */}
                                <button
                                    onClick={goToFirstPage}
                                    disabled={!hasPrevPage || loadingWorkflows}
                                    className="p-2 border border-slate-200 rounded-lg hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 transition-colors shadow-sm"
                                    title="First page"
                                >
                                    <ChevronsLeft size={16} />
                                </button>
                                
                                {/* Previous Page */}
                                <button
                                    onClick={goToPrevPage}
                                    disabled={!hasPrevPage || loadingWorkflows}
                                    className="p-2 border border-slate-200 rounded-lg hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 transition-colors shadow-sm"
                                    title="Previous page"
                                >
                                    <ChevronLeft size={16} />
                                </button>
                                
                                {/* Page indicator */}
                                <span className="px-4 py-2 text-sm font-medium text-slate-700">
                                    {page}
                                </span>
                                
                                {/* Next Page */}
                                <button
                                    onClick={goToNextPage}
                                    disabled={!hasNextPage || loadingWorkflows}
                                    className="p-2 border border-slate-200 rounded-lg hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed text-slate-600 transition-colors shadow-sm"
                                    title="Next page"
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

