import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import {
    Layers, Tag, Users, UserPlus, X, Loader2,
    CheckCircle2, AlertCircle, ChevronDown, Building2,
    UserCheck, UsersRound, Star,
} from 'lucide-react';
import { HO_DEPARTMENTS } from '../data/nabardMetadata.js';

// ─── helpers ─────────────────────────────────────────────────────────────────

function normalizeSuffix(raw) {
    return raw.replace(/\s+/g, '_').replace(/_+/g, '_').replace(/^_+|_+$/g, '');
}

/** 'ecm_ho_ddsi_common_cmd' → 'ecm_ho_vertical_head_ddsi_common_cmd' */
function toVerticalHeadName(groupName) {
    if (!groupName.startsWith('ecm_ho_')) return '';
    const rest = groupName.slice('ecm_ho_'.length);
    return `ecm_ho_vertical_head_${rest}`;
}

// ─── Shared UI primitives ────────────────────────────────────────────────────

const Label = ({ children, icon: Icon }) => (
    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5 mb-1.5">
        {Icon && <Icon size={11} />}{children}
    </label>
);

const Select = ({ value, onChange, disabled, placeholder, options = [], className = '' }) => (
    <div className="relative">
        <select
            value={value}
            onChange={e => onChange(e.target.value)}
            disabled={disabled}
            className={`w-full px-4 py-2.5 border rounded-xl text-sm appearance-none pr-10 transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#0A66C2] cursor-pointer
                ${disabled ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed' : 'bg-white border-slate-200 hover:border-slate-300 text-slate-800'}
                ${className}`}
        >
            <option value="">{placeholder}</option>
            {options.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
            ))}
        </select>
        <ChevronDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
    </div>
);

const Card = ({ children, className = '' }) => (
    <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm p-5 ${className}`}>
        {children}
    </div>
);

const SectionTitle = ({ children }) => (
    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">{children}</p>
);

const MemberTag = ({ type }) => (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
        type === 'user' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
    }`}>{type}</span>
);

// ─── Toast ────────────────────────────────────────────────────────────────────
const Toast = ({ toast, onDismiss }) => {
    useEffect(() => {
        if (!toast) return;
        const t = setTimeout(onDismiss, toast.type === 'success' ? 3000 : 5000);
        return () => clearTimeout(t);
    }, [toast, onDismiss]);
    if (!toast) return null;
    const styles = { success: 'bg-green-50 text-green-800 border-green-200', error: 'bg-red-50 text-red-800 border-red-200' };
    const Icon = toast.type === 'success' ? CheckCircle2 : AlertCircle;
    return (
        <div className={`fixed top-5 right-5 z-50 flex items-start gap-3 px-4 py-3 border rounded-xl shadow-lg max-w-sm ${styles[toast.type]}`}>
            <Icon size={18} className="mt-0.5 shrink-0" />
            <div className="flex-1 text-sm font-medium">{toast.message}</div>
            <button onClick={onDismiss} className="shrink-0 opacity-60 hover:opacity-100"><X size={16} /></button>
        </div>
    );
};

