import React from 'react';
import { NavLink } from 'react-router-dom';
import { GitBranch, Users, Compass, Settings, HelpCircle, Layers } from 'lucide-react';

const Sidebar = () => {
    const navItems = [
        { name: 'Workflows', path: '/dashboard/workflows', icon: GitBranch },
        { name: 'Users', path: '/dashboard/users', icon: Users },
    ];

    return (
        <aside className="w-64 bg-white border-r border-slate-200 flex flex-col h-screen fixed left-0 top-0 z-20 font-sans">
            {/* Logo Section */}
            <div className="p-6 mb-2">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-[#0A66C2] rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
                        <Compass className="text-white" size={24} />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold text-slate-900 leading-tight">NB Support</h1>
                        <p className="text-[10px] font-semibold text-slate-400 tracking-wider uppercase">Enterprise EPC</p>
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

                {/* System Section (Visual placeholder to match style) */}
                <div className="mt-8 mb-2 px-4">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">System</span>
                </div>
                <div className="space-y-1">
                    <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors text-left">
                        <Layers size={18} className="text-slate-500" />
                        <span>Analytics</span>
                    </button>
                    {/* Placeholder for more system items if needed */}
                </div>
            </div>
            
            {/* Footer Section */}
            <div className="p-4 border-t border-slate-100 space-y-1">
                <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors text-left">
                    <Settings size={18} className="text-slate-500" />
                    <span>Settings</span>
                </button>
                <button className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors text-left">
                    <HelpCircle size={18} className="text-slate-500" />
                    <span>Support</span>
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
