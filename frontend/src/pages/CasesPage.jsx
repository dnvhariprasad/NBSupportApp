import React, { useState, useCallback } from 'react';
import axios from '../api/axios';
import { 
    Search, ChevronLeft, ChevronRight, Briefcase, 
    ChevronsLeft, Loader2, X
} from 'lucide-react';

const CasesPage = () => {
    const [cases, setCases] = useState([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [hasNextPage, setHasNextPage] = useState(false);
    const [totalEstimate, setTotalEstimate] = useState(null);
    const [hasSearched, setHasSearched] = useState(false);

    const [caseNumber, setCaseNumber] = useState('');
    const [activeSearch, setActiveSearch] = useState('');

    const fetchCases = useCallback(async (searchTerm, pageNum) => {
        if (!searchTerm || searchTerm.trim() === '') {
            setCases([]);
            setHasSearched(false);
            setTotalEstimate(null);
            return;
        }

        setLoading(true);
        setHasSearched(true);
        try {
            const response = await axios.get('/cases/search', {
                params: { caseNumber: searchTerm.trim(), page: pageNum, size: pageSize }
            });

            const data = response.data;
            setCases(data.cases || []);
            setHasNextPage(data.hasNext || false);
            const currentCount = (data.cases || []).length;
            const minTotal = (pageNum - 1) * pageSize + currentCount;
            setTotalEstimate(data.hasNext ? `${minTotal}+` : minTotal.toString());
        } catch (error) {
            console.error("Error fetching cases", error);
            setCases([]);
            setHasNextPage(false);
            setTotalEstimate('0');
        } finally {
            setLoading(false);
        }
    }, [pageSize]);

    const handleSearch = (e) => {
        e.preventDefault();
        if (caseNumber.trim()) {
            setActiveSearch(caseNumber.trim());
            setPage(1);
            fetchCases(caseNumber.trim(), 1);
        }
    };

    const handlePageChange = (newPage) => {
        setPage(newPage);
        fetchCases(activeSearch, newPage);
    };

    const clearSearch = () => {
        setCaseNumber('');
        setActiveSearch('');
        setCases([]);
        setHasSearched(false);
        setTotalEstimate(null);
        setPage(1);
    };

    const rangeStart = cases.length > 0 ? (page - 1) * pageSize + 1 : 0;
    const rangeEnd = (page - 1) * pageSize + cases.length;

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header + Search inline */}
            <div className="flex items-center justify-between gap-4 mb-4">
                <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <Briefcase size={20} className="text-[#0A66C2]" />
                    Cases
                </h1>
                
                <form onSubmit={handleSearch} className="flex items-center gap-2">
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={caseNumber}
                            onChange={(e) => setCaseNumber(e.target.value)}
                            placeholder="Search case number..."
                            className="w-64 pl-9 pr-8 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#0A66C2]"
                        />
                        {caseNumber && (
                            <button type="button" onClick={clearSearch} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                <X size={14} />
                            </button>
                        )}
                    </div>
                    <button
                        type="submit"
                        disabled={!caseNumber.trim() || loading}
                        className="px-4 py-2 bg-[#0A66C2] text-white rounded-lg text-sm font-medium hover:bg-[#094d92] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                    >
                        {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                        Search
                    </button>
                </form>
            </div>

            {/* Results */}
            <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                {!hasSearched ? (
                    <div className="py-16 text-center text-slate-400">
                        <Search className="mx-auto h-10 w-10 text-slate-300 mb-2" />
                        <p className="text-sm">Enter a case number to search</p>
                    </div>
                ) : (
                    <>
                        {/* Count */}
                        {totalEstimate && !loading && (
                            <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-sm">
                                <span className="text-slate-600">
                                    <span className="font-semibold text-[#0A66C2]">{totalEstimate}</span> result{totalEstimate !== '1' ? 's' : ''} for "{activeSearch}"
                                </span>
                                {cases.length > 0 && <span className="text-slate-400 text-xs">Showing {rangeStart}-{rangeEnd}</span>}
                            </div>
                        )}

                        {/* Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="px-4 py-3 font-semibold text-slate-700 w-12">#</th>
                                        <th className="px-4 py-3 font-semibold text-slate-700">Case Number</th>
                                        <th className="px-4 py-3 font-semibold text-slate-700">Subject</th>
                                        <th className="px-4 py-3 font-semibold text-slate-700">Office</th>
                                        <th className="px-4 py-3 font-semibold text-slate-700">Description</th>
                                        <th className="px-4 py-3 font-semibold text-slate-700">Department</th>
                                        <th className="px-4 py-3 font-semibold text-slate-700">Functions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {loading ? (
                                        [...Array(3)].map((_, i) => (
                                            <tr key={i} className="animate-pulse">
                                                <td className="px-4 py-3"><div className="h-4 bg-slate-100 rounded w-6"></div></td>
                                                <td className="px-4 py-3"><div className="h-4 bg-slate-100 rounded w-28"></div></td>
                                                <td className="px-4 py-3"><div className="h-4 bg-slate-100 rounded w-40"></div></td>
                                                <td className="px-4 py-3"><div className="h-4 bg-slate-100 rounded w-20"></div></td>
                                                <td className="px-4 py-3"><div className="h-4 bg-slate-100 rounded w-32"></div></td>
                                                <td className="px-4 py-3"><div className="h-4 bg-slate-100 rounded w-20"></div></td>
                                                <td className="px-4 py-3"><div className="h-4 bg-slate-100 rounded w-16"></div></td>
                                            </tr>
                                        ))
                                    ) : cases.length === 0 ? (
                                        <tr>
                                            <td colSpan="7" className="px-4 py-10 text-center text-slate-500">
                                                <p className="font-medium">No cases found</p>
                                                <p className="text-xs mt-1">Try a different search term</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        cases.map((c, idx) => (
                                            <tr key={c.r_object_id || idx} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-4 py-3 text-slate-400 font-mono text-xs">{(page - 1) * pageSize + idx + 1}</td>
                                                <td className="px-4 py-3 font-medium text-slate-900">{c.object_name || '-'}</td>
                                                <td className="px-4 py-3 text-slate-600 max-w-xs truncate" title={c.subject}>{c.subject || '-'}</td>
                                                <td className="px-4 py-3 text-slate-600">{c.ho_ro || '-'}</td>
                                                <td className="px-4 py-3 text-slate-600 max-w-xs truncate" title={c.description}>{c.description || '-'}</td>
                                                <td className="px-4 py-3 text-slate-600">{c.department_name || '-'}</td>
                                                <td className="px-4 py-3 text-slate-600">{c.functions || '-'}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {cases.length > 0 && (
                            <div className="flex items-center justify-between px-4 py-2 border-t border-slate-100 bg-slate-50/50 text-sm">
                                <select
                                    value={pageSize}
                                    onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); if (activeSearch) fetchCases(activeSearch, 1); }}
                                    className="text-xs border border-slate-200 rounded px-2 py-1 bg-white"
                                >
                                    <option value={5}>5</option>
                                    <option value={10}>10</option>
                                    <option value={25}>25</option>
                                    <option value={50}>50</option>
                                </select>
                                
                                <div className="flex items-center gap-1">
                                    <button onClick={() => handlePageChange(1)} disabled={page === 1 || loading} className="p-1.5 border border-slate-200 rounded hover:bg-white disabled:opacity-40 text-slate-600"><ChevronsLeft size={14} /></button>
                                    <button onClick={() => handlePageChange(page - 1)} disabled={page === 1 || loading} className="p-1.5 border border-slate-200 rounded hover:bg-white disabled:opacity-40 text-slate-600"><ChevronLeft size={14} /></button>
                                    <span className="px-3 text-slate-700 font-medium">{page}</span>
                                    <button onClick={() => handlePageChange(page + 1)} disabled={!hasNextPage || loading} className="p-1.5 border border-slate-200 rounded hover:bg-white disabled:opacity-40 text-slate-600"><ChevronRight size={14} /></button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default CasesPage;
