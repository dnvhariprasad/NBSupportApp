import { useState, useCallback } from 'react';
import { Building2, Shield, Plus, FolderEdit, Users, ArrowRight, ArrowRightLeft, Loader2, CheckCircle2 } from 'lucide-react';
import { useDeptAdmin } from '../../hooks/useDeptAdmin';
import { StepIndicator, Card, WizardNav, Badge, mapGroupName } from './shared';
import GroupMembersGrid from './GroupMembersGrid';

const STEPS = ['Select Dept', 'Review Groups', 'Create New Groups', 'Move Members', 'Update Users', 'Rename Folder'];

const RenameWizard = ({ onToast }) => {
    const api = useDeptAdmin();
    const [step, setStep] = useState(0);
    const [oldCode, setOldCode] = useState('');
    const [newName, setNewName] = useState('');
    const [newCode, setNewCode] = useState('');
    const [groups, setGroups] = useState([]);
    const [users, setUsers] = useState([]);
    const [folder, setFolder] = useState(null);
    const [loading, setLoading] = useState(false);
    const [createStatus, setCreateStatus] = useState({});
    const [userStatus, setUserStatus] = useState({});
    const [folderStatus, setFolderStatus] = useState('pending');

    const mapName = useCallback((name) => mapGroupName(name, oldCode, newCode), [oldCode, newCode]);

    const fetchImpact = async () => {
        if (!oldCode.trim() || !newName.trim() || !newCode.trim()) return;
        setLoading(true);
        try {
            const [grps, usrs, fld] = await Promise.all([
                api.fetchGroups(oldCode),
                api.fetchUsers(oldCode),
                api.fetchFolder(oldCode),
            ]);
            setGroups(grps);
            setUsers(usrs);
            setFolder(fld);
            setStep(1);
        } catch {
            onToast({ type: 'error', message: 'Failed to fetch department data' });
        } finally {
            setLoading(false);
        }
    };

    const handleCreateGroup = async (oldName) => {
        setCreateStatus(prev => ({ ...prev, [oldName]: 'processing' }));
        try {
            const res = await api.createGroup(mapName(oldName));
            setCreateStatus(prev => ({ ...prev, [oldName]: res?.success ? 'done' : 'failed' }));
            onToast({ type: res?.success ? 'success' : 'error', message: res?.message });
        } catch {
            setCreateStatus(prev => ({ ...prev, [oldName]: 'failed' }));
        }
    };

    const handleCreateAll = async () => {
        for (const g of groups) {
            if (createStatus[g.group_name] !== 'done') await handleCreateGroup(g.group_name);
        }
    };

    const handleUpdateUser = async (user) => {
        const id = user.r_object_id;
        setUserStatus(prev => ({ ...prev, [id]: 'processing' }));
        try {
            const res = await api.updateUserDept(id, newName, oldCode, newCode);
            setUserStatus(prev => ({ ...prev, [id]: res?.success ? 'done' : 'failed' }));
            if (res?.success) onToast({ type: 'success', message: `Updated ${user.object_name}` });
        } catch {
            setUserStatus(prev => ({ ...prev, [id]: 'failed' }));
        }
    };

    const handleUpdateAllUsers = async () => {
        for (const u of users) {
            if (userStatus[u.r_object_id] !== 'done') await handleUpdateUser(u);
        }
    };

    const handleRenameFolder = async () => {
        if (!folder?.r_object_id) return;
        setFolderStatus('processing');
        try {
            const res = await api.renameFolder(folder.r_object_id, newName.toUpperCase());
            setFolderStatus(res?.success ? 'done' : 'failed');
            onToast({ type: res?.success ? 'success' : 'error', message: res?.message });
        } catch {
            setFolderStatus('failed');
        }
    };

    return (
        <div className="space-y-6">
            <StepIndicator steps={STEPS} currentStep={step} />

            {step === 0 && (
                <Card title="Select Department to Rename" icon={Building2}>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <InputField label="Current Short Code" value={oldCode} onChange={v => setOldCode(v.toLowerCase())} placeholder="e.g. fsdd" />
                        <InputField label="New Department Name" value={newName} onChange={setNewName} placeholder="e.g. Financial Services" />
                        <InputField label="New Short Code" value={newCode} onChange={v => setNewCode(v.toLowerCase())} placeholder="e.g. fsd" />
                    </div>
                    <button onClick={fetchImpact} disabled={!oldCode.trim() || !newName.trim() || !newCode.trim() || loading}
                        className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-[#0A66C2] text-white rounded-xl text-sm font-semibold hover:bg-[#094d92] disabled:opacity-50">
                        {loading ? <Loader2 size={15} className="animate-spin" /> : null}
                        Fetch &amp; Review Impact
                    </button>
                </Card>
            )}

            {step === 1 && (
                <Card title={`Affected Groups (${groups.length})`} icon={Shield}>
                    <GroupMappingTable groups={groups} mapName={mapName} />
                    <p className="mt-3 text-xs text-slate-500">Users: <strong>{users.length}</strong> | Folder: <strong>{folder?.object_name || 'Not found'}</strong></p>
                    <WizardNav onBack={() => setStep(0)} onNext={() => setStep(2)} nextLabel="Create New Groups" />
                </Card>
            )}

            {step === 2 && (
                <Card title="Create New Groups" icon={Plus}>
                    <button onClick={handleCreateAll} className="mb-4 px-4 py-2 bg-[#0A66C2] text-white rounded-lg text-xs font-semibold hover:bg-[#094d92]">
                        Create All ({groups.filter(g => createStatus[g.group_name] !== 'done').length} remaining)
                    </button>
                    <ActionTable
                        items={groups}
                        columns={[
                            { key: 'new', label: 'New Group', render: g => <span className="font-mono text-xs text-blue-700">{mapName(g.group_name)}</span> },
                            { key: 'old', label: 'Based On', render: g => <span className="font-mono text-xs text-slate-500">{g.group_name}</span> },
                        ]}
                        statusMap={createStatus}
                        statusKey={g => g.group_name}
                        onAction={g => handleCreateGroup(g.group_name)}
                        actionLabel="Create"
                    />
                    <WizardNav onBack={() => setStep(1)} onNext={() => setStep(3)} nextLabel="Move Members" />
                </Card>
            )}

            {step === 3 && (
                <Card title="Move Members (Group by Group)" icon={ArrowRightLeft}>
                    <GroupMembersGrid groups={groups} oldCode={oldCode} newCode={newCode} mapName={mapName} api={api} onToast={onToast} />
                    <WizardNav onBack={() => setStep(2)} onNext={() => setStep(4)} nextLabel="Update Users" />
                </Card>
            )}

            {step === 4 && (
                <Card title={`Update User Profiles (${users.length})`} icon={Users}>
                    <button onClick={handleUpdateAllUsers} className="mb-4 px-4 py-2 bg-[#0A66C2] text-white rounded-lg text-xs font-semibold hover:bg-[#094d92]">
                        Update All ({users.filter(u => userStatus[u.r_object_id] !== 'done').length} remaining)
                    </button>
                    <ActionTable
                        items={users}
                        columns={[
                            { key: 'name', label: 'User', render: u => <span className="font-medium">{u.object_name}</span> },
                            { key: 'login', label: 'Login', render: u => u.user_login_name },
                            { key: 'cur', label: 'Current', render: u => u.department_name },
                            { key: 'new', label: '→ New', render: () => <span className="text-blue-700 font-medium">{newName}</span> },
                        ]}
                        statusMap={userStatus}
                        statusKey={u => u.r_object_id}
                        onAction={handleUpdateUser}
                        actionLabel="Update"
                    />
                    <WizardNav onBack={() => setStep(3)} onNext={() => setStep(5)} nextLabel="Rename Folder" />
                </Card>
            )}

            {step === 5 && (
                <Card title="Rename Department Folder" icon={FolderEdit}>
                    {folder ? (
                        <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-xl">
                            <div>
                                <p className="text-xs text-slate-500">Current</p>
                                <p className="font-mono text-sm">{folder.object_name}</p>
                            </div>
                            <ArrowRight size={20} className="text-slate-400" />
                            <div>
                                <p className="text-xs text-slate-500">New</p>
                                <p className="font-mono text-sm text-blue-700 font-semibold">{newName.toUpperCase()}</p>
                            </div>
                            <div className="ml-auto flex items-center gap-3">
                                {folderStatus !== 'done' && folderStatus !== 'processing' && (
                                    <button onClick={handleRenameFolder} className="px-4 py-2 bg-[#0A66C2] text-white rounded-lg text-sm font-semibold hover:bg-[#094d92]">Rename</button>
                                )}
                                {folderStatus === 'processing' && <Loader2 size={18} className="animate-spin text-blue-500" />}
                                <Badge status={folderStatus} />
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-slate-400">Folder not found at expected path.</p>
                    )}
                    {folderStatus === 'done' && (
                        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl text-green-800 text-sm flex items-center gap-2">
                            <CheckCircle2 size={16} /> All rename steps completed successfully.
                        </div>
                    )}
                    <WizardNav onBack={() => setStep(4)} showNext={false} />
                </Card>
            )}
        </div>
    );
};

// ─── Reusable sub-components ─────────────────────────────────────────────────

const InputField = ({ label, value, onChange, placeholder }) => (
    <div>
        <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
        <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-[#0A66C2] focus:outline-none" />
    </div>
);

const GroupMappingTable = ({ groups, mapName }) => (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
            <thead className="bg-slate-50"><tr>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">#</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">Current Group</th>
                <th className="px-4 py-3 text-left font-semibold text-slate-700">→ New Group</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
                {groups.map((g, i) => (
                    <tr key={g.group_name} className="hover:bg-slate-50/80">
                        <td className="px-4 py-3 text-slate-500">{i + 1}</td>
                        <td className="px-4 py-3 font-mono text-xs">{g.group_name}</td>
                        <td className="px-4 py-3 font-mono text-xs text-blue-700">{mapName(g.group_name)}</td>
                    </tr>
                ))}
            </tbody>
        </table>
    </div>
);

const ActionTable = ({ items, columns, statusMap, statusKey, onAction, actionLabel }) => (
    <div className="overflow-x-auto rounded-lg border border-slate-200">
        <table className="w-full text-sm">
            <thead className="bg-slate-50"><tr>
                <th className="px-4 py-3 text-left font-semibold">#</th>
                {columns.map(c => <th key={c.key} className="px-4 py-3 text-left font-semibold">{c.label}</th>)}
                <th className="px-4 py-3 text-center font-semibold">Action</th>
                <th className="px-4 py-3 text-center font-semibold">Status</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">
                {items.map((item, i) => {
                    const st = statusMap[statusKey(item)] || 'pending';
                    return (
                        <tr key={statusKey(item)} className={st === 'done' ? 'bg-green-50/50' : 'hover:bg-slate-50/80'}>
                            <td className="px-4 py-3 text-slate-500">{i + 1}</td>
                            {columns.map(c => <td key={c.key} className="px-4 py-3 text-slate-500">{c.render(item)}</td>)}
                            <td className="px-4 py-3 text-center">
                                {st !== 'done' && st !== 'processing' ? (
                                    <button onClick={() => onAction(item)} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700">{actionLabel}</button>
                                ) : st === 'processing' ? (
                                    <Loader2 size={14} className="animate-spin text-blue-500 mx-auto" />
                                ) : null}
                            </td>
                            <td className="px-4 py-3 text-center"><Badge status={st} /></td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    </div>
);

export default RenameWizard;
