import { NavLink } from 'react-router-dom';
import { GitBranch, Users, Compass, Briefcase, UsersRound, Database, Network, ClipboardList, FolderCog, Building2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import api from '../../api/axios';

const Sidebar = () => {
    const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
    const adminRole = storedUser.properties?.admin_role || storedUser.admin_role || null;
    const username = storedUser.properties?.user_name || storedUser.user_name || null;
    const isLocalAdmin = adminRole === 'Local Admin';

    const [userOfficeType, setUserOfficeType] = useState(null);

    console.log('Sidebar - username:', username, 'isLocalAdmin:', isLocalAdmin, 'adminRole:', adminRole);

    // Fetch office_type from cms_user_profile when component mounts
    useEffect(() => {
        if (isLocalAdmin && username) {
            api.get('/users/profile-context', { params: { username } })
                .then(res => {
                    if (res.data?.office_type) {
                        setUserOfficeType(res.data.office_type);
                    }
                })
                .catch(err => console.error('Failed to fetch profile context:', err));
        }
    }, [isLocalAdmin, username]);

    const allNavItems = [
        { name: 'User Management',        path: '/dashboard/users',     icon: Users,        roles: null },
        { name: 'NABARD Department Management',  path: '/dashboard/departments', icon: Building2,  roles: ['Super Admin'] },
        { name: 'HO Vertical Management',    path: '/dashboard/verticals', icon: Network,      roles: ['Super Admin', 'Local Admin'], hideForLocalAdminIf: 'ROTE' },
        { name: 'RO/TE Department Assignment',  path: '/dashboard/verticals2', icon: Network,     roles: ['Super Admin', 'Local Admin'], hideForLocalAdminIf: 'HO' },
        { name: 'Metadata',     path: '/dashboard/metadata',  icon: FolderCog,    roles: null },
        { name: 'Cases',        path: '/dashboard/cases',     icon: Briefcase,    roles: null },
        { name: 'Workflows',    path: '/dashboard/workflows', icon: GitBranch,    roles: null, hideForLocalAdmin: true },
        { name: 'Query',        path: '/dashboard/query',     icon: Database,     roles: null, hideForLocalAdmin: true },
    ];

    const navItems = allNavItems.filter(item => {
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
