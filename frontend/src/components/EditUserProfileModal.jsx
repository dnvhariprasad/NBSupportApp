import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { X, Save, Loader2, User } from 'lucide-react';

const EditUserProfileModal = ({ user, isOpen, onClose, onUpdate }) => {
    const [formData, setFormData] = useState({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (isOpen && user) {
            setFormData({
                object_name: user.object_name || '',
                uin: user.uin || '',
                department_name: user.department_name || '',
                user_grade: user.user_grade || '',
                designation: user.designation || '',
                user_email_address: user.user_email_address || '',
                primary_mobile_number: user.primary_mobile_number || '',
                location: user.location || '',
                office_type: user.office_type || '',
                hindi_user_name: user.hindi_user_name || '',
                hindi_designation: user.hindi_designation || '',
                user_role: user.user_role || '',
                is_active: user.is_active || false
            });
            setError(null);
        }
    }, [isOpen, user]);

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            await api.patch(`/users/profiles/${user.r_object_id}`, formData);
            onUpdate();
            onClose();
        } catch (err) {
            console.error("Error updating user profile:", err);
            setError("Failed to update profile. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 text-slate-900">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200 max-h-[90vh]">
                
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                        <User size={18} className="text-[#0A66C2]" />
                        Edit User Profile
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-200 rounded-full transition-colors text-slate-500">
                        <X size={20} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {error && (
                        <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-lg text-sm border border-red-100">
                            {error}
                        </div>
                    )}

                    <form id="editUserForm" onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-slate-900">
                            {/* Basic Info */}
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500 uppercase">Name</label>
                                <input type="text" name="object_name" value={formData.object_name} onChange={handleChange} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/20 focus:border-[#0A66C2]" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500 uppercase">UIN</label>
                                <input type="text" name="uin" value={formData.uin} onChange={handleChange} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/20 focus:border-[#0A66C2]" />
                            </div>

                            {/* Department & Role */}
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500 uppercase">Department</label>
                                <input type="text" name="department_name" value={formData.department_name} onChange={handleChange} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/20 focus:border-[#0A66C2]" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500 uppercase">User Role</label>
                                <input type="text" name="user_role" value={formData.user_role} onChange={handleChange} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/20 focus:border-[#0A66C2]" />
                            </div>

                            {/* Designation & Grade */}
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500 uppercase">Designation</label>
                                <input type="text" name="designation" value={formData.designation} onChange={handleChange} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/20 focus:border-[#0A66C2]" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500 uppercase">Grade</label>
                                <input type="text" name="user_grade" value={formData.user_grade} onChange={handleChange} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/20 focus:border-[#0A66C2]" />
                            </div>

                            {/* Contact */}
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500 uppercase">Email</label>
                                <input type="email" name="user_email_address" value={formData.user_email_address} onChange={handleChange} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/20 focus:border-[#0A66C2]" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500 uppercase">Mobile</label>
                                <input type="text" name="primary_mobile_number" value={formData.primary_mobile_number} onChange={handleChange} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/20 focus:border-[#0A66C2]" />
                            </div>

                            {/* Location */}
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500 uppercase">Location</label>
                                <input type="text" name="location" value={formData.location} onChange={handleChange} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/20 focus:border-[#0A66C2]" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500 uppercase">Office Type</label>
                                <input type="text" name="office_type" value={formData.office_type} onChange={handleChange} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/20 focus:border-[#0A66C2]" />
                            </div>

                            {/* Hindi Details */}
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500 uppercase font-sans">Hindi Name</label>
                                <input type="text" name="hindi_user_name" value={formData.hindi_user_name} onChange={handleChange} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/20 focus:border-[#0A66C2]" />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500 uppercase font-sans">Hindi Designation</label>
                                <input type="text" name="hindi_designation" value={formData.hindi_designation} onChange={handleChange} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#0A66C2]/20 focus:border-[#0A66C2]" />
                            </div>
                        </div>

                        {/* Status */}
                        <div className="flex items-center gap-2 pt-2">
                            <input 
                                type="checkbox" 
                                id="is_active" 
                                name="is_active" 
                                checked={formData.is_active || false} 
                                onChange={handleChange}
                                className="w-4 h-4 text-[#0A66C2] border-slate-300 rounded focus:ring-[#0A66C2]"
                            />
                            <label htmlFor="is_active" className="text-sm font-medium text-slate-700">Active User</label>
                        </div>
                    </form>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
                    <button 
                        onClick={onClose}
                        className="px-4 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button 
                        type="submit" 
                        form="editUserForm"
                        disabled={loading}
                        className="px-4 py-2 bg-[#0A66C2] text-white rounded-lg text-sm font-medium hover:bg-[#094d92] disabled:opacity-50 flex items-center gap-2"
                    >
                        {loading ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
};

export default EditUserProfileModal;
