import React, { useState, useRef, useEffect } from 'react';
import { User, LogOut, ChevronDown, Check, Key, Copy, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from '../../api/axios';

const Topbar = () => {
    const navigate = useNavigate();
    const [isProfileOpen, setIsProfileOpen] = useState(false);
    const [isTicketOpen, setIsTicketOpen] = useState(false);
    const dropdownRef = useRef(null);
    const ticketDropdownRef = useRef(null);
    const [user, setUser] = useState(null);

    // Login ticket state
    const [currentUser, setCurrentUser] = useState(null);
    const [users, setUsers] = useState([]);
    const [selectedUser, setSelectedUser] = useState('');
    const [loadingUsers, setLoadingUsers] = useState(false);
    const [loginTicket, setLoginTicket] = useState(null);
    const [ticketLoading, setTicketLoading] = useState(false);
    const [ticketError, setTicketError] = useState(null);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }

        // Fetch current user info for login ticket
        fetchCurrentUser();

        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsProfileOpen(false);
            }
            if (ticketDropdownRef.current && !ticketDropdownRef.current.contains(event.target)) {
                setIsTicketOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchCurrentUser = async () => {
        try {
            const response = await axios.get('/auth/current-user');
            setCurrentUser(response.data);
        } catch (error) {
            console.error('Error fetching current user:', error);
        }
    };

    const fetchUsers = async () => {
        setLoadingUsers(true);
        try {
            const response = await axios.get('/auth/users');
            if (response.data.success) {
                setUsers(response.data.users || []);
                // Set current user as default selection
                if (response.data.users.length > 0 && currentUser) {
                    setSelectedUser(currentUser.username);
                }
            }
        } catch (error) {
            console.error('Error fetching users:', error);
        } finally {
            setLoadingUsers(false);
        }
    };

    const fetchLoginTicket = async () => {
        if (!selectedUser) {
            setTicketError('Please select a user');
            return;
        }

        setTicketLoading(true);
        setTicketError(null);
        setLoginTicket(null);

        try {
            const response = await axios.get(`/auth/login-ticket/${selectedUser}`);
            if (response.data.success) {
                setLoginTicket(response.data.loginTicket);
            } else {
                setTicketError(response.data.error || 'Failed to generate login ticket');
            }
        } catch (error) {
            setTicketError(error.response?.data?.error || error.message || 'Failed to generate login ticket');
        } finally {
            setTicketLoading(false);
        }
    };

    const copyTicket = () => {
        if (loginTicket) {
            navigator.clipboard.writeText(loginTicket);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

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
                {/* Login Ticket Section */}
                <div className="relative" ref={ticketDropdownRef}>
                    <button
                        onClick={() => {
                            setIsTicketOpen(!isTicketOpen);
                            if (!isTicketOpen && users.length === 0) {
                                fetchUsers();
                            }
                        }}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-200 text-slate-600 hover:text-[#0A66C2]"
                        title="Get Login Ticket for Support"
                    >
                        <Key size={18} />
                        <span className="text-sm font-medium">Login Ticket</span>
                        <ChevronDown size={14} className={`text-slate-400 transition-transform ${isTicketOpen ? 'rotate-180' : ''}`} />
                    </button>

                    {/* Login Ticket Dropdown */}
                    {isTicketOpen && (
                        <div className="absolute right-0 top-full mt-2 w-96 bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden text-sm animate-in fade-in zoom-in-95 duration-200">
                            {/* Header */}
                            <div className="p-4 border-b border-slate-100 bg-slate-50/50">
                                <div className="flex items-center gap-2 mb-2">
                                    <Key size={16} className="text-[#0A66C2]" />
                                    <p className="font-bold text-slate-800 text-base">Get Login Ticket</p>
                                </div>
                                <p className="text-xs text-slate-500">Generate a temporary authentication ticket</p>
                            </div>

                            {/* Content */}
                            <div className="p-4 space-y-3">
                                {/* User Selection Dropdown */}
                                <div>
                                    <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                        Select User to Impersonate
                                    </label>
                                    {loadingUsers ? (
                                        <div className="mt-1 px-3 py-2 bg-slate-50 rounded-lg text-slate-500 text-sm flex items-center gap-2">
                                            <Loader2 size={14} className="animate-spin" />
                                            Loading users...
                                        </div>
                                    ) : (
                                        <select
                                            value={selectedUser}
                                            onChange={(e) => {
                                                setSelectedUser(e.target.value);
                                                setLoginTicket(null); // Clear previous ticket
                                                setTicketError(null);
                                            }}
                                            className="mt-1 w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#0A66C2] bg-white"
                                        >
                                            <option value="">Select a user...</option>
                                            {users.map((user) => (
                                                <option key={user.username} value={user.username}>
                                                    {user.username} {user.email ? `(${user.email})` : ''} {user.isSuperuser ? '- SUPERUSER' : ''}
                                                </option>
                                            ))}
                                        </select>
                                    )}
                                    <p className="text-xs text-slate-500 mt-1 italic">
                                        ⚠️ Support team only: Generate ticket to troubleshoot user issues
                                    </p>
                                </div>

                                {/* Fetch Button */}
                                <button
                                    onClick={fetchLoginTicket}
                                    disabled={ticketLoading}
                                    className="w-full px-4 py-2 bg-[#0A66C2] text-white rounded-lg text-sm font-medium hover:bg-[#094d92] disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {ticketLoading ? (
                                        <>
                                            <Loader2 size={16} className="animate-spin" />
                                            Fetching...
                                        </>
                                    ) : (
                                        <>
                                            <Key size={16} />
                                            Get Ticket
                                        </>
                                    )}
                                </button>

                                {/* Error Display */}
                                {ticketError && (
                                    <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
                                        {ticketError}
                                    </div>
                                )}

                                {/* Ticket Display */}
                                {loginTicket && (
                                    <div className="space-y-2">
                                        <label className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Login Ticket</label>
                                        <div className="relative">
                                            <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-slate-700 font-mono text-xs break-all max-h-32 overflow-y-auto">
                                                {loginTicket}
                                            </div>
                                            <button
                                                onClick={copyTicket}
                                                className="absolute top-2 right-2 p-1.5 bg-white border border-slate-200 rounded hover:bg-slate-50 transition-colors"
                                                title="Copy ticket"
                                            >
                                                {copied ? (
                                                    <Check size={14} className="text-green-600" />
                                                ) : (
                                                    <Copy size={14} className="text-slate-600" />
                                                )}
                                            </button>
                                        </div>
                                        <p className="text-xs text-slate-500 italic">
                                            ⏱️ Ticket expires in ~10 minutes
                                        </p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>

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
