import React, { useState, useRef, useEffect } from 'react';
import { Bell, User, LogOut, ChevronDown, Check } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Topbar = () => {
    const navigate = useNavigate();
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const dropdownRef = useRef(null);
    const [user, setUser] = useState(null);

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }

        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsProfileOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleLogout = () => {
        localStorage.removeItem('user');
        navigate('/login');
    };

    if (!user) return null;

    // Helper to get initials
    const getInitials = (name) => {
        return name ? name.charAt(0).toUpperCase() : 'U';
    };

    return (
        <header className="h-16 bg-white border-b border-slate-200 fixed top-0 right-0 left-64 z-10 flex items-center justify-end px-8 shadow-sm">
            <div className="flex items-center gap-6">
                
                {/* Notification Icon */}
                <button className="relative p-2 text-slate-500 hover:text-[#0A66C2] hover:bg-blue-50 rounded-full transition-colors">
                    <Bell size={20} />
                    <span className="absolute top-1.5 right-2 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
                </button>

                {/* Profile Section */}
                <div className="relative" ref={dropdownRef}>
                    <button 
                        onClick={() => setIsProfileOpen(!isProfileOpen)}
                        className="flex items-center gap-3 pl-2 pr-1 py-1 rounded-full hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-200"
                    >
                        <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-[#0A66C2] font-bold text-sm">
                            {getInitials(user.properties?.user_name)}
                        </div>
                        <ChevronDown size={16} className={`text-slate-400 transition-transform ${isProfileOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Profile Dropdown */}
                    {isProfileOpen && (
                        <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden text-sm animate-in fade-in zoom-in-95 duration-200">
                            {/* User Header */}
                            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                                <p className="font-bold text-slate-800 text-base mb-0.5">{user.properties?.user_name}</p>
                                <p className="text-slate-500 text-xs break-all">{user.properties?.user_address || 'No email'}</p>
                            </div>

                            {/* Details */}
                            <div className="p-4 space-y-3">
                                <div>
                                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Privileges</label>
                                    <div className="flex items-center gap-2 mt-1 text-slate-700">
                                        <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                                        <span>{user.properties?.user_privileges === 16 ? 'Superuser' : 'Standard User'}</span>
                                    </div>
                                </div>
                                 <div>
                                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Status</label>
                                    <div className="flex items-center gap-2 mt-1 text-slate-700">
                                        <Check size={14} className="text-green-600" />
                                        <span>Active</span>
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="p-2 border-t border-slate-100 bg-slate-50">
                                <button 
                                    onClick={handleLogout}
                                    className="w-full flex items-center justify-center gap-2 p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors font-medium"
                                >
                                    <LogOut size={16} />
                                    Sign Out
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
};

export default Topbar;
