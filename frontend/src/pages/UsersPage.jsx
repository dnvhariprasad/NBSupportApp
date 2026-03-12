import { useState, useEffect, useMemo, useRef } from 'react';
import api from '../api/axios';
import {
    Search, ChevronLeft, ChevronRight, ChevronDown, Users, UserPlus,
    Loader2, Edit2, ChevronsLeft, X, ArrowUpDown, ArrowUp, ArrowDown,
    CheckCircle2, AlertCircle, Shield, Mail, User, Key, Database,
    FolderOpen, Globe, Lock, Tag, Info, Eye, EyeOff, KeyRound, UserCog,
    Briefcase, Building2, Hash, MapPin, ToggleLeft, GraduationCap, Layers
} from 'lucide-react';
import EditUserProfileModal from '../components/EditUserProfileModal.jsx';

// ─── Fetch all users across pages (Documentum REST caps at 2000/page) ────────
async function fetchAllUsers() {
    const PAGE_SIZE = 2000;
    let page = 1;
    let all = [];
    while (true) {
        const res = await api.get('/users/profiles', { params: { page, size: PAGE_SIZE } });
        const users = res.data.users || [];
        all = all.concat(users);
        if (!res.data.hasNext) break;
        page++;
    }
    return all;
}

// ─── Privilege options for dm_user ───────────────────────────────────────────
const PRIVILEGE_OPTIONS = [
    { value: 0,  label: 'None',          description: 'Regular user with no special privileges' },
    { value: 1,  label: 'Create Type',   description: 'Can create new object types' },
    { value: 2,  label: 'Create Cabinet',description: 'Can create cabinets in the repository' },
    { value: 4,  label: 'Create User',   description: 'Can create new users' },
    { value: 8,  label: 'Create Group',  description: 'Can create new groups' },
    { value: 16, label: 'Sysadmin',      description: 'System administrator privileges' },
    { value: 32, label: 'Superuser',     description: 'Full superuser access' },
];

// ─── Toast Notification ───────────────────────────────────────────────────────
const Toast = ({ toast, onDismiss }) => {
    useEffect(() => {
        if (!toast) return;
        const timer = setTimeout(onDismiss, toast.type === 'success' ? 3000 : 5000);
        return () => clearTimeout(timer);
    }, [toast, onDismiss]);

    if (!toast) return null;

    const styles = {
        success: 'bg-green-50 text-green-800 border-green-200',
        error:   'bg-red-50   text-red-800   border-red-200',
    };
    const Icon = toast.type === 'success' ? CheckCircle2 : AlertCircle;

    return (
        <div className={`fixed top-5 right-5 z-50 flex items-start gap-3 px-4 py-3 border rounded-xl shadow-lg max-w-sm animate-fade-in ${styles[toast.type]}`}>
            <Icon size={18} className="mt-0.5 shrink-0" />
            <div className="flex-1 text-sm font-medium">{toast.message}</div>
            <button onClick={onDismiss} className="shrink-0 opacity-60 hover:opacity-100">
                <X size={16} />
            </button>
        </div>
    );
};

