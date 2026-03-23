import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import {
    FolderOpen, FileText, Layers, Building2, MapPin, Tag,
    CheckCircle2, AlertCircle, X, Loader2, Plus, Hash, RefreshCw, Trash2
} from 'lucide-react';
import { getDepartments, getLocations } from '../data/nabardMetadata.js';

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
            <button onClick={onDismiss}><X size={16} /></button>
        </div>
    );
};

// ─── Shared helpers ───────────────────────────────────────────────────────────
const inputCls = (err) =>
    `w-full px-4 py-2.5 border rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#0A66C2] ${
        err ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white hover:border-slate-300'
    }`;

const selectCls = (err, disabled) => disabled
    ? 'w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-100 text-slate-400 cursor-not-allowed appearance-none pr-10'
    : `w-full px-4 py-2.5 border rounded-xl text-sm appearance-none pr-10 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#0A66C2] transition-all cursor-pointer ${
        err ? 'border-red-300 bg-red-50' : 'border-slate-200 bg-white hover:border-slate-300'
    }`;

const ChevronDown = ({ disabled }) => (
    <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
        <svg className={`w-4 h-4 ${disabled ? 'text-slate-300' : 'text-slate-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
    </div>
);

const FieldLabel = ({ icon: Icon, label, required }) => (
    <label className="block text-sm font-medium text-slate-700 mb-1.5">
        <span className="flex items-center gap-1.5">
            <Icon size={14} className="text-slate-400" />
            {label}
            {required && <span className="text-red-400">*</span>}
            {!required && <span className="text-xs font-normal text-slate-400">(optional)</span>}
        </span>
    </label>
);

const FieldError = ({ msg }) => msg
    ? <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={12} />{msg}</p>
    : null;

// ─── Existing File Numbers List ───────────────────────────────────────────────
const FileNumberList = ({ hoRo, deptShortCode, roShortCode, refreshKey, onToast }) => {
    const [items, setItems]         = useState([]);
    const [loading, setLoading]     = useState(false);
    const [error, setError]         = useState(null);
    // confirmId = r_object_id of the row awaiting delete confirmation; null otherwise
    const [confirmId, setConfirmId] = useState(null);
    const [deleting, setDeleting]   = useState(null); // r_object_id being deleted

    const canFetch = hoRo && deptShortCode && (hoRo === 'HO' || roShortCode);

    const loadList = useCallback(async () => {
        if (!canFetch) return;
        setLoading(true);
        setError(null);
        try {
            const params = { hoRo, deptShortCode };
            if (roShortCode) params.roShortCode = roShortCode;
            const res = await api.get('/metadata/file-numbers', { params });
            setItems(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Failed to load');
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, [hoRo, deptShortCode, roShortCode, canFetch]);

    useEffect(() => { loadList(); }, [loadList, refreshKey]);

    const handleDelete = async (item) => {
        setDeleting(item.r_object_id);
        setConfirmId(null);
        try {
            await api.delete(`/metadata/file-numbers/${item.r_object_id}`);
            onToast({ type: 'success', message: `File number '${item.object_name}' deleted.` });
            setItems(prev => prev.filter(i => i.r_object_id !== item.r_object_id));
        } catch (err) {
            const msg = err.response?.data?.message || err.message || 'Delete failed';
            onToast({ type: 'error', message: msg });
        } finally {
            setDeleting(null);
        }
    };

    if (!canFetch) return null;

    return (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Hash size={14} className="text-slate-400" />
                    <span className="text-sm font-semibold text-slate-700">Existing File Numbers</span>
                    {!loading && (
                        <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 text-xs font-semibold rounded-full">
                            {items.length}
                        </span>
                    )}
                </div>
                <button onClick={loadList} disabled={loading}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200 transition-all disabled:opacity-40">
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                </button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center gap-2 py-10 text-slate-400">
                    <Loader2 size={18} className="animate-spin text-indigo-500" />
                    <span className="text-sm">Loading…</span>
                </div>
            ) : error ? (
                <div className="px-5 py-4 text-sm text-red-600 flex items-center gap-2">
                    <AlertCircle size={15} /> {error}
                </div>
            ) : items.length === 0 ? (
                <div className="px-5 py-8 text-center text-sm text-slate-400">
                    No file numbers found for this selection
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 w-8">#</th>
                                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">File Number</th>
                                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Description</th>
                                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Dept Code</th>
                                {hoRo !== 'HO' && (
                                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Location Code</th>
                                )}
                                <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-500 w-24">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {items.map((item, idx) => {
                                const isConfirming = confirmId === item.r_object_id;
                                const isDeleting   = deleting  === item.r_object_id;
                                return (
                                    <tr key={item.r_object_id || idx}
                                        className={`transition-colors ${isConfirming ? 'bg-red-50' : 'hover:bg-indigo-50/30'}`}>
                                        <td className="px-4 py-2.5 text-slate-400 text-xs font-mono">{idx + 1}</td>
                                        <td className="px-4 py-2.5 font-mono text-sm font-semibold text-slate-800">
                                            {item.object_name || '—'}
                                        </td>
                                        <td className="px-4 py-2.5 text-slate-600 text-xs max-w-xs truncate">
                                            {item.description || '—'}
                                        </td>
                                        <td className="px-4 py-2.5">
                                            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-mono">
                                                {item.dept_short_code || '—'}
                                            </span>
                                        </td>
                                        {hoRo !== 'HO' && (
                                            <td className="px-4 py-2.5">
                                                <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs font-mono">
                                                    {item.ro_short_code || '—'}
                                                </span>
                                            </td>
                                        )}
                                        <td className="px-4 py-2.5 text-center">
                                            {isDeleting ? (
                                                <Loader2 size={15} className="animate-spin text-red-400 mx-auto" />
                                            ) : isConfirming ? (
                                                <div className="flex items-center justify-center gap-1">
                                                    <button onClick={() => handleDelete(item)}
                                                        className="px-2 py-1 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-all">
                                                        Delete
                                                    </button>
                                                    <button onClick={() => setConfirmId(null)}
                                                        className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium rounded-lg transition-all">
                                                        Cancel
                                                    </button>
                                                </div>
                                            ) : (
                                                <button onClick={() => setConfirmId(item.r_object_id)}
                                                    className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-all"
                                                    title="Remove file number">
                                                    <Trash2 size={15} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

// ─── File Number Tab ──────────────────────────────────────────────────────────
const EMPTY_FN = { officeType: '', location: '', department: '', shortCode: '', locationShortCode: '', fileNumber: '', description: '' };

const FileNumberTab = ({ onToast }) => {
    const [form, setForm]         = useState(EMPTY_FN);
    const [errors, setErrors]     = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    const isHO            = form.officeType === 'HO';
    const locationOptions = getLocations(form.officeType);
    const deptOptions     = getDepartments(form.officeType, form.location);

    const handleOfficeType = (val) => {
        setForm({ ...EMPTY_FN, officeType: val });
        setErrors({});
    };

    const handleLocation = (val) => {
        const locObj = locationOptions.find(l => l.location === val);
        setForm(f => ({ ...f, location: val, locationShortCode: locObj?.shortCode || '', department: '', shortCode: '' }));
        if (errors.location) setErrors(e => ({ ...e, location: undefined }));
    };

    const handleDept = (val) => {
        const deptObj = deptOptions.find(d => d.name === val);
        setForm(f => ({ ...f, department: val, shortCode: deptObj?.shortCode || '' }));
        if (errors.department) setErrors(e => ({ ...e, department: undefined }));
    };

    const set = (field, val) => {
        setForm(f => ({ ...f, [field]: val }));
        if (errors[field]) setErrors(e => ({ ...e, [field]: undefined }));
    };

    const validate = () => {
        const e = {};
        if (!form.officeType)        e.officeType  = 'Office type is required';
        if (!isHO && !form.location) e.location    = 'Location is required';
        if (!form.department)        e.department  = 'Department is required';
        if (!form.fileNumber.trim()) e.fileNumber  = 'File number is required';
        return e;
    };

    const handleSubmit = async (ev) => {
        ev.preventDefault();
        const e = validate();
        if (Object.keys(e).length) { setErrors(e); return; }
        setSubmitting(true);
        try {
            const res = await api.post('/metadata/file-numbers', {
                object_name:     form.fileNumber.trim(),
                ho_ro:           form.officeType,
                dept_short_code: form.shortCode,
                ro_short_code:   isHO ? '' : form.locationShortCode,
                description:     form.description.trim(),
            });
            onToast({ type: 'success', message: res.data?.message || 'File number created successfully' });
            setForm(f => ({ ...f, fileNumber: '', description: '' }));
            setErrors({});
            setRefreshKey(k => k + 1);   // refresh list
        } catch (err) {
            const msg = err.response?.data?.message || err.message || 'Failed to create file number';
            onToast({ type: 'error', message: msg });
        } finally {
            setSubmitting(false);
        }
    };

    // List is shown when department is selected (all required context is available)
    const listReady = form.officeType && form.shortCode && (isHO || form.locationShortCode);

    return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
            {/* ── Left: creation form ── */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-slate-50 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-sm shrink-0">
                        <FileText size={17} className="text-white" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-slate-900">Create File Number</p>
                        <p className="text-xs text-slate-500">
                            Creates a <code className="font-mono bg-slate-100 px-1 rounded">cms_file_number</code> under /ECM CONFIG/File Number
                        </p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Office Type */}
                    <div>
                        <FieldLabel icon={Building2} label="Office Type" required />
                        <div className="relative">
                            <select value={form.officeType} onChange={e => handleOfficeType(e.target.value)}
                                className={selectCls(errors.officeType, false)}>
                                <option value="">— Select office type —</option>
                                <option value="HO">HO — Head Office</option>
                                <option value="RO">RO — Regional Office</option>
                                <option value="TE">TE — Training Establishment</option>
                            </select>
                            <ChevronDown />
                        </div>
                        <FieldError msg={errors.officeType} />
                    </div>

                    {/* Location */}
                    <div>
                        <FieldLabel icon={MapPin} label="Location" required={!isHO} />
                        <div className="relative">
                            {isHO ? (
                                <>
                                    <select disabled className={selectCls(null, true)}>
                                        <option>— Not applicable for HO —</option>
                                    </select>
                                    <ChevronDown disabled />
                                </>
                            ) : (
                                <>
                                    <select value={form.location}
                                        onChange={e => handleLocation(e.target.value)}
                                        disabled={!form.officeType}
                                        className={selectCls(errors.location, !form.officeType)}>
                                        <option value="">— Select location —</option>
                                        {locationOptions.map(l => (
                                            <option key={l.location} value={l.location}>{l.location}</option>
                                        ))}
                                    </select>
                                    <ChevronDown disabled={!form.officeType} />
                                </>
                            )}
                        </div>
                        <FieldError msg={errors.location} />
                    </div>

                    {/* Department */}
                    <div>
                        <FieldLabel icon={Layers} label="Department" required />
                        {(() => {
                            const disabled = !form.officeType || (!isHO && !form.location);
                            return (
                                <>
                                    <div className="relative">
                                        <select value={form.department}
                                            onChange={e => handleDept(e.target.value)}
                                            disabled={disabled}
                                            className={selectCls(errors.department, disabled)}>
                                            <option value="">— Select department —</option>
                                            {deptOptions.map(d => (
                                                <option key={d.shortCode} value={d.name}>{d.name}</option>
                                            ))}
                                        </select>
                                        <ChevronDown disabled={disabled} />
                                    </div>
                                    {form.shortCode && (
                                        <p className="mt-1 text-xs text-slate-400 flex items-center gap-1">
                                            <Tag size={11} />Short code: <span className="font-mono text-slate-600">{form.shortCode}</span>
                                        </p>
                                    )}
                                </>
                            );
                        })()}
                        <FieldError msg={errors.department} />
                    </div>

                    {/* File Number */}
                    <div>
                        <FieldLabel icon={FileText} label="File Number" required />
                        <input type="text" value={form.fileNumber}
                            onChange={e => set('fileNumber', e.target.value)}
                            placeholder="e.g. SMF-10"
                            className={`${inputCls(errors.fileNumber)} font-mono`} />
                        <FieldError msg={errors.fileNumber} />
                    </div>

                    {/* Description */}
                    <div>
                        <FieldLabel icon={FolderOpen} label="Description" required={false} />
                        <textarea value={form.description}
                            onChange={e => set('description', e.target.value)}
                            placeholder="e.g. Jammu & Kashmir - State Master File (SMF)"
                            rows={3}
                            className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#0A66C2] hover:border-slate-300 bg-white resize-none transition-all" />
                    </div>

                    {/* DQL preview */}
                    {form.officeType && form.department && form.fileNumber && (
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-600 space-y-0.5">
                            <p className="font-sans text-slate-400 font-semibold mb-1">DQL Preview</p>
                            <p>create cms_file_number objects</p>
                            <p>&nbsp;&nbsp;set object_name='{form.fileNumber.trim()}'</p>
                            <p>&nbsp;&nbsp;set ho_ro='{form.officeType}'</p>
                            <p>&nbsp;&nbsp;set dept_short_code='{form.shortCode}'</p>
                            {!isHO && form.location && (
                                <p>&nbsp;&nbsp;set ro_short_code='{form.locationShortCode}'</p>
                            )}
                            {form.description && <p>&nbsp;&nbsp;set description='{form.description.trim()}'</p>}
                            <p>&nbsp;&nbsp;link '/ECM CONFIG/File Number';</p>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                        <button type="button"
                            onClick={() => { setForm(EMPTY_FN); setErrors({}); }}
                            className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg hover:bg-white transition-all">
                            Reset
                        </button>
                        <button type="submit" disabled={submitting}
                            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl shadow-sm transition-all">
                            {submitting ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                            {submitting ? 'Creating…' : 'Create File Number'}
                        </button>
                    </div>
                </form>
            </div>

            {/* ── Right: existing file numbers list ── */}
            {listReady ? (
                <FileNumberList
                    hoRo={form.officeType}
                    deptShortCode={form.shortCode}
                    roShortCode={isHO ? '' : form.locationShortCode}
                    refreshKey={refreshKey}
                    onToast={onToast}
                />
            ) : (
                <div className="flex flex-col items-center justify-center py-20 text-slate-300">
                    <Hash size={36} className="mb-3" />
                    <p className="text-sm text-slate-400">Select office type and department</p>
                    <p className="text-xs text-slate-300 mt-1">Existing file numbers will appear here</p>
                </div>
            )}
        </div>
    );
};

// ─── Case section — inner tabs ────────────────────────────────────────────────
const CASE_TABS = [
    { id: 'filenumber', label: 'File Number', icon: FileText },
];

const CaseSection = ({ onToast }) => {
    const [activeTab, setActiveTab] = useState('filenumber');
    return (
        <div className="space-y-4">
            <div className="flex gap-1 bg-slate-100 p-1 rounded-xl w-fit">
                {CASE_TABS.map(t => (
                    <button key={t.id} onClick={() => setActiveTab(t.id)}
                        className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                            activeTab === t.id
                                ? 'bg-white text-indigo-700 shadow-sm'
                                : 'text-slate-500 hover:text-slate-700'
                        }`}>
                        <t.icon size={15} />
                        {t.label}
                    </button>
                ))}
            </div>
            {activeTab === 'filenumber' && <FileNumberTab onToast={onToast} />}
        </div>
    );
};