// ─── Vertical Creation Tab ────────────────────────────────────────────────────
const VerticalCreationTab = ({ setToast }) => {
    const [dept,     setDept]     = useState('');
    const [suffix,   setSuffix]   = useState('');
    const [creating, setCreating] = useState(false);

    const deptObj         = HO_DEPARTMENTS.find(d => d.name === dept);
    const prefix          = deptObj ? `ecm_ho_${deptObj.shortCode.toLowerCase()}_` : 'ecm_ho_';
    const cleanSuffix     = normalizeSuffix(suffix);
    const groupName       = cleanSuffix ? `${prefix}${cleanSuffix}` : '';
    const groupDisplayName = groupName ? groupName.replace(/_/g, '-').toUpperCase() : '';
    const canCreate       = !!deptObj && cleanSuffix.length > 0;

    const handleCreate = async () => {
        setCreating(true);
        try {
            await api.post('/groups', { group_name: groupName, group_display_name: groupDisplayName });
            setToast({ type: 'success', message: `Vertical '${groupName}' created successfully.` });
            setDept(''); setSuffix('');
        } catch (err) {
            setToast({ type: 'error', message: `Failed: ${err.response?.data?.message || err.message}` });
        } finally {
            setCreating(false);
        }
    };

    return (
        <Card className="space-y-5">
            <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl w-fit text-sm text-slate-600">
                <Building2 size={14} className="text-slate-400" />
                Office Type: <span className="font-semibold text-slate-800">HO — Head Office</span>
            </div>

            <div>
                <Label icon={Layers}>Department</Label>
                <Select
                    value={dept} onChange={v => { setDept(v); setSuffix(''); }}
                    placeholder="— Select department —"
                    options={HO_DEPARTMENTS.map(d => ({ value: d.name, label: `${d.name} (${d.shortCode})` }))}
                />
            </div>

            <div>
                <Label icon={Tag}>Group Name</Label>
                <div className="flex items-stretch rounded-xl border border-slate-200 overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/20 focus-within:border-[#0A66C2] transition-all">
                    <span className="px-3 py-2.5 bg-slate-100 text-slate-500 text-sm font-mono border-r border-slate-200 whitespace-nowrap select-none">
                        {prefix}
                    </span>
                    <input type="text" value={suffix} onChange={e => setSuffix(e.target.value)}
                        disabled={!dept} placeholder={dept ? 'e.g. common_cmd' : 'Select department first'}
                        className="flex-1 px-3 py-2.5 text-sm font-mono focus:outline-none bg-white disabled:bg-slate-50 disabled:text-slate-400 disabled:cursor-not-allowed" />
                </div>
                {cleanSuffix && <p className="text-xs text-slate-400 font-mono mt-1 pl-1">Full: <span className="text-slate-600">{groupName}</span></p>}
                <p className="text-xs text-slate-400 mt-1 pl-1">Spaces and repeated underscores auto-convert to single <code className="bg-slate-100 px-1 rounded">_</code></p>
            </div>

            <div>
                <Label icon={Tag}>Group Display Name <span className="normal-case font-normal text-slate-400">(auto-filled)</span></Label>
                <input type="text" readOnly value={groupDisplayName}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-mono bg-slate-50 text-slate-600 cursor-default" />
            </div>

            <button onClick={handleCreate} disabled={!canCreate || creating}
                className="w-full flex items-center justify-center gap-2 px-6 py-2.5 bg-[#0A66C2] hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                {creating ? <><Loader2 size={15} className="animate-spin" /> Creating...</> : 'Create Vertical'}
            </button>
        </Card>
    );
};

