import React, { useState, useCallback } from 'react';
import axios from '../api/axios';
import {
    Search, ChevronLeft, ChevronRight, Users,
    ChevronsLeft, Loader2, X, UsersRound
} from 'lucide-react';

const GroupsPage = () => {
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [hasNextPage, setHasNextPage] = useState(false);
    const [totalEstimate, setTotalEstimate] = useState(null);
    const [hasSearched, setHasSearched] = useState(false);

    const [groupName, setGroupName] = useState('');
    const [activeSearch, setActiveSearch] = useState('');

    const fetchGroups = useCallback(async (searchTerm, pageNum) => {
        setLoading(true);
        setHasSearched(true);
        try {
            const response = await axios.get('/groups/search', {
                params: {
                    groupName: searchTerm && searchTerm.trim() !== '' ? searchTerm.trim() : undefined,
                    page: pageNum,
                    size: pageSize
                }
            });

            const data = response.data;
            setGroups(data.groups || []);
            setHasNextPage(data.hasNext || false);
            const currentCount = (data.groups || []).length;
            const minTotal = (pageNum - 1) * pageSize + currentCount;
            setTotalEstimate(data.hasNext ? `${minTotal}+` : minTotal.toString());
        } catch (error) {
            console.error("Error fetching groups", error);
            setGroups([]);
            setHasNextPage(false);
            setTotalEstimate('0');
        } finally {
            setLoading(false);
        }
    }, [pageSize]);

    // Load all groups on component mount
    React.useEffect(() => {
        fetchGroups('', 1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleSearch = (e) => {
        e.preventDefault();
        setActiveSearch(groupName.trim());
        setPage(1);
        fetchGroups(groupName.trim(), 1);
    };

    const handlePageChange = (newPage) => {
        setPage(newPage);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        fetchGroups(activeSearch, newPage);
    };

    const handlePageSizeChange = (newSize) => {
        setPageSize(newSize);
        setPage(1);
        fetchGroups(activeSearch, 1);
    };

    const clearSearch = () => {
        setGroupName('');
        setActiveSearch('');
        setGroups([]);
        setHasSearched(false);
        setTotalEstimate(null);
        setPage(1);
    };

    const rangeStart = groups.length > 0 ? (page - 1) * pageSize + 1 : 0;
    const rangeEnd = (page - 1) * pageSize + groups.length;

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header + Search inline */}
            <div className="flex items-center justify-between gap-4 mb-4">
                <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <Users size={20} className="text-[#0A66C2]" />
                    Groups
                </h1>

                <form onSubmit={handleSearch} className="flex items-center gap-2">
                    <div className="relative">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={groupName}
                            onChange={(e) => setGroupName(e.target.value)}
                            placeholder="Filter by group name..."
                            className="w-64 pl-9 pr-8 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#0A66C2]"
                        />
                        {groupName && (
                            <button type="button" onClick={clearSearch} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                <X size={14} />
                            </button>
                        )}
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="px-4 py-2 bg-[#0A66C2] text-white rounded-lg text-sm font-medium hover:bg-[#094d92] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                    >
                        {loading ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
                        Search
                    </button>
                </form>
            </div>

            {/* Results */}
            <div className="bg-white border border-slate-200 rounded-lg shadow-sm overflow-hidden">
                {!hasSearched && !loading ? (
                    <div className="py-16 text-center text-slate-400">
                        <Loader2 className="mx-auto h-10 w-10 text-slate-300 mb-2 animate-spin" />
                        <p className="text-sm">Loading groups...</p>
                    </div>
                ) : (
                    <>
                        {/* Count */}
                        {totalEstimate && !loading && (
                            <div className="px-4 py-2 bg-slate-50 border-b border-slate-100 flex items-center justify-between text-sm">
                                <span className="text-slate-600">
                                    <span className="font-semibold text-[#0A66C2]">{totalEstimate}</span> group{totalEstimate !== '1' ? 's' : ''} found
                                    {activeSearch && ` matching "${activeSearch}"`}
                                </span>
                                {groups.length > 0 && <span className="text-slate-400 text-xs">Showing {rangeStart}-{rangeEnd}</span>}
                            </div>
                        )}

                        {/* Table */}
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="px-4 py-3 font-semibold text-slate-700 w-12">#</th>
                                        <th className="px-4 py-3 font-semibold text-slate-700">Group Name</th>
                                        <th className="px-4 py-3 font-semibold text-slate-700">Description</th>
                                        <th className="px-4 py-3 font-semibold text-slate-700">Owner</th>
                                        <th className="px-4 py-3 font-semibold text-slate-700">Members Count</th>
                                        <th className="px-4 py-3 font-semibold text-slate-700">Created Date</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {loading ? (
                                        [...Array(5)].map((_, i) => (
                                            <tr key={i} className="animate-pulse">
                                                <td className="px-4 py-3"><div className="h-4 bg-slate-100 rounded w-6"></div></td>
                                                <td className="px-4 py-3"><div className="h-4 bg-slate-100 rounded w-32"></div></td>
                                                <td className="px-4 py-3"><div className="h-4 bg-slate-100 rounded w-48"></div></td>
                                                <td className="px-4 py-3"><div className="h-4 bg-slate-100 rounded w-24"></div></td>
                                                <td className="px-4 py-3"><div className="h-4 bg-slate-100 rounded w-16"></div></td>
                                                <td className="px-4 py-3"><div className="h-4 bg-slate-100 rounded w-28"></div></td>
                                            </tr>
                                        ))
                                    ) : groups.length === 0 ? (
                                        <tr>
                                            <td colSpan="6" className="px-4 py-10 text-center text-slate-500">
                                                <p className="font-medium">No groups found</p>
                                                <p className="text-xs mt-1">Try a different search term</p>
                                            </td>
                                        </tr>
                                    ) : (
                                        groups.map((g, idx) => {
                                            // Filter out empty strings and null values from repeating attributes
                                            const users = Array.isArray(g.users_names)
                                                ? g.users_names.filter(name => name && name.trim() !== '')
                                                : (g.users_names ? [g.users_names] : []);
                                            const groups = Array.isArray(g.groups_names)
                                                ? g.groups_names.filter(name => name && name.trim() !== '')
                                                : (g.groups_names ? [g.groups_names] : []);

                                            const usersCount = users.length;
                                            const groupsCount = groups.length;

                                            // Create tooltip text
                                            const memberTooltip = [
                                                usersCount > 0 ? `Users: ${users.join(', ')}` : '',
                                                groupsCount > 0 ? `Groups: ${groups.join(', ')}` : ''
                                            ].filter(Boolean).join('\n') || 'No members';

                                            return (
                                                <tr key={g.r_object_id || idx} className="hover:bg-slate-50 transition-colors">
                                                    <td className="px-4 py-3 text-slate-400 font-mono text-xs">{(page - 1) * pageSize + idx + 1}</td>
                                                    <td className="px-4 py-3 font-medium text-slate-900">{g.group_name || '-'}</td>
                                                    <td className="px-4 py-3 text-slate-600 max-w-xs truncate" title={g.description}>{g.description || '-'}</td>
                                                    <td className="px-4 py-3 text-slate-600">{g.owner_name || '-'}</td>
                                                    <td className="px-4 py-3 text-slate-600" title={memberTooltip}>
                                                        <div className="flex flex-col gap-0.5 cursor-help">
                                                            <span className="inline-flex items-center gap-1 text-xs">
                                                                <Users size={10} className="text-slate-400" />
                                                                {usersCount} {usersCount === 1 ? 'user' : 'users'}
                                                            </span>
                                                            {groupsCount > 0 && (
                                                                <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                                                                    <UsersRound size={10} className="text-slate-400" />
                                                                    {groupsCount} {groupsCount === 1 ? 'group' : 'groups'}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-600 text-xs">
                                                        {g.r_creation_date ? new Date(g.r_creation_date).toLocaleDateString() : '-'}
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {groups.length > 0 && (
                            <div className="flex items-center justify-between px-4 py-2 border-t border-slate-100 bg-slate-50/50 text-sm">
                                <select
                                    value={pageSize}
                                    onChange={(e) => handlePageSizeChange(Number(e.target.value))}
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

export default GroupsPage;