// ─── User Directory Tab ───────────────────────────────────────────────────────
const UserDirectoryTab = () => {
    const [allUsers, setAllUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize] = useState(15);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortConfig, setSortConfig] = useState({ key: 'object_name', direction: 'asc' });
    const [selectedUser, setSelectedUser] = useState(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const users = await fetchAllUsers();
            setAllUsers(users);
        } catch (error) {
            console.error('Error fetching users', error);
            setAllUsers([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchUsers(); }, []);

    const processedUsers = useMemo(() => {
        let result = [...allUsers];
        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase().trim();
            result = result.filter(u =>
                (u.object_name?.toLowerCase() || '').includes(query) ||
                (u.user_login_name?.toLowerCase() || '').includes(query) ||
                (u.uin?.toLowerCase() || '').includes(query) ||
                (u.department_name?.toLowerCase() || '').includes(query) ||
                (u.designation?.toLowerCase() || '').includes(query)
            );
        }
        if (sortConfig.key) {
            result.sort((a, b) => {
                const av = a[sortConfig.key] || '';
                const bv = b[sortConfig.key] || '';
                if (av < bv) return sortConfig.direction === 'asc' ? -1 : 1;
                if (av > bv) return sortConfig.direction === 'asc' ? 1 : -1;
                return 0;
            });
        }
        return result;
    }, [allUsers, searchQuery, sortConfig]);

    const totalItems  = processedUsers.length;
    const totalPages  = Math.ceil(totalItems / pageSize);
    const rangeStart  = (currentPage - 1) * pageSize;
    const rangeEnd    = rangeStart + pageSize;
    const currentUsers = processedUsers.slice(rangeStart, rangeEnd);

    const handleSort = (key) => setSortConfig(c => ({
        key, direction: c.key === key && c.direction === 'asc' ? 'desc' : 'asc'
    }));

    const handlePageChange = (p) => {
        if (p >= 1 && p <= totalPages) setCurrentPage(p);
    };

    const SortIcon = ({ columnKey }) => {
        if (sortConfig.key !== columnKey)
            return <ArrowUpDown size={14} className="text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity ml-1" />;
        return sortConfig.direction === 'asc'
            ? <ArrowUp size={14} className="text-[#0A66C2] ml-1" />
            : <ArrowDown size={14} className="text-[#0A66C2] ml-1" />;
    };

    const SortableHeader = ({ label, columnKey, className = '' }) => (
        <th className={`px-4 py-3 font-semibold text-slate-700 cursor-pointer hover:bg-slate-100 transition-colors group select-none ${className}`}
            onClick={() => handleSort(columnKey)}>
            <div className="flex items-center">{label}<SortIcon columnKey={columnKey} /></div>
        </th>
    );

    return (
        <div className="flex flex-col flex-1 overflow-hidden">
            {/* Search bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                <div className="text-sm text-slate-500 font-medium">
                    {!loading && <span><span className="text-slate-900 font-semibold">{totalItems}</span> users found</span>}
                </div>
                <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
                        placeholder="Search by Name, UIN, Dept..."
                        className="w-full sm:w-72 pl-9 pr-8 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#0A66C2] shadow-sm"
                    />
                    {searchQuery && (
                        <button onClick={() => { setSearchQuery(''); setCurrentPage(1); }}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-full">
                            <X size={14} />
                        </button>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="bg-white border border-slate-200 rounded-lg shadow-sm flex-1 flex flex-col overflow-hidden">
                <div className="overflow-x-auto flex-1">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="px-4 py-3 font-semibold text-slate-700 w-16">#</th>
                                <SortableHeader label="Name"        columnKey="object_name" />
                                <SortableHeader label="UIN"         columnKey="uin" />
                                <SortableHeader label="Department"  columnKey="department_name" />
                                <SortableHeader label="Grade"       columnKey="user_grade" />
                                <SortableHeader label="Designation" columnKey="designation" />
                                <th className="px-4 py-3 font-semibold text-slate-700 w-16 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td colSpan="7" className="px-4 py-20 text-center">
                                    <div className="flex flex-col items-center justify-center text-slate-500">
                                        <Loader2 size={32} className="animate-spin text-[#0A66C2] mb-3" />
                                        <p className="text-sm font-medium">Loading user profiles...</p>
                                    </div>
                                </td></tr>
                            ) : currentUsers.length === 0 ? (
                                <tr><td colSpan="7" className="px-4 py-16 text-center text-slate-500">
                                    <div className="flex flex-col items-center justify-center">
                                        <Users className="h-12 w-12 text-slate-200 mb-3" />
                                        <p className="text-base font-medium text-slate-600">No users found</p>
                                        <p className="text-sm mt-1">Try adjusting your search terms</p>
                                    </div>
                                </td></tr>
                            ) : currentUsers.map((user, idx) => (
                                <tr key={user.r_object_id || idx} className="hover:bg-blue-50/30 transition-colors group">
                                    <td className="px-4 py-3 text-slate-400 font-mono text-xs">{rangeStart + idx + 1}</td>
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
                                        <button onClick={() => { setSelectedUser(user); setIsEditModalOpen(true); }}
                                            className="p-2 hover:bg-white border border-transparent hover:border-slate-200 text-slate-400 hover:text-[#0A66C2] hover:shadow-sm rounded-lg transition-all"
                                            title="Edit User">
                                            <Edit2 size={16} />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="flex items-center justify-between px-6 py-4 border-t border-slate-200 bg-slate-50/50">
                    <div className="text-sm text-slate-500">
                        {totalItems > 0 ? (
                            <>Showing <span className="font-medium text-slate-900">{rangeStart + 1}</span> to <span className="font-medium text-slate-900">{Math.min(rangeEnd, totalItems)}</span> of <span className="font-medium text-slate-900">{totalItems}</span> results</>
                        ) : 'No results'}
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => handlePageChange(1)} disabled={currentPage === 1 || loading}
                            className="p-2 border border-slate-200 rounded-lg hover:bg-white hover:text-[#0A66C2] disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-400 text-slate-500 transition-colors" title="First Page">
                            <ChevronsLeft size={16} />
                        </button>
                        <button onClick={() => handlePageChange(currentPage - 1)} disabled={currentPage === 1 || loading}
                            className="p-2 border border-slate-200 rounded-lg hover:bg-white hover:text-[#0A66C2] disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-400 text-slate-500 transition-colors" title="Previous Page">
                            <ChevronLeft size={16} />
                        </button>
                        <div className="px-4 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-medium text-slate-700 min-w-[3rem] text-center shadow-sm">
                            {currentPage}
                        </div>
                        <button onClick={() => handlePageChange(currentPage + 1)} disabled={currentPage === totalPages || loading || totalPages === 0}
                            className="p-2 border border-slate-200 rounded-lg hover:bg-white hover:text-[#0A66C2] disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-400 text-slate-500 transition-colors" title="Next Page">
                            <ChevronRight size={16} />
                        </button>
                    </div>
                </div>
            </div>

            <EditUserProfileModal
                user={selectedUser}
                isOpen={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                onUpdate={fetchUsers}
            />
        </div>
    );
};

// ─── Create User Tab (3-step wizard) ─────────────────────────────────────────
const SOURCE_OPTIONS = [
    { value: 'OTDS',             label: 'OTDS',             description: 'OpenText Directory Services' },
];

const STATE_OPTIONS = [
    { value: 0, label: 'Active' },
    { value: 1, label: 'Inactive' },
];

const EMPTY_FORM = {
    user_name: '', user_login_name: '', user_address: '', description: '',
    user_source: 'OTDS', user_password: '', user_os_name: '', user_db_name: '',
    user_global_unique_id: '', default_folder: '', home_docbase: '', acl_name: '',
    user_privileges: 0, user_state: 0,
    // OTDS-specific (only used when user_source === 'OTDS')
    otds_password: '', otds_confirm_pw: '', otds_partition: 'DCTMPartitions', otds_no_reset: true,
    // Step 4 — cms_user_profile fields
    profile_designation: '', profile_hindi_designation: '', profile_uin: '', profile_location: '',
    profile_hindi_user_name: '',
    profile_office_type: '', profile_ro_short_code: '', profile_is_active: true,
    profile_user_grade: '', profile_grade_level: '', profile_department_name: '',
    profile_department_short_code: '',
};

const SelectField = ({ value, onChange, options, className = '' }) => (
    <div className="relative">
        <select
            value={value}
            onChange={e => onChange(e.target.value)}
            className={`w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#0A66C2] hover:border-slate-300 bg-white appearance-none pr-10 cursor-pointer ${className}`}
        >
            {options.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}{opt.description ? ` — ${opt.description}` : ''}</option>
            ))}
        </select>
        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
        </div>
    </div>
);

const FormField = ({ label, icon: Icon, required, error, hint, children }) => (
    <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
            <span className="flex items-center gap-1.5">
                <Icon size={14} className="text-slate-400" />
                {label}
                {required && <span className="text-red-400">*</span>}
                {!required && <span className="text-xs font-normal text-slate-400">(optional)</span>}
            </span>
        </label>
        {children}
        {error && <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={12} />{error}</p>}
        {hint && !error && <p className="mt-1.5 text-xs text-slate-400">{hint}</p>}
    </div>
);

const inputCls = (hasError) =>
    `w-full px-4 py-2.5 border rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#0A66C2] ${
        hasError ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white hover:border-slate-300'
    }`;


// ─── Stepper indicator ───────────────────────────────────────────────────────
const STEPS = [
    { num: 1, label: 'Identity',       sub: 'Name & login'              },
    { num: 2, label: 'Authentication', sub: 'Credentials & repository'  },
    { num: 3, label: 'Profile',        sub: 'Role & department'         },
];

const StepIndicator = ({ step }) => (
    <div className="flex items-center justify-center gap-0 mb-8">
        {STEPS.map((s, i) => {
            const done    = step > s.num;
            const active  = step === s.num;
            return (
                <div key={s.num} className="flex items-center">
                    <div className="flex flex-col items-center">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all duration-300 ${
                            done   ? 'bg-[#0A66C2] border-[#0A66C2] text-white' :
                            active ? 'bg-white border-[#0A66C2] text-[#0A66C2]' :
                                     'bg-white border-slate-200 text-slate-400'
                        }`}>
                            {done ? <CheckCircle2 size={16} /> : s.num}
                        </div>
                        <div className="mt-1.5 text-center">
                            <div className={`text-xs font-semibold ${active ? 'text-[#0A66C2]' : done ? 'text-slate-700' : 'text-slate-400'}`}>{s.label}</div>
                            <div className="text-xs text-slate-400">{s.sub}</div>
                        </div>
                    </div>
                    {i < STEPS.length - 1 && (
                        <div className={`h-px w-16 sm:w-24 mx-2 mb-6 transition-all duration-300 ${step > s.num ? 'bg-[#0A66C2]' : 'bg-slate-200'}`} />
                    )}
                </div>
            );
        })}
    </div>
);

// ─── Inline source+password block ────────────────────────────────────────────
const SourcePasswordBlock = ({ form, handleChange, showPassword, setShowPassword,
                               showOtdsConfirm, setShowOtdsConfirm, errors }) => (
    <div>
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
            <span className="flex items-center gap-1.5">
                <Globe size={14} className="text-slate-400" />
                User Source
                <span className="text-red-400">*</span>
            </span>
        </label>
        <div className="border border-slate-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-[#0A66C2] transition-all">
            <div className="flex items-center bg-white">
                <div className="relative flex-1">
                    <select
                        value={form.user_source}
                        onChange={e => { handleChange('user_source', e.target.value); handleChange('user_password', ''); handleChange('otds_password', ''); handleChange('otds_confirm_pw', ''); setShowPassword(false); }}
                        className="w-full px-4 py-2.5 text-sm bg-transparent appearance-none pr-10 cursor-pointer focus:outline-none"
                    >
                        {SOURCE_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label} — {opt.description}</option>
                        ))}
                    </select>
                    <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                    </div>
                </div>
                <div className="px-3 shrink-0">
                    {form.user_source === 'OTDS' && <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">OTDS</span>}
                    {form.user_source === 'inline password' && <span className="px-2 py-0.5 bg-slate-100 text-slate-600 text-xs font-semibold rounded-full">Inline Password</span>}
                </div>
            </div>
            {form.user_source === 'inline password' ? (
                /* Inline Password — password field */
                <div className="border-t border-slate-200 bg-slate-50/60 px-4 py-2.5">
                    <div className="flex items-center gap-2">
                        <Lock size={13} className="text-slate-400 shrink-0" />
                        <input
                            type={showPassword ? 'text' : 'password'}
                            value={form.user_password}
                            onChange={e => handleChange('user_password', e.target.value)}
                            placeholder="Set a password"
                            className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400"
                        />
                        <button type="button" onClick={() => setShowPassword(p => !p)}
                            tabIndex={-1} className="text-slate-400 hover:text-slate-600 transition-colors shrink-0"
                            aria-label={showPassword ? 'Hide password' : 'Show password'}>
                            {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                    </div>
                    {errors?.user_password && <p className="text-xs text-red-500 mt-1 ml-5">{errors.user_password}</p>}
                </div>
            ) : form.user_source === 'OTDS' ? (
                /* OTDS — initial password, confirm, partition, no-reset checkbox */
                <div className="border-t border-slate-200 bg-slate-50/60 p-4 space-y-3">
                    {/* Password */}
                    <div>
                        <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 bg-white focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-[#0A66C2] transition-all">
                            <Key size={13} className="text-slate-400 shrink-0" />
                            <input type={showPassword ? 'text' : 'password'} value={form.otds_password}
                                onChange={e => handleChange('otds_password', e.target.value)}
                                placeholder="Initial OTDS password"
                                className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" />
                            <button type="button" onClick={() => setShowPassword(p => !p)} tabIndex={-1}
                                className="text-slate-400 hover:text-slate-600 transition-colors shrink-0">
                                {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                        </div>
                        {errors?.otds_password && <p className="text-xs text-red-500 mt-1">{errors.otds_password}</p>}
                    </div>
                    {/* Confirm Password */}
                    <div>
                        <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 bg-white focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-[#0A66C2] transition-all">
                            <Key size={13} className="text-slate-400 shrink-0" />
                            <input type={showOtdsConfirm ? 'text' : 'password'} value={form.otds_confirm_pw}
                                onChange={e => handleChange('otds_confirm_pw', e.target.value)}
                                placeholder="Confirm OTDS password"
                                className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" />
                            <button type="button" onClick={() => setShowOtdsConfirm(p => !p)} tabIndex={-1}
                                className="text-slate-400 hover:text-slate-600 transition-colors shrink-0">
                                {showOtdsConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
                            </button>
                        </div>
                        {errors?.otds_confirm_pw && <p className="text-xs text-red-500 mt-1">{errors.otds_confirm_pw}</p>}
                    </div>
                    {/* Partition */}
                    <div>
                        <div className="flex items-center gap-2 border border-slate-200 rounded-lg px-3 py-2 bg-white focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-[#0A66C2] transition-all">
                            <Database size={13} className="text-slate-400 shrink-0" />
                            <input type="text" value={form.otds_partition}
                                onChange={e => handleChange('otds_partition', e.target.value)}
                                placeholder="OTDS Partition name (e.g. DCTMPartitions)"
                                className="flex-1 bg-transparent text-sm outline-none placeholder:text-slate-400" />
                        </div>
                        {errors?.otds_partition && <p className="text-xs text-red-500 mt-1">{errors.otds_partition}</p>}
                    </div>
                    {/* No-reset checkbox */}
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input type="checkbox" checked={form.otds_no_reset}
                            onChange={e => handleChange('otds_no_reset', e.target.checked)}
                            className="w-4 h-4 rounded accent-[#0A66C2] cursor-pointer" />
                        <span className="text-xs text-slate-600">Do not require password change on reset</span>
                    </label>
                </div>
            ) : null}
        </div>
    </div>
);

// ─── Main wizard component ────────────────────────────────────────────────────
const UserCreateTab = ({ onToast }) => {
    const [step, setStep]               = useState(1);
    const [form, setForm]               = useState(EMPTY_FORM);
    const [errors, setErrors]           = useState({});
    const [submitting, setSubmitting]     = useState(false);
    const [showPassword, setShowPassword]   = useState(false);
    const [showOtdsConfirm, setShowOtdsConfirm] = useState(false);
    const [advancedOpen, setAdvancedOpen]   = useState(false);

    const handleChange = (field, value) => {
        setForm(f => ({ ...f, [field]: value }));
        if (errors[field]) setErrors(e => ({ ...e, [field]: undefined }));
    };

    const validatePassword = (pw) => {
        if (!pw) return 'Password is required';
        if (pw.length < 16) return 'Password must be at least 16 characters';
        if (pw.length > 64) return 'Password must not exceed 64 characters';
        if (!/[A-Z]/.test(pw)) return 'Password must contain at least one uppercase letter';
        if (!/[a-z]/.test(pw)) return 'Password must contain at least one lowercase letter';
        if (!/[0-9]/.test(pw)) return 'Password must contain at least one numeric digit';
        if (!/[@|_\-]/.test(pw)) return 'Password must contain at least one special character (@ | _ -)';
        return null;
    };

    const validateStep = (s) => {
        const e = {};
        if (s === 1) {
            if (!form.user_name.trim())       e.user_name       = 'User name is required';
            if (!form.user_login_name.trim()) e.user_login_name = 'Login name is required';
            if (!form.user_address.trim())    e.user_address    = 'User address is required';
        }
        if (s === 2) {
            if (!form.home_docbase) e.home_docbase = 'Home Docbase is required';
            if (form.user_source === 'inline password') {
                const pwErr = validatePassword(form.user_password);
                if (pwErr) e.user_password = pwErr;
            }
            if (form.user_source === 'OTDS') {
                const pwErr = validatePassword(form.otds_password);
                if (pwErr) e.otds_password = pwErr;
                if (!e.otds_password && form.otds_password !== form.otds_confirm_pw)
                    e.otds_confirm_pw = 'Passwords do not match';
                if (!form.otds_partition.trim())
                    e.otds_partition = 'Partition name is required';
            }
        }
        if (s === 3) {
            if (!form.profile_designation.trim())           e.profile_designation           = 'Designation is required';
            if (!form.profile_hindi_designation.trim())     e.profile_hindi_designation     = 'Hindi designation is required';
            if (!form.profile_hindi_user_name.trim())       e.profile_hindi_user_name       = 'Hindi user name is required';
            if (!form.profile_uin.trim())                   e.profile_uin                   = 'UIN is required';
            if (!form.profile_office_type)                  e.profile_office_type           = 'Office type is required';
            if (!form.profile_department_name.trim())       e.profile_department_name       = 'Department name is required';
            if (!form.profile_department_short_code.trim()) e.profile_department_short_code = 'Department short code is required';
            if (!form.profile_user_grade.trim())            e.profile_user_grade            = 'User grade is required';
            if (!form.profile_grade_level || isNaN(Number(form.profile_grade_level)))
                e.profile_grade_level = 'Valid grade level is required';
        }
        return e;
    };

    const goNext = () => {
        const e = validateStep(step);
        if (Object.keys(e).length) { setErrors(e); return; }
        setErrors({});
        setStep(s => s + 1);
    };

    const goBack = () => { setErrors({}); setStep(s => s - 1); };

    const handleReset = () => { setForm(EMPTY_FORM); setErrors({}); setStep(1); setShowPassword(false); setShowOtdsConfirm(false); };

    const handleSubmit = async () => {
        setSubmitting(true);
        // Build a clean payload — only Documentum fields, no OTDS-specific keys
        const loginName = form.user_login_name.trim();
        const payload = {
            user_name:            form.user_name.trim(),
            user_login_name:      loginName,
            user_address:         form.user_address.trim(),
            user_source:          form.user_source,
            user_privileges:      Number(form.user_privileges),
            user_state:           Number(form.user_state),
            description:          form.description,
            user_os_name:         form.user_os_name,
            user_db_name:         form.user_db_name,
            user_global_unique_id:form.user_global_unique_id,
            default_folder:       form.default_folder,
            home_docbase:         form.home_docbase,
            acl_name:             form.acl_name,
            ...(form.user_source === 'inline password' && { user_password: form.user_password }),
        };
        try {
            await api.post('/users', payload);

            if (form.user_source === 'inline password') {
                // Set the password via the existing update-password API after creation
                try {
                    await api.patch(`/users/${loginName}/inline-password`, { password: form.user_password });
                    onToast({ type: 'success', message: `User "${form.user_name}" created successfully.` });
                } catch (pwErr) {
                    const pwMsg = pwErr.response?.data?.message || pwErr.message || 'Password update failed';
                    onToast({ type: 'error', message: `User created but password could not be set: ${pwMsg}` });
                }
            } else if (form.user_source === 'OTDS') {
                try {
                    await api.post('/users/otds/setup', {
                        loginName:             loginName,
                        displayName:           form.user_name.trim(),
                        email:                 form.user_address.trim(),
                        password:              form.otds_password,
                        partition:             form.otds_partition.trim(),
                        requirePasswordChange: !form.otds_no_reset,
                    });
                    onToast({ type: 'success', message: `User "${form.user_name}" created in Documentum and provisioned in OTDS.` });
                } catch (otdsErr) {
                    const otdsMsg = otdsErr.response?.data?.message || otdsErr.message || 'OTDS setup failed';
                    onToast({ type: 'error', message: `User created in Documentum but OTDS setup failed: ${otdsMsg}` });
                }
            } else {
                onToast({ type: 'success', message: `User "${form.user_name}" created successfully.` });
            }

            // Create cms_user_profile object for all user types
            try {
                await api.post('/users/profile', {
                    object_name:              form.user_name.trim(),
                    user_login_name:          loginName,
                    user_email_address:       form.user_address.trim(),
                    designation:              form.profile_designation.trim(),
                    hindi_designation:        form.profile_hindi_designation.trim(),
                    hindi_user_name:          form.profile_hindi_user_name.trim(),
                    uin:                      form.profile_uin.trim(),
                    location:                 form.profile_location.trim(),
                    office_type:              form.profile_office_type,
                    ro_short_code:            form.profile_ro_short_code.trim(),
                    is_active:                form.profile_is_active,
                    user_grade:               form.profile_user_grade.trim(),
                    grade_level:              Number(form.profile_grade_level),
                    department_name:          form.profile_department_name.trim(),
                    department_short_code:    form.profile_department_short_code.trim(),
                });
            } catch (profileErr) {
                const profileMsg = profileErr.response?.data?.message || profileErr.message || 'Profile creation failed';
                onToast({ type: 'error', message: `User created but profile setup failed: ${profileMsg}` });
            }

            handleReset();
        } catch (err) {
            const status = err.response?.status;
            const msg    = err.response?.data?.message || err.message || 'Failed to create user';

            // 409 — login name already exists: surface on the Login Name field at step 1
            if (status === 409 || msg.includes('E_CREATE_USER_EXIST') || msg.toLowerCase().includes('already exists')) {
                setErrors({ user_login_name: 'A user with this login name already exists.' });
                setStep(1);
            } else {
                onToast({ type: 'error', message: msg });
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="overflow-y-auto flex-1 min-h-0 pr-1">
            <div className="flex justify-center pb-6">
                <div className="w-full max-w-2xl">

                    {/* Step indicator */}
                    <StepIndicator step={step} />

                    {/* Card */}
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">

                        {/* ── Step 1: Identity ── */}
                        {step === 1 && (
                            <>
                                <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-slate-50 flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-[#0A66C2] flex items-center justify-center shadow-sm shrink-0">
                                        <User size={17} className="text-white" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900">User Identity</p>
                                        <p className="text-xs text-slate-500">Core identifiers for the dm_user object</p>
                                    </div>
                                </div>
                                <div className="p-6 space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <FormField label="User Name" icon={User} required error={errors.user_name}>
                                            <input autoFocus type="text" value={form.user_name}
                                                onChange={e => handleChange('user_name', e.target.value)}
                                                placeholder="e.g. John Doe"
                                                className={inputCls(errors.user_name)} />
                                        </FormField>
                                        <FormField label="Login Name" icon={Key} required error={errors.user_login_name}
                                            hint="Used to authenticate into Documentum">
                                            <input type="text" value={form.user_login_name}
                                                onChange={e => handleChange('user_login_name', e.target.value)}
                                                placeholder="e.g. john.doe"
                                                className={`${inputCls(errors.user_login_name)} font-mono`} />
                                        </FormField>
                                    </div>
                                    <FormField label="Description" icon={Info}>
                                        <input type="text" value={form.description}
                                            onChange={e => handleChange('description', e.target.value)}
                                            placeholder="e.g. NABARD staff member — HO Dept"
                                            className={inputCls(false)} />
                                    </FormField>
                                    <FormField label="User Address" icon={Mail} required error={errors.user_address} hint="Email address or contact">
                                        <input type="text" value={form.user_address}
                                            onChange={e => handleChange('user_address', e.target.value)}
                                            placeholder="e.g. john.doe@nabard.org"
                                            className={inputCls(errors.user_address)} />
                                    </FormField>
                                </div>
                            </>
                        )}

                        {/* ── Step 2: Authentication & Repository ── */}
                        {step === 2 && (
                            <>
                                <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-violet-50 to-slate-50 flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-violet-600 flex items-center justify-center shadow-sm shrink-0">
                                        <Shield size={17} className="text-white" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900">Authentication & Repository</p>
                                        <p className="text-xs text-slate-500">Source, credentials, and repository settings</p>
                                    </div>
                                </div>
                                <div className="p-6 space-y-4">
                                    <SourcePasswordBlock form={form} handleChange={handleChange}
                                        showPassword={showPassword} setShowPassword={setShowPassword}
                                        showOtdsConfirm={showOtdsConfirm} setShowOtdsConfirm={setShowOtdsConfirm}
                                        errors={errors} />
                                    {/* Advanced optional fields accordion */}
                                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                                        <button type="button"
                                            onClick={() => setAdvancedOpen(o => !o)}
                                            className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors text-left">
                                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Advanced (optional)</span>
                                            <ChevronDown size={15} className={`text-slate-400 transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
                                        </button>
                                        {advancedOpen && (
                                            <div className="p-4 space-y-4 border-t border-slate-200">
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                    <FormField label="OS Username" icon={Database} hint="Operating system login name">
                                                        <input type="text" value={form.user_os_name}
                                                            onChange={e => handleChange('user_os_name', e.target.value)}
                                                            placeholder={`e.g. NABARD\\john.doe`}
                                                            className={`${inputCls(false)} font-mono`} />
                                                    </FormField>
                                                    <FormField label="DB Username" icon={Database} hint="Database-level login name">
                                                        <input type="text" value={form.user_db_name}
                                                            onChange={e => handleChange('user_db_name', e.target.value)}
                                                            placeholder="e.g. john_doe_db"
                                                            className={`${inputCls(false)} font-mono`} />
                                                    </FormField>
                                                </div>
                                                <FormField label="Global Unique ID" icon={Tag} hint="Cross-system unique identifier (GUID)">
                                                    <input type="text" value={form.user_global_unique_id}
                                                        onChange={e => handleChange('user_global_unique_id', e.target.value)}
                                                        placeholder="e.g. 550e8400-e29b-41d4-a716-446655440000"
                                                        className={`${inputCls(false)} font-mono`} />
                                                </FormField>
                                            </div>
                                        )}
                                    </div>

                                    {/* ── Repository settings ── */}
                                    <div className="border-t border-slate-100 pt-4 space-y-4">
                                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Repository & Permissions</p>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <FormField label="Home Docbase" icon={Globe} required error={errors.home_docbase}>
                                                <SelectField value={form.home_docbase}
                                                    onChange={v => handleChange('home_docbase', v)}
                                                    options={[
                                                        { value: '',         label: '— Select docbase —' },
                                                        { value: 'EDMS',     label: 'EDMS' },
                                                        { value: 'NABARDUAT',label: 'NABARDUAT' },
                                                    ]} />
                                                {errors.home_docbase && <p className="text-xs text-red-500 mt-1">{errors.home_docbase}</p>}
                                            </FormField>
                                            <FormField label="User Privileges" icon={Shield}
                                                hint={PRIVILEGE_OPTIONS.find(p => p.value === Number(form.user_privileges))?.description}>
                                                <SelectField value={form.user_privileges}
                                                    onChange={v => handleChange('user_privileges', v)}
                                                    options={PRIVILEGE_OPTIONS.map(p => ({ value: p.value, label: `${p.label} (${p.value})` }))} />
                                            </FormField>
                                        </div>
                                        <FormField label="User State" icon={User}
                                            hint={Number(form.user_state) === 0 ? 'User can log in to the repository' : 'User login is disabled'}>
                                            <SelectField value={form.user_state}
                                                onChange={v => handleChange('user_state', v)}
                                                options={STATE_OPTIONS} />
                                        </FormField>
                                    </div>

                                    {/* Summary card */}
                                    <div className="mt-2 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">Review dm_user Creation:</p>
                                        <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                                            {[
                                                ['User Name',   form.user_name],
                                                ['Login Name',  form.user_login_name],
                                                ['Source',      SOURCE_OPTIONS.find(s => s.value === form.user_source)?.label || 'Local'],
                                                ['Privileges',  PRIVILEGE_OPTIONS.find(p => p.value === Number(form.user_privileges))?.label],
                                                ['State',       Number(form.user_state) === 0 ? 'Active' : 'Inactive'],
                                                ['Address',     form.user_address || '—'],
                                            ].map(([k, v]) => (
                                                <div key={k} className="flex items-baseline gap-1.5 min-w-0">
                                                    <span className="text-slate-400 text-xs shrink-0">{k}:</span>
                                                    <span className="text-slate-700 font-medium truncate text-xs">{v || '—'}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* ── Step 3: User Profile ── */}
                        {step === 3 && (
                            <>
                                <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-amber-50 to-slate-50 flex items-center gap-3">
                                    <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center shadow-sm shrink-0">
                                        <Briefcase size={17} className="text-white" />
                                    </div>
                                    <div>
                                        <p className="text-sm font-semibold text-slate-900">User Profile</p>
                                        <p className="text-xs text-slate-500">Role, department and organisational details</p>
                                    </div>
                                </div>
                                <div className="p-6 space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <FormField label="Designation" icon={Briefcase} required error={errors.profile_designation}>
                                            <input type="text" value={form.profile_designation}
                                                onChange={e => handleChange('profile_designation', e.target.value)}
                                                placeholder="e.g. DGM"
                                                className={inputCls(errors.profile_designation)} />
                                        </FormField>
                                        <FormField label="Hindi Designation" icon={Briefcase} required error={errors.profile_hindi_designation}>
                                            <input type="text" value={form.profile_hindi_designation}
                                                onChange={e => handleChange('profile_hindi_designation', e.target.value)}
                                                placeholder="e.g. महाप्रबंधक"
                                                className={inputCls(errors.profile_hindi_designation)} />
                                        </FormField>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <FormField label="Hindi User Name" icon={User} required error={errors.profile_hindi_user_name}>
                                            <input type="text" value={form.profile_hindi_user_name}
                                                onChange={e => handleChange('profile_hindi_user_name', e.target.value)}
                                                placeholder="e.g. राहुल शर्मा"
                                                className={inputCls(errors.profile_hindi_user_name)} />
                                        </FormField>
                                        <FormField label="UIN" icon={Hash} required error={errors.profile_uin}>
                                            <input type="text" value={form.profile_uin}
                                                onChange={e => handleChange('profile_uin', e.target.value)}
                                                placeholder="e.g. 3405"
                                                className={`${inputCls(errors.profile_uin)} font-mono`} />
                                        </FormField>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <FormField label="Office Type" icon={Building2} required error={errors.profile_office_type}>
                                            <SelectField value={form.profile_office_type}
                                                onChange={v => handleChange('profile_office_type', v)}
                                                options={[
                                                    { value: '',   label: '— Select office type —' },
                                                    { value: 'HO', label: 'HO — Head Office' },
                                                    { value: 'RO', label: 'RO — Regional Office' },
                                                    { value: 'TE', label: 'TE — Training Establishment' },
                                                ]} />
                                            {errors.profile_office_type && <p className="text-xs text-red-500 mt-1">{errors.profile_office_type}</p>}
                                        </FormField>
                                        <FormField label="RO Short Code" icon={Tag} hint="Leave blank for HO users">
                                            <input type="text" value={form.profile_ro_short_code}
                                                onChange={e => handleChange('profile_ro_short_code', e.target.value)}
                                                placeholder="e.g. MUM"
                                                className={`${inputCls(false)} font-mono`} />
                                        </FormField>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <FormField label="Department Name" icon={Layers} required error={errors.profile_department_name}>
                                            <input type="text" value={form.profile_department_name}
                                                onChange={e => handleChange('profile_department_name', e.target.value)}
                                                placeholder="e.g. DDSI"
                                                className={inputCls(errors.profile_department_name)} />
                                        </FormField>
                                        <FormField label="Department Short Code" icon={Tag} required error={errors.profile_department_short_code}>
                                            <input type="text" value={form.profile_department_short_code}
                                                onChange={e => handleChange('profile_department_short_code', e.target.value)}
                                                placeholder="e.g. ddsi"
                                                className={`${inputCls(errors.profile_department_short_code)} font-mono`} />
                                        </FormField>
                                    </div>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <FormField label="User Grade" icon={GraduationCap} required error={errors.profile_user_grade}>
                                            <input type="text" value={form.profile_user_grade}
                                                onChange={e => handleChange('profile_user_grade', e.target.value)}
                                                placeholder="e.g. grade_d"
                                                className={inputCls(errors.profile_user_grade)} />
                                        </FormField>
                                        <FormField label="Grade Level" icon={Hash} required error={errors.profile_grade_level}>
                                            <input type="number" min="1" value={form.profile_grade_level}
                                                onChange={e => handleChange('profile_grade_level', e.target.value)}
                                                placeholder="e.g. 4"
                                                className={inputCls(errors.profile_grade_level)} />
                                        </FormField>
                                    </div>
                                    <FormField label="Location" icon={MapPin} hint="City or office location">
                                        <input type="text" value={form.profile_location}
                                            onChange={e => handleChange('profile_location', e.target.value)}
                                            placeholder="e.g. Mumbai"
                                            className={inputCls(false)} />
                                    </FormField>
                                    <label className="flex items-center gap-2 cursor-pointer select-none pt-1">
                                        <input type="checkbox" checked={form.profile_is_active}
                                            onChange={e => handleChange('profile_is_active', e.target.checked)}
                                            className="w-4 h-4 rounded accent-[#0A66C2] cursor-pointer" />
                                        <span className="text-sm text-slate-700 font-medium">Active user</span>
                                        <span className="text-xs text-slate-400">(sets is_active = true on profile)</span>
                                    </label>
                                </div>
                            </>
                        )}

                        {/* Footer nav */}
                        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <button type="button" onClick={handleReset}
                                    className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg hover:bg-white transition-all">
                                    Reset
                                </button>
                                {step > 1 && (
                                    <button type="button" onClick={goBack}
                                        className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-slate-600 border border-slate-200 rounded-xl hover:bg-white hover:border-slate-300 hover:shadow-sm transition-all">
                                        <ChevronLeft size={15} /> Back
                                    </button>
                                )}
                            </div>

                            <div className="flex items-center gap-2">
                                {/* Step dots */}
                                <div className="flex gap-1 mr-2">
                                    {STEPS.map(s => (
                                        <div key={s.num} className={`w-1.5 h-1.5 rounded-full transition-all ${step === s.num ? 'bg-[#0A66C2] w-4' : step > s.num ? 'bg-[#0A66C2] opacity-40' : 'bg-slate-200'}`} />
                                    ))}
                                </div>
                                {step < 3 ? (
                                    <button type="button" onClick={goNext}
                                        className="flex items-center gap-1.5 px-5 py-2 bg-[#0A66C2] hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-all">
                                        Next <ChevronRight size={15} />
                                    </button>
                                ) : (
                                    <button type="button" onClick={handleSubmit} disabled={submitting || !form.profile_designation.trim() || !form.profile_hindi_designation.trim() || !form.profile_hindi_user_name.trim() || !form.profile_uin.trim() || !form.profile_office_type || !form.profile_department_name.trim() || !form.profile_department_short_code.trim() || !form.profile_user_grade.trim() || !form.profile_grade_level || isNaN(Number(form.profile_grade_level))}
                                        className="flex items-center gap-2 px-6 py-2 bg-[#0A66C2] hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold rounded-xl shadow-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed">
                                        {submitting
                                            ? <><Loader2 size={15} className="animate-spin" /> Creating...</>
                                            : <><UserPlus size={15} /> Create User</>
                                        }
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── Update Password Tab ──────────────────────────────────────────────────────
const UpdatePasswordTab = ({ onToast }) => {
    const [searchQuery, setSearchQuery]         = useState('');
    const [allUsers, setAllUsers]               = useState([]);
    const [loadingUsers, setLoadingUsers]       = useState(false);
    const [showDropdown, setShowDropdown]       = useState(false);
    const [selectedUser, setSelectedUser]       = useState(null);
    const [newPassword, setNewPassword]         = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showNew, setShowNew]                 = useState(false);
    const [showConfirm, setShowConfirm]         = useState(false);
    const [submitting, setSubmitting]           = useState(false);
    const [errors, setErrors]                   = useState({});

    // Fetch OTDS users once
    useEffect(() => {
        setLoadingUsers(true);
        fetchAllUsers()
            .then(users => setAllUsers(users))
            .catch(() => setAllUsers([]))
            .finally(() => setLoadingUsers(false));
    }, []);

    const otdsUsers = useMemo(() =>
        allUsers.filter(u => u.user_login_name),
    [allUsers]);

    const filtered = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        if (!q) return otdsUsers.slice(0, 8);
        return otdsUsers.filter(u =>
            (u.object_name?.toLowerCase() || '').includes(q) ||
            (u.user_login_name?.toLowerCase() || '').includes(q)
        ).slice(0, 8);
    }, [otdsUsers, searchQuery]);

    const selectUser = (user) => {
        setSelectedUser(user);
        setSearchQuery(user.object_name || user.user_login_name);
        setShowDropdown(false);
        setErrors({});
    };

    const clearUser = () => {
        setSelectedUser(null);
        setSearchQuery('');
        setNewPassword('');
        setConfirmPassword('');
        setErrors({});
    };

    const validate = () => {
        const e = {};
        if (!selectedUser)             e.user = 'Please select a user';
        if (!newPassword)              e.newPassword = 'New password is required';
        else if (newPassword.length < 8) e.newPassword = 'Password must be at least 8 characters';
        if (!confirmPassword)          e.confirmPassword = 'Please confirm the password';
        else if (newPassword !== confirmPassword) e.confirmPassword = 'Passwords do not match';
        return e;
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const errs = validate();
        if (Object.keys(errs).length) { setErrors(errs); return; }
        setSubmitting(true);
        try {
            await api.patch(`/users/${encodeURIComponent(selectedUser.user_login_name)}/password`, {
                password: newPassword,
            });
            onToast({ type: 'success', message: `Password updated for "${selectedUser.object_name || selectedUser.user_login_name}".` });
            clearUser();
        } catch (err) {
            const msg = err.response?.data?.message || err.message || 'Failed to update password';
            onToast({ type: 'error', message: msg });
        } finally {
            setSubmitting(false);
        }
    };

    const pwStrength = (pw) => {
        if (!pw) return null;
        let score = 0;
        if (pw.length >= 8)  score++;
        if (pw.length >= 12) score++;
        if (/[A-Z]/.test(pw)) score++;
        if (/[0-9]/.test(pw)) score++;
        if (/[^A-Za-z0-9]/.test(pw)) score++;
        if (score <= 1) return { label: 'Weak',   color: 'bg-red-400',    text: 'text-red-500',    bars: 1 };
        if (score <= 2) return { label: 'Fair',   color: 'bg-amber-400',  text: 'text-amber-500',  bars: 2 };
        if (score <= 3) return { label: 'Good',   color: 'bg-yellow-400', text: 'text-yellow-600', bars: 3 };
        if (score <= 4) return { label: 'Strong', color: 'bg-emerald-400',text: 'text-emerald-600',bars: 4 };
        return { label: 'Very Strong', color: 'bg-emerald-500', text: 'text-emerald-700', bars: 5 };
    };

    const strength = pwStrength(newPassword);

    return (
        <div className="overflow-y-auto flex-1 min-h-0 pr-1">
            <div className="flex justify-center pb-6">
                <div className="w-full max-w-lg">
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">

                        {/* Header */}
                        <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-amber-50 to-slate-50 flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center shadow-sm shrink-0">
                                <KeyRound size={17} className="text-white" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-slate-900">Update User Password</p>
                                <p className="text-xs text-slate-500">Change the Documentum password for a user account</p>
                            </div>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-5">

                            {/* User search */}
                            <div className="relative">
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                    <span className="flex items-center gap-1.5">
                                        <User size={14} className="text-slate-400" />
                                        Select User
                                        <span className="text-red-400">*</span>
                                    </span>
                                </label>
                                <div className={`flex items-center border rounded-xl overflow-hidden transition-all ${errors.user ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white hover:border-slate-300'} focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-[#0A66C2]`}>
                                    <Search size={15} className="ml-3 text-slate-400 shrink-0" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={e => { setSearchQuery(e.target.value); setShowDropdown(true); if (selectedUser) setSelectedUser(null); }}
                                        onFocus={() => setShowDropdown(true)}
                                        onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                                        placeholder={loadingUsers ? 'Loading users...' : 'Search by name or login name…'}
                                        className="flex-1 px-3 py-2.5 text-sm bg-transparent focus:outline-none placeholder:text-slate-400"
                                    />
                                    {selectedUser && (
                                        <button type="button" onClick={clearUser} className="mr-2 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-100">
                                            <X size={14} />
                                        </button>
                                    )}
                                </div>
                                {errors.user && (
                                    <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={12} />{errors.user}</p>
                                )}

                                {/* Dropdown */}
                                {showDropdown && !selectedUser && (
                                    <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
                                        {filtered.length === 0 ? (
                                            <div className="px-4 py-3 text-sm text-slate-400 text-center">No users found</div>
                                        ) : filtered.map((u, i) => (
                                            <button
                                                key={u.r_object_id || i}
                                                type="button"
                                                onMouseDown={() => selectUser(u)}
                                                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 text-left transition-colors border-b border-slate-50 last:border-0"
                                            >
                                                <div className="w-7 h-7 rounded-full bg-[#0A66C2]/10 flex items-center justify-center shrink-0">
                                                    <User size={13} className="text-[#0A66C2]" />
                                                </div>
                                                <div className="min-w-0">
                                                    <p className="text-sm font-medium text-slate-800 truncate">{u.object_name || u.user_login_name}</p>
                                                    <p className="text-xs text-slate-500 font-mono truncate">{u.user_login_name}</p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Selected user card */}
                            {selectedUser && (
                                <div className="flex items-center gap-3 p-3 bg-blue-50 border border-blue-100 rounded-xl">
                                    <div className="w-9 h-9 rounded-full bg-[#0A66C2] flex items-center justify-center shrink-0 text-white font-bold text-sm">
                                        {(selectedUser.object_name || selectedUser.user_login_name || '?')[0].toUpperCase()}
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-slate-800">{selectedUser.object_name}</p>
                                        <p className="text-xs text-slate-500 font-mono">{selectedUser.user_login_name}</p>
                                        {selectedUser.department_name && (
                                            <p className="text-xs text-slate-400">{selectedUser.department_name}</p>
                                        )}
                                    </div>
                                    <CheckCircle2 size={16} className="ml-auto text-[#0A66C2] shrink-0" />
                                </div>
                            )}

                            {/* Divider */}
                            <div className="border-t border-slate-100" />

                            {/* New password */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                    <span className="flex items-center gap-1.5">
                                        <Lock size={14} className="text-slate-400" />
                                        New Password
                                        <span className="text-red-400">*</span>
                                    </span>
                                </label>
                                <div className={`flex items-center border rounded-xl overflow-hidden transition-all ${errors.newPassword ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white hover:border-slate-300'} focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-[#0A66C2]`}>
                                    <input
                                        type={showNew ? 'text' : 'password'}
                                        value={newPassword}
                                        onChange={e => { setNewPassword(e.target.value); if (errors.newPassword) setErrors(v => ({ ...v, newPassword: undefined })); }}
                                        placeholder="Enter new password"
                                        className="flex-1 px-4 py-2.5 text-sm bg-transparent focus:outline-none placeholder:text-slate-400"
                                    />
                                    <button type="button" onClick={() => setShowNew(p => !p)}
                                        className="mr-3 text-slate-400 hover:text-slate-600 transition-colors" tabIndex={-1}>
                                        {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                                    </button>
                                </div>
                                {errors.newPassword && (
                                    <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={12} />{errors.newPassword}</p>
                                )}

                                {/* Strength meter */}
                                {newPassword && strength && (
                                    <div className="mt-2">
                                        <div className="flex gap-1 mb-1">
                                            {[1,2,3,4,5].map(n => (
                                                <div key={n} className={`h-1 flex-1 rounded-full transition-all ${n <= strength.bars ? strength.color : 'bg-slate-100'}`} />
                                            ))}
                                        </div>
                                        <p className={`text-xs font-medium ${strength.text}`}>{strength.label}</p>
                                    </div>
                                )}
                            </div>

                            {/* Confirm password */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                    <span className="flex items-center gap-1.5">
                                        <Lock size={14} className="text-slate-400" />
                                        Confirm Password
                                        <span className="text-red-400">*</span>
                                    </span>
                                </label>
                                <div className={`flex items-center border rounded-xl overflow-hidden transition-all ${errors.confirmPassword ? 'border-red-300 bg-red-50' : confirmPassword && confirmPassword === newPassword ? 'border-emerald-300 bg-emerald-50/30' : 'border-slate-200 bg-white hover:border-slate-300'} focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-[#0A66C2]`}>
                                    <input
                                        type={showConfirm ? 'text' : 'password'}
                                        value={confirmPassword}
                                        onChange={e => { setConfirmPassword(e.target.value); if (errors.confirmPassword) setErrors(v => ({ ...v, confirmPassword: undefined })); }}
                                        placeholder="Re-enter the password"
                                        className="flex-1 px-4 py-2.5 text-sm bg-transparent focus:outline-none placeholder:text-slate-400"
                                    />
                                    {confirmPassword && confirmPassword === newPassword ? (
                                        <CheckCircle2 size={15} className="mr-3 text-emerald-500 shrink-0" />
                                    ) : (
                                        <button type="button" onClick={() => setShowConfirm(p => !p)}
                                            className="mr-3 text-slate-400 hover:text-slate-600 transition-colors" tabIndex={-1}>
                                            {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                                        </button>
                                    )}
                                </div>
                                {errors.confirmPassword && (
                                    <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={12} />{errors.confirmPassword}</p>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center justify-end gap-3 pt-1">
                                <button type="button" onClick={clearUser}
                                    className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all">
                                    Clear
                                </button>
                                <button type="submit" disabled={submitting}
                                    className="flex items-center gap-2 px-6 py-2 bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed">
                                    {submitting
                                        ? <><Loader2 size={15} className="animate-spin" /> Updating…</>
                                        : <><KeyRound size={15} /> Update Password</>
                                    }
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── Bulk Password Update Tab ─────────────────────────────────────────────────
const BulkPasswordTab = ({ onToast }) => {
    const [searchQuery, setSearchQuery]         = useState('');
    const [allUsers, setAllUsers]               = useState([]);
    const [loadingUsers, setLoadingUsers]       = useState(false);
    const [showDropdown, setShowDropdown]       = useState(false);
    const [selectedUsers, setSelectedUsers]     = useState([]);
    const [newPassword, setNewPassword]         = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showNew, setShowNew]                 = useState(false);
    const [showConfirm, setShowConfirm]         = useState(false);
    const [errors, setErrors]                   = useState({});
    const [updating, setUpdating]               = useState(false);
    const [results, setResults]                 = useState([]);
    const dropdownRef                           = useRef(null);

    useEffect(() => {
        setLoadingUsers(true);
        fetchAllUsers()
            .then(users => setAllUsers(users))
            .catch(() => setAllUsers([]))
            .finally(() => setLoadingUsers(false));
    }, []);

    // Close dropdown on outside click
    useEffect(() => {
        if (!showDropdown) return;
        const handler = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setShowDropdown(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [showDropdown]);

    const otdsUsers = useMemo(() => allUsers.filter(u => u.user_login_name), [allUsers]);

    const selectedIdSet = useMemo(() => new Set(selectedUsers.map(u => u.r_object_id)), [selectedUsers]);

    // ALL matching users — no limit (used by Add All checkbox)
    const filteredAll = useMemo(() => {
        const q = searchQuery.toLowerCase().trim();
        if (!q) return otdsUsers;
        return otdsUsers.filter(u =>
            (u.object_name?.toLowerCase() || '').includes(q) ||
            (u.user_login_name?.toLowerCase() || '').includes(q)
        );
    }, [otdsUsers, searchQuery]);

    // Unselected users for display in dropdown list (capped at 100 for performance)
    const filtered = useMemo(() =>
        filteredAll.filter(u => !selectedIdSet.has(u.r_object_id)).slice(0, 100),
    [filteredAll, selectedIdSet]);

    const allChecked = filteredAll.length > 0 && filteredAll.every(u => selectedIdSet.has(u.r_object_id));
    const someChecked = !allChecked && filteredAll.some(u => selectedIdSet.has(u.r_object_id));

    const toggleAddAll = (checked) => {
        if (checked) {
            const toAdd = filteredAll.filter(u => !selectedIdSet.has(u.r_object_id));
            setSelectedUsers(prev => [...prev, ...toAdd]);
        } else {
            const ids = new Set(filteredAll.map(u => u.r_object_id));
            setSelectedUsers(prev => prev.filter(u => !ids.has(u.r_object_id)));
        }
        if (errors.users) setErrors(v => ({ ...v, users: undefined }));
    };

    const addUser = (user) => {
        setSelectedUsers(prev => [...prev, user]);
        // Keep dropdown open; clear search so next query is easy
        setSearchQuery('');
        if (errors.users) setErrors(v => ({ ...v, users: undefined }));
    };

    const removeUser = (userId) => setSelectedUsers(prev => prev.filter(u => u.r_object_id !== userId));

    const validate = () => {
        const e = {};
        if (selectedUsers.length === 0) e.users = 'Please select at least one user';
        if (!newPassword)               e.newPassword = 'New password is required';
        else if (newPassword.length < 8) e.newPassword = 'Password must be at least 8 characters';
        if (!confirmPassword)           e.confirmPassword = 'Please confirm the password';
        else if (newPassword !== confirmPassword) e.confirmPassword = 'Passwords do not match';
        return e;
    };

    const handleUpdateAll = async () => {
        const errs = validate();
        if (Object.keys(errs).length) { setErrors(errs); return; }
        setUpdating(true);
        setResults(selectedUsers.map(u => ({ user: u, status: 'pending', message: '' })));
        let successCount = 0;
        for (let i = 0; i < selectedUsers.length; i++) {
            const user = selectedUsers[i];
            setResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'processing' } : r));
            try {
                await api.patch(`/users/${encodeURIComponent(user.user_login_name)}/password`, { password: newPassword });
                setResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'success' } : r));
                successCount++;
            } catch (err) {
                const msg = err.response?.data?.message || err.message || 'Failed';
                setResults(prev => prev.map((r, idx) => idx === i ? { ...r, status: 'error', message: msg } : r));
            }
        }
        setUpdating(false);
        const failCount = selectedUsers.length - successCount;
        if (failCount === 0) {
            onToast({ type: 'success', message: `Passwords updated for ${successCount} user${successCount > 1 ? 's' : ''}.` });
        } else {
            onToast({ type: 'error', message: `${successCount} succeeded, ${failCount} failed. See details below.` });
        }
    };

    const pwStrength = (pw) => {
        if (!pw) return null;
        let score = 0;
        if (pw.length >= 8)  score++;
        if (pw.length >= 12) score++;
        if (/[A-Z]/.test(pw)) score++;
        if (/[0-9]/.test(pw)) score++;
        if (/[^A-Za-z0-9]/.test(pw)) score++;
        if (score <= 1) return { label: 'Weak',        color: 'bg-red-400',     text: 'text-red-500',     bars: 1 };
        if (score <= 2) return { label: 'Fair',        color: 'bg-amber-400',   text: 'text-amber-500',   bars: 2 };
        if (score <= 3) return { label: 'Good',        color: 'bg-yellow-400',  text: 'text-yellow-600',  bars: 3 };
        if (score <= 4) return { label: 'Strong',      color: 'bg-emerald-400', text: 'text-emerald-600', bars: 4 };
        return             { label: 'Very Strong', color: 'bg-emerald-500', text: 'text-emerald-700', bars: 5 };
    };
    const strength = pwStrength(newPassword);

    const clearAll = () => {
        setSelectedUsers([]);
        setNewPassword('');
        setConfirmPassword('');
        setErrors({});
        setResults([]);
        setSearchQuery('');
    };

    const doneCount    = results.filter(r => r.status === 'success' || r.status === 'error').length;
    const successCount = results.filter(r => r.status === 'success').length;

    return (
        <div className="overflow-y-auto flex-1 min-h-0 pr-1">
            <div className="flex justify-center pb-6">
                <div className="w-full max-w-2xl space-y-4">

                    {/* Main card */}
                    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">

                        {/* Header */}
                        <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-violet-50 to-slate-50 flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-violet-500 flex items-center justify-center shadow-sm shrink-0">
                                <UserCog size={17} className="text-white" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-slate-900">Bulk Password Update</p>
                                <p className="text-xs text-slate-500">Update password for multiple users at once</p>
                            </div>
                        </div>

                        <div className="p-6 space-y-5">

                            {/* User search */}
                            <div className="relative" ref={dropdownRef}>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                    <span className="flex items-center gap-1.5">
                                        <Users size={14} className="text-slate-400" />
                                        Add Users
                                        <span className="text-red-400">*</span>
                                    </span>
                                </label>
                                <div className={`flex items-center border rounded-xl overflow-hidden transition-all ${errors.users ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white hover:border-slate-300'} focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-[#0A66C2]`}>
                                    <Search size={15} className="ml-3 text-slate-400 shrink-0" />
                                    <input
                                        type="text"
                                        value={searchQuery}
                                        onChange={e => { setSearchQuery(e.target.value); setShowDropdown(true); }}
                                        onFocus={() => setShowDropdown(true)}
                                        placeholder={loadingUsers ? 'Loading users...' : 'Search and add users…'}
                                        className="flex-1 px-3 py-2.5 text-sm bg-transparent focus:outline-none placeholder:text-slate-400"
                                    />
                                    {selectedUsers.length > 0 && (
                                        <span className="mr-3 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full shrink-0">
                                            {selectedUsers.length} added
                                        </span>
                                    )}
                                </div>
                                {errors.users && (
                                    <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={12} />{errors.users}</p>
                                )}

                                {/* Dropdown */}
                                {showDropdown && (
                                    <div className="absolute z-20 left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden flex flex-col max-h-80">

                                        {/* Add All checkbox header */}
                                        <label className="flex items-center gap-3 px-4 py-2.5 bg-slate-50 border-b border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors shrink-0">
                                            <input
                                                type="checkbox"
                                                checked={allChecked}
                                                ref={el => { if (el) el.indeterminate = someChecked; }}
                                                onChange={e => toggleAddAll(e.target.checked)}
                                                className="w-4 h-4 rounded accent-[#0A66C2] cursor-pointer"
                                            />
                                            <span className="text-xs font-semibold text-slate-700">
                                                Add All
                                                <span className="ml-1.5 text-slate-400 font-normal">
                                                    ({filteredAll.length} {searchQuery ? 'matching' : 'users'})
                                                </span>
                                            </span>
                                        </label>

                                        {/* User list */}
                                        <div className="overflow-y-auto flex-1">
                                            {filtered.length === 0 ? (
                                                <div className="px-4 py-3 text-sm text-slate-400 text-center">
                                                    {allChecked ? 'All matching users added' : searchQuery ? 'No matching users' : 'All users already added'}
                                                </div>
                                            ) : filtered.map((u, i) => (
                                                <button
                                                    key={u.r_object_id || i}
                                                    type="button"
                                                    onClick={() => addUser(u)}
                                                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-blue-50 text-left transition-colors border-b border-slate-50 last:border-0"
                                                >
                                                    <div className="w-7 h-7 rounded-full bg-[#0A66C2]/10 flex items-center justify-center shrink-0">
                                                        <User size={13} className="text-[#0A66C2]" />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-sm font-medium text-slate-800 truncate">{u.object_name || u.user_login_name}</p>
                                                        <p className="text-xs text-slate-500 font-mono truncate">{u.user_login_name}</p>
                                                    </div>
                                                    <span className="text-xs text-[#0A66C2] font-semibold shrink-0">+ Add</span>
                                                </button>
                                            ))}
                                        </div>

                                        {/* Done button footer */}
                                        <div className="px-4 py-2.5 border-t border-slate-100 bg-slate-50 flex items-center justify-between shrink-0">
                                            <span className="text-xs text-slate-500">
                                                {selectedUsers.length} user{selectedUsers.length !== 1 ? 's' : ''} selected
                                            </span>
                                            <button
                                                type="button"
                                                onClick={() => setShowDropdown(false)}
                                                className="px-4 py-1.5 bg-[#0A66C2] hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors">
                                                Done
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Selected users chips */}
                            {selectedUsers.length > 0 && (
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <p className="text-xs font-medium text-slate-600">
                                            {selectedUsers.length} user{selectedUsers.length > 1 ? 's' : ''} selected
                                        </p>
                                        <button type="button" onClick={() => setSelectedUsers([])}
                                            className="text-xs text-slate-400 hover:text-red-500 transition-colors">
                                            Remove all
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {selectedUsers.map(u => (
                                            <div key={u.r_object_id}
                                                className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-50 border border-blue-100 rounded-lg text-xs font-medium text-blue-700">
                                                <span>{u.object_name || u.user_login_name}</span>
                                                <button type="button" onClick={() => removeUser(u.r_object_id)}
                                                    className="text-blue-400 hover:text-red-500 transition-colors">
                                                    <X size={12} />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="border-t border-slate-100" />

                            {/* New password */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                    <span className="flex items-center gap-1.5">
                                        <Lock size={14} className="text-slate-400" />
                                        New Password
                                        <span className="text-red-400">*</span>
                                    </span>
                                </label>
                                <div className={`flex items-center border rounded-xl overflow-hidden transition-all ${errors.newPassword ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white hover:border-slate-300'} focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-[#0A66C2]`}>
                                    <input
                                        type={showNew ? 'text' : 'password'}
                                        value={newPassword}
                                        onChange={e => { setNewPassword(e.target.value); if (errors.newPassword) setErrors(v => ({ ...v, newPassword: undefined })); }}
                                        placeholder="Enter new password"
                                        className="flex-1 px-4 py-2.5 text-sm bg-transparent focus:outline-none placeholder:text-slate-400"
                                    />
                                    <button type="button" onClick={() => setShowNew(p => !p)}
                                        className="mr-3 text-slate-400 hover:text-slate-600 transition-colors" tabIndex={-1}>
                                        {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                                    </button>
                                </div>
                                {errors.newPassword && (
                                    <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={12} />{errors.newPassword}</p>
                                )}
                                {newPassword && strength && (
                                    <div className="mt-2">
                                        <div className="flex gap-1 mb-1">
                                            {[1,2,3,4,5].map(n => (
                                                <div key={n} className={`h-1 flex-1 rounded-full transition-all ${n <= strength.bars ? strength.color : 'bg-slate-100'}`} />
                                            ))}
                                        </div>
                                        <p className={`text-xs font-medium ${strength.text}`}>{strength.label}</p>
                                    </div>
                                )}
                            </div>

                            {/* Confirm password */}
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                                    <span className="flex items-center gap-1.5">
                                        <Lock size={14} className="text-slate-400" />
                                        Confirm Password
                                        <span className="text-red-400">*</span>
                                    </span>
                                </label>
                                <div className={`flex items-center border rounded-xl overflow-hidden transition-all ${errors.confirmPassword ? 'border-red-300 bg-red-50' : confirmPassword && confirmPassword === newPassword ? 'border-emerald-300 bg-emerald-50/30' : 'border-slate-200 bg-white hover:border-slate-300'} focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-[#0A66C2]`}>
                                    <input
                                        type={showConfirm ? 'text' : 'password'}
                                        value={confirmPassword}
                                        onChange={e => { setConfirmPassword(e.target.value); if (errors.confirmPassword) setErrors(v => ({ ...v, confirmPassword: undefined })); }}
                                        placeholder="Re-enter the password"
                                        className="flex-1 px-4 py-2.5 text-sm bg-transparent focus:outline-none placeholder:text-slate-400"
                                    />
                                    {confirmPassword && confirmPassword === newPassword ? (
                                        <CheckCircle2 size={15} className="mr-3 text-emerald-500 shrink-0" />
                                    ) : (
                                        <button type="button" onClick={() => setShowConfirm(p => !p)}
                                            className="mr-3 text-slate-400 hover:text-slate-600 transition-colors" tabIndex={-1}>
                                            {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                                        </button>
                                    )}
                                </div>
                                {errors.confirmPassword && (
                                    <p className="mt-1.5 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={12} />{errors.confirmPassword}</p>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="flex items-center justify-between pt-1">
                                <p className="text-xs text-slate-400">
                                    {selectedUsers.length > 0 ? `Will update ${selectedUsers.length} user${selectedUsers.length > 1 ? 's' : ''}` : 'No users selected'}
                                </p>
                                <div className="flex gap-3">
                                    <button type="button" onClick={clearAll}
                                        className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-700 border border-slate-200 rounded-xl hover:bg-slate-50 transition-all">
                                        Clear All
                                    </button>
                                    <button type="button" onClick={handleUpdateAll}
                                        disabled={updating || selectedUsers.length === 0}
                                        className="flex items-center gap-2 px-6 py-2 bg-violet-500 hover:bg-violet-600 active:bg-violet-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-all disabled:opacity-60 disabled:cursor-not-allowed">
                                        {updating
                                            ? <><Loader2 size={15} className="animate-spin" /> Updating…</>
                                            : <><KeyRound size={15} /> Update All{selectedUsers.length > 0 ? ` (${selectedUsers.length})` : ''}</>
                                        }
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Results card */}
                    {results.length > 0 && (
                        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                                <div>
                                    <p className="text-sm font-semibold text-slate-900">Update Results</p>
                                    <p className="text-xs text-slate-500">
                                        {doneCount < results.length
                                            ? `Updating… ${doneCount} / ${results.length}`
                                            : `${successCount} of ${results.length} updated successfully`}
                                    </p>
                                </div>
                                {doneCount === results.length && (
                                    <div className={`text-xs font-semibold px-3 py-1 rounded-full ${successCount === results.length ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                                        {successCount === results.length ? 'All done' : `${results.length - successCount} failed`}
                                    </div>
                                )}
                            </div>
                            <div className="divide-y divide-slate-50">
                                {results.map((r, i) => (
                                    <div key={i} className="flex items-center gap-3 px-6 py-3">
                                        <div className="shrink-0">
                                            {r.status === 'pending'    && <div className="w-5 h-5 rounded-full border-2 border-slate-200" />}
                                            {r.status === 'processing' && <Loader2 size={16} className="animate-spin text-blue-500" />}
                                            {r.status === 'success'    && <CheckCircle2 size={16} className="text-emerald-500" />}
                                            {r.status === 'error'      && <AlertCircle size={16} className="text-red-500" />}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="text-sm font-medium text-slate-800 truncate">{r.user.object_name || r.user.user_login_name}</p>
                                            <p className="text-xs text-slate-500 font-mono truncate">{r.user.user_login_name}</p>
                                        </div>
                                        <div className="text-xs font-medium shrink-0">
                                            {r.status === 'pending'    && <span className="text-slate-400">Waiting…</span>}
                                            {r.status === 'processing' && <span className="text-blue-500">Updating…</span>}
                                            {r.status === 'success'    && <span className="text-emerald-600">Updated</span>}
                                            {r.status === 'error'      && <span className="text-red-500" title={r.message}>Failed — {r.message?.slice(0, 40)}</span>}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ─── Update Password (merged Single / Multiple) ───────────────────────────────
const PasswordTab = ({ onToast }) => {
    const [mode, setMode] = useState('single');
    return (
        <div className="flex-1 flex flex-col overflow-hidden">
            {/* Sub-nav */}
            <div className="flex items-center gap-1 mb-5 border-b border-slate-200">
                {[
                    { id: 'single',   label: 'Single User',   icon: User    },
                    { id: 'multiple', label: 'Multiple User', icon: UserCog },
                ].map(({ id, label, icon: Icon }) => (
                    <button key={id} type="button" onClick={() => setMode(id)}
                        className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px ${
                            mode === id
                                ? 'border-[#0A66C2] text-[#0A66C2]'
                                : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                        }`}>
                        <Icon size={16} />{label}
                    </button>
                ))}
            </div>
            {mode === 'single'   && <UpdatePasswordTab onToast={onToast} />}
            {mode === 'multiple' && <BulkPasswordTab   onToast={onToast} />}
        </div>
    );
};

// ─── Main UsersPage ───────────────────────────────────────────────────────────
const UsersPage = () => {
    const [activeTab, setActiveTab] = useState('directory');
    const [toast, setToast] = useState(null);

    const tabs = [
        { id: 'directory', label: 'User Directory',        icon: Users    },
        { id: 'creation',  label: 'User Creation',          icon: UserPlus },
        { id: 'password',  label: 'User Password Update',   icon: KeyRound },
    ];

    return (
        <div className="p-6 max-w-7xl mx-auto h-full flex flex-col">
            <Toast toast={toast} onDismiss={() => setToast(null)} />

            {/* Page header */}
            <div className="flex items-center gap-2 mb-5">
                <Users size={20} className="text-[#0A66C2]" />
                <h1 className="text-xl font-bold text-slate-900">Users</h1>
            </div>

            {/* Tab bar */}
            <div className="flex items-center gap-1 mb-5 border-b border-slate-200">
                {tabs.map(tab => {
                    const Icon = tab.icon;
                    const active = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-all -mb-px ${
                                active
                                    ? 'border-[#0A66C2] text-[#0A66C2]'
                                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                            }`}
                        >
                            <Icon size={16} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Tab content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {activeTab === 'directory' && <UserDirectoryTab />}
                {activeTab === 'creation'  && <UserCreateTab onToast={setToast} />}
                {activeTab === 'password'  && <PasswordTab onToast={setToast} />}
            </div>
        </div>
    );
};

export default UsersPage;
