import { Check, Loader2, AlertCircle } from 'lucide-react';

/**
 * "Assign New Vertical Head" prompt.
 *
 * Shown when a user who heads a vertical is about to lose that vertical's group,
 * either by being removed from the vertical directly (Verticals screen) or by an
 * office-type / department change that drops the group (Edit Profile). A vertical
 * cannot be left headless, so a replacement must be chosen before the removal runs.
 *
 * Purely presentational — the caller owns the API calls and the queue.
 */
const AssignVerticalHeadModal = ({
    open,
    userName,             // login name of the user losing the head role
    verticalGroup,        // vertical group whose head is being reassigned
    candidates = [],      // [{ name }] users eligible to take over
    selected,
    onSelect,
    onCancel,
    onConfirm,
    busy = false,
    error = null,
    step = null,          // { current, total } when several verticals need a head
}) => {
    if (!open) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm flex flex-col overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-slate-50">
                    <div className="flex items-start justify-between gap-3">
                        <h2 className="text-lg font-bold text-slate-900">Assign New Vertical Head</h2>
                        {step && step.total > 1 && (
                            <span className="shrink-0 mt-1 px-2 py-0.5 rounded-full bg-white border border-slate-200 text-[11px] font-semibold text-slate-500">
                                {step.current} of {step.total}
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                        {userName} is a vertical head. Assign a new head before removing.
                    </p>
                </div>

                {/* Content */}
                <div className="px-6 py-5 space-y-4">
                    {verticalGroup && (
                        <div>
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-1">
                                Vertical
                            </span>
                            <p className="text-sm font-mono text-slate-700 break-all">{verticalGroup}</p>
                        </div>
                    )}

                    <div>
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide block mb-2">
                            Select New Vertical Head <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={selected}
                            onChange={(e) => onSelect(e.target.value)}
                            disabled={busy || candidates.length === 0}
                            className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/20 focus:border-[#0A66C2] bg-white appearance-none cursor-pointer disabled:bg-slate-100 disabled:cursor-not-allowed">
                            <option value="">— Select new head —</option>
                            {candidates.map((u) => (
                                <option key={u.name} value={u.name}>{u.name}</option>
                            ))}
                        </select>
                        {candidates.length === 0 && (
                            <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                No other user belongs to this vertical, so there is nobody to hand it to.
                                Add a member to the vertical first, then retry this change.
                            </p>
                        )}
                    </div>

                    {error && (
                        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                            <AlertCircle size={14} className="text-red-500 mt-0.5 shrink-0" />
                            <p className="text-xs text-red-700">{error}</p>
                        </div>
                    )}

                    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                        <p className="text-xs text-blue-700">
                            <strong>Note:</strong> The selected user will be assigned as the new vertical head
                            before {userName} is removed from the vertical.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-slate-100 bg-slate-50">
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={busy}
                        className="px-4 py-2 text-slate-600 text-sm font-medium hover:bg-slate-200 rounded-lg transition-all disabled:opacity-40">
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={!selected || busy}
                        className="flex items-center gap-2 px-4 py-2 bg-[#0A66C2] hover:bg-[#094d92] disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-lg transition-all">
                        {busy ? (
                            <><Loader2 size={14} className="animate-spin" /> Updating…</>
                        ) : (
                            <><Check size={14} /> Assign Head</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AssignVerticalHeadModal;
