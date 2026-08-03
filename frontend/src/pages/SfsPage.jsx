import { useState, useEffect, useCallback } from 'react';
import api from '../api/axios';
import {
    CheckCircle2, AlertCircle, X, Loader2, Plus, Hash, RefreshCw, Trash2, FileText
} from 'lucide-react';

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

const FieldLabel = ({ label, required }) => (
    <label className="block text-sm font-medium text-slate-700 mb-1.5">
        <span className="flex items-center gap-1.5">
            {label}
            {required && <span className="text-red-400">*</span>}
        </span>
    </label>
);

const FieldError = ({ msg }) => msg
    ? <p className="mt-1 text-xs text-red-500 flex items-center gap-1"><AlertCircle size={12} />{msg}</p>
    : null;

// ─── Existing Document Types List ────────────────────────────────────────────
const DocumentTypeList = ({ refreshKey, onToast }) => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [confirmId, setConfirmId] = useState(null);
    const [deleting, setDeleting] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [editValues, setEditValues] = useState({ document_type: '', document_category: '', serial_number: '' });
    const [saving, setSaving] = useState(false);

    const loadList = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.get('/sfs/document-types');
            setItems(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Failed to load');
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadList(); }, [loadList, refreshKey]);

    const startEdit = (item) => {
        setEditingId(item.r_object_id);
        setEditValues({
            document_type: item.document_type || '',
            document_category: item.document_category || '',
            serial_number: item.serial_number || ''
        });
        setConfirmId(null);
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditValues({ document_type: '', document_category: '', serial_number: '' });
    };

    const handleSave = async (item) => {
        setSaving(true);
        try {
            await api.put(`/sfs/document-types/${item.r_object_id}`, {
                document_type: editValues.document_type.trim(),
                document_category: editValues.document_category.trim(),
                serial_number: editValues.serial_number.trim(),
            });
            onToast({ type: 'success', message: 'Document type updated.' });
            setItems(prev => prev.map(i => i.r_object_id === item.r_object_id
                ? { ...i, ...editValues }
                : i));
            cancelEdit();
        } catch (err) {
            onToast({ type: 'error', message: err.response?.data?.message || err.message });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (item) => {
        setDeleting(item.r_object_id);
        setConfirmId(null);
        try {
            await api.delete(`/sfs/document-types/${item.r_object_id}`);
            onToast({ type: 'success', message: 'Document type deleted.' });
            setItems(items.filter(i => i.r_object_id !== item.r_object_id));
        } catch (err) {
            onToast({ type: 'error', message: err.response?.data?.message || err.message });
        } finally {
            setDeleting(null);
        }
    };

    return (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Hash size={14} className="text-slate-400" />
                    <span className="text-sm font-semibold text-slate-700">Existing Document Types</span>
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
                    No document types found
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 w-8">#</th>
                                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Document Type</th>
                                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Document Category</th>
                                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Serial Number</th>
                                <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-500">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {items.map((item, idx) => {
                                const isConfirming = confirmId === item.r_object_id;
                                const isDeleting = deleting === item.r_object_id;
                                const isEditing = editingId === item.r_object_id;
                                const rowBg = isEditing ? 'bg-blue-50' : isConfirming ? 'bg-green-50' : 'hover:bg-indigo-50/30';
                                return (
                                    <tr key={item.r_object_id || idx} className={`transition-colors ${rowBg}`}>
                                        <td className="px-4 py-2.5 text-slate-400 text-xs font-mono">{idx + 1}</td>
                                        <td className="px-4 py-2.5 text-slate-800 text-sm">
                                            {isEditing ? (
                                                <input value={editValues.document_type}
                                                    onChange={e => setEditValues(v => ({ ...v, document_type: e.target.value }))}
                                                    className="w-full px-2 py-1 border border-blue-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white" />
                                            ) : (item.document_type || '—')}
                                        </td>
                                        <td className="px-4 py-2.5 text-slate-800 text-sm">
                                            {isEditing ? (
                                                <input value={editValues.document_category}
                                                    onChange={e => setEditValues(v => ({ ...v, document_category: e.target.value }))}
                                                    className="w-full px-2 py-1 border border-blue-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white" />
                                            ) : (item.document_category || '—')}
                                        </td>
                                        <td className="px-4 py-2.5 text-slate-800 text-sm">
                                            {isEditing ? (
                                                <input value={editValues.serial_number}
                                                    onChange={e => setEditValues(v => ({ ...v, serial_number: e.target.value }))}
                                                    className="w-full px-2 py-1 border border-blue-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white" />
                                            ) : (item.serial_number || '—')}
                                        </td>
                                        <td className="px-4 py-2.5 text-center">
                                            <div className="flex items-center justify-center gap-1.5">
                                                {isEditing ? (
                                                    <>
                                                        <button onClick={() => handleSave(item)} disabled={saving}
                                                            className="p-1 rounded text-green-600 hover:bg-green-50 disabled:opacity-40 transition-colors"
                                                            title="Save">
                                                            {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                                                        </button>
                                                        <button onClick={cancelEdit} disabled={saving}
                                                            className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition-colors"
                                                            title="Cancel">
                                                            <X size={16} />
                                                        </button>
                                                    </>
                                                ) : isConfirming ? (
                                                    <>
                                                        <button onClick={() => handleDelete(item)} disabled={isDeleting}
                                                            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded hover:bg-red-100 disabled:opacity-40 transition-colors"
                                                            title="Confirm delete">
                                                            {isDeleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                                                            Delete
                                                        </button>
                                                        <button onClick={() => setConfirmId(null)} disabled={isDeleting}
                                                            className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition-colors"
                                                            title="Cancel">
                                                            <X size={16} />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button onClick={() => setConfirmId(item.r_object_id)}
                                                            className="p-1 rounded text-red-500 hover:bg-red-50 transition-colors"
                                                            title="Delete">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
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

// ─── Document Type Tab ────────────────────────────────────────────────────────
const DocumentTypeTab = ({ onToast }) => {
    const EMPTY_FORM = { document_type: '', document_category: '', serial_number: '' };
    const [form, setForm] = useState(EMPTY_FORM);
    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    const set = (field, val) => {
        setForm(f => ({ ...f, [field]: val }));
        if (errors[field]) setErrors(e => ({ ...e, [field]: undefined }));
    };

    const validate = () => {
        const e = {};
        if (!form.document_type.trim()) e.document_type = 'Document Type is required';
        if (!form.document_category.trim()) e.document_category = 'Document Category is required';
        if (!form.serial_number.trim()) e.serial_number = 'Serial Number is required';
        return e;
    };

    const handleSubmit = async (ev) => {
        ev.preventDefault();
        const e = validate();
        if (Object.keys(e).length) { setErrors(e); return; }
        setSubmitting(true);
        try {
            const res = await api.post('/sfs/document-types', {
                document_type: form.document_type.trim(),
                document_category: form.document_category.trim(),
                serial_number: form.serial_number.trim(),
            });
            onToast({ type: 'success', message: res.data?.message || 'Document type created successfully' });
            setForm(EMPTY_FORM);
            setErrors({});
            setRefreshKey(k => k + 1);
        } catch (err) {
            onToast({ type: 'error', message: err.response?.data?.message || err.message });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
            {/* Left: creation form */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-slate-50 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-sm shrink-0">
                        <FileText size={17} className="text-white" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-slate-900">Create Document Type</p>
                        <p className="text-xs text-slate-500">
                            Creates a <code className="font-mono bg-slate-100 px-1 rounded">cms_sfs_metadata</code> under /SFS Config/Document Type
                        </p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Document Type */}
                    <div>
                        <FieldLabel label="Document Type" required />
                        <input type="text" value={form.document_type}
                            onChange={e => set('document_type', e.target.value)}
                            placeholder="e.g. DocType1"
                            className={inputCls(errors.document_type)} />
                        <FieldError msg={errors.document_type} />
                    </div>

                    {/* Document Category */}
                    <div>
                        <FieldLabel label="Document Category" required />
                        <input type="text" value={form.document_category}
                            onChange={e => set('document_category', e.target.value)}
                            placeholder="e.g. DocCatg1"
                            className={inputCls(errors.document_category)} />
                        <FieldError msg={errors.document_category} />
                    </div>

                    {/* Serial Number */}
                    <div>
                        <FieldLabel label="Serial Number" required />
                        <input type="text" value={form.serial_number}
                            onChange={e => set('serial_number', e.target.value)}
                            placeholder="e.g. 001A"
                            className={inputCls(errors.serial_number)} />
                        <FieldError msg={errors.serial_number} />
                    </div>

                    {/* DQL preview */}
                    {form.document_type && form.document_category && form.serial_number && (
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-600 space-y-0.5">
                            <p className="font-sans text-slate-400 font-semibold mb-1">DQL Preview</p>
                            <p>create cms_sfs_metadata object</p>
                            <p>&nbsp;&nbsp;set document_type='{form.document_type.trim()}'</p>
                            <p>&nbsp;&nbsp;set document_category='{form.document_category.trim()}'</p>
                            <p>&nbsp;&nbsp;set serial_number='{form.serial_number.trim()}'</p>
                            <p>&nbsp;&nbsp;link '/SFS Config/Document Type';</p>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                        <button type="button"
                            onClick={() => { setForm(EMPTY_FORM); setErrors({}); }}
                            disabled={submitting}
                            className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg hover:bg-white transition-all disabled:opacity-40">
                            Reset
                        </button>
                        <button type="submit" disabled={submitting}
                            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl shadow-sm transition-all">
                            {submitting ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                            {submitting ? 'Creating…' : 'Create'}
                        </button>
                    </div>
                </form>
            </div>

            {/* Right: existing list */}
            <DocumentTypeList refreshKey={refreshKey} onToast={onToast} />
        </div>
    );
};

// ─── Existing Document Categories List ────────────────────────────────────────
const DocumentCategoryList = ({ refreshKey, onToast }) => {
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [confirmId, setConfirmId] = useState(null);
    const [deleting, setDeleting] = useState(null);
    const [editingId, setEditingId] = useState(null);
    const [editValues, setEditValues] = useState({ document_type: '', document_category: '', serial_number: '' });
    const [saving, setSaving] = useState(false);

    const loadList = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await api.get('/sfs/document-categories');
            setItems(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            setError(err.response?.data?.message || err.message || 'Failed to load');
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadList(); }, [loadList, refreshKey]);

    const startEdit = (item) => {
        setEditingId(item.r_object_id);
        setEditValues({
            document_type: item.document_type || '',
            document_category: item.document_category || '',
            serial_number: item.serial_number || ''
        });
        setConfirmId(null);
    };

    const cancelEdit = () => {
        setEditingId(null);
        setEditValues({ document_type: '', document_category: '', serial_number: '' });
    };

    const handleSave = async (item) => {
        setSaving(true);
        try {
            await api.put(`/sfs/document-categories/${item.r_object_id}`, {
                document_type: editValues.document_type.trim(),
                document_category: editValues.document_category.trim(),
                serial_number: editValues.serial_number.trim(),
            });
            onToast({ type: 'success', message: 'Document category updated.' });
            setItems(prev => prev.map(i => i.r_object_id === item.r_object_id
                ? { ...i, ...editValues }
                : i));
            cancelEdit();
        } catch (err) {
            onToast({ type: 'error', message: err.response?.data?.message || err.message });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (item) => {
        setDeleting(item.r_object_id);
        setConfirmId(null);
        try {
            await api.delete(`/sfs/document-categories/${item.r_object_id}`);
            onToast({ type: 'success', message: 'Document category deleted.' });
            setItems(items.filter(i => i.r_object_id !== item.r_object_id));
        } catch (err) {
            onToast({ type: 'error', message: err.response?.data?.message || err.message });
        } finally {
            setDeleting(null);
        }
    };

    return (
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Hash size={14} className="text-slate-400" />
                    <span className="text-sm font-semibold text-slate-700">Existing Document Categories</span>
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
                    No document categories found
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500 w-8">#</th>
                                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Document Type</th>
                                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Document Category</th>
                                <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Serial Number</th>
                                <th className="px-4 py-2.5 text-center text-xs font-semibold text-slate-500">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {items.map((item, idx) => {
                                const isConfirming = confirmId === item.r_object_id;
                                const isDeleting = deleting === item.r_object_id;
                                const isEditing = editingId === item.r_object_id;
                                const rowBg = isEditing ? 'bg-blue-50' : isConfirming ? 'bg-green-50' : 'hover:bg-indigo-50/30';
                                return (
                                    <tr key={item.r_object_id || idx} className={`transition-colors ${rowBg}`}>
                                        <td className="px-4 py-2.5 text-slate-400 text-xs font-mono">{idx + 1}</td>
                                        <td className="px-4 py-2.5 text-slate-800 text-sm">
                                            {isEditing ? (
                                                <div className="relative">
                                                    <select value={editValues.document_type}
                                                        onChange={e => setEditValues(v => ({ ...v, document_type: e.target.value }))}
                                                        className={selectCls(false, false)}>
                                                        <option value="">— Select —</option>
                                                    </select>
                                                    <ChevronDown />
                                                </div>
                                            ) : (item.document_type || '—')}
                                        </td>
                                        <td className="px-4 py-2.5 text-slate-800 text-sm">
                                            {isEditing ? (
                                                <input value={editValues.document_category}
                                                    onChange={e => setEditValues(v => ({ ...v, document_category: e.target.value }))}
                                                    className="w-full px-2 py-1 border border-blue-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white" />
                                            ) : (item.document_category || '—')}
                                        </td>
                                        <td className="px-4 py-2.5 text-slate-800 text-sm">
                                            {isEditing ? (
                                                <input value={editValues.serial_number}
                                                    onChange={e => setEditValues(v => ({ ...v, serial_number: e.target.value }))}
                                                    className="w-full px-2 py-1 border border-blue-300 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 bg-white" />
                                            ) : (item.serial_number || '—')}
                                        </td>
                                        <td className="px-4 py-2.5 text-center">
                                            <div className="flex items-center justify-center gap-1.5">
                                                {isEditing ? (
                                                    <>
                                                        <button onClick={() => handleSave(item)} disabled={saving}
                                                            className="p-1 rounded text-green-600 hover:bg-green-50 disabled:opacity-40 transition-colors"
                                                            title="Save">
                                                            {saving ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                                                        </button>
                                                        <button onClick={cancelEdit} disabled={saving}
                                                            className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition-colors"
                                                            title="Cancel">
                                                            <X size={16} />
                                                        </button>
                                                    </>
                                                ) : isConfirming ? (
                                                    <>
                                                        <button onClick={() => handleDelete(item)} disabled={isDeleting}
                                                            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded hover:bg-red-100 disabled:opacity-40 transition-colors"
                                                            title="Confirm delete">
                                                            {isDeleting ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                                                            Delete
                                                        </button>
                                                        <button onClick={() => setConfirmId(null)} disabled={isDeleting}
                                                            className="p-1 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 disabled:opacity-40 transition-colors"
                                                            title="Cancel">
                                                            <X size={16} />
                                                        </button>
                                                    </>
                                                ) : (
                                                    <>
                                                        <button onClick={() => setConfirmId(item.r_object_id)}
                                                            className="p-1 rounded text-red-500 hover:bg-red-50 transition-colors"
                                                            title="Delete">
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </>
                                                )}
                                            </div>
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

// ─── Document Category Tab ────────────────────────────────────────────────────
const DocumentCategoryTab = ({ onToast }) => {
    const EMPTY_FORM = { document_type: '', document_category: '', serial_number: '' };
    const [form, setForm] = useState(EMPTY_FORM);
    const [errors, setErrors] = useState({});
    const [submitting, setSubmitting] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const [documentTypes, setDocumentTypes] = useState([]);
    const [loadingTypes, setLoadingTypes] = useState(false);

    // Fetch document types for dropdown
    useEffect(() => {
        setLoadingTypes(true);
        api.get('/sfs/document-types')
            .then(res => setDocumentTypes(Array.isArray(res.data) ? res.data : []))
            .catch(() => setDocumentTypes([]))
            .finally(() => setLoadingTypes(false));
    }, []);

    const set = (field, val) => {
        setForm(f => ({ ...f, [field]: val }));
        if (errors[field]) setErrors(e => ({ ...e, [field]: undefined }));
    };

    const validate = () => {
        const e = {};
        if (!form.document_type.trim()) e.document_type = 'Document Type is required';
        if (!form.document_category.trim()) e.document_category = 'Document Category is required';
        if (!form.serial_number.trim()) e.serial_number = 'Serial Number is required';
        return e;
    };

    const handleSubmit = async (ev) => {
        ev.preventDefault();
        const e = validate();
        if (Object.keys(e).length) { setErrors(e); return; }
        setSubmitting(true);
        try {
            const res = await api.post('/sfs/document-categories', {
                document_type: form.document_type.trim(),
                document_category: form.document_category.trim(),
                serial_number: form.serial_number.trim(),
            });
            onToast({ type: 'success', message: res.data?.message || 'Document category created successfully' });
            setForm(EMPTY_FORM);
            setErrors({});
            setRefreshKey(k => k + 1);
        } catch (err) {
            onToast({ type: 'error', message: err.response?.data?.message || err.message });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
            {/* Left: creation form */}
            <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-indigo-50 to-slate-50 flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-sm shrink-0">
                        <FileText size={17} className="text-white" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-slate-900">Create Document Category</p>
                        <p className="text-xs text-slate-500">
                            Creates a <code className="font-mono bg-slate-100 px-1 rounded">cms_sfs_metadata</code> under /SFS Config/Document Type
                        </p>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Document Type Dropdown */}
                    <div>
                        <FieldLabel label="Document Type" required />
                        <div className="relative">
                            <select value={form.document_type}
                                onChange={e => set('document_type', e.target.value)}
                                disabled={loadingTypes}
                                className={selectCls(errors.document_type, loadingTypes)}>
                                <option value="">— Select document type —</option>
                                {documentTypes.map(dt => (
                                    <option key={dt.r_object_id} value={dt.document_type}>
                                        {dt.document_type}
                                    </option>
                                ))}
                            </select>
                            <ChevronDown disabled={loadingTypes} />
                        </div>
                        <FieldError msg={errors.document_type} />
                    </div>

                    {/* Document Category */}
                    <div>
                        <FieldLabel label="Document Category" required />
                        <input type="text" value={form.document_category}
                            onChange={e => set('document_category', e.target.value)}
                            placeholder="e.g. DocCatg1"
                            className={inputCls(errors.document_category)} />
                        <FieldError msg={errors.document_category} />
                    </div>

                    {/* Serial Number */}
                    <div>
                        <FieldLabel label="Serial Number" required />
                        <input type="text" value={form.serial_number}
                            onChange={e => set('serial_number', e.target.value)}
                            placeholder="e.g. 002A"
                            className={inputCls(errors.serial_number)} />
                        <FieldError msg={errors.serial_number} />
                    </div>

                    {/* DQL preview */}
                    {form.document_type && form.document_category && form.serial_number && (
                        <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-mono text-slate-600 space-y-0.5">
                            <p className="font-sans text-slate-400 font-semibold mb-1">DQL Preview</p>
                            <p>create cms_sfs_metadata object</p>
                            <p>&nbsp;&nbsp;set document_type='{form.document_type.trim()}'</p>
                            <p>&nbsp;&nbsp;set document_category='{form.document_category.trim()}'</p>
                            <p>&nbsp;&nbsp;set serial_number='{form.serial_number.trim()}'</p>
                            <p>&nbsp;&nbsp;link '/SFS Config/Document Type';</p>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                        <button type="button"
                            onClick={() => { setForm(EMPTY_FORM); setErrors({}); }}
                            disabled={submitting}
                            className="px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg hover:bg-white transition-all disabled:opacity-40">
                            Reset
                        </button>
                        <button type="submit" disabled={submitting}
                            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl shadow-sm transition-all">
                            {submitting ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                            {submitting ? 'Creating…' : 'Create'}
                        </button>
                    </div>
                </form>
            </div>

            {/* Right: existing list */}
            <DocumentCategoryList refreshKey={refreshKey} onToast={onToast} />
        </div>
    );
};

// ─── Top-level SFS page ───────────────────────────────────────────────────────
const SFS_TABS = [
    { id: 'document_type', label: 'Document Type' },
    { id: 'document_category', label: 'Document Category' },
];

const SfsPage = () => {
    const [activeTab, setActiveTab] = useState('document_type');
    const [toast, setToast] = useState(null);

    return (
        <div className="flex flex-col h-full bg-slate-50">
            <Toast toast={toast} onDismiss={() => setToast(null)} />

            {/* Page header */}
            <div className="bg-white border-b border-slate-200 px-6 py-4">
                <h1 className="text-lg font-bold text-slate-900">SFS Configuration</h1>
                <p className="text-xs text-slate-500 mt-0.5">Manage SFS metadata objects</p>
            </div>

            {/* Tab bar */}
            <div className="bg-white border-b border-slate-200 px-6">
                <div className="flex gap-0">
                    {SFS_TABS.map(t => (
                        <button key={t.id} onClick={() => setActiveTab(t.id)}
                            className={`flex items-center gap-2 px-4 py-3.5 text-sm font-medium border-b-2 transition-all ${
                                activeTab === t.id
                                    ? 'border-indigo-600 text-indigo-700'
                                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                            }`}>
                            {t.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6">
                {activeTab === 'document_type' && <DocumentTypeTab onToast={setToast} />}
                {activeTab === 'document_category' && <DocumentCategoryTab onToast={setToast} />}
            </div>
        </div>
    );
};

export default SfsPage;
