import React, { useState, useEffect, useMemo } from 'react';
import api from '../api/axios';
import { 
    Search, ChevronLeft, ChevronRight, Users, 
    Loader2, Edit2, ChevronsLeft, X, ArrowUpDown, ArrowUp, ArrowDown
} from 'lucide-react';
import EditUserProfileModal from '../components/EditUserProfileModal.jsx';

const UsersPage = () => {
    // Data state
    const [allUsers, setAllUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    
    // View state
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize] = useState(15);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'object_name', direction: 'asc' });

    // Modal state
    const [selectedUser, setSelectedUser] = useState(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    // Initial Fetch
    const fetchUsers = async () => {
        setLoading(true);
        try {
            // Fetch all users at once
            const response = await api.get('/users/profiles', { 
                params: { page: 1, size: 5000 } 
            });
            const data = response.data;
            setAllUsers(data.users || []);
        } catch (error) {
            console.error("Error fetching users", error);
            setAllUsers([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    // Filter & Sort Logic
    const processedUsers = useMemo(() => {
        let result = [...allUsers];

        // 1. Filter
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();
            result = result.filter(user => 
                (user.object_name?.toLowerCase() || '').includes(query) ||
                (user.user_login_name?.toLowerCase() || '').includes(query) ||
                (user.uin?.toLowerCase() || '').includes(query) ||
                (user.department_name?.toLowerCase() || '').includes(query) ||
                (user.designation?.toLowerCase() || '').includes(query)
            );
        }

        // 2. Sort
        if (sortConfig.key) {
            result.sort((a, b) => {
                const aValue = a[sortConfig.key] || '';
                const bValue = b[sortConfig.key] || '';
                
                if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1;
                if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }

        return result;
    }, [allUsers, searchQuery, sortConfig]);

    // Pagination Logic
    const totalItems = processedUsers.length;
    const totalPages = Math.ceil(totalItems / pageSize);
    const rangeStart = (currentPage - 1) * pageSize;
    const rangeEnd = rangeStart + pageSize;
    const currentUsers = processedUsers.slice(rangeStart, rangeEnd);

    // Handlers
    const handleSort = (key) => {
        setSortConfig(current => ({
            key,
            direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc'
        }));
    };

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && newPage <= totalPages) {
            setCurrentPage(newPage);
        }
    };

    const handleEditClick = (user) => {
        setSelectedUser(user);
        setIsEditModalOpen(true);
    };

    const handleUserUpdate = () => {
        fetchUsers(); // Refresh data after update
    };

    // Helper for Sort Icon
    const SortIcon = ({ columnKey }) => {
        if (sortConfig.key !== columnKey) return <ArrowUpDown size={14} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity ml-1" />;
        return sortConfig.direction === 'asc' 
            ? <ArrowUp size={14} className="text-[#0A66C2] ml-1" />
            : <ArrowDown size={14} className="text-[#0A66C2] ml-1" />;
    };

    const SortableHeader = ({ label, columnKey, className = "" }) => (
        <th 
            className={`px-4 py-3 font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors group select-none ${className}`}
            onClick={() => handleSort(columnKey)}
        >
            <div className="flex items-center">
                {label}
                <SortIcon columnKey={columnKey} />
            </div>
        </th>
    );

    return (
        <div className="p-6 max-w-7xl mx-auto h-full flex flex-col">
            {/* Header + Search */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                    <Users size={20} className="text-[#0A66C2]" />
                    User Directory
                    <span className="ml-2 px-2.5 py-0.5 bg-blue-50 text-[#0A66C2] text-xs rounded-full font-medium">
                        {totalItems}
                    </span>
                </h1>
                
                <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => {
                            setSearchQuery(e.target.value);
                            setCurrentPage(1); // Reset to first page on search
                        }}
                        placeholder="Search by Name, UIN, Dept..."
                        className="w-full sm:w-72 pl-9 pr-8 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#0A66C2] shadow-sm"
                    />
                    {searchQuery && (
                        <button 
                            onClick={() => {
                                setSearchQuery('');
                                setCurrentPage(1);
                            }} 
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-full"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>
            </div>

            {/* Results Table */}
            <div className="bg-white border border-slate-200 rounded-lg shadow-sm flex-1 flex flex-col overflow-hidden">
                <div className="overflow-x-auto flex-1">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="px-4 py-3 font-semibold text-slate-700 w-16">#</th>
                                <SortableHeader label="Name" columnKey="object_name" />
                                <SortableHeader label="UIN" columnKey="uin" />
                                <SortableHeader label="Department" columnKey="department_name" />
                                <SortableHeader label="Grade" columnKey="user_grade" />
                                <SortableHeader label="Designation" columnKey="designation" />
                                <th className="px-4 py-3 font-semibold text-slate-700 w-16 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan="7" className="px-4 py-20 text-center">
                                        <div className="flex flex-col items-center justify-center text-slate-500">
                                            <Loader2 size={32} className="animate-spin text-[#0A66C2] mb-3" />
                                            <p className="text-sm font-medium">Loading user profiles...</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : currentUsers.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="px-4 py-16 text-center text-slate-500">
                                        <div className="flex flex-col items-center justify-center">
                                            <Users className="h-12 w-12 text-slate-200 mb-3" />
                                            <p className="text-base font-medium text-slate-600">No users found</p>
                                            <p className="text-sm mt-1">Try adjusting your search terms</p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                currentUsers.map((user, idx) => (
                                    <tr key={user.r_object_id || idx} className="hover:bg-blue-50/30 transition-colors group">
                                        <td className="px-4 py-3 text-slate-400 font-mono text-xs">
                                            {rangeStart + idx + 1}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex flex-col">
                                                <span className="font-medium text-slate-900">{user.object_name}</span>
                                                <span className="text-xs text-slate-500 group-hover:text-[#0A66C2] transition-colors">{user.user_login_name}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-slate-600 font-mono text-xs">{user.uin || '-'}</td>
                                        <td className="px-4 py-3 text-slate-600">{user.department_name || '-'}</td>
                                        <td className="px-4 py-3 text-slate-600">
                                            {user.user_grade ? (
                                                <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-medium border border-slate-200">
                                                    {user.user_grade}
                                                </span>
                                            ) : '-'}
                                        </td>
                                        <td className="px-4 py-3 text-slate-600">{user.designation || '-'}</td>
                                        <td className="px-4 py-3 text-center">
                                            <button 
                                                onClick={() => handleEditClick(user)}
                                                className="p-2 hover:bg-white border border-transparent hover:border-slate-200 text-slate-400 hover:text-[#0A66C2] hover:shadow-sm rounded-lg transition-all"
                                                title="Edit User"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50/50">
                    <div className="text-sm text-slate-500">
                        {totalItems > 0 ? (
                            <>
                                Showing <span className="font-medium text-slate-900">{rangeStart + 1}</span> to <span className="font-medium text-slate-900">{Math.min(rangeEnd, totalItems)}</span> of <span className="font-medium text-slate-900">{totalItems}</span> results
                            </>
                        ) : (
                            'No results'
                        )}
                    </div>
                    
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={() => handlePageChange(1)} 
                            disabled={currentPage === 1 || loading} 
                            className="p-2 border border-slate-200 rounded-lg hover:bg-white hover:text-[#0A66C2] disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-400 text-slate-500 transition-colors"
                            title="First Page"
                        >
                            <ChevronsLeft size={16} />
                        </button>
                        <button 
                            onClick={() => handlePageChange(currentPage - 1)} 
                            disabled={currentPage === 1 || loading} 
                            className="p-2 border border-slate-200 rounded-lg hover:bg-white hover:text-[#0A66C2] disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-400 text-slate-500 transition-colors"
                            title="Previous Page"
                        >
                            <ChevronLeft size={16} />
                        </button>
                        
                        <div className="px-4 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 min-w-[3rem] text-center shadow-sm">
                            {currentPage}
                        </div>

                        <button 
                            onClick={() => handlePageChange(currentPage + 1)} 
                            disabled={currentPage === totalPages || loading || totalPages === 0} 
                            className="p-2 border border-slate-200 rounded-lg hover:bg-white hover:text-[#0A66C2] disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-400 text-slate-500 transition-colors"
                            title="Next Page"
                        >
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            </div>

            <EditUserProfileModal 
                user={selectedUser}
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                onUpdate={handleUserUpdate}
            />
        </div>
    );
};

export default UsersPage;
