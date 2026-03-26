import React, { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import { getDepartments, getLocations } from '../data/nabardMetadata';
import {
    ArrowRightLeft, Search, Loader2, ChevronLeft, ChevronRight,
    ChevronsLeft, X, UserRoundCog, Users, Building2, MapPin, FolderOpen
} from 'lucide-react';

// ─── Toast ────────────────────────────────────────────────────────────────────
const Toast = ({ toast, onClose }) => {
    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(onClose, 4000);
        return () => clearTimeout(t);
    }, [toast, onClose]);

    if (!toast) return null;
    const isError = toast.type === 'error';
    return (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium border
            ${isError ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-800'}`}>
            <span>{toast.message}</span>
            <button onClick={onClose} className="ml-1 opacity-60 hover:opacity-100"><X size={14} /></button>
        </div>
    );
};

// ─── SelectWrapper ─────────────────────────────────────────────────────────
const SelectWrapper = ({ children }) => (
    <div className="relative">
        {children}
        <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
            <svg className="h-4 w-4 text-slate-400" fill="none" viewBox="0 0 20 20" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M6 8l4 4 4-4" />
            </svg>
        </div>
    </div>
);

const selectCls         = 'w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/20 focus:border-[#0A66C2] bg-white appearance-none cursor-pointer pr-8';
const disabledSelectCls = 'w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-100 text-slate-400 cursor-not-allowed appearance-none pr-8';

const FieldLabel = ({ icon: Icon, label }) => (
    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-600 mb-1">
        <Icon size={13} className="text-slate-400" />
        {label}
    </label>
);

