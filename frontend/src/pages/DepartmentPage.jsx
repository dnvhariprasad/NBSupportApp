import { useState } from 'react';
import api from '../api/axios';
import {
    Building2, ChevronDown, Loader2, CheckCircle2, AlertCircle, X, MapPin,
} from 'lucide-react';
import { RO_LOCATIONS, TE_LOCATIONS, invalidateDeptCache } from '../data/nabardMetadata.js';

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
    <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm ${className}`}>
        {children}
    </div>
);

const OFFICE_TYPES = [
    { value: 'HO', label: 'HO - Head Office' },
    { value: 'RO', label: 'RO - Regional Office' },
    { value: 'TE', label: 'TE - Training Establishment' },
];

export default function DepartmentPage() {
    const [officeType, setOfficeType] = useState('');
    const [departmentName, setDepartmentName] = useState('');
    const [dmdSelection, setDmdSelection] = useState('');
    const [location, setLocation] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState(null);

    const shortCode = departmentName.toLowerCase();

    const locationOptions = officeType === 'RO'
        ? RO_LOCATIONS.map(l => ({ value: l.location, label: `${l.location} (${l.shortCode})` }))
        : officeType === 'TE'
            ? TE_LOCATIONS.map(l => ({ value: l.location, label: `${l.location} (${l.shortCode})` }))
            : [];

    const selectedLocationObj = officeType === 'RO'
        ? RO_LOCATIONS.find(l => l.location === location)
        : officeType === 'TE'
            ? TE_LOCATIONS.find(l => l.location === location)
            : null;

    const isFormValid = officeType
        && departmentName.length > 0
        && (officeType === 'HO' ? dmdSelection !== '' : location !== '');

    const handleDeptNameChange = (e) => {
        const val = e.target.value.toUpperCase().replace(/[^A-Z]/g, '');
        if (val.length <= 6) setDepartmentName(val);
    };

    const handleOfficeTypeChange = (val) => {
        setOfficeType(val);
        setDmdSelection('');
        setLocation('');
        setResult(null);
    };

    const handleSubmit = async () => {
        if (!isFormValid || submitting) return;
        setSubmitting(true);
        setResult(null);

        const payload = {
            officeType,
            departmentName,
            departmentShortCode: shortCode,
            dmdSelection: officeType === 'HO' ? dmdSelection : null,
            locationShortCode: selectedLocationObj?.shortCode || null,
            locationName: location || null,
        };

        try {
            const { data } = await api.post('/departments', payload);
            setResult(data);
            if (data.success) {
                invalidateDeptCache(officeType, location || undefined);
                setDepartmentName('');
                setDmdSelection('');
                setLocation('');
            }
        } catch (err) {
            const msg = err.response?.data?.message || err.message;
            setResult({ success: false, message: msg, steps: [] });
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 p-8">
            <div className="max-w-2xl mx-auto">
                {/* Header */}
                <div className="mb-8">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-[#0A66C2] rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                            <Building2 className="text-white" size={22} />
                        </div>
                        <h1 className="text-2xl font-bold text-slate-900">Department Creation</h1>
                    </div>
                    <p className="text-sm text-slate-500 ml-[52px]">
                        Create a new department with associated groups and metadata in Documentum.
                    </p>
                </div>

                <Card className="p-6">
                    <div className="space-y-5">
                        {/* Office Type */}
                        <div>
                            <Label icon={Building2}>Office Type</Label>
                            <Select
                                value={officeType}
                                onChange={handleOfficeTypeChange}
                                placeholder="Select office type"
                                options={OFFICE_TYPES}
                            />
                        </div>

                        {/* Location (RO/TE only) */}
                        {(officeType === 'RO' || officeType === 'TE') && (
                            <div>
                                <Label icon={MapPin}>
                                    {officeType === 'RO' ? 'Regional Office Location' : 'Training Establishment Location'}
                                </Label>
                                <Select
                                    value={location}
                                    onChange={setLocation}
                                    placeholder="Select location"
                                    options={locationOptions}
                                />
                            </div>
                        )}

                        {/* Department Name */}
                        <div>
                            <Label>Department Name</Label>
                            <input
                                type="text"
                                value={departmentName}
                                onChange={handleDeptNameChange}
                                maxLength={6}
                                placeholder="e.g. FSPD (max 6 characters, uppercase only)"
                                className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#0A66C2] hover:border-slate-300 bg-white text-slate-800 placeholder:text-slate-400"
                            />
                            <p className="text-xs text-slate-400 mt-1">{departmentName.length}/6 characters</p>
                        </div>

                        {/* Department Short Code (auto) */}
                        {departmentName && (
                            <div>
                                <Label>Department Short Code</Label>
                                <input
                                    type="text"
                                    value={shortCode}
                                    readOnly
                                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm bg-slate-50 text-slate-600 cursor-not-allowed"
                                />
                                <p className="text-xs text-slate-400 mt-1">Auto-generated from department name</p>
                            </div>
                        )}

                        {/* DMD Selection (HO only) */}
                        {officeType === 'HO' && departmentName && (
                            <div>
                                <Label>{departmentName} belongs to DMD S1 or DMD S2?</Label>
                                <div className="flex gap-4 mt-2">
                                    {['DMDS1', 'DMDS2'].map(opt => (
                                        <label key={opt} className={`flex items-center gap-2.5 px-5 py-3 rounded-xl border cursor-pointer transition-all text-sm font-medium
                                            ${dmdSelection === opt
                                                ? 'border-[#0A66C2] bg-blue-50 text-[#0A66C2] shadow-sm'
                                                : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'}`}>
                                            <input
                                                type="radio"
                                                name="dmdSelection"
                                                value={opt}
                                                checked={dmdSelection === opt}
                                                onChange={() => setDmdSelection(opt)}
                                                className="accent-[#0A66C2]"
                                            />
                                            {opt === 'DMDS1' ? 'DMD S1' : 'DMD S2'}
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Submit */}
                        <button
                            onClick={handleSubmit}
                            disabled={!isFormValid || submitting}
                            className={`w-full py-3 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2
                                ${isFormValid && !submitting
                                    ? 'bg-[#0A66C2] text-white hover:bg-[#084E96] shadow-lg shadow-blue-500/20'
                                    : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                        >
                            {submitting
                                ? <><Loader2 size={16} className="animate-spin" /> Creating Department...</>
                                : 'Create Department'}
                        </button>
                    </div>

                    {/* Result */}
                    {result && (
                        <div className={`mt-6 rounded-xl border p-4 ${result.success ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
                            <div className="flex items-start gap-2 mb-3">
                                {result.success
                                    ? <CheckCircle2 size={18} className="text-emerald-600 mt-0.5" />
                                    : <AlertCircle size={18} className="text-red-600 mt-0.5" />}
                                <div>
                                    <p className={`text-sm font-semibold ${result.success ? 'text-emerald-800' : 'text-red-800'}`}>
                                        {result.success ? 'Department Created Successfully' : 'Department Creation Failed'}
                                    </p>
                                    <p className={`text-xs mt-0.5 ${result.success ? 'text-emerald-600' : 'text-red-600'}`}>
                                        {result.message}
                                    </p>
                                </div>
                                <button onClick={() => setResult(null)} className="ml-auto text-slate-400 hover:text-slate-600">
                                    <X size={14} />
                                </button>
                            </div>

                            {/* Step details */}
                            {result.steps && result.steps.length > 0 && (
                                <div className="space-y-1.5 mt-3 pt-3 border-t border-slate-200/60">
                                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Steps</p>
                                    {result.steps.map((step, i) => (
                                        <div key={i} className="flex items-start gap-2 text-xs">
                                            {step.success
                                                ? <CheckCircle2 size={13} className="text-emerald-500 mt-0.5 shrink-0" />
                                                : <AlertCircle size={13} className="text-red-500 mt-0.5 shrink-0" />}
                                            <div>
                                                <span className={step.success ? 'text-slate-700' : 'text-red-700'}>
                                                    {step.step}
                                                </span>
                                                {step.message && (
                                                    <span className="text-slate-400 ml-1">— {step.message}</span>
                                                )}
                                                {step.error && (
                                                    <p className="text-red-500 mt-0.5 break-all">{step.error}</p>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
}
