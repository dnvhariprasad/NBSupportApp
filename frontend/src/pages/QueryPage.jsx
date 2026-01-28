import React, { useState, useCallback } from 'react';
import axios from '../api/axios';
import { 
    Play, ChevronLeft, ChevronRight, Database, 
    ChevronsLeft, Loader2, X, AlertCircle
} from 'lucide-react';

const QueryPage = () => {
    const [rows, setRows] = useState([]);
    const [columns, setColumns] = useState([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(25);
    const [hasNextPage, setHasNextPage] = useState(false);
    const [hasExecuted, setHasExecuted] = useState(false);
    const [error, setError] = useState(null);

    const [query, setQuery] = useState('');
    const [activeQuery, setActiveQuery] = useState('');

    const executeQuery = useCallback(async (dql, pageNum) => {
        if (!dql || dql.trim() === '') {
            setError('Please enter a DQL query');
            return;
        }

        setLoading(true);
        setHasExecuted(true);
        setError(null);
        
        try {
            const response = await axios.post('/query/execute', {
                dql: dql.trim(),
                page: pageNum,
                size: pageSize
            });

            const data = response.data;
            
            if (data.error) {
                setError(data.error);
                setRows([]);
                setColumns([]);
                setHasNextPage(false);
            } else {
                setRows(data.rows || []);
                setColumns(data.columns || []);
                setHasNextPage(data.hasNext || false);
            }
        } catch (err) {
            console.error("Error executing query", err);
            setError(err.response?.data?.message || err.message || 'Query execution failed');
            setRows([]);
            setColumns([]);
            setHasNextPage(false);
        } finally {
            setLoading(false);
        }
    }, [pageSize]);

    const handleExecute = (e) => {
        e.preventDefault();
        if (query.trim()) {
            setActiveQuery(query.trim());
            setPage(1);
            executeQuery(query.trim(), 1);
        }
    };

    const handlePageChange = (newPage) => {
        setPage(newPage);
        executeQuery(activeQuery, newPage);
    };

    const clearQuery = () => {
        setQuery('');
        setActiveQuery('');
        setRows([]);
        setColumns([]);
        setHasExecuted(false);
        setError(null);
        setPage(1);
    };

    const rangeStart = rows.length > 0 ? (page - 1) * pageSize + 1 : 0;
    const rangeEnd = (page - 1) * pageSize + rows.length;

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
                        onChange={(e) => setPageSize(Number(e.target.value))}
                        className="text-sm border border-slate-200 rounded-lg px-2 py-2 bg-white"
                    >
                        <option value={10}>10 rows</option>
                        <option value={25}>25 rows</option>
                        <option value={50}>50 rows</option>
                        <option value={100}>100 rows</option>
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
                ) : rows.length > 0 && (
                    <>
                        {/* Count */}
                        <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-sm">
                            <span className="text-slate-600">
                                <span className="font-semibold text-[#0A66C2]">{columns.length}</span> columns, showing rows {rangeStart}-{rangeEnd}
                            </span>
                            {hasNextPage && <span className="text-slate-400 text-xs">More results available</span>}
                        </div>

                        {/* Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="px-3 py-2 font-semibold text-slate-700 w-10">#</th>
                                        {columns.map((col) => (
                                            <th key={col} className="px-3 py-2 font-semibold text-slate-700 whitespace-nowrap">
                                                {col}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {rows.map((row, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50 transition-colors">
                                            <td className="px-3 py-2 text-slate-400 font-mono text-xs">
                                                {(page - 1) * pageSize + idx + 1}
                                            </td>
                                            {columns.map((col) => (
                                                <td key={col} className="px-3 py-2 text-slate-600 max-w-xs truncate" title={String(row[col] ?? '')}>
                                                    {row[col] !== null && row[col] !== undefined ? String(row[col]) : '-'}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        <div className="flex items-center justify-between px-4 py-2 border-t border-slate-100 bg-slate-50/50 text-sm">
                            <span className="text-slate-500">Page {page}</span>
                            <div className="flex items-center gap-1">
                                <button 
                                    onClick={() => handlePageChange(1)} 
                                    disabled={page === 1 || loading} 
                                    className="p-1.5 border border-slate-200 rounded hover:bg-white disabled:opacity-40 text-slate-600"
                                >
                                    <ChevronsLeft size={14} />
                                </button>
                                <button 
                                    onClick={() => handlePageChange(page - 1)} 
                                    disabled={page === 1 || loading} 
                                    className="p-1.5 border border-slate-200 rounded hover:bg-white disabled:opacity-40 text-slate-600"
                                >
                                    <ChevronLeft size={14} />
                                </button>
                                <span className="px-3 text-slate-700 font-medium">{page}</span>
                                <button 
                                    onClick={() => handlePageChange(page + 1)} 
                                    disabled={!hasNextPage || loading} 
                                    className="p-1.5 border border-slate-200 rounded hover:bg-white disabled:opacity-40 text-slate-600"
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
