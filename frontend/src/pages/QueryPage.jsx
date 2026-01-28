import React, { useState, useCallback, useMemo } from 'react';
import axios from '../api/axios';
import {
    Play, ChevronLeft, ChevronRight, Database,
    ChevronsLeft, Loader2, X, AlertCircle, Filter
} from 'lucide-react';

const QueryPage = () => {
    const [allRows, setAllRows] = useState([]); // Store all fetched rows
    const [columns, setColumns] = useState([]);
    const [loading, setLoading] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [hasExecuted, setHasExecuted] = useState(false);
    const [error, setError] = useState(null);
    const [columnFilters, setColumnFilters] = useState({});

    const [query, setQuery] = useState('');
    const [activeQuery, setActiveQuery] = useState('');

    const executeQuery = useCallback(async (dql) => {
        if (!dql || dql.trim() === '') {
            setError('Please enter a DQL query');
            return;
        }

        setLoading(true);
        setHasExecuted(true);
        setError(null);

        try {
            // Fetch all results at once (use large page size)
            const response = await axios.post('/query/execute', {
                dql: dql.trim(),
                page: 1,
                size: 10000 // Fetch large number of rows for client-side pagination
            });

            const data = response.data;

            if (data.error) {
                setError(data.error);
                setAllRows([]);
                setColumns([]);
            } else {
                setAllRows(data.rows || []);
                setColumns(data.columns || []);
                setColumnFilters({}); // Reset filters on new query
                setCurrentPage(1); // Reset to first page
            }
        } catch (err) {
            console.error("Error executing query", err);
            setError(err.response?.data?.message || err.message || 'Query execution failed');
            setAllRows([]);
            setColumns([]);
        } finally {
            setLoading(false);
        }
    }, []);

    // Client-side filtering
    const filteredRows = useMemo(() => {
        if (allRows.length === 0) return [];

        return allRows.filter(row => {
            return Object.entries(columnFilters).every(([column, filterValue]) => {
                if (!filterValue || filterValue.trim() === '') return true;
                const cellValue = row[column];
                if (cellValue === null || cellValue === undefined) return false;
                return String(cellValue).toLowerCase().includes(filterValue.toLowerCase());
            });
        });
    }, [allRows, columnFilters]);

    // Client-side pagination
    const paginatedRows = useMemo(() => {
        const startIndex = (currentPage - 1) * pageSize;
        const endIndex = startIndex + pageSize;
        return filteredRows.slice(startIndex, endIndex);
    }, [filteredRows, currentPage, pageSize]);

    const totalPages = Math.ceil(filteredRows.length / pageSize);

    const handleExecute = (e) => {
        e.preventDefault();
        if (query.trim()) {
            setActiveQuery(query.trim());
            executeQuery(query.trim());
        }
    };

    const handlePageChange = (newPage) => {
        setCurrentPage(newPage);
    };

    const handleFilterChange = (column, value) => {
        setColumnFilters(prev => ({
            ...prev,
            [column]: value
        }));
        setCurrentPage(1); // Reset to first page when filtering
    };

    const clearAllFilters = () => {
        setColumnFilters({});
        setCurrentPage(1);
    };

    const clearQuery = () => {
        setQuery('');
        setActiveQuery('');
        setAllRows([]);
        setColumns([]);
        setHasExecuted(false);
        setError(null);
        setCurrentPage(1);
        setColumnFilters({});
    };

    const handlePageSizeChange = (newSize) => {
        setPageSize(Number(newSize));
        setCurrentPage(1); // Reset to first page when changing page size
    };

    const rangeStart = paginatedRows.length > 0 ? (currentPage - 1) * pageSize + 1 : 0;
    const rangeEnd = (currentPage - 1) * pageSize + paginatedRows.length;
    const hasActiveFilters = Object.values(columnFilters).some(v => v && v.trim() !== '');

    return (
        <div className="p-6 max-w-full mx-auto">
            {/* Header */}
            <div className="mb-4">
                <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <Database size={20} className="text-[#0A66C2]" />
                    Query
                </h1>
                <p className="text-sm text-slate-500">Execute DQL queries against the repository</p>
            </div>

            {/* Query Input */}
            <form onSubmit={handleExecute} className="bg-white border border-slate-200 rounded-lg shadow-sm p-4 mb-4">
                <div className="mb-3">
                    <label className="block text-sm font-medium text-slate-700 mb-1">DQL Query</label>
                    <div className="relative">
                        <textarea
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="SELECT r_object_id, object_name FROM dm_document WHERE folder('/Temp')"
                            rows={3}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#0A66C2] resize-y"
                        />
                        {query && (
                            <button 
                                type="button" 
                                onClick={clearQuery} 
                                className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                            >
                                <X size={16} />
                            </button>
                        )}
                    </div>
                    <p className="text-xs text-slate-400 mt-1">
                        r_object_id and r_object_type will be automatically included if not specified.
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        type="submit"
                        disabled={!query.trim() || loading}
                        className="px-4 py-2 bg-[#0A66C2] text-white rounded-lg text-sm font-medium hover:bg-[#094d92] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                    >
                        {loading ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
                        Execute
                    </button>
                    <select
                        value={pageSize}
                        onChange={(e) => handlePageSizeChange(e.target.value)}
                        className="text-sm border border-slate-200 rounded-lg px-2 py-2 bg-white"
                    >
                        <option value={10}>10 rows/page</option>
                        <option value={25}>25 rows/page</option>
                        <option value={50}>50 rows/page</option>
                        <option value={100}>100 rows/page</option>
                        <option value={500}>500 rows/page</option>
                    </select>
                </div>
            </form>

            {/* Error Display */}
            {error && (
                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2 text-red-700 text-sm">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {/* Results */}
            <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                {!hasExecuted ? (
                    <div className="py-16 text-center text-slate-400">
                        <Database className="mx-auto h-10 w-10 text-slate-300 mb-2" />
                        <p className="text-sm">Enter a DQL query and click Execute</p>
                    </div>
                ) : loading ? (
                    <div className="py-16 text-center text-slate-400">
                        <Loader2 className="mx-auto h-8 w-8 text-[#0A66C2] animate-spin mb-2" />
                        <p className="text-sm">Executing query...</p>
                    </div>
                ) : rows.length === 0 && !error ? (
                    <div className="py-16 text-center text-slate-400">
                        <Database className="mx-auto h-10 w-10 text-slate-300 mb-2" />
                        <p className="text-sm">No results found</p>
                    </div>
                ) : allRows.length > 0 && (
                    <>
                        {/* Count and Filter Controls */}
                        <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-sm flex-wrap gap-2">
                            <div className="flex items-center gap-3">
                                <span className="text-slate-600">
                                    <span className="font-semibold text-[#0A66C2]">{allRows.length}</span> total rows
                                    {filteredRows.length < allRows.length && (
                                        <span className="ml-1">
                                            (<span className="font-semibold text-amber-600">{filteredRows.length}</span> filtered)
                                        </span>
                                    )}
                                </span>
                                <span className="text-slate-400">•</span>
                                <span className="text-slate-600">
                                    Showing {rangeStart}-{rangeEnd}
                                </span>
                            </div>
                            {hasActiveFilters && (
                                <button
                                    onClick={clearAllFilters}
                                    className="text-xs px-2 py-1 bg-white border border-slate-200 rounded hover:bg-slate-50 text-slate-600 flex items-center gap-1"
                                >
                                    <X size={12} />
                                    Clear Filters
                                </button>
                            )}
                        </div>

                        {/* Table with fixed height */}
                        <div className="overflow-auto max-h-[calc(100vh-28rem)] min-h-[400px]">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10">
                                    <tr>
                                        <th className="px-3 py-2 font-semibold text-slate-700 bg-slate-50 sticky left-0 z-20 w-12">#</th>
                                        {columns.map((col) => (
                                            <th key={col} className="px-3 py-2 font-semibold text-slate-700 bg-slate-50">
                                                <div className="flex flex-col gap-1.5 min-w-[120px]">
                                                    <span className="whitespace-nowrap">{col}</span>
                                                    <div className="relative">
                                                        <Filter size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                                                        <input
                                                            type="text"
                                                            value={columnFilters[col] || ''}
                                                            onChange={(e) => handleFilterChange(col, e.target.value)}
                                                            placeholder="Filter..."
                                                            className="w-full pl-7 pr-2 py-1 text-xs border border-slate-200 rounded focus:outline-none focus:ring-1 focus:ring-blue-500/30 focus:border-[#0A66C2] bg-white"
                                                            onClick={(e) => e.stopPropagation()}
                                                        />
                                                    </div>
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100 bg-white">
                                    {paginatedRows.length === 0 ? (
                                        <tr>
                                            <td colSpan={columns.length + 1} className="px-3 py-12 text-center text-slate-400">
                                                <Filter className="mx-auto h-8 w-8 text-slate-300 mb-2" />
                                                <p className="text-sm">No results match the current filters</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        paginatedRows.map((row, idx) => (
                                            <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                                <td className="px-3 py-2.5 text-slate-400 font-mono text-xs bg-slate-50/50 sticky left-0 border-r border-slate-100">
                                                    {(currentPage - 1) * pageSize + idx + 1}
                                                </td>
                                                {columns.map((col) => (
                                                    <td key={col} className="px-3 py-2.5 text-slate-600 max-w-xs truncate" title={String(row[col] ?? '')}>
                                                        {row[col] !== null && row[col] !== undefined ? String(row[col]) : '-'}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 bg-slate-50/50 text-sm">
                            <span className="text-slate-500">
                                Page <span className="font-semibold text-slate-700">{currentPage}</span> of <span className="font-semibold text-slate-700">{totalPages}</span>
                            </span>
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => handlePageChange(1)}
                                    disabled={currentPage === 1}
                                    className="p-1.5 border border-slate-200 rounded hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed text-slate-600"
                                    title="First page"
                                >
                                    <ChevronsLeft size={14} />
                                </button>
                                <button
                                    onClick={() => handlePageChange(currentPage - 1)}
                                    disabled={currentPage === 1}
                                    className="p-1.5 border border-slate-200 rounded hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed text-slate-600"
                                    title="Previous page"
                                >
                                    <ChevronLeft size={14} />
                                </button>
                                <span className="px-3 text-slate-700 font-medium min-w-[3rem] text-center">{currentPage}</span>
                                <button
                                    onClick={() => handlePageChange(currentPage + 1)}
                                    disabled={currentPage >= totalPages}
                                    className="p-1.5 border border-slate-200 rounded hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed text-slate-600"
                                    title="Next page"
                                >
                                    <ChevronRight size={14} />
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

export default QueryPage;