// ─── DelegatePage ─────────────────────────────────────────────────────────────
const DelegatePage = () => {
    // ── Filter state ──────────────────────────────────────────────────────────
    const [officeType, setOfficeType] = useState('');
    const [location,   setLocation]   = useState(''); // location name (for RO/TE)
    const [department, setDepartment] = useState(null); // { name, shortCode }

    // ── User dropdown state ───────────────────────────────────────────────────
    const [users,        setUsers]        = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [selectedUser, setSelectedUser] = useState(''); // object_name (performer)

    // ── Cases state ───────────────────────────────────────────────────────────
    const [cases,        setCases]        = useState([]);
    const [loadingCases, setLoadingCases] = useState(false);
    const [page,         setPage]         = useState(1);
    const pageSize = 20;
    const [hasNext,      setHasNext]      = useState(false);

    const [searchQuery, setSearchQuery] = useState('');
    const [activeQuery, setActiveQuery] = useState('');

    const [delegating, setDelegating] = useState(null);
    const [toast,      setToast]      = useState(null);

    // Derived helpers
    const locations   = getLocations(officeType);
    const departments = getDepartments(officeType, location);
    const isRoTe      = officeType === 'RO' || officeType === 'TE';

    // ── Case fetching ─────────────────────────────────────────────────────────
    const fetchCases = useCallback(async (query, hoRo, deptName, pg) => {
        setLoadingCases(true);
        try {
            const params = { query: query || '', page: pg, size: pageSize };
            if (hoRo)     params.hoRo     = hoRo;
            if (deptName) params.deptName = deptName;
            const res = await api.get('/delegate/cases', { params });
            setCases(res.data?.cases || []);
            setHasNext(res.data?.hasNext || false);
        } catch (err) {
            setToast({ type: 'error', message: 'Failed to load cases: ' + (err.response?.data?.message || err.message) });
            setCases([]);
        } finally {
            setLoadingCases(false);
        }
    }, [pageSize]);

    // Load recent cases on mount
    useEffect(() => { fetchCases('', '', '', 1); }, [fetchCases]);

    // ── User fetching ─────────────────────────────────────────────────────────
    const fetchUsersByDept = async (shortCode) => {
        setLoadingUsers(true);
        setUsers([]);
        try {
            const res = await api.get('/users/by-dept', { params: { shortCode } });
            setUsers(res.data?.users || res.data || []);
        } catch (err) {
            setToast({ type: 'error', message: 'Failed to load users: ' + (err.response?.data?.message || err.message) });
        } finally {
            setLoadingUsers(false);
        }
    };

    const fetchUsersByLocation = async (loc) => {
        setLoadingUsers(true);
        setUsers([]);
        try {
            const res = await api.get('/users/by-location', { params: { location: loc } });
            setUsers(res.data?.users || res.data || []);
        } catch (err) {
            setToast({ type: 'error', message: 'Failed to load users: ' + (err.response?.data?.message || err.message) });
        } finally {
            setLoadingUsers(false);
        }
    };

    // ── Cascade handlers ──────────────────────────────────────────────────────
    const handleOfficeTypeChange = (val) => {
        setOfficeType(val);
        setLocation('');
        setDepartment(null);
        setUsers([]);
        setSelectedUser('');
        setPage(1);
        fetchCases(activeQuery, val, '', 1);
    };

    const handleLocationChange = (val) => {
        setLocation(val);
        setDepartment(null);
        setSelectedUser('');
        setPage(1);
        if (val) {
            fetchUsersByLocation(val);
            fetchCases(activeQuery, officeType, '', 1);
        } else {
            setUsers([]);
            fetchCases(activeQuery, officeType, '', 1);
        }
    };

    const handleDepartmentChange = (shortCode) => {
        if (!shortCode) {
            setDepartment(null);
            setSelectedUser('');
            // For RO/TE fall back to location-based users, for HO clear users
            if (isRoTe && location) {
                fetchUsersByLocation(location);
            } else {
                setUsers([]);
            }
            fetchCases(activeQuery, officeType, '', 1);
            setPage(1);
            return;
        }
        const dept = departments.find(d => d.shortCode === shortCode) || null;
        setDepartment(dept);
        setSelectedUser('');
        setPage(1);
        if (dept) {
            fetchUsersByDept(dept.shortCode);
            fetchCases(activeQuery, officeType, dept.name, 1);
        }
    };

    // ── Search handlers ───────────────────────────────────────────────────────
    const handleSearch = (e) => {
        e.preventDefault();
        const q = searchQuery.trim();
        setActiveQuery(q);
        setPage(1);
        fetchCases(q, officeType, department?.name || '', 1);
    };

    const clearSearch = () => {
        setSearchQuery('');
        setActiveQuery('');
        setPage(1);
        fetchCases('', officeType, department?.name || '', 1);
    };

    const handlePageChange = (newPage) => {
        setPage(newPage);
        fetchCases(activeQuery, officeType, department?.name || '', newPage);
    };

    // ── Delegate action ───────────────────────────────────────────────────────
    const handleDelegate = async (caseItem) => {
        if (!selectedUser) {
            setToast({ type: 'error', message: 'Please select a user to delegate to.' });
            return;
        }
        setDelegating(caseItem.r_object_id);
        try {
            const res = await api.post('/delegate', {
                caseId: caseItem.r_object_id,
                performerDisplayName: selectedUser,
            });
            setToast({ type: 'success', message: res.data?.message || 'Case delegated successfully.' });
        } catch (err) {
            setToast({ type: 'error', message: err.response?.data?.message || err.message || 'Delegation failed.' });
        } finally {
            setDelegating(null);
        }
    };

    const rangeStart = cases.length > 0 ? (page - 1) * pageSize + 1 : 0;
    const rangeEnd   = (page - 1) * pageSize + cases.length;

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <Toast toast={toast} onClose={() => setToast(null)} />

            {/* Page Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
                    <ArrowRightLeft className="text-[#0A66C2]" />
                    Delegate Case
                </h1>
                <p className="text-sm text-slate-500 mt-1">
                    Filter by office and department, select a user, then delegate cases.
                </p>
            </div>

            {/* ── Filter Panel ── */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-5 mb-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">

                    {/* Office Type */}
                    <div>
                        <FieldLabel icon={Building2} label="Office Type" />
                        <SelectWrapper>
                            <select value={officeType} onChange={e => handleOfficeTypeChange(e.target.value)}
                                className={selectCls}>
                                <option value="">— All offices —</option>
                                <option value="HO">HO — Head Office</option>
                                <option value="RO">RO — Regional Office</option>
                                <option value="TE">TE — Training Establishment</option>
                            </select>
                        </SelectWrapper>
                    </div>

                    {/* Location */}
                    <div>
                        <FieldLabel icon={MapPin} label="Location" />
                        {isRoTe ? (
                            <SelectWrapper>
                                <select value={location} onChange={e => handleLocationChange(e.target.value)}
                                    className={selectCls}>
                                    <option value="">— Select location —</option>
                                    {locations.map(l => (
                                        <option key={l.shortCode} value={l.location}>{l.location}</option>
                                    ))}
                                </select>
                            </SelectWrapper>
                        ) : officeType === 'HO' ? (
                            <input readOnly value="Mumbai (Head Office)"
                                className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm bg-slate-100 text-slate-500 cursor-not-allowed" />
                        ) : (
                            <input readOnly value=""
                                placeholder="— Select office first —"
                                className={disabledSelectCls} />
                        )}
                    </div>

                    {/* Department */}
                    <div>
                        <FieldLabel icon={FolderOpen} label="Department" />
                        <SelectWrapper>
                            <select
                                value={department?.shortCode || ''}
                                onChange={e => handleDepartmentChange(e.target.value)}
                                disabled={!officeType || (isRoTe && !location)}
                                className={!officeType || (isRoTe && !location) ? disabledSelectCls : selectCls}
                            >
                                <option value="">
                                    {!officeType
                                        ? '— Select office first —'
                                        : (isRoTe && !location)
                                            ? '— Select location first —'
                                            : '— Select department —'}
                                </option>
                                {departments.map(d => (
                                    <option key={d.shortCode} value={d.shortCode}>{d.name}</option>
                                ))}
                            </select>
                        </SelectWrapper>
                    </div>

                    {/* Delegate To */}
                    <div>
                        <FieldLabel icon={Users} label="Delegate To" />
                        <SelectWrapper>
                            <select
                                value={selectedUser}
                                onChange={e => setSelectedUser(e.target.value)}
                                disabled={loadingUsers || users.length === 0}
                                className={loadingUsers || users.length === 0 ? disabledSelectCls : selectCls}
                            >
                                <option value="">
                                    {loadingUsers
                                        ? 'Loading users…'
                                        : users.length === 0
                                            ? '— Select dept/location first —'
                                            : '— Select user —'}
                                </option>
                                {users.map(u => (
                                    <option key={u.r_object_id || u.user_login_name} value={u.object_name}>
                                        {u.object_name}
                                    </option>
                                ))}
                            </select>
                        </SelectWrapper>
                    </div>
                </div>
            </div>

            {/* ── Search Bar + Active Filter Chips ── */}
            <div className="flex flex-wrap items-center gap-3 mb-5">
                <form onSubmit={handleSearch} className="flex items-center gap-2">
                    <div className="relative">
                        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Search by case number…"
                            className="w-64 pl-9 pr-8 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#0A66C2] shadow-sm transition-all"
                        />
                        {searchQuery && (
                            <button type="button" onClick={clearSearch}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1">
                                <X size={14} />
                            </button>
                        )}
                    </div>
                    <button type="submit" disabled={!searchQuery.trim() || loadingCases}
                        className="px-5 py-2.5 bg-[#0A66C2] text-white rounded-lg text-sm font-semibold hover:bg-[#094d92] disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm transition-all">
                        {loadingCases ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
                        Search
                    </button>
                </form>

                {/* Active filter chips */}
                <div className="flex items-center gap-2 flex-wrap">
                    {officeType && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-xs font-medium">
                            <Building2 size={11} /> {officeType}
                        </span>
                    )}
                    {location && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-100 text-slate-700 border border-slate-200 rounded-full text-xs font-medium">
                            <MapPin size={11} /> {location}
                        </span>
                    )}
                    {department && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-full text-xs font-medium">
                            <FolderOpen size={11} /> {department.name}
                        </span>
                    )}
                    {selectedUser && (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-green-50 text-green-700 border border-green-200 rounded-full text-xs font-medium">
                            <UserRoundCog size={11} /> {selectedUser}
                        </span>
                    )}
                </div>
            </div>

            {/* ── Cases Table ── */}
            <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
                {/* Meta bar */}
                {!loadingCases && cases.length > 0 && (
                    <div className="px-6 py-3 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between text-sm">
                        <span className="text-slate-600">
                            Showing <span className="font-semibold text-[#0A66C2]">{rangeStart}–{rangeEnd}</span>
                            {hasNext ? '+' : ''} cases
                        </span>
                        {!selectedUser && (
                            <span className="text-amber-600 text-xs font-medium">
                                Select a user above to enable delegation
                            </span>
                        )}
                    </div>
                )}

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-5 py-3 font-semibold text-slate-700 w-14">#</th>
                                <th className="px-5 py-3 font-semibold text-slate-700">Case Number</th>
                                <th className="px-5 py-3 font-semibold text-slate-700">Subject</th>
                                <th className="px-5 py-3 font-semibold text-slate-700">Description</th>
                                <th className="px-5 py-3 font-semibold text-slate-700">Office / Dept</th>
                                <th className="px-5 py-3 font-semibold text-slate-700 text-center w-28">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loadingCases ? (
                                [...Array(5)].map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td className="px-5 py-3"><div className="h-4 bg-slate-100 rounded w-6" /></td>
                                        <td className="px-5 py-3"><div className="h-4 bg-slate-100 rounded w-32" /></td>
                                        <td className="px-5 py-3"><div className="h-4 bg-slate-100 rounded w-48" /></td>
                                        <td className="px-5 py-3"><div className="h-4 bg-slate-100 rounded w-40" /></td>
                                        <td className="px-5 py-3"><div className="h-4 bg-slate-100 rounded w-24" /></td>
                                        <td className="px-5 py-3"><div className="h-8 bg-slate-100 rounded w-20 mx-auto" /></td>
                                    </tr>
                                ))
                            ) : cases.length === 0 ? (
                                <tr>
                                    <td colSpan="6" className="px-6 py-14 text-center text-slate-500">
                                        <p className="font-medium">No cases found</p>
                                        <p className="text-xs mt-1">
                                            {officeType && !department
                                                ? 'Select a department to narrow results'
                                                : 'Try different filters or a different search term'}
                                        </p>
                                    </td>
                                </tr>
                            ) : (
                                cases.map((c, idx) => {
                                    const isDelegating = delegating === c.r_object_id;
                                    return (
                                        <tr key={c.r_object_id || idx}
                                            className="hover:bg-blue-50/30 transition-colors group">
                                            <td className="px-5 py-2.5 text-slate-400 font-mono text-xs">
                                                {(page - 1) * pageSize + idx + 1}
                                            </td>
                                            <td className="px-5 py-2.5 font-medium text-slate-900">
                                                {c.object_name || '-'}
                                            </td>
                                            <td className="px-5 py-2.5 text-slate-600 font-medium">
                                                {c.subject || '-'}
                                            </td>
                                            <td className="px-5 py-2.5 text-slate-500 max-w-xs truncate"
                                                title={c.description}>
                                                {c.description || '-'}
                                            </td>
                                            <td className="px-5 py-2.5 text-slate-500">
                                                <div className="flex flex-col">
                                                    <span>{c.ho_ro || '-'}</span>
                                                    <span className="text-xs text-slate-400">{c.department_name}</span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-2.5 text-center">
                                                <button
                                                    onClick={() => handleDelegate(c)}
                                                    disabled={!selectedUser || isDelegating || !!delegating}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0A66C2] hover:bg-[#094d92] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg shadow-sm transition-all"
                                                >
                                                    {isDelegating
                                                        ? <><Loader2 size={12} className="animate-spin" /> Delegating…</>
                                                        : <><ArrowRightLeft size={12} /> Delegate</>
                                                    }
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {!loadingCases && cases.length > 0 && (
                    <div className="px-6 py-3 border-t border-slate-100 flex items-center justify-between bg-slate-50/50">
                        <button onClick={() => handlePageChange(1)} disabled={page === 1}
                            className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                            <ChevronsLeft size={16} className="text-slate-600" />
                        </button>
                        <div className="flex items-center gap-1">
                            <button onClick={() => handlePageChange(page - 1)} disabled={page === 1}
                                className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                                <ChevronLeft size={16} className="text-slate-600" />
                            </button>
                            <span className="px-3 py-1 text-sm font-medium text-slate-700">Page {page}</span>
                            <button onClick={() => handlePageChange(page + 1)} disabled={!hasNext}
                                className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors">
                                <ChevronRight size={16} className="text-slate-600" />
                            </button>
                        </div>
                        <div className="w-8" />
                    </div>
                )}
            </div>
        </div>
    );
};

export default DelegatePage;
