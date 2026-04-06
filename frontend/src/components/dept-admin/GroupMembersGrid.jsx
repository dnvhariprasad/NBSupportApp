import { useState } from 'react';
import { ArrowRight, ChevronRight, Loader2 } from 'lucide-react';
import { Badge } from './shared';

const GroupMembersGrid = ({ groups, oldCode, newCode, mapName, api, onToast }) => {
    const [expandedGroup, setExpandedGroup] = useState(null);
    const [groupMembers, setGroupMembers] = useState({});
    const [loadingMembers, setLoadingMembers] = useState(null);
    const [moveStatus, setMoveStatus] = useState({});

    const loadMembers = async (groupName) => {
        if (expandedGroup === groupName) { setExpandedGroup(null); return; }
        setLoadingMembers(groupName);
        try {
            const data = await api.fetchGroupMembers(groupName);
            setGroupMembers(prev => ({ ...prev, [groupName]: data }));
            setExpandedGroup(groupName);
        } catch {
            onToast({ type: 'error', message: 'Failed to load members' });
        } finally {
            setLoadingMembers(null);
        }
    };

    const handleMove = async (sourceGroup, memberName, memberType) => {
        const targetGroup = mapName(sourceGroup);
        const key = `${sourceGroup}:${memberName}`;
        setMoveStatus(prev => ({ ...prev, [key]: 'processing' }));
        try {
            const res = await api.moveMember(sourceGroup, targetGroup, memberName, memberType);
            setMoveStatus(prev => ({ ...prev, [key]: res?.success ? 'done' : 'failed' }));
            if (res?.success) onToast({ type: 'success', message: res.message });
            else onToast({ type: 'error', message: res?.message || 'Move failed' });
        } catch {
            setMoveStatus(prev => ({ ...prev, [key]: 'failed' }));
            onToast({ type: 'error', message: 'Move failed' });
        }
    };

    const handleMoveAll = async (groupName) => {
        const members = groupMembers[groupName];
        if (!members) return;
        const all = [...(members.users || []), ...(members.groups || [])];
        for (const m of all) {
            const key = `${groupName}:${m.name}`;
            if (moveStatus[key] !== 'done') await handleMove(groupName, m.name, m.type);
        }
    };

    return (
        <div className="space-y-4">
            {groups.map(g => {
                const members = groupMembers[g.group_name];
                const isExpanded = expandedGroup === g.group_name;
                const allMembers = members ? [...(members.users || []), ...(members.groups || [])] : [];
                const movedCount = allMembers.filter(m => moveStatus[`${g.group_name}:${m.name}`] === 'done').length;

                return (
                    <div key={g.group_name} className="border border-slate-200 rounded-xl overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 bg-slate-50 cursor-pointer hover:bg-slate-100"
                            onClick={() => loadMembers(g.group_name)}>
                            <div className="flex items-center gap-2 text-xs">
                                <span className="font-mono text-slate-800">{g.group_name}</span>
                                <ArrowRight size={14} className="text-slate-400" />
                                <span className="font-mono text-blue-700">{mapName(g.group_name)}</span>
                            </div>
                            <div className="flex items-center gap-2">
                                {members && <span className="text-xs text-slate-500">{movedCount}/{allMembers.length} moved</span>}
                                {loadingMembers === g.group_name && <Loader2 size={14} className="animate-spin text-blue-500" />}
                                <ChevronRight size={14} className={`text-slate-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`} />
                            </div>
                        </div>

                        {isExpanded && members && (
                            <div className="p-4 border-t border-slate-200">
                                {allMembers.length > 0 && (
                                    <button onClick={() => handleMoveAll(g.group_name)}
                                        className="mb-3 px-3 py-1.5 bg-[#0A66C2] text-white rounded-lg text-xs font-semibold hover:bg-[#094d92]">
                                        Move All ({allMembers.length - movedCount} remaining)
                                    </button>
                                )}
                                {allMembers.length === 0 ? (
                                    <p className="text-sm text-slate-400">No members in this group</p>
                                ) : (
                                    <table className="w-full text-sm">
                                        <thead><tr className="text-left text-xs text-slate-500">
                                            <th className="pb-2">Member</th>
                                            <th className="pb-2">Type</th>
                                            <th className="pb-2 text-center">Action</th>
                                            <th className="pb-2 text-center">Status</th>
                                        </tr></thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {allMembers.map(m => {
                                                const key = `${g.group_name}:${m.name}`;
                                                const st = moveStatus[key] || 'pending';
                                                return (
                                                    <tr key={key} className={st === 'done' ? 'bg-green-50/50' : ''}>
                                                        <td className="py-2 text-slate-800">{m.name}</td>
                                                        <td className="py-2">
                                                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                                                m.type === 'user' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                                                            }`}>{m.type}</span>
                                                        </td>
                                                        <td className="py-2 text-center">
                                                            {st !== 'done' && st !== 'processing' ? (
                                                                <button onClick={() => handleMove(g.group_name, m.name, m.type)}
                                                                    className="px-3 py-1 bg-indigo-600 text-white rounded-lg text-xs font-semibold hover:bg-indigo-700">Move</button>
                                                            ) : st === 'processing' ? (
                                                                <Loader2 size={14} className="animate-spin text-blue-500 mx-auto" />
                                                            ) : null}
                                                        </td>
                                                        <td className="py-2 text-center"><Badge status={st} /></td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                )}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
    );
};

export default GroupMembersGrid;
