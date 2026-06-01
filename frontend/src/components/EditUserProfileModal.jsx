import { useState, useEffect, useRef } from 'react';
import api from '../api/axios';
import { X, Save, Loader2, User, Building2, MapPin, Tag, Layers, AlertCircle, ArrowRightLeft, Users, ChevronDown } from 'lucide-react';
import { USER_GRADES, DESIGNATION_OPTIONS, getLocations, fetchDepartments, RO_LOCATIONS, TE_LOCATIONS, DDM_DISTRICTS } from '../data/nabardMetadata.js';

const USER_GRADE_OPTIONS = [
    { value: '', label: '— Select grade —', level: '' },
    ...USER_GRADES.map(g => ({ value: g.value, label: g.label, level: g.gradeLevel })),
];

// Designation to User Grade mapping
const DESIGNATION_GRADE_MAPPING = {
    'DA': 'group_b',      // Group B
    'AM': 'grade_a',      // Grade A
    'MGR': 'grade_b',     // Grade B
    'AGM': 'grade_c',     // Grade C
    'DGM': 'grade_d',     // Grade D
    'GM': 'grade_e',      // Grade E
    'GM(OIC)': 'grade_e(oic)', // Grade E (OIC)
    'CGM': 'grade_f',     // Grade F
};

// User Grade to Designation mapping (reverse mapping)
const GRADE_DESIGNATION_MAPPING = {
    'group_b': 'DA',
    'grade_a': 'AM',
    'grade_b': 'MGR',
    'grade_c': 'AGM',
    'grade_d': 'DGM',
    'grade_e': 'GM',
    'grade_e(oic)': 'GM(OIC)',
    'grade_f': 'CGM',
};

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
    const [loadingForm, setLoadingForm] = useState(false);
    const [error, setError] = useState(null);
    const [errors, setErrors] = useState({});
    const [designationChanged, setDesignationChanged] = useState(false);
    const [gradeChanged, setGradeChanged] = useState(false);
    const originalGroupInfoRef = useRef({ officeType: '', roShortCode: '', deptCodes: [], designation: '' });
    const hindiTouched = useRef({});
    const lastManualChangeRef = useRef(null); // Track which field was last manually changed ('designation' or 'grade')

    // Pending cases / delegate state
    const [checkingInbox,       setCheckingInbox]       = useState(false);
    const [pendingCases,        setPendingCases]        = useState([]);
    const [showPendingBlock,    setShowPendingBlock]    = useState(false);

    // Office type change — pending cases block
    const [checkingOfficeInbox,    setCheckingOfficeInbox]    = useState(false);
    const [officePendingCases,     setOfficePendingCases]     = useState([]);
    const [showOfficeBlock,        setShowOfficeBlock]        = useState(false);

    // Department change — pending cases block
    const [checkingDeptInbox,      setCheckingDeptInbox]      = useState(false);
    const [deptPendingCases,       setDeptPendingCases]       = useState([]);
    const [showDeptBlock,          setShowDeptBlock]          = useState(false);

    // Location change — pending cases block
    const [checkingLocationInbox,  setCheckingLocationInbox]  = useState(false);
    const [locationPendingCases,   setLocationPendingCases]   = useState([]);
    const [showLocationBlock,      setShowLocationBlock]      = useState(false);

    // Delegate modal state
    const [delegateTask,         setDelegateTask]         = useState(null);
    const [delegateUsers,        setDelegateUsers]        = useState([]);
    const [loadingDelegateUsers, setLoadingDelegateUsers] = useState(false);
    const [delegateSelectedUser, setDelegateSelectedUser] = useState('');
    const [delegatingCaseId,     setDelegatingCaseId]     = useState(null);
    const [delegateError,        setDelegateError]        = useState(null);
    const [deptOptions,          setDeptOptions]          = useState([]);

    useEffect(() => {
        if (!isOpen || !user) return;
        setLoadingForm(true);
        setPendingCases([]);
        setShowPendingBlock(false);
        setOfficePendingCases([]);
        setShowOfficeBlock(false);
        setDeptPendingCases([]);
        setShowDeptBlock(false);
        setLocationPendingCases([]);
        setShowLocationBlock(false);
        setDelegateTask(null);
        setDesignationChanged(false);
        setGradeChanged(false);
        lastManualChangeRef.current = null;
        api.get(`/users/profiles/${user.r_object_id}`)
            .then(res => initForm({ ...user, ...res.data }))
            .catch(() => initForm(user));
    }, [isOpen, user]);

    // Auto-populate hindi_designation when designation changes
    useEffect(() => {
        if (!form.designation) return;
        const designationObj = DESIGNATION_OPTIONS.find(opt => opt.value === form.designation);
        if (designationObj && designationObj.hindi) {
            set('hindi_designation', designationObj.hindi);
        }
    }, [form.designation]);

    // Auto-populate user_grade when designation changes (only if user manually changed designation, not during initial load)
    useEffect(() => {
        if (!form.designation || lastManualChangeRef.current !== 'designation') return;
        const mappedGrade = DESIGNATION_GRADE_MAPPING[form.designation];
        if (mappedGrade) {
            set('user_grade', mappedGrade);
            const opt = USER_GRADE_OPTIONS.find(o => o.value === mappedGrade);
            set('grade_level', opt?.level ?? '');
            setGradeChanged(false);
        }
    }, [form.designation]);

    // Auto-populate designation when user_grade changes (only if user manually changed grade, not during initial load)
    useEffect(() => {
        if (!form.user_grade || lastManualChangeRef.current !== 'grade') return;
        const mappedDesignation = GRADE_DESIGNATION_MAPPING[form.user_grade];
        if (mappedDesignation) {
            set('designation', mappedDesignation);
            const designationObj = DESIGNATION_OPTIONS.find(opt => opt.value === mappedDesignation);
            if (designationObj && designationObj.hindi) {
                set('hindi_designation', designationObj.hindi);
            }
            setGradeChanged(true);
        }
    }, [form.user_grade]);

    const initForm = async (profile) => {
        console.log('[initForm] Profile received:', profile);
        const officeType = profile.office_type || '';
        const location   = profile.location   || '';
        const deptName   = profile.department_name || '';
        const isDDMProfile = deptName === 'DDM';
        console.log('[initForm] Extracted values:', { officeType, location, deptName, isDDMProfile });

        const locs        = getLocations(officeType);
        const locObj      = locs.find(l => l.location === location);
        const roShortCode = locObj ? locObj.shortCode : (profile.ro_short_code || '');

        const depts  = officeType ? await fetchDepartments(officeType, location) : [];
        setDeptOptions(depts);
        const isROTE = ['RO', 'TE'].includes(officeType);

        let deptShortCode      = '';
        let deptShortCodeMulti = [];

        if (isROTE) {
            const multiCodes = Array.isArray(profile.department_short_code_multi)
                ? profile.department_short_code_multi
                : (profile.department_short_code ? [profile.department_short_code] : []);
            deptShortCodeMulti = multiCodes;
            deptShortCode      = multiCodes[0] || '';
            // For DDM users: store empty deptCodes so standard group logic doesn't process district names
            originalGroupInfoRef.current = { officeType, roShortCode, deptCodes: isDDMProfile ? [] : multiCodes, designation: profile.designation || '' };
        } else {
            // For HO users: try to get department_short_code from multiple sources
            const deptObj = depts.find(d => d.name === deptName);

            // Try: 1) match by name, 2) first code from multi array, 3) direct department_short_code
            if (deptObj) {
                deptShortCode = deptObj.shortCode;
            } else if (Array.isArray(profile.department_short_code_multi) && profile.department_short_code_multi.length > 0) {
                deptShortCode = profile.department_short_code_multi[0];
                deptShortCodeMulti = profile.department_short_code_multi;
            } else {
                deptShortCode = profile.department_short_code || '';
            }

            originalGroupInfoRef.current = { officeType, roShortCode, deptCodes: deptShortCode ? [deptShortCode] : [], designation: profile.designation || '' };
        }

        const gradeObj   = USER_GRADES.find(g => g.value === profile.user_grade);
        const gradeLevel = gradeObj !== undefined ? gradeObj.gradeLevel : (profile.grade_level ?? '');

        const finalForm = {
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
        };
        console.log('[initForm] Final form state:', finalForm);
        setForm(finalForm);
        setError(null);
        setErrors({});
        setPendingCases([]);
        setShowPendingBlock(false);
        setLoadingForm(false);
    };

    const set = (field, value) => setForm(prev => ({ ...prev, [field]: value }));

    // When status dropdown changes — if switching to inactive, check inbox
    const handleStatusChange = async (value) => {
        const goingInactive = value === false || value === 'false';

        // Always clear the pending block when user changes the dropdown
        setShowPendingBlock(false);
        setPendingCases([]);
        set('is_active', !goingInactive);

        if (goingInactive && user?.object_name) {
            setCheckingInbox(true);
            try {
                const res = await api.get('/inbox/tasklist', {
                    params: { username: user.object_name, page: 1, start: 0 }
                });
                const data = res.data || {};
                let items = [];
                if (Array.isArray(data.entries)) {
                    items = data.entries.map(e => {
                        const props = e?.content?.properties || e?.properties || e;
                        return { ...props, _raw: e };
                    });
                } else if (Array.isArray(data.tasks)) {
                    items = data.tasks;
                }
                if (items.length > 0) {
                    setPendingCases(items);
                    setShowPendingBlock(true);
                    // Keep dropdown at Inactive — save is blocked until cases are delegated
                }
            } catch {
                // Inbox check failed — allow proceeding
            } finally {
                setCheckingInbox(false);
            }
        }
    };

    // ── Delegate helpers ──────────────────────────────────────────────────────
    const pf = (task, f) => task[`packagescase_folder${f}`] || task[f] || '';

    const handleDelegateClick = async (task) => {
        const caseNumber = pf(task, 'object_name') || task.object_name || task.case_number || task.case_id || '';
        const currentPerformer = form.object_name || '';

        // Use ORIGINAL profile values (stored at load time) for delegation, not edited form values
        // This allows users to delegate before saving profile changes
        const originalOfficeType = originalGroupInfoRef.current.officeType;
        const isHO = originalOfficeType === 'HO';
        const isROTE = originalOfficeType === 'RO' || originalOfficeType === 'TE';

        console.log('[Delegate] Using original profile values:', {
            originalOfficeType,
            isHO,
            isROTE,
            originalDeptCodes: originalGroupInfoRef.current.deptCodes,
            originalRoShortCode: originalGroupInfoRef.current.roShortCode
        });
        console.log('[Delegate] Case number:', { caseNumber });

        setDelegateTask(task);
        setDelegateSelectedUser('');
        setDelegateUsers([]);
        setDelegateError(null);
        setLoadingDelegateUsers(true);
        try {
            if (isHO) {
                // HO user: Always delegate to users in their own department
                const userDeptCode = originalGroupInfoRef.current.deptCodes[0];
                if (!userDeptCode || !userDeptCode.trim()) {
                    setDelegateError('Department code is not set for this user in their profile.');
                    setDelegateUsers([]);
                    return;
                }

                console.log('[Delegate] HO user delegating:', { caseNumber, userDeptCode });

                const res = await api.get('/users/by-dept', { params: { shortCode: userDeptCode.toLowerCase(), officeType: 'HO', page: 1, size: 500 } });
                const allUsers = Array.isArray(res.data?.users) ? res.data.users : (Array.isArray(res.data) ? res.data : []);

                console.log('[Delegate] Fetched HO users from user dept:', { userDeptCode, count: allUsers.length });

                if (allUsers.length === 0) {
                    setDelegateError(`No users found in department ${userDeptCode.toUpperCase()}.`);
                    setDelegateUsers([]);
                    return;
                }

                const filteredUsers = allUsers
                    .filter(u => {
                        const displayName = u.object_name || u.name || '';
                        return displayName.trim().length > 0;
                    })
                    .filter(u => {
                        const userName = u.name?.trim().toLowerCase() || '';
                        const userObjName = u.object_name?.trim().toLowerCase() || '';
                        const currentName = currentPerformer?.trim().toLowerCase() || '';
                        return userName !== currentName && userObjName !== currentName;
                    });

                console.log('[Delegate] Filtered HO users:', { count: filteredUsers.length, names: filteredUsers.map(u => u.object_name || u.name) });
                setDelegateUsers(filteredUsers);
            } else if (isROTE) {
                // RO/TE user: Always delegate to users in their own location
                const roShortCode = originalGroupInfoRef.current.roShortCode;
                if (!roShortCode) {
                    setDelegateError('Location code is not set for this user in their profile.');
                    setDelegateUsers([]);
                    return;
                }

                // Convert ro_short_code back to location name
                const allLocs = [...RO_LOCATIONS, ...TE_LOCATIONS];
                const locObj = allLocs.find(l => l.shortCode?.toUpperCase() === roShortCode.toUpperCase());
                const userLocation = locObj?.location;

                if (!userLocation) {
                    setDelegateError(`Location not found for code: ${roShortCode}`);
                    setDelegateUsers([]);
                    return;
                }

                console.log('[Delegate] RO/TE user delegating:', { caseNumber, roShortCode, userLocation, originalOfficeType });

                const res = await api.get('/users/by-location', { params: { location: userLocation, page: 1, size: 500 } });
                const allUsers = Array.isArray(res.data?.users) ? res.data.users : (Array.isArray(res.data) ? res.data : []);

                console.log('[Delegate] Fetched RO/TE users from user location:', { userLocation, count: allUsers.length });

                if (allUsers.length === 0) {
                    setDelegateError(`No users found in location ${userLocation}.`);
                    setDelegateUsers([]);
                    return;
                }

                const filteredUsers = allUsers
                    .filter(u => {
                        const displayName = u.object_name || u.name || '';
                        return displayName.trim().length > 0;
                    })
                    .filter(u => {
                        const userName = u.name?.trim().toLowerCase() || '';
                        const userObjName = u.object_name?.trim().toLowerCase() || '';
                        const currentName = currentPerformer?.trim().toLowerCase() || '';
                        return userName !== currentName && userObjName !== currentName;
                    });

                console.log('[Delegate] Filtered RO/TE users:', { count: filteredUsers.length, names: filteredUsers.map(u => u.object_name || u.name) });
                setDelegateUsers(filteredUsers);
            } else {
                setDelegateError('Could not determine office type for this user.');
                setDelegateUsers([]);
            }
        } catch (err) {
            console.error('[Delegate] Failed to load users:', { error: err.message, caseNumber, originalOfficeType, status: err.response?.status, data: err.response?.data });
            const errorMsg = err.response?.data?.message || err.message || 'Failed to load users. Please check the console for details.';
            setDelegateError(errorMsg);
        } finally {
            setLoadingDelegateUsers(false);
        }
    };

    const handleDelegateConfirm = async () => {
        if (!delegateSelectedUser || !delegateTask) return;
        const caseId = pf(delegateTask, 'id') || delegateTask.id || delegateTask.r_object_id;
        const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
        const loginUsername = storedUser.properties?.user_name || storedUser.user_name || '';
        const assignedUser = `NEO Admin (${loginUsername})`;
        setDelegatingCaseId(caseId);
        try {
            await api.post('/delegate', { caseId, performerDisplayName: delegateSelectedUser, loginUsername: assignedUser });
            const filterOut = (list) => list.filter(t => {
                const tid = pf(t, 'id') || t.id || t.r_object_id;
                return tid !== caseId;
            });
            const remaining = filterOut(pendingCases);
            setPendingCases(remaining);
            if (remaining.length === 0 && showPendingBlock) {
                setShowPendingBlock(false);
                set('is_active', false);
            }
            const officeRemaining = filterOut(officePendingCases);
            setOfficePendingCases(officeRemaining);
            if (officeRemaining.length === 0) {
                setShowOfficeBlock(false);
            }
            const deptRemaining = filterOut(deptPendingCases);
            setDeptPendingCases(deptRemaining);
            if (deptRemaining.length === 0) {
                setShowDeptBlock(false);
            }
            const locationRemaining = filterOut(locationPendingCases);
            setLocationPendingCases(locationRemaining);
            if (locationRemaining.length === 0) {
                setShowLocationBlock(false);
            }
            setDelegateTask(null);
        } catch (err) {
            setDelegateError(err.response?.data?.message || 'Delegation failed.');
        } finally {
            setDelegatingCaseId(null);
        }
    };

    // Check inbox for cases matching specific department codes
    const checkDeptInbox = async (removedDeptCodes) => {
        if (!removedDeptCodes.length || !user?.object_name) {
            setShowDeptBlock(false);
            setDeptPendingCases([]);
            return;
        }
        setCheckingDeptInbox(true);
        setShowDeptBlock(false);
        setDeptPendingCases([]);
        try {
            const res = await api.get('/inbox/tasklist', {
                params: { username: user.object_name, page: 1, start: 0 }
            });
            const data = res.data || {};
            let items = [];
            if (Array.isArray(data.entries)) {
                items = data.entries.map(e => {
                    const props = e?.content?.properties || e?.properties || e;
                    return { ...props, _raw: e };
                });
            } else if (Array.isArray(data.tasks)) {
                items = data.tasks;
            }
            // Filter cases that belong to any of the removed department codes
            const lowerCodes = removedDeptCodes.map(c => c.toLowerCase());
            const offType = form.office_type;
            const matched = items.filter(task => {
                const caseName = pf(task, 'object_name') || task.caseName || '';
                const parts = caseName.split('-');
                // HO: parts[1] is dept code; RO/TE: parts[3] is dept code
                const caseDept = (offType === 'HO' ? parts[1] : parts[3] || '').toLowerCase();
                return lowerCodes.includes(caseDept);
            });
            if (matched.length > 0) {
                setDeptPendingCases(matched);
                setShowDeptBlock(true);
            }
        } catch {
            // Inbox check failed — allow proceeding
        } finally {
            setCheckingDeptInbox(false);
        }
    };

    const handleOfficeTypeChange = async (v) => {
        set('office_type',               v);
        set('location',                  v === 'HO' ? 'Mumbai' : '');
        set('ro_short_code',             '');
        set('department_name',           '');
        setShowDeptBlock(false);
        setDeptPendingCases([]);
        set('department_short_code',     '');
        set('department_names',          []);
        set('department_short_code_multi', []);
        if (v === 'HO') {
            setDeptOptions(await fetchDepartments('HO'));
        } else {
            setDeptOptions([]);
        }

        // Check inbox when office type changes from original value
        const originalOfficeType = originalGroupInfoRef.current.officeType;
        if (v !== originalOfficeType && user?.object_name) {
            setCheckingOfficeInbox(true);
            setShowOfficeBlock(false);
            setOfficePendingCases([]);
            try {
                const res = await api.get('/inbox/tasklist', {
                    params: { username: user.object_name, page: 1, start: 0 }
                });
                const data = res.data || {};
                let items = [];
                if (Array.isArray(data.entries)) {
                    items = data.entries.map(e => {
                        const props = e?.content?.properties || e?.properties || e;
                        return { ...props, _raw: e };
                    });
                } else if (Array.isArray(data.tasks)) {
                    items = data.tasks;
                }
                if (items.length > 0) {
                    setOfficePendingCases(items);
                    setShowOfficeBlock(true);
                }
            } catch {
                // Inbox check failed — allow proceeding
            } finally {
                setCheckingOfficeInbox(false);
            }
        } else {
            // Reverted back to original office type — clear block
            setShowOfficeBlock(false);
            setOfficePendingCases([]);
        }
    };

    // Check inbox for cases matching specific location (RO/TE only)
    const checkLocationInbox = async (oldLocation) => {
        if (!oldLocation || form.office_type === 'HO' || !user?.object_name) {
            setShowLocationBlock(false);
            setLocationPendingCases([]);
            return;
        }

        setCheckingLocationInbox(true);
        setShowLocationBlock(false);
        setLocationPendingCases([]);
        try {
            const res = await api.get('/inbox/tasklist', {
                params: { username: user.object_name, page: 1, start: 0 }
            });
            const data = res.data || {};
            let items = [];
            if (Array.isArray(data.entries)) {
                items = data.entries.map(e => {
                    const props = e?.content?.properties || e?.properties || e;
                    return { ...props, _raw: e };
                });
            } else if (Array.isArray(data.tasks)) {
                items = data.tasks;
            }

            // Find the old location's short code to match against case names
            const locs = getLocations(form.office_type);
            const oldLocObj = locs.find(l => l.location === oldLocation);
            const oldLocCode = oldLocObj?.shortCode?.toLowerCase();

            if (!oldLocCode) {
                setShowLocationBlock(false);
                setLocationPendingCases([]);
                setCheckingLocationInbox(false);
                return;
            }

            // Filter cases that belong to the old location (RO/TE: parts[2] is location code)
            const matched = items.filter(task => {
                const caseName = pf(task, 'object_name') || task.caseName || '';
                const parts = caseName.split('-');
                const caseLocCode = (parts[2] || '').toLowerCase();
                return caseLocCode === oldLocCode;
            });

            if (matched.length > 0) {
                setLocationPendingCases(matched);
                setShowLocationBlock(true);
            }
        } catch {
            // Inbox check failed — allow proceeding
        } finally {
            setCheckingLocationInbox(false);
        }
    };

    const handleLocationChange = async (v) => {
        set('location', v);
        const locs = getLocations(form.office_type);
        const loc  = locs.find(l => l.location === v);
        set('ro_short_code',             loc ? loc.shortCode : '');
        // For DDM users: clear district; for others: clear department_name
        if (form.department_name !== 'DDM') {
            set('department_name',           '');
        }
        set('department_short_code',     '');
        set('department_names',          []);
        set('department_short_code_multi', []);
        if (v && form.office_type) {
            setDeptOptions(await fetchDepartments(form.office_type, v));
        } else {
            setDeptOptions([]);
        }

        // Check inbox when location changes from original value (RO/TE only)
        // Always check against the ORIGINAL location, not the immediate previous location
        const originalLocation = originalGroupInfoRef.current.roShortCode
            ? getLocations(form.office_type).find(l => l.shortCode === originalGroupInfoRef.current.roShortCode)?.location
            : null;

        if (v !== originalLocation && originalLocation && ['RO', 'TE'].includes(form.office_type) && user?.object_name) {
            // Check for cases from the ORIGINAL location when changing away from it
            await checkLocationInbox(originalLocation);
        } else {
            // Reverted back to original location — clear block
            setShowLocationBlock(false);
            setLocationPendingCases([]);
        }
    };

    const handleDepartmentChange = (v) => {
        set('department_name', v);
        const dept = deptOptions.find(d => d.name === v);
        const newDeptCode = dept ? dept.shortCode : '';
        set('department_short_code', newDeptCode);

        // HO: check inbox for cases in the original department if it's being changed away
        if (form.office_type === 'HO') {
            const originalDeptCodes = originalGroupInfoRef.current.deptCodes;
            const originalCode = (originalDeptCodes[0] || '').toLowerCase();
            if (originalCode && newDeptCode.toLowerCase() !== originalCode) {
                checkDeptInbox(originalDeptCodes);
            } else {
                setShowDeptBlock(false);
                setDeptPendingCases([]);
            }
        }
    };

    const handleDDMDistrictChange = (district) => {
        set('department_short_code', district);
        set('department_short_code_multi', district ? [district] : []);
        set('department_name', 'DDM');
    };

    const handleGradeChange = (v) => {
        lastManualChangeRef.current = 'grade';
        set('user_grade', v);
        const opt = USER_GRADE_OPTIONS.find(o => o.value === v);
        set('grade_level', opt?.level ?? '');
        // Reset to false; the useEffect will set it to true after auto-updating designation
        setGradeChanged(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (showPendingBlock) return; // block save if pending cases exist
        if (showOfficeBlock) return;  // block save if office type changed with pending cases
        if (showDeptBlock) return;    // block save if department changed with pending cases
        if (showLocationBlock) return; // block save if location changed with pending cases
        const v = {};
        if (!form.designation?.trim())        v.designation        = 'Designation is required';
        if (!form.uin?.trim())                v.uin                = 'UIN is required';
        if (!form.user_email_address?.trim()) v.user_email_address = 'Email is required';
        if (!form.hindi_user_name?.trim())    v.hindi_user_name    = 'Hindi Name is required';
        if (!form.hindi_designation?.trim())  v.hindi_designation  = 'Hindi Designation is required';
        const isDDMUser = form.department_name === 'DDM' && ['RO', 'TE'].includes(form.office_type);
        if (isDDMUser && !form.department_short_code?.trim()) v.department_short_code = 'District is required';
        if (Object.keys(v).length > 0) { setErrors(v); return; }
        setErrors({});
        setLoading(true);
        setError(null);
        try {
            const isROTE = ['RO', 'TE'].includes(form.office_type);
            const { department_short_code_multi, ...rest } = form;
            const payload = {
                ...rest,
                ...(isROTE && !isDDMUser && { department_short_code_multi }),
                ...(isDDMUser && { department_short_code_multi: form.department_short_code ? [form.department_short_code] : [] }),
            };
            await api.patch(`/users/profiles/${user.r_object_id}`, payload);

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

            const getDigidakGroups = (offType, roCode, codes) => {
                const groups = [];
                if (offType === 'HO') {
                    for (const c of codes) {
                        if (c) {
                            groups.push(`ecm_digidak_ho_${c.toLowerCase()}_cgm`);
                            groups.push(`ecm_digidak_ho_${c.toLowerCase()}_cgm_ps`);
                        }
                    }
                } else if (['RO', 'TE'].includes(offType) && roCode) {
                    const ro = roCode.toLowerCase();
                    for (const c of codes) {
                        if (c) {
                            groups.push(`ecm_digidak_${offType.toLowerCase()}_${ro}_${c.toLowerCase()}_cgm`);
                        }
                    }
                }
                return groups;
            };

            const memberName = user.user_login_name;
            if (!memberName || !memberName.trim()) {
                console.error('Cannot perform group updates: user_login_name is missing', user);
                throw new Error('User login name is required for group management');
            }

            const old = originalGroupInfoRef.current;
            const newRoShortCode = (form.ro_short_code || '').toLowerCase();
            const wasDDMBefore = old.deptCodes.length === 0;

            if (isDDMUser) {
                // DDM-specific group management: handle ecm_digidak_ro_<code>_ddm groups
                const oldRoCode = (old.roShortCode || '').toLowerCase();

                console.log('DDM User Management Debug:', {
                    isDDMUser,
                    wasDDMBefore,
                    oldRoCode,
                    newRoShortCode,
                    locationChanged: oldRoCode !== newRoShortCode,
                    memberName
                });

                // If transitioning FROM standard departments TO DDM, remove all department-related groups
                if (!wasDDMBefore) {
                    // Query all current groups and remove any non-DDM, non-superuser groups
                    api.get(`/groups/by-user?username=${encodeURIComponent(memberName)}`)
                        .then(groupsResponse => {
                            const currentGroups = Array.isArray(groupsResponse.data) ? groupsResponse.data : [];
                            console.log('Transitioning to DDM - current groups:', { memberName, currentGroups });

                            for (const groupObj of currentGroups) {
                                const groupName = groupObj.group_name || groupObj.name;
                                // Keep only dm_superusers_dynamic and DDM groups (if any)
                                if (groupName &&
                                    groupName !== 'dm_superusers_dynamic' &&
                                    !groupName.includes('_ddm')) {
                                    console.log(`Removing non-DDM group: ${groupName}`);
                                    api.delete(`/groups/${groupName}/members/${encodeURIComponent(memberName)}`).catch(err => {
                                        console.error(`Failed to remove ${groupName}:`, err.response?.data || err.message);
                                    });
                                }
                            }
                        })
                        .catch(err => {
                            console.error('Failed to query user groups:', err.message);
                            // Fallback: try to remove calculated groups if query fails
                            const oldGroups = getGroups(old.officeType, old.roShortCode, old.deptCodes);
                            const oldDigidakGroups = getDigidakGroups(old.officeType, old.roShortCode, old.deptCodes);
                            const allOldGroups = [...oldGroups, ...oldDigidakGroups];
                            console.log('Fallback - removing calculated groups:', { allOldGroups });
                            for (const g of allOldGroups) {
                                api.delete(`/groups/${g}/members/${encodeURIComponent(memberName)}`).catch(() => {});
                            }
                        });
                }

                // Always ensure user is in the current DDM group (handles both new DDM and missed prior adds)
                if (newRoShortCode) {
                    api.post(`/groups/ecm_digidak_ro_${newRoShortCode}_ddm/members`, { memberName, memberType: 'user' }).catch(err => {
                        console.warn(`Failed to add DDM group: ${err.message}`);
                    });
                }

                // Cleanup non-DDM groups for any DDM user (whether changing district or not)
                // Query all current groups and remove any non-DDM, non-superuser groups
                const cleanupNonDDMGroups = () => {
                    api.get(`/groups/by-user?username=${encodeURIComponent(memberName)}`)
                        .then(groupsResponse => {
                            const currentGroups = Array.isArray(groupsResponse.data) ? groupsResponse.data : [];
                            console.log('Current groups for DDM user - cleanup:', { memberName, currentGroups });

                            for (const groupObj of currentGroups) {
                                const groupName = groupObj.group_name || groupObj.name;
                                // Keep only dm_superusers_dynamic and DDM groups
                                if (groupName &&
                                    groupName !== 'dm_superusers_dynamic' &&
                                    !groupName.includes('_ddm')) {
                                    console.log(`Removing non-DDM group from DDM user: ${groupName}`);
                                    api.delete(`/groups/${groupName}/members/${encodeURIComponent(memberName)}`).catch(err => {
                                        console.error(`Failed to remove ${groupName}:`, err.response?.data || err.message);
                                    });
                                }
                            }
                        })
                        .catch(err => {
                            console.error('Failed to query user groups:', err.message);
                        });
                };

                // If location changed and user was DDM before, remove from old DDM group and clean up
                if (wasDDMBefore && oldRoCode && oldRoCode !== newRoShortCode) {
                    console.log('DDM user changing district - removing old DDM group and cleaning up');
                    // Remove from old DDM group
                    api.delete(`/groups/ecm_digidak_ro_${oldRoCode}_ddm/members/${encodeURIComponent(memberName)}`).catch(err => {
                        console.warn(`Failed to remove old DDM group: ${err.message}`);
                    });
                    cleanupNonDDMGroups();
                } else if (wasDDMBefore) {
                    // User was already DDM, just ensure non-DDM groups are removed
                    console.log('DDM user - cleaning up non-DDM groups');
                    cleanupNonDDMGroups();
                }
            } else {
                // Standard group management for non-DDM users
                // If user was DDM before, remove the old DDM group
                if (wasDDMBefore) {
                    const oldRoCode = (old.roShortCode || '').toLowerCase();
                    if (oldRoCode) {
                        api.delete(`/groups/ecm_digidak_ro_${oldRoCode}_ddm/members/${encodeURIComponent(memberName)}`).catch(err => {
                            console.warn(`Failed to remove DDM group: ${err.message}`);
                        });
                    }
                }
                const newDeptCodes = isROTE
                    ? (form.department_short_code_multi || [])
                    : (form.department_short_code ? [form.department_short_code] : []);

                const oldGroups = getGroups(old.officeType, old.roShortCode, old.deptCodes);
                const newGroups = getGroups(form.office_type, newRoShortCode, newDeptCodes);

                console.log('Group Management Debug:', {
                    memberName,
                    oldOfficeType: old.officeType,
                    oldRoCode: old.roShortCode,
                    oldDeptCodes: old.deptCodes,
                    oldGroups,
                    newOfficeType: form.office_type,
                    newRoCode: newRoShortCode,
                    newDeptCodes,
                    newGroups,
                    groupsToRemove: oldGroups.filter(g => !newGroups.includes(g)),
                    groupsToAdd: newGroups.filter(g => !oldGroups.includes(g))
                });

                for (const g of oldGroups) {
                    if (!newGroups.includes(g)) {
                        console.log(`Removing user from group: ${g}`);
                        api.delete(`/groups/${g}/members/${encodeURIComponent(memberName)}`).catch(err => {
                            console.error(`Failed to remove ${g}:`, err.response?.data || err.message);
                        });
                    }
                }
                for (const g of newGroups) {
                    if (!oldGroups.includes(g)) {
                        console.log(`Adding user to group: ${g}`);
                        api.post(`/groups/${g}/members`, { memberName, memberType: 'user' }).catch(err => {
                            console.error(`Failed to add ${g}:`, err.response?.data || err.message);
                        });
                    }
                }
            }

            // ── CGM group management based on designation change or location change (skip for DDM users) ──────────
            if (!isDDMUser) {
                const getCgmGroup = (offType, roCode, deptCodes) => {
                    if (offType === 'HO') {
                        const dc = (deptCodes[0] || '').toLowerCase();
                        return dc ? `ecm_digidak_ho_${dc}_cgm` : '';
                    } else if (['RO', 'TE'].includes(offType) && roCode) {
                        return `ecm_digidak_${offType.toLowerCase()}_${roCode.toLowerCase()}_cgm`;
                    }
                    return '';
                };

                const newDeptCodes = isROTE
                    ? (form.department_short_code_multi || [])
                    : (form.department_short_code ? [form.department_short_code] : []);

                const oldDesignation = (old.designation || '').toUpperCase();
                const newDesignation = (form.designation || '').toUpperCase();
                const wasCGM = oldDesignation === 'CGM';
                const isCGM  = newDesignation === 'CGM';
                const oldRoCode = (old.roShortCode || '').toLowerCase();
                const locationChanged = oldRoCode !== newRoShortCode;

                if (isCGM && !wasCGM) {
                    // Designation changed TO CGM — add CGM group
                    const cgmGroup = getCgmGroup(form.office_type, newRoShortCode, newDeptCodes);
                    if (cgmGroup) {
                        console.log(`Adding CGM group: ${cgmGroup}`);
                        api.post(`/groups/${cgmGroup}/members`, { memberName, memberType: 'user' }).catch(err => {
                            console.error(`Failed to add ${cgmGroup}:`, err.response?.data || err.message);
                        });
                    }
                } else if (wasCGM && !isCGM) {
                    // Designation changed FROM CGM — remove old CGM group
                    const cgmGroup = getCgmGroup(old.officeType, old.roShortCode, old.deptCodes);
                    if (cgmGroup) {
                        console.log(`Removing CGM group (designation change): ${cgmGroup}`);
                        api.delete(`/groups/${cgmGroup}/members/${encodeURIComponent(memberName)}`).catch(err => {
                            console.error(`Failed to remove ${cgmGroup}:`, err.response?.data || err.message);
                        });
                    }
                } else if (isCGM && locationChanged) {
                    // Location changed while user is CGM — remove old location's CGM group, add new one
                    const oldCgmGroup = getCgmGroup(old.officeType, old.roShortCode, old.deptCodes);
                    const newCgmGroup = getCgmGroup(form.office_type, newRoShortCode, newDeptCodes);

                    if (oldCgmGroup && oldCgmGroup !== newCgmGroup) {
                        console.log(`Removing CGM group (location change): ${oldCgmGroup}`);
                        api.delete(`/groups/${oldCgmGroup}/members/${encodeURIComponent(memberName)}`).catch(err => {
                            console.error(`Failed to remove ${oldCgmGroup}:`, err.response?.data || err.message);
                        });
                    }
                    if (newCgmGroup && oldCgmGroup !== newCgmGroup) {
                        console.log(`Adding CGM group (location change): ${newCgmGroup}`);
                        api.post(`/groups/${newCgmGroup}/members`, { memberName, memberType: 'user' }).catch(err => {
                            console.error(`Failed to add ${newCgmGroup}:`, err.response?.data || err.message);
                        });
                    }
                }
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

    const storedUser  = JSON.parse(localStorage.getItem('user') || '{}');
    const adminRole   = storedUser.properties?.admin_role || storedUser.admin_role || null;
    const isSuperAdmin = adminRole === 'Super Admin';
    const isLocalAdmin = adminRole === 'Local Admin';

    const depts     = deptOptions;
    const needsLoc  = ['RO', 'TE'].includes(form.office_type) && !form.location;
    const locations = getLocations(form.office_type);
    const isHO      = form.office_type === 'HO';
    const isROTE    = ['RO', 'TE'].includes(form.office_type);
    const isDDMUser = form.department_name === 'DDM' && isROTE;

    // Delegate case modal
    const DelegateCaseModal = () => {
        if (!delegateTask) return null;
        const caseName   = pf(delegateTask, 'object_name') || delegateTask.caseName || '—';
        const deptName   = pf(delegateTask, 'department_name') || delegateTask.department_name || '';
        const parts      = caseName.split('-');

        // Determine office type from delegateTask.ho_ro property, or fallback to parsing case name
        // Case format: NB-DEPTCODE-... (HO) or NB-RO/TE-LOCATION-DEPTCODE-... (RO/TE)
        let offType = 'HO'; // default
        let roCode = '';
        let deptCode = '';

        // Check if we have ho_ro property from task
        if (delegateTask.ho_ro) {
            offType = delegateTask.ho_ro;
        } else if (parts[1] === 'RO' || parts[1] === 'TE') {
            // Parse from case name if ho_ro not available
            offType = parts[1];
        }

        const isRoTe = offType === 'RO' || offType === 'TE';

        if (isRoTe) {
            roCode = (parts[2] || '').toLowerCase();
            deptCode = (parts[3] || '').toLowerCase();
        } else {
            // HO: parts[1] is dept code
            deptCode = (parts[1] || '').toLowerCase();
        }

        const allLocs = offType === 'TE' ? TE_LOCATIONS : RO_LOCATIONS;
        const locLabel = isRoTe ? (allLocs.find(l => l.shortCode === roCode)?.location || roCode.toUpperCase()) : null;

        // Extract dept code from department name if available
        if (deptName) {
            const deptMatch = deptName.match(/\(([^)]+)\)$/);
            if (deptMatch) {
                deptCode = deptMatch[1].toLowerCase();
            }
        }
        return (
            <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md flex flex-col overflow-hidden">
                    <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-blue-50 to-slate-50">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-xl bg-[#0A66C2] flex items-center justify-center shadow-sm">
                                <ArrowRightLeft size={17} className="text-white" />
                            </div>
                            <div>
                                <p className="text-sm font-bold text-slate-900">Delegate Case</p>
                                <p className="text-xs text-slate-500 font-mono">{caseName}</p>
                            </div>
                        </div>
                        <button onClick={() => setDelegateTask(null)}
                            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all">
                            <X size={18} />
                        </button>
                    </div>
                    <div className="p-6 space-y-4">
                        <div className="text-xs text-slate-500 space-y-1">
                            {isRoTe && locLabel && (
                                <div>Location: <span className="font-semibold text-slate-700">{locLabel}</span> <span className="text-slate-400">({offType})</span></div>
                            )}
                            {deptName && (
                                <div>Department: <span className="font-semibold text-slate-700">{deptName}</span>
                                    {deptCode && <span className="ml-1 text-slate-400">({deptCode})</span>}
                                </div>
                            )}
                        </div>
                        {delegateError && (
                            <div className="text-xs text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{delegateError}</div>
                        )}
                        <div>
                            <label className="text-xs font-semibold text-slate-600 mb-1.5 flex items-center gap-1.5">
                                <Users size={12} /> Select User to Delegate
                            </label>
                            {loadingDelegateUsers ? (
                                <div className="flex items-center gap-2 text-sm text-slate-400 py-2">
                                    <Loader2 size={14} className="animate-spin" /> Loading users…
                                </div>
                            ) : delegateUsers.length === 0 ? (
                                <div className="text-xs text-slate-400 py-2">No users found for this department.</div>
                            ) : (
                                <div className="relative">
                                    <select
                                        value={delegateSelectedUser}
                                        onChange={e => setDelegateSelectedUser(e.target.value)}
                                        className="w-full px-3 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/20 focus:border-[#0A66C2] bg-white appearance-none pr-8 cursor-pointer"
                                    >
                                        <option value="">— Select user —</option>
                                        {delegateUsers.map(u => (
                                            <option key={u.r_object_id || u.user_login_name} value={u.object_name}>
                                                {u.object_name}
                                            </option>
                                        ))}
                                    </select>
                                    <ChevronDown size={13} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center justify-end gap-2 px-6 pb-5">
                        <button onClick={() => setDelegateTask(null)}
                            className="px-4 py-2 text-xs font-medium text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors">
                            Cancel
                        </button>
                        <button
                            onClick={handleDelegateConfirm}
                            disabled={!delegateSelectedUser || !!delegatingCaseId}
                            className="flex items-center gap-1.5 px-4 py-2 bg-[#0A66C2] hover:bg-[#094d92] disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg transition-all">
                            {delegatingCaseId ? <><Loader2 size={12} className="animate-spin" /> Delegating…</> : <><ArrowRightLeft size={12} /> Delegate</>}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <DelegateCaseModal />
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
                                    <SelectWrapper>
                                        <select value={form.designation}
                                            onChange={e => {
                                                const newDesignation = e.target.value;
                                                lastManualChangeRef.current = 'designation';
                                                set('designation', newDesignation);
                                                setErrors(p => ({ ...p, designation: undefined }));
                                                // Track if designation was actually changed from original
                                                setDesignationChanged(newDesignation !== originalGroupInfoRef.current.designation);
                                                // Reset hindi_designation touched so it can auto-populate
                                                hindiTouched.current.hindi_designation = false;
                                            }}
                                            className={errors.designation ? errorCls : selectCls} >
                                            {DESIGNATION_OPTIONS.map((opt) => (
                                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                                            ))}
                                        </select>
                                    </SelectWrapper>
                                    {errors.designation && <p className="text-xs text-red-500">{errors.designation}</p>}
                                    {designationChanged && <p className="text-xs text-amber-600 font-medium mt-1">💡 User grade has been auto-updated based on designation</p>}
                                </div>
                                <div className="space-y-1">
                                    <Label>User Role</Label>
                                    <input type="text" value={form.user_role}
                                        onChange={e => set('user_role', e.target.value)}
                                        className={inputCls} />
                                </div>
                                <div className="space-y-1">
                                    <Label>User Grade</Label>
                                    <SelectWrapper>
                                        <select value={form.user_grade} onChange={e => handleGradeChange(e.target.value)} className={selectCls}>
                                            {USER_GRADE_OPTIONS.map(o => (
                                                <option key={o.value} value={o.value}>{o.label}</option>
                                            ))}
                                        </select>
                                    </SelectWrapper>
                                    {gradeChanged && <p className="text-xs text-amber-600 font-medium mt-1">💡 Designation has been auto-updated based on grade</p>}
                                </div>
                                <div className="space-y-1">
                                    <Label>Grade Level</Label>
                                    <input type="number" readOnly value={form.grade_level}
                                        placeholder="Auto-filled"
                                        className={readonlyCls} />
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
                                        readOnly
                                        className={readonlyCls} />
                                </div>
                            </div>
                        </div>

                        {/* ── Office ── */}
                        <div>
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                <Building2 size={12} /> Office &amp; Location
                            </p>
                            <div className="space-y-3">
                                <div className="space-y-1">
                                    <Label>Office Type</Label>
                                    <SelectWrapper>
                                        <select value={form.office_type}
                                            onChange={e => handleOfficeTypeChange(e.target.value)}
                                            disabled={checkingOfficeInbox || isLocalAdmin}
                                            className={(checkingOfficeInbox || isLocalAdmin) ? disabledSelectCls : selectCls}>
                                            <option value="">— Select office type —</option>
                                            <option value="HO">HO — Head Office</option>
                                            <option value="RO">RO — Regional Office</option>
                                            <option value="TE">TE — Training Establishment</option>
                                        </select>
                                    </SelectWrapper>
                                    {checkingOfficeInbox && (
                                        <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                                            <Loader2 size={12} className="animate-spin" /> Checking case inbox…
                                        </div>
                                    )}
                                </div>

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
                                            <>
                                                <SelectWrapper>
                                                    <select value={form.location} onChange={e => handleLocationChange(e.target.value)} disabled={checkingLocationInbox || isLocalAdmin} className={(checkingLocationInbox || isLocalAdmin) ? disabledSelectCls : selectCls}>
                                                        <option value="">— Select location —</option>
                                                        {locations.map(l => (
                                                            <option key={l.location} value={l.location}>{l.location}</option>
                                                        ))}
                                                    </select>
                                                </SelectWrapper>
                                                {checkingLocationInbox && (
                                                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                                                        <Loader2 size={12} className="animate-spin" /> Checking inbox…
                                                    </div>
                                                )}
                                            </>
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

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <Label><Layers size={10} className="inline mr-0.5" />{isDDMUser ? 'District' : 'Department'}</Label>
                                        {isROTE ? (
                                            // RO/TE: DDM option always visible, with conditional content below
                                            <div className="space-y-2">
                                                {/* DDM option - always visible for RO/TE */}
                                                {!needsLoc && form.office_type && (
                                                    <label className="flex items-center gap-3 px-3 py-2 cursor-pointer border border-blue-200 rounded-lg bg-blue-50 hover:bg-blue-100">
                                                        <input
                                                            type="checkbox"
                                                            checked={form.department_name === 'DDM'}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    set('department_name', 'DDM');
                                                                    set('department_short_code', '');
                                                                    set('department_short_code_multi', []);
                                                                } else {
                                                                    set('department_name', '');
                                                                    set('department_short_code', '');
                                                                    set('department_short_code_multi', []);
                                                                }
                                                            }}
                                                            className="rounded accent-[#0A66C2]"
                                                        />
                                                        <span className="text-sm font-semibold text-blue-700">DDM — District Development Manager</span>
                                                    </label>
                                                )}

                                                {/* District dropdown for DDM users OR Department checkboxes for regular users */}
                                                {isDDMUser ? (
                                                    // District dropdown for checked DDM
                                                    <SelectWrapper>
                                                        <select value={form.department_short_code || ''}
                                                            onChange={e => handleDDMDistrictChange(e.target.value)}
                                                            disabled={!form.location}
                                                            className={!form.location ? disabledSelectCls : selectCls}>
                                                            <option value="">— Select district —</option>
                                                            {(DDM_DISTRICTS[form.location] || []).map(d => (
                                                                <option key={d} value={d}>{d}</option>
                                                            ))}
                                                        </select>
                                                    </SelectWrapper>
                                                ) : (
                                                    // Department checkboxes for unchecked DDM
                                                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                                                        {needsLoc ? (
                                                            <p className="px-3 py-2 text-sm text-slate-400">— Select location first —</p>
                                                        ) : !form.office_type ? (
                                                            <p className="px-3 py-2 text-sm text-slate-400">— Select office type first —</p>
                                                        ) : (
                                                            <>
                                                                {depts.length > 0 && (
                                                                    <label className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50 border-b border-slate-100 bg-slate-50 font-semibold">
                                                                        <input
                                                                            type="checkbox"
                                                                            checked={(form.department_short_code_multi || []).length === depts.length && depts.length > 0}
                                                                            indeterminate={(form.department_short_code_multi || []).length > 0 && (form.department_short_code_multi || []).length < depts.length}
                                                                            onChange={() => {
                                                                                const currentCodes = form.department_short_code_multi || [];
                                                                                const allSelected = currentCodes.length === depts.length;
                                                                                const newCodes = allSelected ? [] : depts.map(d => d.shortCode);
                                                                                const firstDept = depts.find(dept => dept.shortCode === newCodes[0]);
                                                                                set('department_short_code',       newCodes[0] || '');
                                                                                set('department_short_code_multi', newCodes);
                                                                                set('department_name',             firstDept?.name || '');

                                                                                // RO/TE: check inbox for all departments removed vs original
                                                                                const originalCodes = originalGroupInfoRef.current.deptCodes.map(c => c.toLowerCase());
                                                                                const removedCodes = originalCodes.filter(c => !newCodes.map(n => n.toLowerCase()).includes(c));
                                                                                if (removedCodes.length > 0) {
                                                                                    checkDeptInbox(removedCodes);
                                                                                } else {
                                                                                    setShowDeptBlock(false);
                                                                                    setDeptPendingCases([]);
                                                                                }
                                                                            }}
                                                                            className="rounded accent-[#0A66C2]"
                                                                        />
                                                                        <span className="text-sm text-slate-700">{(form.department_short_code_multi || []).length === depts.length && depts.length > 0 ? 'Deselect All' : 'Select All'}</span>
                                                                    </label>
                                                                )}
                                                                <div className="max-h-40 overflow-y-auto divide-y divide-slate-100">
                                                                    {depts.map(d => (
                                                                        <label key={d.name} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-slate-50">
                                                                            <input
                                                                                type="checkbox"
                                                                                checked={(form.department_short_code_multi || []).includes(d.shortCode)}
                                                                                onChange={() => {
                                                                                    const currentCodes = form.department_short_code_multi || [];
                                                                                    const isRemoving = currentCodes.includes(d.shortCode);
                                                                                    const newCodes = isRemoving
                                                                                        ? currentCodes.filter(c => c !== d.shortCode)
                                                                                        : [...currentCodes, d.shortCode];
                                                                                    const firstDept = depts.find(dept => dept.shortCode === newCodes[0]);
                                                                                    set('department_short_code',       newCodes[0] || '');
                                                                                    set('department_short_code_multi', newCodes);
                                                                                    set('department_name',             firstDept?.name || '');

                                                                                    // RO/TE: check inbox for all departments removed vs original
                                                                                    const originalCodes = originalGroupInfoRef.current.deptCodes.map(c => c.toLowerCase());
                                                                                    const removedCodes = originalCodes.filter(c => !newCodes.map(n => n.toLowerCase()).includes(c));
                                                                                    if (removedCodes.length > 0) {
                                                                                        checkDeptInbox(removedCodes);
                                                                                    } else {
                                                                                        setShowDeptBlock(false);
                                                                                        setDeptPendingCases([]);
                                                                                    }
                                                                                }}
                                                                                className="rounded accent-[#0A66C2]"
                                                                            />
                                                                            <span className="text-sm text-slate-700">{d.name}</span>
                                                                        </label>
                                                                    ))}
                                                                </div>
                                                            </>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <SelectWrapper>
                                                <select value={form.department_name}
                                                    onChange={e => handleDepartmentChange(e.target.value)}
                                                    disabled={!form.office_type || (isLocalAdmin && isHO)}
                                                    className={!form.office_type || (isLocalAdmin && isHO) ? disabledSelectCls : selectCls}>
                                                    <option value="">
                                                        {!form.office_type ? '— Select office type first —' : (isLocalAdmin && isHO) ? '— Not editable —' : '— Select department —'}
                                                    </option>
                                                    {depts.map(d => (
                                                        <option key={d.name} value={d.name}>{d.name}</option>
                                                    ))}
                                                </select>
                                            </SelectWrapper>
                                        )}
                                    </div>
                                    <div className="space-y-1">
                                        <Label><Tag size={10} className="inline mr-0.5" />{isDDMUser ? 'District Code' : 'Dept. Short Code'}</Label>
                                        <input type="text" readOnly
                                            value={isDDMUser
                                                ? (form.department_short_code || '')
                                                : (isROTE
                                                    ? (form.department_short_code_multi || []).join(',')
                                                    : (form.department_short_code || ''))}
                                            placeholder="Auto-filled"
                                            className={readonlyCls} />
                                        {isDDMUser && errors.department_short_code && <p className="text-xs text-red-500">{errors.department_short_code}</p>}
                                    </div>
                                </div>
                                {checkingDeptInbox && (
                                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                                        <Loader2 size={12} className="animate-spin" /> Checking case inbox for department…
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Office type change — pending cases block */}
                        {showOfficeBlock && officePendingCases.length > 0 && (
                            <div className="space-y-2">
                                <div className="flex items-start gap-2.5 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                                    <AlertCircle size={15} className="mt-0.5 shrink-0 text-amber-500" />
                                    <span>Cannot change Office Type — this user has pending cases. Delegate or resolve them first.</span>
                                </div>
                                <div className="border border-slate-200 rounded-xl overflow-hidden">
                                    <div className="px-3 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                                        <span className="text-xs font-semibold text-slate-600">Pending Cases</span>
                                        <span className="px-2 py-0.5 text-xs bg-amber-100 text-amber-700 rounded-full font-medium">{officePendingCases.length}</span>
                                    </div>
                                    <div className="divide-y divide-slate-100 max-h-52 overflow-y-auto">
                                        {officePendingCases.map((task, idx) => {
                                            const caseName = pf(task, 'object_name') || task.caseName || '—';
                                            const desc     = pf(task, 'description') || '';
                                            const status   = pf(task, 'status') || task.status || '';
                                            const priority = pf(task, 'task_priority') || task.priority || '';
                                            return (
                                                <div key={pf(task, 'id') || task.id || idx} className="px-3 py-2.5 flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-medium text-slate-800 truncate">{caseName}</p>
                                                        <p className="text-xs text-slate-500 truncate">{desc}</p>
                                                    </div>
                                                    <div className="shrink-0 flex items-center gap-1.5">
                                                        {status && <span className="px-1.5 py-0.5 text-xs rounded-full bg-blue-50 text-blue-700 font-medium whitespace-nowrap">{status}</span>}
                                                        {priority && (
                                                            <span className={`px-1.5 py-0.5 text-xs rounded-full font-medium whitespace-nowrap ${
                                                                priority === 'High' ? 'bg-red-100 text-red-700' :
                                                                priority === 'Medium' ? 'bg-amber-100 text-amber-700' :
                                                                'bg-slate-100 text-slate-600'
                                                            }`}>{priority}</span>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDelegateClick(task)}
                                                            className="flex items-center gap-1 px-2 py-1 bg-[#0A66C2] hover:bg-[#094d92] text-white text-xs font-semibold rounded-lg transition-all whitespace-nowrap">
                                                            <ArrowRightLeft size={11} /> Delegate
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Department change — pending cases block */}
                        {showDeptBlock && deptPendingCases.length > 0 && (
                            <div className="space-y-2">
                                <div className="flex items-start gap-2.5 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                                    <AlertCircle size={15} className="mt-0.5 shrink-0 text-amber-500" />
                                    <span>Cannot change department — this user has pending cases in the department. Delegate or resolve them first.</span>
                                </div>
                                <div className="border border-slate-200 rounded-xl overflow-hidden">
                                    <div className="px-3 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                                        <span className="text-xs font-semibold text-slate-600">Pending Cases</span>
                                        <span className="px-2 py-0.5 text-xs bg-amber-100 text-amber-700 rounded-full font-medium">{deptPendingCases.length}</span>
                                    </div>
                                    <div className="divide-y divide-slate-100 max-h-52 overflow-y-auto">
                                        {deptPendingCases.map((task, idx) => {
                                            const caseName = pf(task, 'object_name') || task.caseName || '—';
                                            const desc     = pf(task, 'description') || '';
                                            const status   = pf(task, 'status') || task.status || '';
                                            const priority = pf(task, 'task_priority') || task.priority || '';
                                            return (
                                                <div key={pf(task, 'id') || task.id || idx} className="px-3 py-2.5 flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-medium text-slate-800 truncate">{caseName}</p>
                                                        <p className="text-xs text-slate-500 truncate">{desc}</p>
                                                    </div>
                                                    <div className="shrink-0 flex items-center gap-1.5">
                                                        {status && <span className="px-1.5 py-0.5 text-xs rounded-full bg-blue-50 text-blue-700 font-medium whitespace-nowrap">{status}</span>}
                                                        {priority && (
                                                            <span className={`px-1.5 py-0.5 text-xs rounded-full font-medium whitespace-nowrap ${
                                                                priority === 'High' ? 'bg-red-100 text-red-700' :
                                                                priority === 'Medium' ? 'bg-amber-100 text-amber-700' :
                                                                'bg-slate-100 text-slate-600'
                                                            }`}>{priority}</span>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDelegateClick(task)}
                                                            className="flex items-center gap-1 px-2 py-1 bg-[#0A66C2] hover:bg-[#094d92] text-white text-xs font-semibold rounded-lg transition-all whitespace-nowrap">
                                                            <ArrowRightLeft size={11} /> Delegate
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Location change — pending cases block (RO/TE only) */}
                        {showLocationBlock && locationPendingCases.length > 0 && ['RO', 'TE'].includes(form.office_type) && (
                            <div className="space-y-2">
                                <div className="flex items-start gap-2.5 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                                    <AlertCircle size={15} className="mt-0.5 shrink-0 text-amber-500" />
                                    <span>Cannot change location — this user has pending cases from the current location. Delegate or resolve them first.</span>
                                </div>
                                <div className="border border-slate-200 rounded-xl overflow-hidden">
                                    <div className="px-3 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                                        <span className="text-xs font-semibold text-slate-600">Pending Cases</span>
                                        <span className="px-2 py-0.5 text-xs bg-amber-100 text-amber-700 rounded-full font-medium">{locationPendingCases.length}</span>
                                    </div>
                                    <div className="divide-y divide-slate-100 max-h-52 overflow-y-auto">
                                        {locationPendingCases.map((task, idx) => {
                                            const caseName = pf(task, 'object_name') || task.caseName || '—';
                                            const desc     = pf(task, 'description') || '';
                                            const status   = pf(task, 'status') || task.status || '';
                                            const priority = pf(task, 'task_priority') || task.priority || '';
                                            return (
                                                <div key={pf(task, 'id') || task.id || idx} className="px-3 py-2.5 flex items-start justify-between gap-3">
                                                    <div className="min-w-0">
                                                        <p className="text-xs font-medium text-slate-800 truncate">{caseName}</p>
                                                        <p className="text-xs text-slate-500 truncate">{desc}</p>
                                                    </div>
                                                    <div className="shrink-0 flex items-center gap-1.5">
                                                        {status && <span className="px-1.5 py-0.5 text-xs rounded-full bg-blue-50 text-blue-700 font-medium whitespace-nowrap">{status}</span>}
                                                        {priority && (
                                                            <span className={`px-1.5 py-0.5 text-xs rounded-full font-medium whitespace-nowrap ${
                                                                priority === 'High' ? 'bg-red-100 text-red-700' :
                                                                priority === 'Medium' ? 'bg-amber-100 text-amber-700' :
                                                                'bg-slate-100 text-slate-600'
                                                            }`}>{priority}</span>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDelegateClick(task)}
                                                            className="flex items-center gap-1 px-2 py-1 bg-[#0A66C2] hover:bg-[#094d92] text-white text-xs font-semibold rounded-lg transition-all whitespace-nowrap">
                                                            <ArrowRightLeft size={11} /> Delegate
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* ── User State (Super Admin only) ── */}
                        {isSuperAdmin && <div className="space-y-3">
                            <div className="space-y-1">
                                <Label>User State</Label>
                                <SelectWrapper>
                                    <select
                                        value={String(form.is_active ?? false)}
                                        onChange={e => handleStatusChange(e.target.value)}
                                        disabled={checkingInbox}
                                        className={checkingInbox ? disabledSelectCls : selectCls}
                                    >
                                        <option value="true">Active</option>
                                        <option value="false">Inactive</option>
                                    </select>
                                </SelectWrapper>
                                {checkingInbox && (
                                    <div className="flex items-center gap-2 text-xs text-slate-400 mt-1">
                                        <Loader2 size={12} className="animate-spin" /> Checking inbox…
                                    </div>
                                )}
                            </div>

                            {/* Pending cases block */}
                            {showPendingBlock && pendingCases.length > 0 && (
                                <div className="space-y-2">
                                    <div className="flex items-start gap-2.5 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                                        <AlertCircle size={15} className="mt-0.5 shrink-0 text-amber-500" />
                                        <span>Delegate the pending cases to make this user inactive.</span>
                                    </div>
                                    <div className="border border-slate-200 rounded-xl overflow-hidden">
                                        <div className="px-3 py-2 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                                            <span className="text-xs font-semibold text-slate-600">Pending Cases</span>
                                            <span className="px-2 py-0.5 text-xs bg-amber-100 text-amber-700 rounded-full font-medium">{pendingCases.length}</span>
                                        </div>
                                        <div className="divide-y divide-slate-100 max-h-52 overflow-y-auto">
                                            {pendingCases.map((task, idx) => {
                                                const caseName = pf(task, 'object_name') || task.caseName || '—';
                                                const desc     = pf(task, 'description') || '';
                                                const status   = pf(task, 'status') || task.status || '';
                                                const priority = pf(task, 'task_priority') || task.priority || '';
                                                return (
                                                    <div key={pf(task, 'id') || task.id || idx} className="px-3 py-2.5 flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <p className="text-xs font-medium text-slate-800 truncate">{caseName}</p>
                                                            <p className="text-xs text-slate-500 truncate">{desc}</p>
                                                        </div>
                                                        <div className="shrink-0 flex items-center gap-1.5">
                                                            {status && <span className="px-1.5 py-0.5 text-xs rounded-full bg-blue-50 text-blue-700 font-medium whitespace-nowrap">{status}</span>}
                                                            {priority && (
                                                                <span className={`px-1.5 py-0.5 text-xs rounded-full font-medium whitespace-nowrap ${
                                                                    priority === 'High' ? 'bg-red-100 text-red-700' :
                                                                    priority === 'Medium' ? 'bg-amber-100 text-amber-700' :
                                                                    'bg-slate-100 text-slate-600'
                                                                }`}>{priority}</span>
                                                            )}
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDelegateClick(task)}
                                                                className="flex items-center gap-1 px-2 py-1 bg-[#0A66C2] hover:bg-[#094d92] text-white text-xs font-semibold rounded-lg transition-all whitespace-nowrap">
                                                                <ArrowRightLeft size={11} /> Delegate
                                                            </button>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>}

                    </form>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                    <button onClick={onClose}
                        className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
                        Cancel
                    </button>
                    <button type="submit" form="editProfileForm" disabled={loading || loadingForm || checkingInbox || checkingOfficeInbox || checkingDeptInbox || checkingLocationInbox || (isSuperAdmin && showPendingBlock) || showOfficeBlock || showDeptBlock || showLocationBlock}
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