// ─── Add Members Tab ──────────────────────────────────────────────────────────
const AddMembersTab = ({ setToast }) => {
    const [dept,              setDept]              = useState('');
    const [verticals,         setVerticals]         = useState([]);
    const [selectedVertical,  setSelectedVertical]  = useState('');
    const [users,             setUsers]             = useState([]);
    const [selectedUser,      setSelectedUser]      = useState('');   // user_login_name (DCTM identifier)
    const [selectedUserObjectName, setSelectedUserObjectName] = useState(''); // full name for display

    const [verticalMembers,   setVerticalMembers]   = useState({ users: [], groups: [] });
    const [userGroups,        setUserGroups]        = useState([]);
    const [vhGroupName,       setVhGroupName]       = useState('');
    const [vhExists,          setVhExists]          = useState(false);
    const [vhMembers,         setVhMembers]         = useState([]);

    const [loadingVerticals,  setLoadingVerticals]  = useState(false);
    const [loadingUsers,      setLoadingUsers]      = useState(false);
    const [loadingMembers,    setLoadingMembers]    = useState(false);
    const [loadingUserGroups, setLoadingUserGroups] = useState(false);
    const [adding,            setAdding]            = useState(false);
    const [creatingVH,        setCreatingVH]        = useState(false);

    // On dept change
    const handleDeptChange = async (v) => {
        setDept(v);
        setSelectedVertical(''); setVerticals([]);
        setSelectedUser(''); setUsers([]);
        setVerticalMembers({ users: [], groups: [] });
        setUserGroups([]); setVhGroupName(''); setVhExists(false); setVhMembers([]);
        if (!v) return;
        const d = HO_DEPARTMENTS.find(d => d.name === v);
        if (!d) return;

        // Load verticals + users in parallel
        setLoadingVerticals(true); setLoadingUsers(true);
        const [vRes, uRes] = await Promise.allSettled([
            api.get('/groups/by-prefix', { params: { prefix: `ecm_ho_${d.shortCode.toLowerCase()}` } }),
            api.get('/users/by-dept',    { params: { shortCode: d.shortCode.toLowerCase() } }),
        ]);
        setLoadingVerticals(false); setLoadingUsers(false);
        if (vRes.status === 'fulfilled') {
            // Exclude vertical_head groups from the list
            const all = vRes.value.data || [];
            setVerticals(all.filter(g => !g.group_name.includes('vertical_head') && !g.group_name.includes('_grade_') && !g.group_name.includes('_cgm_sec')));
        }
        if (uRes.status === 'fulfilled') setUsers(uRes.value.data || []);
    };

    // On vertical change
    const handleVerticalChange = useCallback(async (v) => {
        setSelectedVertical(v);
        setVerticalMembers({ users: [], groups: [] });
        setVhGroupName(''); setVhExists(false); setVhMembers([]);
        if (!v) return;

        const vhName = toVerticalHeadName(v);
        setVhGroupName(vhName);

        setLoadingMembers(true);
        const [membersRes, vhRes, vhMembersRes] = await Promise.allSettled([
            api.get(`/groups/${v}/members`),
            api.get(`/groups/exists/${vhName}`),
            api.get(`/groups/${vhName}/members`),
        ]);
        setLoadingMembers(false);

        if (membersRes.status === 'fulfilled') {
            setVerticalMembers({
                users:  membersRes.value.data.users  || [],
                groups: membersRes.value.data.groups || [],
            });
        }
        if (vhRes.status === 'fulfilled') {
            setVhExists(vhRes.value.data.exists);
        }
        if (vhMembersRes.status === 'fulfilled') {
            setVhMembers(vhMembersRes.value.data.users || []);
        }
    }, []);

    // On user change — loginName = user_login_name (used for DCTM ops via resolveDmUserName)
    const handleUserChange = async (loginName) => {
        const userObj = users.find(u => u.user_login_name === loginName);
        setSelectedUser(loginName);
        setSelectedUserObjectName(userObj?.object_name || loginName); // full name for VH display
        setUserGroups([]);
        if (!loginName) return;
        setLoadingUserGroups(true);
        try {
            const res = await api.get('/groups/by-user', { params: { username: loginName } });
            setUserGroups(res.data || []);
        } catch { setUserGroups([]); }
        finally { setLoadingUserGroups(false); }
    };

    const userAlreadyInGroup = verticalMembers.users.some(u => u.name === selectedUser);

    const handleAddToGroup = async () => {
        if (!selectedVertical || !selectedUser) return;
        if (userAlreadyInGroup) {
            setToast({ type: 'error', message: `'${selectedUser}' is already a member of '${selectedVertical}'.` });
            return;
        }
        setAdding(true);
        try {
            const addRes = await api.post(`/groups/${selectedVertical}/members`, {
                memberName: selectedUser, memberType: 'user',
            });
            if (addRes.data?.success === false) {
                setToast({ type: 'error', message: addRes.data.message || 'Failed to add member.' });
                return;
            }
            setToast({ type: 'success', message: `'${selectedUser}' added to '${selectedVertical}'.` });
            // Refresh members
            const res = await api.get(`/groups/${selectedVertical}/members`);
            setVerticalMembers({ users: res.data.users || [], groups: res.data.groups || [] });
        } catch (err) {
            const msg = err.response?.data?.message || err.message || 'Failed to add member.';
            setToast({ type: 'error', message: msg });
        } finally { setAdding(false); }
    };

    const handleMarkVerticalHead = async () => {
        if (!selectedVertical || !selectedUser) return;
        setCreatingVH(true);
        try {
            const vhDisplayName = selectedVertical.replace(/_/g, '-').toUpperCase() + ` -${selectedUserObjectName}`;
            // 1. Create the vertical head group (ignore if it already exists from a prior attempt)
            try {
                await api.post('/groups', { group_name: vhGroupName, group_display_name: vhDisplayName });
            } catch (createErr) {
                // Group may already exist from a failed previous attempt — proceed to add user anyway
                const msg = createErr.response?.data?.message || '';
                if (!msg.toLowerCase().includes('already') && !msg.toLowerCase().includes('exist')) {
                    throw createErr; // Rethrow unexpected errors
                }
            }
            // 2. Add the user to the vertical head group
            await api.post(`/groups/${vhGroupName}/members`, { memberName: selectedUser, memberType: 'user' });
            setToast({ type: 'success', message: `Vertical head '${vhGroupName}' created and '${selectedUser}' assigned.` });
            setVhExists(true);
            // Refresh user's groups + VH members
            const [groupsRes, vhMembersRes] = await Promise.allSettled([
                api.get('/groups/by-user', { params: { username: selectedUser } }),
                api.get(`/groups/${vhGroupName}/members`),
            ]);
            if (groupsRes.status === 'fulfilled')   setUserGroups(groupsRes.value.data || []);
            if (vhMembersRes.status === 'fulfilled') setVhMembers(vhMembersRes.value.data.users || []);
        } catch (err) {
            setToast({ type: 'error', message: err.response?.data?.message || 'Failed to create vertical head.' });
        } finally { setCreatingVH(false); }
    };

    const showMarkVHButton = selectedVertical && selectedUser;
    const canAdd = selectedVertical && selectedUser && !userAlreadyInGroup;

    return (
        <div className="space-y-5">
            {/* ── Step 1: Department + Vertical + User ── */}
            <Card className="space-y-4">
                <SectionTitle>Selection</SectionTitle>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                        <Label icon={Layers}>Department</Label>
                        <Select value={dept} onChange={handleDeptChange}
                            placeholder="— Select dept —"
                            options={HO_DEPARTMENTS.map(d => ({ value: d.name, label: `${d.name} (${d.shortCode})` }))} />
                    </div>
                    <div>
                        <Label icon={UsersRound}>Vertical</Label>
                        {loadingVerticals
                            ? <div className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-400"><Loader2 size={14} className="animate-spin" /> Loading…</div>
                            : <Select value={selectedVertical} onChange={handleVerticalChange}
                                disabled={!dept || verticals.length === 0}
                                placeholder={!dept ? '— Select dept first —' : verticals.length === 0 ? 'No verticals found' : '— Select vertical —'}
                                options={verticals.map(g => ({ value: g.group_name, label: g.group_name }))} />
                        }
                    </div>
                    <div>
                        <Label icon={Users}>User</Label>
                        {loadingUsers
                            ? <div className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-400"><Loader2 size={14} className="animate-spin" /> Loading…</div>
                            : <Select value={selectedUser} onChange={handleUserChange}
                                disabled={!dept || users.length === 0}
                                placeholder={!dept ? '— Select dept first —' : users.length === 0 ? 'No users found' : '— Select user —'}
                                options={users.map(u => ({ value: u.user_login_name, label: `${u.object_name} (${u.user_login_name})` }))} />
                        }
                    </div>
                </div>
            </Card>

            {/* ── Step 2: Info panels (members + user groups + vertical head) ── */}
            {(selectedVertical || selectedUser) && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">

                    {/* 1 — Vertical Members */}
                    {selectedVertical && (
                        <Card>
                            <SectionTitle>Vertical Members</SectionTitle>
                            {loadingMembers
                                ? <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-slate-400" /></div>
                                : [...verticalMembers.users, ...verticalMembers.groups].length === 0
                                    ? <p className="text-xs text-slate-400 text-center py-3">No members</p>
                                    : <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                        {[...verticalMembers.users, ...verticalMembers.groups].map(m => (
                                            <div key={`${m.type}-${m.name}`} className="flex items-center gap-2 text-xs">
                                                <MemberTag type={m.type} />
                                                <span className="font-mono text-slate-700 truncate">{m.name}</span>
                                            </div>
                                        ))}
                                    </div>
                            }
                        </Card>
                    )}

                    {/* 2 — Vertical Head Group */}
                    {selectedVertical && (
                        <Card>
                            <SectionTitle>Vertical Head Group</SectionTitle>
                            <p className="text-xs font-mono text-slate-400 mb-2 break-all">{vhGroupName}</p>
                            {loadingMembers
                                ? <div className="flex justify-center py-2"><Loader2 size={14} className="animate-spin text-slate-400" /></div>
                                : vhExists
                                    ? <>
                                        <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-2.5 py-1.5 mb-2">
                                            <CheckCircle2 size={12} /> Exists
                                        </div>
                                        {vhMembers.length > 0 && (
                                            <div className="space-y-1 mt-1">
                                                {vhMembers.map(m => (
                                                    <div key={m.name} className="flex items-center gap-2 text-xs">
                                                        <MemberTag type="user" />
                                                        <span className="font-mono text-slate-700 truncate">{m.name}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </>
                                    : <div className="flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                                        <AlertCircle size={12} /> Not yet created
                                    </div>
                            }
                        </Card>
                    )}

                    {/* 3 — User's Groups */}
                    {selectedUser && (
                        <Card>
                            <SectionTitle>User's Groups</SectionTitle>
                            {loadingUserGroups
                                ? <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-slate-400" /></div>
                                : userGroups.length === 0
                                    ? <p className="text-xs text-slate-400 text-center py-3">Not in any group</p>
                                    : <div className="space-y-1 max-h-48 overflow-y-auto">
                                        {userGroups.map(g => (
                                            <p key={g.group_name} className="text-xs font-mono text-slate-600 truncate">{g.group_name}</p>
                                        ))}
                                    </div>
                            }
                        </Card>
                    )}
                </div>
            )}

            {/* ── Step 3: Action buttons ── */}
            {selectedVertical && selectedUser && (
                <Card className="space-y-3">
                    <SectionTitle>Actions</SectionTitle>

                    {userAlreadyInGroup && (
                        <div className="flex items-center gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
                            <AlertCircle size={14} /> User already exists in this group
                        </div>
                    )}

                    <div className="flex flex-wrap gap-3">
                        {/* Add to Group */}
                        <button onClick={handleAddToGroup} disabled={!canAdd || adding}
                            className="flex items-center gap-2 px-5 py-2.5 bg-[#0A66C2] hover:bg-blue-700 text-white text-sm font-semibold rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                            {adding
                                ? <><Loader2 size={14} className="animate-spin" /> Adding…</>
                                : <><UserPlus size={14} /> Add to Vertical</>}
                        </button>

                        {/* Mark Vertical Head */}
                        {showMarkVHButton && (
                            <button onClick={handleMarkVerticalHead} disabled={creatingVH || vhExists}
                                className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-semibold rounded-xl shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed">
                                {creatingVH
                                    ? <><Loader2 size={14} className="animate-spin" /> Creating…</>
                                    : <><Star size={14} /> Mark Vertical Head</>}
                            </button>
                        )}

                    </div>

                    <p className="text-xs text-slate-400">
                        Adding <span className="font-mono text-slate-600">{selectedUser}</span> to <span className="font-mono text-slate-600">{selectedVertical}</span>
                        {vhGroupName && <> · Vertical head group: <span className="font-mono text-slate-600">{vhGroupName}</span>{vhExists ? ' (exists)' : ''}</>}
                    </p>
                </Card>
            )}
        </div>
    );
};

// ─── Remove Members Tab ───────────────────────────────────────────────────────
const RemoveMembersTab = ({ setToast }) => {
    const [dept,           setDept]           = useState('');
    const [verticals,      setVerticals]      = useState([]);
    const [selectedGroup,  setSelectedGroup]  = useState('');
    const [members,        setMembers]        = useState({ users: [], groups: [] });
    const [loadingVerts,   setLoadingVerts]   = useState(false);
    const [loadingMembers, setLoadingMembers] = useState(false);

    const handleDeptChange = async (v) => {
        setDept(v); setSelectedGroup(''); setVerticals([]); setMembers({ users: [], groups: [] });
        if (!v) return;
        const d = HO_DEPARTMENTS.find(d => d.name === v);
        if (!d) return;
        setLoadingVerts(true);
        try {
            const res = await api.get('/groups/by-prefix', {
                params: { prefix: `ecm_ho_${d.shortCode.toLowerCase()}` },
            });
            setVerticals(res.data || []);
        } catch { setVerticals([]); }
        finally { setLoadingVerts(false); }
    };

    const handleGroupChange = async (v) => {
        setSelectedGroup(v); setMembers({ users: [], groups: [] });
        if (!v) return;
        setLoadingMembers(true);
        try {
            const res = await api.get(`/groups/${v}/members`);
            setMembers({ users: res.data.users || [], groups: res.data.groups || [] });
        } catch { setMembers({ users: [], groups: [] }); }
        finally { setLoadingMembers(false); }
    };

    const handleRemove = async (member) => {
        try {
            await api.delete(`/groups/${selectedGroup}/members/${member.name}`, {
                params: { memberType: member.type },
            });
            setToast({ type: 'success', message: `'${member.name}' removed from '${selectedGroup}'.` });
            setMembers(prev => ({
                users:  prev.users.filter(u => u.name !== member.name),
                groups: prev.groups.filter(g => g.name !== member.name),
            }));
        } catch (err) {
            setToast({ type: 'error', message: err.response?.data?.message || 'Failed to remove member.' });
        }
    };

    const allMembers = [...members.users, ...members.groups];

    return (
        <div className="space-y-5">
            <Card className="space-y-4">
                <SectionTitle>Select Group</SectionTitle>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <Label icon={Layers}>Department</Label>
                        <Select value={dept} onChange={handleDeptChange}
                            placeholder="— Select dept —"
                            options={HO_DEPARTMENTS.map(d => ({ value: d.name, label: `${d.name} (${d.shortCode})` }))} />
                    </div>
                    <div>
                        <Label icon={UsersRound}>Vertical / Group</Label>
                        {loadingVerts
                            ? <div className="flex items-center gap-2 px-4 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-400"><Loader2 size={14} className="animate-spin" /> Loading…</div>
                            : <Select value={selectedGroup} onChange={handleGroupChange}
                                disabled={!dept || verticals.length === 0}
                                placeholder={!dept ? '— Select dept first —' : verticals.length === 0 ? 'No groups found' : '— Select group —'}
                                options={verticals.map(g => ({ value: g.group_name, label: g.group_name }))} />
                        }
                    </div>
                </div>
            </Card>

            {selectedGroup && (
                <Card>
                    <div className="flex items-center justify-between mb-3">
                        <SectionTitle>Members of <span className="font-mono normal-case">{selectedGroup}</span></SectionTitle>
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full text-xs">{allMembers.length}</span>
                    </div>

                    {loadingMembers
                        ? <div className="flex justify-center py-6"><Loader2 size={18} className="animate-spin text-slate-400" /></div>
                        : allMembers.length === 0
                            ? <p className="text-sm text-slate-400 text-center py-4">No members in this group</p>
                            : <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100">
                                {allMembers.map(m => (
                                    <div key={`${m.type}-${m.name}`} className="flex items-center justify-between px-4 py-2.5">
                                        <div className="flex items-center gap-2.5">
                                            <MemberTag type={m.type} />
                                            <span className="text-sm text-slate-700 font-mono">{m.name}</span>
                                        </div>
                                        <button onClick={() => handleRemove(m)}
                                            className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Remove">
                                            <X size={14} />
                                        </button>
                                    </div>
                                ))}
                            </div>
                    }
                </Card>
            )}
        </div>
    );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
const VerticalsPage = () => {
    const [pageTab,  setPageTab]  = useState('creation');
    const [innerTab, setInnerTab] = useState('add');
    const [toast,    setToast]    = useState(null);

    const PAGE_TABS = [
        { key: 'creation', label: 'Vertical Creation' },
        { key: 'members',  label: 'Manage Members'    },
    ];
    const INNER_TABS = [
        { key: 'add',    label: 'Add Members',    icon: UserPlus   },
        { key: 'remove', label: 'Remove Members', icon: UserCheck  },
    ];

    return (
        <div className="p-6 max-w-5xl mx-auto">
            <Toast toast={toast} onDismiss={() => setToast(null)} />

            <div className="mb-6">
                <h1 className="text-2xl font-bold text-slate-900">Verticals</h1>
                <p className="text-sm text-slate-500 mt-1">Manage HO verticals (dm_group) and their members</p>
            </div>

            {/* Top-level tabs */}
            <div className="flex gap-1 border-b border-slate-200 mb-6">
                {PAGE_TABS.map(tab => (
                    <button key={tab.key} onClick={() => setPageTab(tab.key)}
                        className={`px-5 py-2.5 text-sm font-medium rounded-t-lg transition-colors border-b-2 -mb-px ${
                            pageTab === tab.key
                                ? 'border-[#0A66C2] text-[#0A66C2] bg-blue-50/40'
                                : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                        }`}>
                        {tab.label}
                    </button>
                ))}
            </div>

            {pageTab === 'creation' && <VerticalCreationTab setToast={setToast} />}

            {pageTab === 'members' && (
                <>
                    {/* Inner tabs for Manage Members */}
                    <div className="flex gap-2 mb-5">
                        {INNER_TABS.map(t => (
                            <button key={t.key} onClick={() => setInnerTab(t.key)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                                    innerTab === t.key
                                        ? 'bg-[#0A66C2] text-white shadow-sm'
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}>
                                <t.icon size={13} /> {t.label}
                            </button>
                        ))}
                    </div>
                    {innerTab === 'add'    && <AddMembersTab    setToast={setToast} />}
                    {innerTab === 'remove' && <RemoveMembersTab setToast={setToast} />}
                </>
            )}
        </div>
    );
};

export default VerticalsPage;
