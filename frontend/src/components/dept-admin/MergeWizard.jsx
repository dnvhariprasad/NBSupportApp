import { useState, useCallback, useMemo } from 'react';
import { ArrowRightLeft, Shield, Users, Plus, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';
import { useDeptAdmin } from '../../hooks/useDeptAdmin';
import { StepIndicator, Card, WizardNav, Badge, mapGroupName } from './shared';
import GroupMembersGrid from './GroupMembersGrid';

const STEPS = ['Select Depts', 'Group Mapping', 'Review Users', 'Create Missing', 'Move Members', 'Update Users', 'Verify'];

const MergeWizard = ({ onToast }) => {
    const api = useDeptAdmin();
    const [step, setStep] = useState(0);
    const [sourceCode, setSourceCode] = useState('');
    const [targetCode, setTargetCode] = useState('');
    const [targetName, setTargetName] = useState('');
    const [sourceGroups, setSourceGroups] = useState([]);
    const [targetGroups, setTargetGroups] = useState([]);
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [createStatus, setCreateStatus] = useState({});
    const [userStatus, setUserStatus] = useState({});

    const mapName = useCallback((name) => mapGroupName(name, sourceCode, targetCode), [sourceCode, targetCode]);

    const targetGroupNames = useMemo(() => new Set(targetGroups.map(g => g.group_name)), [targetGroups]);
    const missingGroups = useMemo(
        () => sourceGroups.filter(g => !targetGroupNames.has(mapName(g.group_name))),
        [sourceGroups, targetGroupNames, mapName]
    );

    const fetchMergeData = async () => {
        if (!sourceCode.trim() || !targetCode.trim()) return;
        setLoading(true);
        try {
            const [srcGroups, tgtGroups, usrs] = await Promise.all([
                api.fetchGroups(sourceCode),
                api.fetchGroups(targetCode),
                api.fetchUsers(sourceCode),
            ]);
            setSourceGroups(srcGroups);
            setTargetGroups(tgtGroups);
            setUsers(usrs);
            setStep(1);
        } catch {
            onToast({ type: 'error', message: 'Failed to fetch merge data' });
        } finally {
            setLoading(false);
        }
    };

    const handleCreateMissing = async (sourceName) => {
        setCreateStatus(prev => ({ ...prev, [sourceName]: 'processing' }));
        try {
            const res = await api.createGroup(mapName(sourceName));
            setCreateStatus(prev => ({ ...prev, [sourceName]: res?.success ? 'done' : 'failed' }));
            onToast({ type: res?.success ? 'success' : 'error', message: res?.message });
        } catch {
            setCreateStatus(prev => ({ ...prev, [sourceName]: 'failed' }));
        }
    };

    const handleUpdateUser = async (user) => {
        const id = user.r_object_id;
        setUserStatus(prev => ({ ...prev, [id]: 'processing' }));
        try {
            const res = await api.updateUserDept(id, targetName || targetCode.toUpperCase(), sourceCode, targetCode);
            setUserStatus(prev => ({ ...prev, [id]: res?.success ? 'done' : 'failed' }));
        } catch {
            setUserStatus(prev => ({ ...prev, [id]: 'failed' }));
        }
    };

    const handleUpdateAllUsers = async () => {
        for (const u of users) {
            if (userStatus[u.r_object_id] !== 'done') await handleUpdateUser(u);
        }
    };

    const movedCount = Object.values(userStatus).filter(s => s === 'done').length;
    const failedCount = Object.values(userStatus).filter(s => s === 'failed').length;

    return (
        <div className="space-y-6">
            <StepIndicator steps={STEPS} currentStep={step} />

            {step === 0 && (
                <Card title="Select Departments to Merge" icon={ArrowRightLeft}>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <InputField label="Source (Merge FROM)" value={sourceCode} onChange={v => setSourceCode(v.toLowerCase())} placeholder="e.g. fsdd" />
                        <div className="flex justify-center pb-2"><ArrowRight size={24} className="text-slate-400" /></div>
                        <InputField label="Target (Merge INTO)" value={targetCode} onChange={v => setTargetCode(v.toLowerCase())} placeholder="e.g. hrmd" />
                    </div>
                    <InputField label="Target Full Name" value={targetName} onChange={setTargetName} placeholder="e.g. HRMD" className="mt-3 md:w-1/3" />
                    <button onClick={fetchMergeData} disabled={!sourceCode.trim() || !targetCode.trim() || sourceCode === targetCode || loading}
                        className="mt-4 flex items-center gap-2 px-5 py-2.5 bg-[#0A66C2] text-white rounded-xl text-sm font-semibold hover:bg-[#094d92] disabled:opacity-50">
                        {loading ? <Loader2 size={15} className="animate-spin" /> : null}
                        Fetch &amp; Review
                    </button>
                </Card>
            )}

            {step === 1 && (
                <Card title={`Group Mapping (${sourceGroups.length} source → ${targetGroups.length} target)`} icon={Shield}>
                    <div className="overflow-x-auto rounded-lg border border-slate-200">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50"><tr>
                                <th className="px-4 py-3 text-left font-semibold">Source</th>
                                <th className="px-4 py-3 text-left font-semibold">→ Target</th>
                                <th className="px-4 py-3 text-center font-semibold">Exists?</th>
                            </tr></thead>
                            <tbody className="divide-y divide-slate-100">
                                {sourceGroups.map(g => {
                                    const tgt = mapName(g.group_name);
                                    const exists = targetGroupNames.has(tgt);
                                    return (
                                        <tr key={g.group_name} className="hover:bg-slate-50/80">
                                            <td className="px-4 py-3 font-mono text-xs">{g.group_name}</td>
                                            <td className="px-4 py-3 font-mono text-xs text-blue-700">{tgt}</td>
                                            <td className="px-4 py-3 text-center">
                                                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${exists ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                    {exists ? 'Yes' : 'No'}
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                    <p className="mt-3 text-xs text-slate-500">Users: <strong>{users.length}</strong> | Missing groups: <strong>{missingGroups.length}</strong></p>
                    <WizardNav onBack={() => setStep(0)} onNext={() => setStep(2)} nextLabel="Review Users" />
                </Card>
            )}

            {step === 2 && (
                <Card title={`Users to Reassign (${users.length})`} icon={Users}>
                    <div className="overflow-x-auto rounded-lg border border-slate-200">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50"><tr>
                                <th className="px-4 py-3 text-left font-semibold">#</th>
                                <th className="px-4 py-3 text-left font-semibold">Name</th>
                                <th className="px-4 py-3 text-left font-semibold">Login</th>
                                <th className="px-4 py-3 text-left font-semibold">Current</th>
                                <th className="px-4 py-3 text-left font-semibold">→ New</th>
                            </tr></thead>
                            <tbody className="divide-y divide-slate-100">
                                {users.map((u, i) => (
                                    <tr key={u.r_object_id} className="hover:bg-slate-50/80">
                                        <td className="px-4 py-3 text-slate-500">{i + 1}</td>
                                        <td className="px-4 py-3 font-medium">{u.object_name}</td>
                                        <td className="px-4 py-3 text-slate-500">{u.user_login_name}</td>
                                        <td className="px-4 py-3 text-slate-500">{u.department_name}</td>
                                        <td className="px-4 py-3 text-blue-700 font-medium">{targetName || targetCode.toUpperCase()}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <WizardNav onBack={() => setStep(1)} onNext={() => setStep(missingGroups.length > 0 ? 3 : 4)}
                        nextLabel={missingGroups.length > 0 ? 'Create Missing Groups' : 'Move Members'} />
                </Card>
            )}

            {step === 3 && (
                <Card title={`Create Missing Target Groups (${missingGroups.length})`} icon={Plus}>
                    <div className="overflow-x-auto rounded-lg border border-slate-200">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50"><tr>
                                <th className="px-4 py-3 text-left font-semibold">Group to Create</th>
                                <th className="px-4 py-3 text-left font-semibold">Based On</th>
                                <th className="px-4 py-3 text-center font-semibold">Action</th>
                                <th className="px-4 py-3 text-center font-semibold">Status</th>
                            </tr></thead>
                            <tbody className="divide-y divide-slate-100">
                                {missingGroups.map(g => {
                                    const st = createStatus[g.group_name] || 'pending';
                                    return (
                                        <tr key={g.group_name}>
                                            <td className="px-4 py-3 font-mono text-xs text-blue-700">{mapName(g.group_name)}</td>
                                            <td className="px-4 py-3 font-mono text-xs text-slate-500">{g.group_name}</td>
                                            <td className="px-4 py-3 text-center">
                                                {st !== 'done' && st !== 'processing' ? (
                                                    <button onClick={() => handleCreateMissing(g.group_name)}
                                                        className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700">Create</button>
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
                    <WizardNav onBack={() => setStep(2)} onNext={() => setStep(4)} nextLabel="Move Members" />
                </Card>
            )}

            {step === 4 && (
                <Card title="Move Members (Group by Group)" icon={ArrowRightLeft}>
                    <GroupMembersGrid groups={sourceGroups} oldCode={sourceCode} newCode={targetCode} mapName={mapName} api={api} onToast={onToast} />
                    <WizardNav onBack={() => setStep(missingGroups.length > 0 ? 3 : 2)} onNext={() => setStep(5)} nextLabel="Update Users" />
                </Card>
            )}

            {step === 5 && (
                <Card title={`Update User Profiles (${users.length})`} icon={Users}>
                    <button onClick={handleUpdateAllUsers}
                        className="mb-4 px-4 py-2 bg-[#0A66C2] text-white rounded-lg text-xs font-semibold hover:bg-[#094d92]">
                        Update All ({users.filter(u => userStatus[u.r_object_id] !== 'done').length} remaining)
                    </button>
                    <div className="overflow-x-auto rounded-lg border border-slate-200">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50"><tr>
                                <th className="px-4 py-3 text-left font-semibold">#</th>
                                <th className="px-4 py-3 text-left font-semibold">User</th>
                                <th className="px-4 py-3 text-left font-semibold">Current</th>
                                <th className="px-4 py-3 text-left font-semibold">→ New</th>
                                <th className="px-4 py-3 text-center font-semibold">Action</th>
                                <th className="px-4 py-3 text-center font-semibold">Status</th>
                            </tr></thead>
                            <tbody className="divide-y divide-slate-100">
                                {users.map((u, i) => {
                                    const st = userStatus[u.r_object_id] || 'pending';
                                    return (
                                        <tr key={u.r_object_id} className={st === 'done' ? 'bg-green-50/50' : ''}>
                                            <td className="px-4 py-3 text-slate-500">{i + 1}</td>
                                            <td className="px-4 py-3 font-medium">{u.object_name}</td>
                                            <td className="px-4 py-3 text-slate-500">{u.department_name}</td>
                                            <td className="px-4 py-3 text-blue-700">{targetName || targetCode.toUpperCase()}</td>
                                            <td className="px-4 py-3 text-center">
                                                {st !== 'done' && st !== 'processing' ? (
                                                    <button onClick={() => handleUpdateUser(u)}
                                                        className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs font-semibold">Update</button>
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
                    <WizardNav onBack={() => setStep(4)} onNext={() => setStep(6)} nextLabel="Verify" />
                </Card>
            )}

            {step === 6 && (
                <Card title="Merge Verification" icon={CheckCircle2}>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        {[
                            { val: sourceGroups.length, label: 'Groups Processed', color: 'text-[#0A66C2]' },
                            { val: movedCount, label: 'Users Updated', color: 'text-green-600' },
                            { val: missingGroups.length, label: 'Groups Created', color: 'text-purple-600' },
                            { val: failedCount, label: 'Failures', color: 'text-red-600' },
                        ].map(s => (
                            <div key={s.label} className="text-center p-4 bg-slate-50 rounded-xl">
                                <div className={`text-2xl font-bold ${s.color}`}>{s.val}</div>
                                <div className="text-xs text-slate-500 mt-1">{s.label}</div>
                            </div>
                        ))}
                    </div>
                    <div className="p-4 bg-green-50 border border-green-200 rounded-xl text-green-800 text-sm flex items-center gap-2">
                        <CheckCircle2 size={16} />
                        Merge of <strong>{sourceCode.toUpperCase()}</strong> into <strong>{targetCode.toUpperCase()}</strong> steps completed. Old groups preserved (empty).
                    </div>
                    <WizardNav onBack={() => setStep(5)} showNext={false} />
                </Card>
            )}
        </div>
    );
};

const InputField = ({ label, value, onChange, placeholder, className = '' }) => (
    <div className={className}>
        <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
        <input type="text" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
            className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-[#0A66C2] focus:outline-none" />
    </div>
);

export default MergeWizard;
