import { NavLink } from 'react-router-dom';
import { GitBranch, Users, Compass, Briefcase, UsersRound, Database, Network, ClipboardList, FolderCog, Building2, FileBarChart2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import api from '../../api/axios';

const Sidebar = () => {
    const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
    const adminRole = storedUser.properties?.admin_role || storedUser.admin_role || null;
    const username = storedUser.properties?.user_name || storedUser.user_name || null;
    const isSuperAdmin = adminRole === 'Super Admin';
    const isLocalAdmin = adminRole === 'Local Admin';

    const [userOfficeType, setUserOfficeType] = useState(null);
    const [userDepartment, setUserDepartment] = useState(null);

    console.log('Sidebar - username:', username, 'isLocalAdmin:', isLocalAdmin, 'adminRole:', adminRole);

    // Fetch office_type and department from cms_user_profile when component mounts
    useEffect(() => {
        if (isLocalAdmin && username) {
            api.get('/users/profile-context', { params: { username } })
                .then(res => {
                    console.log('[Sidebar] Profile context response:', res.data);
                    if (res.data?.office_type) {
                        setUserOfficeType(res.data.office_type);
                    }
                    // Try multiple department field names
                    let dept = res.data?.department_short_code ||
                                 res.data?.department_name ||
                                 res.data?.profile_department_short_code ||
                                 res.data?.profile_department_name ||
                                 res.data?.dept;

                    // Check if department_short_code_multi exists (array format)
                    if (!dept && res.data?.department_short_code_multi && Array.isArray(res.data.department_short_code_multi)) {
                        const deptArray = res.data.department_short_code_multi;
                        if (deptArray.length > 0) {
                            dept = deptArray[0]; // Get first department
                        }
                    }

                    if (dept) {
                        // Normalize to uppercase for comparison
                        const normalizedDept = String(dept).toUpperCase();
                        console.log('[Sidebar] Setting department to:', normalizedDept);
                        setUserDepartment(normalizedDept);
                    } else {
                        console.log('[Sidebar] No department found in response. Available keys:', Object.keys(res.data || {}));
                    }
                })
                .catch(err => console.error('Failed to fetch profile context:', err));
        }
    }, [isLocalAdmin, username]);

    const allNavItems = [
        { name: 'User Management',        path: '/dashboard/users',     icon: Users,        roles: null },
        { name: 'NABARD Department Management',  path: '/dashboard/departments', icon: Building2,  roles: ['Super Admin'] },
        { name: 'HO Vertical Management',    path: '/dashboard/verticals', icon: Network,      roles: ['Super Admin', 'Local Admin'], hideForLocalAdminIf: 'ROTE' },
        { name: 'RO/TE Department Head Assignment',  path: '/dashboard/verticals2', icon: Network,     roles: ['Super Admin', 'Local Admin'], hideForLocalAdminIf: 'HO' },
        { name: 'Metadata',     path: '/dashboard/metadata',  icon: FolderCog,    roles: null },
        { name: 'SFS',          path: '/dashboard/sfs',       icon: FolderCog,    roles: null, showOnlyForHRMD: true },
        { name: 'Cases',        path: '/dashboard/cases',     icon: Briefcase,    roles: null },
        { name: 'Reports',      path: '/dashboard/reports',   icon: FileBarChart2, roles: null },
        { name: 'Workflows',    path: '/dashboard/workflows', icon: GitBranch,    roles: null, hideForLocalAdmin: true },
        { name: 'Query',        path: '/dashboard/query',     icon: Database,     roles: null, hideForLocalAdmin: true },
    ];

    const navItems = allNavItems.filter(item => {
        // Check if item is only for HRMD department Local Admin
        if (item.showOnlyForHRMD) {
            console.log('[Sidebar] Checking SFS menu - isSuperAdmin:', isSuperAdmin, 'isLocalAdmin:', isLocalAdmin, 'userDepartment:', userDepartment);
            // Super Admin can always see it
            if (isSuperAdmin) {
                console.log('[Sidebar] Super Admin - showing SFS');
                return true;
            }
            // Local Admin can only see it if they're HRMD
            if (isLocalAdmin) {
                const normalizedDept = String(userDepartment).toUpperCase();
                const isHRMD = normalizedDept === 'HRMD';
                console.log('[Sidebar] Local Admin HRMD check - userDepartment:', userDepartment, 'normalized:', normalizedDept, 'isHRMD:', isHRMD);
                return isHRMD;
            }
            // Regular users cannot see it
            console.log('[Sidebar] Regular user - hiding SFS');
            return false;
        }

        // Hide items for Local Admin
        if (isLocalAdmin && item.hideForLocalAdmin) {
            return false;
        }
        // Check role access
        if (item.roles && !item.roles.includes(adminRole)) {
            return false;
        }
        // Check local admin office type hiding
        if (isLocalAdmin && item.hideForLocalAdminIf) {
            if (item.hideForLocalAdminIf === 'HO' && userOfficeType === 'HO') {
                return false;
            }
            if (item.hideForLocalAdminIf === 'ROTE' && ['RO', 'TE'].includes(userOfficeType)) {
                return false;
            }
        }
        return true;
    });

    return (
        <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-screen fixed left-0 top-0 z-20 font-sans">
            {/* Logo Section */}
            <div className="p-6 mb-2">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#0A66C2] rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
                        <Compass className="text-white" size={24} />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-slate-900 leading-tight">NEO Admin</h1>
                    </div>
                </div>
            </div>

            {/* Main Navigation */}
            <div className="flex-1 px-4 overflow-y-auto">
                <div className="space-y-1">
                    {navItems.map((item) => (
                        <NavLink
                            key={item.path}
                            to={item.path}
                            className={({ isActive }) =>
                                `flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                                    isActive
                                        ? 'bg-blue-50 text-[#0A66C2]'
                                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                }`
                            }
                        >
                            {({ isActive }) => (
                                <>
                                    <item.icon size={18} className={isActive ? 'text-[#0A66C2]' : 'text-slate-500'} />
                                    {item.name}
                                </>
                            )}
                        </NavLink>
                    ))}
                </div>
            </div>
            
        </aside>
    );
};

export default Sidebar;
