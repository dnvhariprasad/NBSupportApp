import { useState, useEffect, useRef } from 'react';
import api from '../api/axios';
import { X, Save, Loader2, User, Building2, MapPin, Tag, GraduationCap, Layers } from 'lucide-react';
import { USER_GRADES, getDepartments, getLocations } from '../data/nabardMetadata.js';

const USER_GRADE_OPTIONS = [
    { value: '', label: '— Select grade —', level: '' },
    ...USER_GRADES.map(g => ({ value: g.value, label: g.label, level: g.gradeLevel })),
];

const inputCls = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/20 focus:border-[#0A66C2] bg-white';
const readonlyCls = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-50 text-slate-500 cursor-default font-mono';
const selectCls = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/20 focus:border-[#0A66C2] bg-white appearance-none cursor-pointer';
const disabledSelectCls = 'w-full px-3 py-2 border border-slate-200 rounded-lg text-sm bg-slate-100 text-slate-400 cursor-not-allowed appearance-none';

const Label = ({ children, required }) => (
    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
        {children}{required && <span className="text-red-500 ml-0.5">*</span>}
    </label>
);

const errorCls = 'w-full px-3 py-2 border border-red-400 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400/20 focus:border-red-500 bg-white';

const SelectWrapper = ({ children }) => (
    <div className="relative">
        {children}
        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
            <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
        </div>
    </div>
);

const EditUserProfileModal = ({ user, isOpen, onClose, onUpdate }) => {
    const [form, setForm] = useState({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [errors, setErrors] = useState({});
    const originalGroupInfoRef = useRef({ officeType: '', roShortCode: '', deptCodes: [] });

    useEffect(() => {
        if (!isOpen || !user) return;

        // Fetch full profile to get repeating attrs (e.g. department_short_code_multi)
        api.get(`/users/profiles/${user.r_object_id}`)
            .then(res => initForm({ ...user, ...res.data }))
            .catch(() => initForm(user)); // fallback to list data on error
    }, [isOpen, user]);

    const initForm = (profile) => {
        const officeType = profile.office_type || '';
        const location   = profile.location   || '';
        const deptName   = profile.department_name || '';

        const locs        = getLocations(officeType);
        const locObj      = locs.find(l => l.location === location);
        const roShortCode = locObj ? locObj.shortCode : (profile.ro_short_code || '');

        const depts  = getDepartments(officeType, location);
        const isROTE = ['RO', 'TE'].includes(officeType);

        let deptShortCode      = '';
        let deptShortCodeMulti = [];

        if (isROTE) {
            const multiCodes = Array.isArray(profile.department_short_code_multi)
                ? profile.department_short_code_multi
                : (profile.department_short_code ? [profile.department_short_code] : []);
            deptShortCodeMulti = multiCodes;
            deptShortCode      = multiCodes[0] || '';
            originalGroupInfoRef.current = { officeType, roShortCode, deptCodes: multiCodes };
        } else {
            const deptObj = depts.find(d => d.name === deptName);
            deptShortCode = deptObj ? deptObj.shortCode : (profile.department_short_code || '');
            originalGroupInfoRef.current = { officeType, roShortCode, deptCodes: deptShortCode ? [deptShortCode] : [] };
        }

        const gradeObj   = USER_GRADES.find(g => g.value === profile.user_grade);
        const gradeLevel = gradeObj !== undefined ? gradeObj.gradeLevel : (profile.grade_level ?? '');

        setForm({
            object_name:                 profile.object_name            || '',
            uin:                         profile.uin                    || '',
            designation:                 profile.designation            || '',
            hindi_designation:           profile.hindi_designation      || '',
            hindi_user_name:             profile.hindi_user_name        || '',
            user_role:                   profile.user_role              || '',
            user_email_address:          profile.user_email_address     || '',
            primary_mobile_number:       profile.primary_mobile_number  || '',
            office_type:                 officeType,
            location:                    officeType === 'HO' ? 'Mumbai' : location,
            ro_short_code:               officeType === 'HO' ? '' : roShortCode,
            department_name:             deptName,
            department_short_code:       deptShortCode,
            department_short_code_multi: deptShortCodeMulti,
            user_grade:                  profile.user_grade             || '',
            grade_level:                 gradeLevel,
            is_active:                   profile.is_active              ?? false,
        });
        setError(null);
        setErrors({});
    };

    const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

    const handleOfficeTypeChange = (v) => {
        set('office_type',               v);
        set('location',                  v === 'HO' ? 'Mumbai' : '');
        set('ro_short_code',             '');
        set('department_name',           '');
        set('department_short_code',     '');
        set('department_names',          []);
        set('department_short_code_multi', []);
    };

    const handleLocationChange = (v) => {
        set('location', v);
        const locs = getLocations(form.office_type);
        const loc  = locs.find(l => l.location === v);
        set('ro_short_code',             loc ? loc.shortCode : '');
        set('department_name',           '');
        set('department_short_code',     '');
        set('department_names',          []);
        set('department_short_code_multi', []);
    };

    const handleDepartmentChange = (v) => {
        set('department_name', v);
        const depts = getDepartments(form.office_type, form.location);
        const dept  = depts.find(d => d.name === v);
        set('department_short_code', dept ? dept.shortCode : '');
    };

    const handleGradeChange = (v) => {
        set('user_grade', v);
        const opt = USER_GRADE_OPTIONS.find(o => o.value === v);
        set('grade_level', opt?.level ?? '');
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const v = {};
        if (!form.designation?.trim())        v.designation        = 'Designation is required';
        if (!form.uin?.trim())                v.uin                = 'UIN is required';
        if (!form.user_email_address?.trim()) v.user_email_address = 'Email is required';
        if (!form.hindi_user_name?.trim())    v.hindi_user_name    = 'Hindi Name is required';
        if (!form.hindi_designation?.trim())  v.hindi_designation  = 'Hindi Designation is required';
        if (Object.keys(v).length > 0) { setErrors(v); return; }
        setErrors({});
        setLoading(true);
        setError(null);
        try {
            const isROTE = ['RO', 'TE'].includes(form.office_type);
            const { department_short_code_multi, ...rest } = form;
            const payload = {
                ...rest,
                ...(isROTE && { department_short_code_multi }),
            };
            await api.patch(`/users/profiles/${user.r_object_id}`, payload);

            // Compute all groups for a given office config
            const getGroups = (offType, roCode, codes) => {
                const groups = [];
                if (offType === 'HO') {
                    for (const c of codes) if (c) groups.push(`ecm_ho_${c.toLowerCase()}`);
                } else if (['RO', 'TE'].includes(offType) && roCode) {
                    const ro = roCode.toLowerCase();
                    if (codes.length > 0) groups.push(`ecm_${ro}`);
                    for (const c of codes) if (c) groups.push(`ecm_${ro}_${c.toLowerCase()}`);
                }
                return groups;
            };

            const loginName = user.user_login_name;
            const old = originalGroupInfoRef.current;
            const newDeptCodes = isROTE
                ? (form.department_short_code_multi || [])
                : (form.department_short_code ? [form.department_short_code] : []);
            const newRoShortCode = (form.ro_short_code || '').toLowerCase();

            const oldGroups = getGroups(old.officeType, old.roShortCode, old.deptCodes);
            const newGroups = getGroups(form.office_type, newRoShortCode, newDeptCodes);

            for (const g of oldGroups) {
                if (!newGroups.includes(g))
                    api.delete(`/groups/${g}/members/${encodeURIComponent(loginName)}`).catch(() => {});
            }
            for (const g of newGroups) {
                if (!oldGroups.includes(g))
                    api.post(`/groups/${g}/members`, { memberName: loginName, memberType: 'user' }).catch(() => {});
            }

            onUpdate();
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to update profile. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    const depts     = getDepartments(form.office_type, form.location);
    const needsLoc  = ['RO', 'TE'].includes(form.office_type) && !form.location;
    const locations = getLocations(form.office_type);
    const isHO      = form.office_type === 'HO';
    const isROTE    = ['RO', 'TE'].includes(form.office_type);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden max-h-[90vh]">

                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                        <User size={16} className="text-[#0A66C2]" />
                        Edit User Profile
                    </h2>
                    <button onClick={onClose} className="p-1.5 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                        <X size={18} />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6">
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100">{error}</div>
                    )}
                    <form id="editProfileForm" onSubmit={handleSubmit} className="space-y-5">

                        {/* ── Basic Info ── */}
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Basic Information</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label>Name</Label>
                                    <input type="text" value={form.object_name} readOnly
                                        className={readonlyCls} />
                                </div>
                                <div className="space-y-1">
                                    <Label required>UIN</Label>
                                    <input type="text" value={form.uin}
                                        onChange={e => { set('uin', e.target.value); setErrors(p => ({ ...p, uin: undefined })); }}
                                        className={errors.uin ? errorCls : inputCls} />
                                    {errors.uin && <p className="text-xs text-red-500">{errors.uin}</p>}
                                </div>
                                <div className="space-y-1">
                                    <Label required>Designation</Label>
                                    <input type="text" value={form.designation}
                                        onChange={e => { set('designation', e.target.value); setErrors(p => ({ ...p, designation: undefined })); }}
                                        className={errors.designation ? errorCls : inputCls} />
                                    {errors.designation && <p className="text-xs text-red-500">{errors.designation}</p>}
                                </div>
                                <div className="space-y-1">
                                    <Label>User Role</Label>
                                    <input type="text" value={form.user_role}
                                        onChange={e => set('user_role', e.target.value)}
                                        className={inputCls} />
                                </div>
                                <div className="space-y-1">
                                    <Label required>Email</Label>
                                    <input type="email" value={form.user_email_address}
                                        onChange={e => { set('user_email_address', e.target.value); setErrors(p => ({ ...p, user_email_address: undefined })); }}
                                        className={errors.user_email_address ? errorCls : inputCls} />
                                    {errors.user_email_address && <p className="text-xs text-red-500">{errors.user_email_address}</p>}
                                </div>
                                <div className="space-y-1">
                                    <Label>Mobile</Label>
                                    <input type="text" value={form.primary_mobile_number}
                                        onChange={e => set('primary_mobile_number', e.target.value)}
                                        className={inputCls} />
                                </div>
                            </div>
                        </div>

                        {/* ── Hindi ── */}
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Hindi Details</p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                    <Label required>Hindi Name</Label>
                                    <input type="text" value={form.hindi_user_name}
                                        onChange={e => { set('hindi_user_name', e.target.value); setErrors(p => ({ ...p, hindi_user_name: undefined })); }}
                                        className={errors.hindi_user_name ? errorCls : inputCls} />
                                    {errors.hindi_user_name && <p className="text-xs text-red-500">{errors.hindi_user_name}</p>}
                                </div>
                                <div className="space-y-1">
                                    <Label required>Hindi Designation</Label>
                                    <input type="text" value={form.hindi_designation}
                                        onChange={e => { set('hindi_designation', e.target.value); setErrors(p => ({ ...p, hindi_designation: undefined })); }}
                                        className={errors.hindi_designation ? errorCls : inputCls} />
                                    {errors.hindi_designation && <p className="text-xs text-red-500">{errors.hindi_designation}</p>}
                                </div>
                            </div>
                        </div>

                        {/* ── Office ── */}
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                <Building2 size={12} /> Office &amp; Location
                            </p>
                            <div className="space-y-3">
                                {/* Office Type */}
                                <div className="space-y-1">
                                    <Label>Office Type</Label>
                                    <SelectWrapper>
                                        <select value={form.office_type} onChange={e => handleOfficeTypeChange(e.target.value)} className={selectCls}>
                                            <option value="">— Select office type —</option>
                                            <option value="HO">HO — Head Office</option>
                                            <option value="RO">RO — Regional Office</option>
                                            <option value="TE">TE — Training Establishment</option>
                                        </select>
                                    </SelectWrapper>
                                </div>

                                {/* Location + Short Code */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <Label><MapPin size={10} className="inline mr-0.5" />Location</Label>
                                        {isHO ? (
                                            <SelectWrapper>
                                                <select disabled className={disabledSelectCls}>
                                                    <option>Mumbai</option>
                                                </select>
                                            </SelectWrapper>
                                        ) : (
                                            <SelectWrapper>
                                                <select value={form.location} onChange={e => handleLocationChange(e.target.value)} className={selectCls}>
                                                    <option value="">— Select location —</option>
                                                    {locations.map(l => (
                                                        <option key={l.location} value={l.location}>{l.location}</option>
                                                    ))}
                                                </select>
                                            </SelectWrapper>
                                        )}
                                    </div>
                                    <div className="space-y-1">
                                        <Label><Tag size={10} className="inline mr-0.5" />RO/TE Short Code</Label>
                                        <input type="text" readOnly value={isHO ? '' : form.ro_short_code}
                                            disabled={isHO || !form.office_type}
                                            placeholder="Auto-filled"
                                            className={readonlyCls} />
                                    </div>
                                </div>

                                {/* Department + Short Code */}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <Label><Layers size={10} className="inline mr-0.5" />Department</Label>
                                        {isROTE ? (
                                            <div className="border border-slate-200 rounded-lg overflow-hidden">
                                                {needsLoc ? (
                                                    <p className="px-3 py-2 text-sm text-slate-400">— Select location first —</p>
                                                ) : !form.office_type ? (
                                                    <p className="px-3 py-2 text-sm text-slate-400">— Select office type first —</p>
                                                ) : (
                                                    <div className="max-h-40 overflow-y-auto divide-y divide-slate-100">
                                                        {depts.map(d => (
                                                            <label key={d.name} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={(form.department_short_code_multi || []).includes(d.shortCode)}
                                                                    onChange={() => {
                                                                        const currentCodes = form.department_short_code_multi || [];
                                                                        const newCodes = currentCodes.includes(d.shortCode)
                                                                            ? currentCodes.filter(c => c !== d.shortCode)
                                                                            : [...currentCodes, d.shortCode];
                                                                        const firstDept = depts.find(dept => dept.shortCode === newCodes[0]);
                                                                        set('department_short_code',       newCodes[0] || '');
                                                                        set('department_short_code_multi', newCodes);
                                                                        set('department_name',             firstDept?.name || '');
                                                                    }}
                                                                    className="rounded accent-[#0A66C2]"
                                                                />
                                                                <span className="text-sm text-slate-700">{d.name}</span>
                                                            </label>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <SelectWrapper>
                                                <select value={form.department_name}
                                                    onChange={e => handleDepartmentChange(e.target.value)}
                                                    disabled={!form.office_type}
                                                    className={!form.office_type ? disabledSelectCls : selectCls}>
                                                    <option value="">
                                                        {!form.office_type ? '— Select office type first —' : '— Select department —'}
                                                    </option>
                                                    {depts.map(d => (
                                                        <option key={d.name} value={d.name}>{d.name}</option>
                                                    ))}
                                                </select>
                                            </SelectWrapper>
                                        )}
                                    </div>
                                    <div className="space-y-1">
                                        <Label><Tag size={10} className="inline mr-0.5" />Dept. Short Code</Label>
                                        <input type="text" readOnly
                                            value={isROTE
                                                ? (form.department_short_code_multi || []).join(',')
                                                : (form.department_short_code || '')}
                                            placeholder="Auto-filled"
                                            className={readonlyCls} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ── Grade ── */}
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                <GraduationCap size={12} /> Grade
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <Label>User Grade</Label>
                                    <SelectWrapper>
                                        <select value={form.user_grade} onChange={e => handleGradeChange(e.target.value)} className={selectCls}>
                                            {USER_GRADE_OPTIONS.map(o => (
                                                <option key={o.value} value={o.value}>{o.label}</option>
                                            ))}
                                        </select>
                                    </SelectWrapper>
                                </div>
                                <div className="space-y-1">
                                    <Label>Grade Level</Label>
                                    <input type="number" readOnly value={form.grade_level}
                                        placeholder="Auto-filled"
                                        className={readonlyCls} />
                                </div>
                            </div>
                        </div>

                        {/* ── Status ── */}
                        <div className="flex items-center pt-1">
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" checked={form.is_active || false}
                                    onChange={e => set('is_active', e.target.checked)}
                                    className="sr-only peer" />
                                <div className="w-10 h-5 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-[#0A66C2]/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-[#0A66C2]" />
                                <span className="ml-3 text-sm font-medium text-slate-700">Active User</span>
                            </label>
                        </div>
                    </form>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                    <button onClick={onClose}
                        className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
                        Cancel
                    </button>
                    <button type="submit" form="editProfileForm" disabled={loading}
                        className="px-4 py-2 bg-[#0A66C2] text-white rounded-lg text-sm font-medium hover:bg-[#094d92] disabled:opacity-50 flex items-center gap-2 transition-colors">
                        {loading ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EditUserProfileModal;