// ─── Digidak section (placeholder) ───────────────────────────────────────────
const DigidakSection = () => (
    <div className="flex flex-col items-center justify-center py-24 text-slate-400">
        <FolderOpen size={40} className="mb-3 text-slate-200" />
        <p className="text-base font-medium text-slate-500">Digidak</p>
        <p className="text-sm mt-1">Coming soon</p>
    </div>
);

// ─── Top-level tabs ───────────────────────────────────────────────────────────
const TOP_TABS = [
    { id: 'case',    label: 'Case',    icon: FolderOpen },
    { id: 'digidak', label: 'Digidak', icon: Layers },
];

// ─── MetadataPage ─────────────────────────────────────────────────────────────
const MetadataPage = () => {
    const [activeTab, setActiveTab] = useState('case');
    const [toast, setToast]         = useState(null);

    return (
        <div className="flex flex-col h-full bg-slate-50">
            <Toast toast={toast} onDismiss={() => setToast(null)} />

            {/* Page header */}
            <div className="bg-white border-b border-slate-200 px-6 py-4">
                <h1 className="text-lg font-bold text-slate-900">Metadata</h1>
                <p className="text-xs text-slate-500 mt-0.5">Manage ECM configuration metadata objects</p>
            </div>

            {/* Top tab bar */}
            <div className="bg-white border-b border-slate-200 px-6">
                <div className="flex gap-0">
                    {TOP_TABS.map(t => (
                        <button key={t.id} onClick={() => setActiveTab(t.id)}
                            className={`flex items-center gap-2 px-4 py-3.5 text-sm font-medium border-b-2 transition-all ${
                                activeTab === t.id
                                    ? 'border-indigo-600 text-indigo-700'
                                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                            }`}>
                            <t.icon size={15} />
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
                {activeTab === 'case'    && <CaseSection onToast={setToast} />}
                {activeTab === 'digidak' && <DigidakSection />}
            </div>
        </div>
    );
};

export default MetadataPage;
