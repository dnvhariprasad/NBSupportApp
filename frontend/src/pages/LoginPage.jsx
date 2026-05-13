import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, Loader2, ArrowRight, Compass, Mail, Eye, EyeOff } from 'lucide-react';
import api from '../api/axios';

// Determine repository based on environment
const getDefaultRepository = () => {
    // Check for explicit environment variable first
    if (import.meta.env.VITE_DCTM_REPOSITORY) {
        console.log('[DCTM] Using environment variable:', import.meta.env.VITE_DCTM_REPOSITORY);
        return import.meta.env.VITE_DCTM_REPOSITORY;
    }

    // Check hostname to determine environment
    const hostname = window.location.hostname.toLowerCase();
    console.log('[DCTM] Detected hostname:', hostname);

    // Production: use EDMS (exact match first)
    if (hostname === 'neo.nabard.org' || hostname.endsWith('.neo.nabard.org')) {
        console.log('[DCTM] Environment: Production (neo.nabard.org) - Using EDMS');
        return 'EDMS';
    }

    // UAT: use NABARDUAT (exact match first)
    if (hostname === 'ecmrevampuat.nabard.org' || hostname.endsWith('.ecmrevampuat.nabard.org')) {
        console.log('[DCTM] Environment: UAT (ecmrevampuat.nabard.org) - Using NABARDUAT');
        return 'NABARDUAT';
    }

    // Azure: use NABARDUAT
    if (hostname === '172.172.20.214' || hostname.includes('172.172.20.214') || hostname.includes('azure')) {
        console.log('[DCTM] Environment: Azure (172.172.20.214) - Using NABARDUAT');
        return 'NABARDUAT';
    }

    // Check for environment keywords as fallback
    if (hostname.includes('production') || hostname.includes('prod')) {
        console.log('[DCTM] Environment: Production (keyword match) - Using EDMS');
        return 'EDMS';
    }

    if (hostname.includes('uat') || hostname.includes('test')) {
        console.log('[DCTM] Environment: UAT (keyword match) - Using NABARDUAT');
        return 'NABARDUAT';
    }

    // Local/default: NABARDUAT
    console.log('[DCTM] Environment: Development/Local (default) - Using NABARDUAT');
    return 'NABARDUAT';
};

// Determine OTDS URL based on environment
const getOtdsUrl = () => {
    // Check for explicit environment variable first (highest priority)
    if (import.meta.env.VITE_OTDS_URL) {
        console.log('[OTDS] Using environment variable:', import.meta.env.VITE_OTDS_URL);
        return import.meta.env.VITE_OTDS_URL;
    }

    // Check hostname to determine environment
    const hostname = window.location.hostname.toLowerCase();
    console.log('[OTDS] Detected hostname:', hostname);

    // Production: neo.nabard.org (check with exact match first)
    if (hostname === 'neo.nabard.org' || hostname.endsWith('.neo.nabard.org')) {
        const url = 'https://neo.nabard.org/proxy/otds/Integration/otds-proxy/token';
        console.log('[OTDS] Environment: Production (neo.nabard.org)');
        return url;
    }

    // UAT: ecmrevampuat.nabard.org (check with exact match first)
    if (hostname === 'ecmrevampuat.nabard.org' || hostname.endsWith('.ecmrevampuat.nabard.org')) {
        const url = 'https://ecmrevampuat.nabard.org/proxy/otds/Integration/otds-proxy/token';
        console.log('[OTDS] Environment: UAT (ecmrevampuat.nabard.org)');
        return url;
    }

    // Azure: IP-based or contains 'azure'
    if (hostname === '172.172.20.214' || hostname.includes('172.172.20.214') || hostname.includes('azure')) {
        const url = 'http://172.172.20.214/proxy/otds/Integration/otds-proxy/token';
        console.log('[OTDS] Environment: Azure (172.172.20.214)');
        return url;
    }

    // Check for environment keywords as fallback
    if (hostname.includes('production') || hostname.includes('prod')) {
        const url = 'https://neo.nabard.org/proxy/otds/Integration/otds-proxy/token';
        console.log('[OTDS] Environment: Production (keyword match)');
        return url;
    }

    if (hostname.includes('uat') || hostname.includes('test')) {
        const url = 'https://ecmrevampuat.nabard.org/proxy/otds/Integration/otds-proxy/token';
        console.log('[OTDS] Environment: UAT (keyword match)');
        return url;
    }

    // Local/default: use Azure IP for development
    const url = 'http://172.172.20.214/proxy/otds/Integration/otds-proxy/token';
    console.log('[OTDS] Environment: Development/Local (default)');
    return url;
};

