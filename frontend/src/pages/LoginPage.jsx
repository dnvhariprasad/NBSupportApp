import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lock, Loader2, ArrowRight, Compass, Mail } from 'lucide-react';
import api from '../api/axios';

const LoginPage = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        repository: 'NABARDUAT'
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
        setError(null);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            const response = await api.post('/auth/login', formData);
            if (response.data.authenticated) {
                localStorage.setItem('user', JSON.stringify(response.data.userDetails));
                navigate('/dashboard');
            } else {
                setError(response.data.message || 'Authentication failed');
            }
        } catch (err) {
            console.error(err);
            if (err.response && err.response.data && err.response.data.message) {
                setError(err.response.data.message);
            } else {
                setError('Service unavailable. Please contact support.');
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
                        <span className="text-2xl font-bold tracking-tight">NB Support</span>
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
                        <h2 className="text-2xl font-bold text-gray-900 mb-2">Enterprise Portal Access</h2>
                        <p className="text-gray-500 text-sm">Welcome back. Please enter your corporate credentials to continue to the dashboard.</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2" htmlFor="username">
                                Username or Email
                            </label>
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
                                    placeholder="name@company.com"
                                    required
                                />
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-sm font-semibold text-gray-700" htmlFor="password">
                                    Password
                                </label>
                                <a href="#" className="text-xs font-medium text-[#0A66C2] hover:underline">
                                    Forgot?
                                </a>
                            </div>
                            <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                                    <Lock size={18} className="text-gray-400" />
                                </div>
                                <input
                                    id="password"
                                    type="password"
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    className="block w-full pl-10 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg 
                                             text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-[#0A66C2] 
                                             transition-all text-sm"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                        </div>

                         <div className="flex items-center">
                            <input
                                id="remember-me"
                                name="remember-me"
                                type="checkbox"
                                className="h-4 w-4 text-[#0A66C2] focus:ring-[#0A66C2] border-gray-300 rounded"
                            />
                            <label htmlFor="remember-me" className="ml-2 block text-xs text-gray-500">
                                Remember this device for 30 days
                            </label>
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

                    <div className="mt-8 text-center">
                        <p className="text-sm text-gray-500">
                            Don't have an account? <a href="#" className="font-semibold text-[#0A66C2] hover:underline">Contact Administrator</a>
                        </p>
                    </div>

                </motion.div>

                <div className="mt-8 flex gap-6 text-xs text-gray-500 font-medium">
                    <a href="#" className="hover:text-gray-800">Contact Support</a>
                    <a href="#" className="hover:text-gray-800">Terms of Service</a>
                    <a href="#" className="hover:text-gray-800">Privacy Policy</a>
                </div>
            </div>
        </div>
    );
};

export default LoginPage;
