import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import api from '../api/axios';
import {
    Inbox, Loader2, X, User,
    FileText, Info, ClipboardList, ChevronLeft, ChevronRight, ChevronsLeft
} from 'lucide-react';

const USERS_PAGE_SIZE = 2000;
const PAGE_SIZE = 20;

async function fetchAllUsers() {
    let page = 1;
    let all = [];
    while (true) {
        const res = await api.get('/users/profiles', { params: { page, size: USERS_PAGE_SIZE } });
        const users = res.data?.users || [];
        all = all.concat(users);
        if (!res.data?.hasNext) break;
        page++;
    }
    return all;
}

// ─── Case Details Modal ────────────────────────────────────────────────────────
const CaseDetailsModal = ({ caseItem, onClose }) => {
    if (!caseItem) return null;

    const f = (c, field) => c[`packagescase_folder${field}`] || c[field] || '';

    const DetailRow = ({ label, value }) => (
        <div className="flex gap-2">
            <span className="text-xs font-semibold text-slate-500 w-36 shrink-0">{label}</span>
            <span className="text-xs text-slate-800 break-all">{value || '—'}</span>
        </div>
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-slate-50 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[#0A66C2] flex items-center justify-center shadow-sm">
                            <FileText size={17} className="text-white" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-900">{f(caseItem, 'object_name')}</p>
                            <p className="text-xs text-slate-500">Case Details</p>
                        </div>
                    </div>
                    <button onClick={onClose}
                        className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all">
                        <X size={18} />
                    </button>
                </div>

                <div className="overflow-y-auto flex-1 p-6">
                    <div className="flex items-center gap-2 mb-3">
                        <Info size={14} className="text-[#0A66C2]" />
                        <h3 className="text-sm font-bold text-slate-800">Case Details</h3>
                    </div>
                    <div className="bg-slate-50 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3 border border-slate-100">
                        <DetailRow label="Case Number"    value={f(caseItem, 'object_name')} />
                        <DetailRow label="Subject"        value={f(caseItem, 'description')} />
                        <DetailRow label="Department"     value={f(caseItem, 'department_name')} />
                        <DetailRow label="Vertical"       value={f(caseItem, 'functions')} />
                        <DetailRow label="Office Type"    value={f(caseItem, 'ho_ro')} />
                        <DetailRow label="Case Priority"  value={f(caseItem, 'task_priority')} />
                        <DetailRow label="Case Status"    value={f(caseItem, 'status')} />
                        <DetailRow label="Nature of Case" value={f(caseItem, 'case_nature')} />
                        <DetailRow label="Disposal Level" value={f(caseItem, 'disposal_level')} />
                        <DetailRow label="File No"        value={f(caseItem, 'file_number')} />
                        <DetailRow label="Case Type"      value={f(caseItem, 'types')} />
                        <DetailRow label="Created By"     value={f(caseItem, 'r_creator_name')} />
                        <DetailRow label="Language"       value={f(caseItem, 'language_type')} />
                        <DetailRow label="Task"           value={caseItem.packagesworkflow_paramtask_name} />
                        <DetailRow label="Performer"      value={caseItem.task_performer_name} />
                        <DetailRow label="Object ID"      value={f(caseItem, 'id') || caseItem.id} />
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── Movement Register Modal ───────────────────────────────────────────────────
const MovementRegisterModal = ({ caseItem, onClose }) => {
    const [movement, setMovement] = useState([]);
    const [loading, setLoading]   = useState(true);

    useEffect(() => {
        if (!caseItem) return;
        const caseId = caseItem.packagescase_folderid || caseItem.r_object_id || caseItem.objectId || caseItem.id;
        if (!caseId) { setLoading(false); return; }
        setLoading(true);
        api.get(`/delegate/cases/${caseId}/movement`)
            .then(res => setMovement(Array.isArray(res.data) ? res.data : []))
            .catch(() => setMovement([]))
            .finally(() => setLoading(false));
    }, [caseItem]);

    if (!caseItem) return null;

    const movCols = [
        { key: 'object_name',    label: 'Object Name' },
        { key: 'performer',      label: 'Performer' },
        { key: 'decision',       label: 'Decision' },
        { key: 'assigned_user',  label: 'Assigned User' },
        { key: 'completion_date',label: 'Completion Date' },
        { key: 'r_creation_date',label: 'R Creation Date' },
        { key: 'r_modify_date',  label: 'R Modify Date' },
        { key: 'acl_domain',     label: 'Acl Domain' },
        { key: 'acl_name',       label: 'Acl Name' },
        { key: 'owner_name',     label: 'Owner Name' },
    ];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-slate-50 shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[#0A66C2] flex items-center justify-center shadow-sm">
                            <ClipboardList size={17} className="text-white" />
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-900">
                                {caseItem.packagescase_folderobject_name || caseItem.object_name}
                            </p>
                            <p className="text-xs text-slate-500">Movement Register</p>
                        </div>
                    </div>
                    <button onClick={onClose}
                        className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all">
                        <X size={18} />
                    </button>
                </div>

                <div className="overflow-y-auto flex-1 p-6">
                    <div className="flex items-center gap-2 mb-3">
                        <ClipboardList size={14} className="text-[#0A66C2]" />
                        <h3 className="text-sm font-bold text-slate-800">Movement Register</h3>
                        {!loading && (
                            <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                                {movement.length}
                            </span>
                        )}
                    </div>

                    {loading ? (
                        <div className="flex items-center gap-2 py-12 justify-center text-slate-400">
                            <Loader2 size={18} className="animate-spin text-[#0A66C2]" />
                            <span className="text-sm">Loading movement register…</span>
                        </div>
                    ) : movement.length === 0 ? (
                        <div className="py-12 text-center text-sm text-slate-400 bg-slate-50 rounded-xl border border-slate-100">
                            No movement register records found for this case.
                        </div>
                    ) : (
                        <div className="overflow-x-auto border border-slate-200 rounded-xl">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-slate-50 border-b border-slate-200">
                                    <tr>
                                        <th className="px-3 py-2.5 font-semibold text-slate-600 w-8">#</th>
                                        {movCols.map(col => (
                                            <th key={col.key} className="px-3 py-2.5 font-semibold text-slate-600 whitespace-nowrap">
                                                {col.label}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {movement.map((rec, idx) => (
                                        <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                                            <td className="px-3 py-2 text-slate-400 font-mono">{idx + 1}</td>
                                            {movCols.map(col => (
                                                <td key={col.key} className="px-3 py-2 text-slate-700 max-w-xs truncate"
                                                    title={String(rec[col.key] ?? '')}>
                                                    {rec[col.key] ?? '—'}
                                                </td>
                                            ))}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ─── CaseInbox2Page ────────────────────────────────────────────────────────────
const CaseInbox2Page = () => {
    const [allUsers,     setAllUsers]     = useState([]);
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [searchQuery,  setSearchQuery]  = useState('');
    const [showDropdown, setShowDropdown] = useState(false);
    const [selectedUser, setSelectedUser] = useState(null);
    const dropdownRef = useRef(null);

    const [cases,        setCases]        = useState([]);
    const [total,        setTotal]        = useState(0);
    const [loadingCases, setLoadingCases] = useState(false);
    const [page,         setPage]         = useState(1);
    const [error,        setError]        = useState(null);

    const [detailCase,   setDetailCase]   = useState(null);
    const [movementCase, setMovementCase] = useState(null);

    // Load all users on mount
    useEffect(() => {
        setLoadingUsers(true);
        fetchAllUsers()
            .then(setAllUsers)
            .catch(() => setAllUsers([]))
            .finally(() => setLoadingUsers(false));
    }, []);

    // Close dropdown on outside click
    useEffect(() => {
        const handler = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target))
                setShowDropdown(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    const filteredUsers = useMemo(() =>
        allUsers.filter(u => {
            const q = searchQuery.toLowerCase();
            return (u.object_name || '').toLowerCase().includes(q)
                || (u.user_login_name || '').toLowerCase().includes(q);
        }),
        [allUsers, searchQuery]
    );

    const fetchCases = useCallback(async (userName, pg) => {
        if (!userName) { setCases([]); setTotal(0); return; }
        setLoadingCases(true);
        setError(null);
        try {
            const start = (pg - 1) * PAGE_SIZE;
            const res = await api.get('/inbox/tasklist', {
                params: { username: userName, page: pg, start }
            });
            const data = res.data || {};
            let items = [];
            if (Array.isArray(data.entries)) {
                items = data.entries.map(entry => {
                    const props = entry?.content?.properties || entry?.properties || entry;
                    return { ...props, _raw: entry };
                });
            } else if (Array.isArray(data.tasks)) {
                items = data.tasks;
            }
setCases(items);
            setTotal(data.total || data.count || items.length);
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Failed to load inbox');
            setCases([]);
            setTotal(0);
        } finally {
            setLoadingCases(false);
        }
    }, []);

    const handleSelectUser = (user) => {
        setSelectedUser(user);
        setSearchQuery('');
        setShowDropdown(false);
        setPage(1);
        fetchCases(user.object_name, 1);
    };

    const handlePageChange = (newPage) => {
        setPage(newPage);
        fetchCases(selectedUser?.object_name, newPage);
    };

    const rangeStart = cases.length > 0 ? (page - 1) * PAGE_SIZE + 1 : 0;
    const rangeEnd   = (page - 1) * PAGE_SIZE + cases.length;
    const hasNext    = rangeEnd < total;
    const hasPrev    = page > 1;

    const p               = (c, f) => c[`packagescase_folder${f}`] || c[f];
    const getCaseName     = (c) => p(c, 'object_name') || '—';
    const getCaseDesc     = (c) => p(c, 'description') || c.packagesworkflow_paramtask_name || '—';
    const getCaseStatus   = (c) => p(c, 'status') || '—';
    const getCasePriority = (c) => p(c, 'task_priority') || '—';
    const getCaseDept     = (c) => p(c, 'department_name') || '—';
    const getCaseHoRo     = (c) => p(c, 'ho_ro') || '—';
    const getCaseId       = (c) => p(c, 'id') || c.id || '';

    const inputCls = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/20 focus:border-[#0A66C2] bg-white';

    return (
        <div className="p-6 max-w-7xl mx-auto h-full flex flex-col">
            {detailCase   && <CaseDetailsModal     caseItem={detailCase}   onClose={() => setDetailCase(null)} />}
            {movementCase && <MovementRegisterModal caseItem={movementCase} onClose={() => setMovementCase(null)} />}

            {/* Page header */}
            <div className="flex items-center gap-2 mb-5">
                <Inbox size={20} className="text-[#0A66C2]" />
                <h1 className="text-xl font-bold text-slate-900">Case Inbox</h1>
            </div>

            {/* User selector */}
            <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm mb-5">
                <h2 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
                    <User size={15} className="text-[#0A66C2]" />
                    Select User
                </h2>
                <div className="relative max-w-md" ref={dropdownRef}>
                    <input
                        type="text"
                        className={inputCls}
                        placeholder={loadingUsers ? 'Loading users…' : 'Search by name or login…'}
                        value={selectedUser ? selectedUser.object_name : searchQuery}
                        disabled={loadingUsers}
                        onFocus={() => { if (selectedUser) setSelectedUser(null); setShowDropdown(true); }}
                        onChange={e => { setSearchQuery(e.target.value); setShowDropdown(true); setSelectedUser(null); }}
                    />
                    {loadingUsers && (
                        <Loader2 size={15} className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin text-slate-400" />
                    )}
                    {showDropdown && filteredUsers.length > 0 && (
                        <div className="absolute z-20 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                            {filteredUsers.slice(0, 100).map(u => (
                                <button
                                    key={u.r_object_id || u.user_login_name}
                                    type="button"
                                    className="w-full text-left px-3 py-2 text-sm hover:bg-[#0A66C2]/5 flex items-center justify-between"
                                    onClick={() => handleSelectUser(u)}
                                >
                                    <span className="font-medium text-slate-800">{u.object_name}</span>
                                    <span className="text-xs text-slate-400 font-mono">{u.user_login_name}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Tasks panel */}
            <div className="flex-1 bg-white border border-slate-200 rounded-xl shadow-sm flex flex-col overflow-hidden">

                {/* Panel header */}
                <div className="px-5 py-3 border-b border-slate-100 flex items-center gap-3">
                    <ClipboardList size={15} className="text-[#0A66C2]" />
                    <span className="text-sm font-semibold text-slate-700">
                        {selectedUser ? `Inbox — ${selectedUser.object_name}` : 'Inbox Tasks'}
                    </span>
                    {selectedUser && !loadingCases && total > 0 && (
                        <span className="px-2 py-0.5 text-xs bg-slate-100 text-slate-500 rounded-full">
                            {total} case{total !== 1 ? 's' : ''}
                        </span>
                    )}
                </div>

                {/* Table area */}
                <div className="flex-1 overflow-auto">
                    {!selectedUser && (
                        <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400 py-16">
                            <Inbox size={36} strokeWidth={1.5} />
                            <p className="text-sm">Select a user to view their inbox cases</p>
                        </div>
                    )}

                    {selectedUser && loadingCases && (
                        <div className="flex items-center justify-center h-full py-16">
                            <Loader2 size={24} className="animate-spin text-[#0A66C2]" />
                        </div>
                    )}

                    {selectedUser && !loadingCases && error && (
                        <div className="flex flex-col items-center justify-center h-full gap-2 text-red-500 py-16">
                            <p className="text-sm">{error}</p>
                        </div>
                    )}

                    {selectedUser && !loadingCases && !error && cases.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full gap-2 text-slate-400 py-16">
                            <Inbox size={36} strokeWidth={1.5} />
                            <p className="text-sm">No pending cases found for this user</p>
                        </div>
                    )}

                    {selectedUser && !loadingCases && !error && cases.length > 0 && (
                        <table className="w-full text-left text-sm">
                            <thead className="sticky top-0 bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide w-12">#</th>
                                    {['Case Number', 'Subject', 'Department', 'Office', 'Status', 'Priority', 'Actions'].map(h => (
                                        <th key={h} className="px-4 py-2.5 text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">
                                            {h}
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {cases.map((c, idx) => (
                                    <tr key={getCaseId(c) || idx} className="hover:bg-slate-50 transition-colors">
                                        <td className="px-4 py-3 text-slate-400 font-mono text-xs">
                                            {(page - 1) * PAGE_SIZE + idx + 1}
                                        </td>
                                        <td className="px-4 py-3 font-medium text-slate-800">{getCaseName(c)}</td>
                                        <td className="px-4 py-3 text-slate-600 max-w-xs truncate" title={getCaseDesc(c)}>
                                            {getCaseDesc(c)}
                                        </td>
                                        <td className="px-4 py-3 text-slate-600 text-xs">{getCaseDept(c)}</td>
                                        <td className="px-4 py-3 text-slate-600 text-xs">{getCaseHoRo(c)}</td>
                                        <td className="px-4 py-3">
                                            <span className="px-2 py-0.5 text-xs rounded-full bg-blue-50 text-blue-700 font-medium">
                                                {getCaseStatus(c)}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            {getCasePriority(c) !== '—' ? (
                                                <span className={`px-2 py-0.5 text-xs rounded-full font-medium ${
                                                    getCasePriority(c) === 'High'   ? 'bg-red-100 text-red-700' :
                                                    getCasePriority(c) === 'Medium' ? 'bg-amber-100 text-amber-700' :
                                                    'bg-slate-100 text-slate-600'
                                                }`}>{getCasePriority(c)}</span>
                                            ) : '—'}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="flex items-center gap-1">
                                                <button
                                                    onClick={() => setDetailCase(c)}
                                                    title="Case Details"
                                                    className="p-1.5 rounded-lg text-slate-400 hover:text-[#0A66C2] hover:bg-blue-50 transition-all"
                                                >
                                                    <FileText size={15} />
                                                </button>
                                                <button
                                                    onClick={() => setMovementCase(c)}
                                                    title="Movement Register"
                                                    className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all"
                                                >
                                                    <ClipboardList size={15} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Pagination footer */}
                {selectedUser && !loadingCases && (hasPrev || hasNext) && (
                    <div className="px-5 py-3 border-t border-slate-100 flex items-center justify-between bg-white">
                        <span className="text-xs text-slate-500">
                            {rangeStart > 0 ? `Showing ${rangeStart}–${rangeEnd}${total > rangeEnd ? ` of ${total}` : ''}` : ''}
                        </span>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => handlePageChange(1)}
                                disabled={!hasPrev}
                                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <ChevronsLeft size={16} />
                            </button>
                            <button
                                onClick={() => handlePageChange(page - 1)}
                                disabled={!hasPrev}
                                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <ChevronLeft size={16} />
                            </button>
                            <span className="px-3 py-1 text-xs font-medium text-slate-700">Page {page}</span>
                            <button
                                onClick={() => handlePageChange(page + 1)}
                                disabled={!hasNext}
                                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                <ChevronRight size={16} />
                            </button>
                        </div>
                        <div className="w-16" />
                    </div>
                )}
            </div>
        </div>
    );
};

export default CaseInbox2Page;