const LoginPage = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        repository: getDefaultRepository()
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [showPassword, setShowPassword] = useState(false);
    const [authConfig, setAuthConfig] = useState(null);

    // Fetch environment-specific auth config from backend on component mount
    React.useEffect(() => {
        const fetchAuthConfig = async () => {
            try {
                const response = await api.get('/auth/config');
                if (response.data) {
                    console.log('[AUTH] Backend config loaded:', response.data);
                    console.log('[AUTH] Active Environment:', response.data.environment);
                    console.log('[AUTH] Repository:', response.data.repository);
                    console.log('[AUTH] OTDS Token API URL:', response.data.otdsTokenApiUrl);
                    setAuthConfig(response.data);
                    // Update formData with repository from backend
                    setFormData(prev => ({
                        ...prev,
                        repository: response.data.repository || prev.repository
                    }));
                }
            } catch (err) {
                console.error('[AUTH] Failed to fetch auth config from backend:', err);
                console.warn('[AUTH] Error details:', err.message);
                // Fallback to client-side detection if backend endpoint fails
                console.log('[AUTH] Falling back to client-side environment detection');
            }
        };
        fetchAuthConfig();
    }, []);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        setError(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            // Step 1: Authenticate with OTDS
            const params = new URLSearchParams();
            params.append('username', formData.username);
            params.append('password', formData.password);
            params.append('captcha_id', 'dev-no-captcha');
            params.append('captcha_answer', '0');

            // Use OTDS endpoint from backend config (priority) or fallback to client-side detection
            const otdsUrl = authConfig?.otdsTokenApiUrl || getOtdsUrl();
            console.log('[LOGIN] Attempting OTDS authentication with URL:', otdsUrl);
            console.log('[LOGIN] Using backend config:', !!authConfig?.otdsTokenApiUrl);
            const otdsResponse = await fetch(otdsUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: params.toString()
            });

            if (!otdsResponse.ok) {
                // Show user-friendly error message for authentication failures
                if (otdsResponse.status === 400 || otdsResponse.status === 401 || otdsResponse.status === 403) {
                    setError('Invalid username or password. Please try again.');
                } else {
                    const errorData = await otdsResponse.json().catch(() => ({}));
                    setError(errorData.message || 'Authentication service unavailable. Please try again later.');
                }
                return;
            }

            const otdsData = await otdsResponse.json();
            const token = otdsData.token || otdsData.access_token;

            if (!token) {
                setError('No token received from authentication service');
                return;
            }

            // Step 2: Store token and fetch user profile from backend
            localStorage.setItem('token', token);

            // Fetch user profile from backend with the OTDS token and username
            const userResponse = await api.get('/auth/profile', {
                params: { username: formData.username },
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (userResponse.data) {
                localStorage.setItem('user', JSON.stringify(userResponse.data));
                navigate('/dashboard');
            } else {
                setError('Failed to fetch user profile');
            }
        } catch (err) {
            console.error(err);
            if (err.response?.status === 401 || err.response?.status === 400) {
                setError('Invalid username or password. Please try again.');
            } else if (err.response?.data?.message) {
                setError(err.response.data.message);
            } else {
                setError('Service unavailable. Please check your connection and try again.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex font-sans">
            {/* Left Side - Brand Section (Blue) */}
            <div className="hidden lg:flex w-[45%] bg-[#0A66C2] relative flex-col justify-between p-12 text-white overflow-hidden">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-10" 
                     style={{
                         backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
                         backgroundSize: '32px 32px'
                     }}>
                </div>
                
                {/* Decorative Circles */}
                <div className="absolute -bottom-24 -left-24 w-96 h-96 rounded-full border border-white/10" />
                <div className="absolute -bottom-10 -left-10 w-64 h-64 rounded-full border border-white/10" />

                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-16">
                        <div className="p-1.5 bg-white/20 rounded-lg backdrop-blur-sm">
                            <Compass size={28} className="text-white" />
                        </div>
                        <span className="text-2xl font-bold tracking-tight">NB Admin</span>
                    </div>
                </div>

                <div className="relative z-10">
                </div>
            </div>

            {/* Right Side - Login Form (Light Grey) */}
            <div className="flex-1 bg-[#F8F9FA] flex flex-col justify-center items-center p-8 relative">
                <motion.div 
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="w-full max-w-md bg-white rounded-xl shadow-lg p-8 md:p-10"
                >
                    <div className="mb-8">
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Sign In</h2>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        
                        <div>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                    <Mail size={18} className="text-gray-400" />
                                </div>
                                <input
                                    id="username"
                                    type="text"
                                    name="username"
                                    value={formData.username}
                                    onChange={handleChange}
                                    className="block w-full pl-10 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg
                                             text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#0A66C2]
                                             transition-all text-sm"
                                    placeholder="Username"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                    <Lock size={18} className="text-gray-400" />
                                </div>
                                <input
                                    id="password"
                                    type={showPassword ? 'text' : 'password'}
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    className="block w-full pl-10 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-lg
                                             text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#0A66C2]
                                             transition-all text-sm"
                                    placeholder="Password"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-gray-400 hover:text-gray-600 transition-colors"
                                    title={showPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="p-3 rounded-lg bg-red-50 border border-red-100 text-red-600 text-xs font-medium flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isLoading}
                            className="w-full flex items-center justify-center py-2.5 px-4 rounded-lg shadow-sm text-sm font-bold text-white 
                                     bg-[#1877F2] hover:bg-[#166fe5] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#1877F2] 
                                     disabled:opacity-70 disabled:cursor-not-allowed transition-all gap-2"
                        >
                            {isLoading ? (
                                <Loader2 className="animate-spin h-4 w-4" />
                            ) : (
                                <>
                                    <span>Sign In</span>
                                    <ArrowRight className="h-4 w-4" />
                                </>
                            )}
                        </button>
                    </form>


                </motion.div>

            </div>
        </div>
    );
};

export default LoginPage;
