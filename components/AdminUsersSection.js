'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import {
    CheckCircle, XCircle, Clock, Search, User, Mail,
    GraduationCap, FileText, Eye, Loader2, AlertTriangle, Users, Trash2
} from 'lucide-react';

const USER_TABS = [
    { key: 'pending', label: 'Pending', icon: Clock, color: 'text-orange-400', bg: 'bg-orange-500' },
    { key: 'approved', label: 'Verified', icon: CheckCircle, color: 'text-orange-400', bg: 'bg-orange-500' },
    { key: 'rejected', label: 'Rejected', icon: XCircle, color: 'text-orange-400', bg: 'bg-orange-500' },
    { key: 'all', label: 'All Users', icon: Users, color: 'text-orange-400', bg: 'bg-orange-500' },
];

function RejectReasonModal({ onConfirm, onCancel, processing }) {
    const [reason, setReason] = useState('');
    return (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={onCancel} />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative bg-[#1a1a1a] border border-red-500/30 rounded-[2.5rem] p-8 max-w-sm w-full shadow-2xl">
                <div className="w-14 h-14 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-5">
                    <XCircle size={28} className="text-red-500" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2 text-center">Reject Verification</h3>
                <p className="text-white/40 text-xs mb-4 text-center">Provide a reason so the student knows what to fix.</p>
                <textarea
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. Document is blurry, please re-upload a clearer image..."
                    className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-sm text-white placeholder:text-white/20 outline-none focus:border-red-500/50 resize-none h-24 mb-4"
                />
                <div className="space-y-3">
                    <button onClick={() => onConfirm(reason || 'Document could not be verified')} disabled={processing}
                        className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs tracking-widest transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                        {processing ? <Loader2 size={14} className="animate-spin" /> : <><XCircle size={14} /> REJECT</>}
                    </button>
                    <button onClick={onCancel} className="w-full py-3 bg-white/5 hover:bg-white/10 text-white/60 rounded-xl font-bold text-xs tracking-widest">CANCEL</button>
                </div>
            </motion.div>
        </div>
    );
}

function DocPreviewModal({ url, onClose }) {
    if (!url) return null;
    const isPdf = url.includes('.pdf');
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} className="absolute inset-0 bg-black/85 backdrop-blur-sm" />
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                className="relative w-full max-w-2xl bg-[#121212] border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl max-h-[90vh]">
                {isPdf ? (
                    <iframe src={url} className="w-full h-[80vh]" title="Verification Document" />
                ) : (
                    <img src={url} alt="Verification Document" className="w-full max-h-[80vh] object-contain" />
                )}
                <div className="p-4">
                    <button onClick={onClose} className="w-full py-3 bg-white/5 hover:bg-white/10 text-white/60 rounded-2xl font-bold text-xs tracking-widest">CLOSE</button>
                </div>
            </motion.div>
        </div>
    );
}

export default function AdminUsersSection() {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [activeTab, setActiveTab] = useState('pending');
    const [searchQuery, setSearchQuery] = useState('');
    const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0, total: 0 });
    const [toast, setToast] = useState(null);
    const [rejectTarget, setRejectTarget] = useState(null);
    const [previewDocUrl, setPreviewDocUrl] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [selectedUsers, setSelectedUsers] = useState(new Set());
    const [batchDeleteConfirm, setBatchDeleteConfirm] = useState(false);

    const showToast = (message, type = 'success') => { setToast({ message, type }); setTimeout(() => setToast(null), 3000); };
    const getAuthHeaders = async () => { const { data: { session } } = await supabase.auth.getSession(); return { Authorization: `Bearer ${session?.access_token}` }; };

    const fetchUsers = useCallback(async () => {
        try {
            setLoading(true);
            const headers = await getAuthHeaders();
            const res = await fetch(`/api/admin/users?status=${activeTab}`, { headers });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error);
            setUsers(json.users || []);
        } catch (err) { showToast(err.message, 'error'); } finally { setLoading(false); }
    }, [activeTab]);

    const fetchStats = useCallback(async () => {
        try {
            const headers = await getAuthHeaders();
            const res = await fetch('/api/admin/users?status=all', { headers });
            const json = await res.json();
            if (res.ok && json.users) {
                const all = json.users;
                setStats({ pending: all.filter(u => u.verification_status === 'pending').length, approved: all.filter(u => u.verification_status === 'approved').length, rejected: all.filter(u => u.verification_status === 'rejected').length, total: all.length });
            }
        } catch { }
    }, []);

    useEffect(() => { fetchUsers(); fetchStats(); }, [fetchUsers, fetchStats]);

    const handleDeleteUser = async (userId) => {
        try {
            setProcessing(true);
            const headers = await getAuthHeaders();
            const res = await fetch('/api/admin/users/delete', {
                method: 'DELETE', headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error);
            showToast('User account deleted permanently');
            setDeleteTarget(null);
            fetchUsers(); fetchStats();
        } catch (err) { showToast(err.message, 'error'); } finally { setProcessing(false); }
    };

    // Batch helpers
    const toggleSelect = (id) => setSelectedUsers(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
    const toggleSelectAll = () => { selectedUsers.size === filtered.length ? setSelectedUsers(new Set()) : setSelectedUsers(new Set(filtered.map(u => u.id))); };
    const handleBatchModerate = async (action) => {
        if (selectedUsers.size === 0) return;
        try {
            setProcessing(true);
            const headers = await getAuthHeaders();
            const res = await fetch('/api/admin/users', {
                method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ userIds: [...selectedUsers], action }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error);
            showToast(json.message);
            setSelectedUsers(new Set());
            fetchUsers(); fetchStats();
        } catch (err) { showToast(err.message, 'error'); } finally { setProcessing(false); }
    };
    const handleBatchDelete = async () => {
        if (selectedUsers.size === 0) return;
        try {
            setProcessing(true);
            const headers = await getAuthHeaders();
            const res = await fetch('/api/admin/users/delete', {
                method: 'DELETE', headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ userIds: [...selectedUsers] }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error);
            showToast(json.message);
            setSelectedUsers(new Set()); setBatchDeleteConfirm(false);
            fetchUsers(); fetchStats();
        } catch (err) { showToast(err.message, 'error'); } finally { setProcessing(false); }
    };

    const handleModerate = async (userId, action, reason) => {
        try {
            setProcessing(true);
            const headers = await getAuthHeaders();
            const res = await fetch('/api/admin/users', {
                method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, action, reason }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error);
            showToast(`User ${action === 'approve' ? 'approved' : 'rejected'}${json.emailSent ? ' — email sent' : ''}`);
            setRejectTarget(null);
            fetchUsers(); fetchStats();
        } catch (err) { showToast(err.message, 'error'); } finally { setProcessing(false); }
    };

    const filtered = users.filter(u => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.student_number?.toLowerCase().includes(q);
    });

    const statusColors = { pending: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30', approved: 'bg-green-500/15 text-green-400 border-green-500/30', rejected: 'bg-red-500/15 text-red-400 border-red-500/30' };

    return (
        <div className="space-y-8">
            {/* Stats */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {[{ label: 'Pending', count: stats.pending, icon: Clock, color: 'text-yellow-400', tab: 'pending' },
                { label: 'Verified', count: stats.approved, icon: CheckCircle, color: 'text-green-400', tab: 'approved' },
                { label: 'Rejected', count: stats.rejected, icon: XCircle, color: 'text-red-400', tab: 'rejected' },
                { label: 'Total Users', count: stats.total, icon: Users, color: 'text-orange-400', tab: 'all' }
                ].map(s => (
                    <button key={s.tab} onClick={() => setActiveTab(s.tab)}
                        className={`p-5 rounded-2xl border transition-all text-left ${activeTab === s.tab ? 'bg-orange-500/10 border-orange-500/40' : 'bg-white/[0.03] border-white/10 hover:border-white/20'}`}>
                        <div className="flex items-center justify-between mb-3"><s.icon size={20} className={s.color} /><span className="text-3xl font-black text-white">{s.count}</span></div>
                        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">{s.label}</p>
                    </button>
                ))}
            </div>

            {/* Tabs + Search */}
            <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
                <div className="flex bg-white/5 p-1.5 rounded-2xl border border-white/10 backdrop-blur-md">
                    {USER_TABS.map(tab => (
                        <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-[0.9rem] text-xs font-black tracking-widest transition-all ${activeTab === tab.key ? `${tab.bg} text-white shadow-lg` : 'text-white/30 hover:text-white/50'}`}>
                            <tab.icon size={14} />{tab.label}
                        </button>
                    ))}
                </div>
                <div className="flex items-center gap-4 lg:ml-auto w-full lg:w-auto flex-1 lg:justify-end">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-500/50" size={18} />
                        <input type="text" placeholder="Search by name, email, student ID..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-white/[0.04] border border-white/10 py-3 pl-11 pr-4 rounded-xl outline-none text-sm focus:border-orange-500/50 transition-all placeholder:text-white/20" />
                    </div>
                </div>
            </div>

            {/* Select all */}
            {filtered.length > 0 && (
                <div className="flex items-center gap-3">
                    <button onClick={toggleSelectAll}
                        className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${selectedUsers.size === filtered.length && filtered.length > 0 ? 'bg-orange-500 border-orange-400' : 'bg-white/5 border-white/20 hover:border-orange-500/60'}`}>
                        {selectedUsers.size === filtered.length && filtered.length > 0 && <CheckCircle size={14} className="text-white" />}
                    </button>
                    <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
                        {selectedUsers.size > 0 ? `${selectedUsers.size} selected` : 'Select all'}
                    </span>
                </div>
            )}

            {/* Users Grid */}
            <div className="relative min-h-[400px]">
                <AnimatePresence mode="wait">
                    {loading ? (
                        <motion.div key="loader" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center pt-20 gap-4">
                            <div className="w-10 h-10 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin" />
                            <p className="text-[10px] font-black tracking-widest text-orange-500/40 uppercase">Loading users...</p>
                        </motion.div>
                    ) : filtered.length > 0 ? (
                        <motion.div key="grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {filtered.map(u => (
                                <motion.div key={u.id} layout initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }}
                                    onClick={() => toggleSelect(u.id)}
                                    className={`bg-white/[0.04] border rounded-3xl p-5 flex flex-col h-full hover:border-orange-500/30 transition-all cursor-pointer ${selectedUsers.has(u.id) ? 'border-orange-500/60 ring-2 ring-orange-500/30' : 'border-white/10'}`}>
                                    <div className="space-y-4 mb-4">
                                        {/* User header */}
                                        <div className="flex items-center gap-3">
                                            <button onClick={(e) => { e.stopPropagation(); toggleSelect(u.id); }}
                                                className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${selectedUsers.has(u.id) ? 'bg-orange-500 border-orange-400' : 'bg-white/5 border-white/20'}`}>
                                                {selectedUsers.has(u.id) && <CheckCircle size={12} className="text-white" />}
                                            </button>
                                            <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center overflow-hidden shrink-0">
                                                {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full object-cover" alt="" /> : <User size={20} className="text-orange-500" />}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-white truncate">{u.full_name || 'Unknown'}</p>
                                                <p className="text-[10px] text-white/30 font-mono">{u.student_number || 'N/A'}</p>
                                            </div>
                                            <span className={`px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${statusColors[u.verification_status]}`}>{u.verification_status}</span>
                                        </div>
                                        {/* Email */}
                                        <div className="flex items-center gap-2 text-white/30">
                                            <Mail size={12} className="text-orange-500" />
                                            <span className="text-[10px] font-bold truncate">{u.email}</span>
                                        </div>
                                        {/* Document preview button */}
                                        {u.verification_doc_signed_url && (
                                            <button onClick={() => setPreviewDocUrl(u.verification_doc_signed_url)}
                                                className="w-full flex items-center gap-2 p-3 bg-white/[0.03] rounded-xl border border-white/5 hover:border-orange-500/30 transition-all text-left">
                                                <FileText size={16} className="text-orange-500 shrink-0" />
                                                <span className="text-[10px] font-bold text-white/50 uppercase tracking-widest">View Document</span>
                                                <Eye size={14} className="ml-auto text-white/20" />
                                            </button>
                                        )}
                                        {/* Rejection reason */}
                                        {u.verification_status === 'rejected' && u.verification_rejection_reason && (
                                            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-3">
                                                <p className="text-[8px] font-black uppercase tracking-widest text-red-400 mb-1">Rejection Reason</p>
                                                <p className="text-white/50 text-[10px] line-clamp-2">{u.verification_rejection_reason}</p>
                                            </div>
                                        )}
                                    </div>

                                    <div className="mt-auto space-y-4 pt-2">
                                        {/* Timestamp */}
                                        <p className="text-[10px] text-white/20 font-bold tracking-widest uppercase">
                                            Joined {new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </p>
                                        {/* Actions */}
                                        <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                                            {u.verification_status === 'pending' && (<>
                                                <button onClick={() => handleModerate(u.id, 'approve')} disabled={processing}
                                                    className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white border-2 border-transparent rounded-xl font-bold text-[10px] tracking-widest transition-all flex items-center justify-center gap-1.5 disabled:opacity-50">
                                                    <CheckCircle size={12} /> APPROVE
                                                </button>
                                                <button onClick={() => setRejectTarget(u.id)} disabled={processing}
                                                    className="flex-1 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 border-2 border-red-500/30 rounded-xl font-bold text-[10px] tracking-widest transition-all flex items-center justify-center gap-1.5 disabled:opacity-50">
                                                    <XCircle size={12} /> REJECT
                                                </button>
                                            </>)}
                                            {u.verification_status === 'rejected' && (
                                                <button onClick={() => handleModerate(u.id, 'approve')} disabled={processing}
                                                    className="flex-1 py-2.5 bg-green-600/20 hover:bg-green-600/30 text-green-400 border border-green-500/30 rounded-xl font-bold text-[10px] tracking-widest transition-all flex items-center justify-center gap-1.5 disabled:opacity-50">
                                                    <CheckCircle size={12} /> APPROVE
                                                </button>
                                            )}
                                            {u.verification_status === 'approved' && (
                                                <button onClick={() => setRejectTarget(u.id)} disabled={processing}
                                                    className="flex-1 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400/60 border border-red-500/20 rounded-xl font-bold text-[10px] tracking-widest transition-all flex items-center justify-center gap-1.5 disabled:opacity-50">
                                                    <XCircle size={12} /> REVOKE
                                                </button>
                                            )}
                                            <button onClick={() => setDeleteTarget(u.id)} disabled={processing}
                                                className="p-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl transition-all disabled:opacity-50" title="Delete account">
                                                <Trash2 size={12} />
                                            </button>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </motion.div>
                    ) : (
                        <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-20 text-white/20">
                            <Users size={48} strokeWidth={1} className="mb-4" />
                            <p className="text-[10px] font-black uppercase tracking-[0.2em]">{searchQuery ? 'No users match' : `No ${activeTab === 'all' ? '' : activeTab} users`}</p>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Toast */}
            <AnimatePresence>{toast && (
                <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }}
                    className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[120] px-6 py-4 rounded-2xl font-bold text-sm shadow-2xl border ${toast.type === 'error' ? 'bg-red-500/20 border-red-500/40 text-red-300' : 'bg-green-500/20 border-green-500/40 text-green-300'}`}>
                    {toast.message}
                </motion.div>
            )}</AnimatePresence>

            {/* Modals */}
            <AnimatePresence>{previewDocUrl && <DocPreviewModal url={previewDocUrl} onClose={() => setPreviewDocUrl(null)} />}</AnimatePresence>
            <AnimatePresence>{rejectTarget && <RejectReasonModal processing={processing} onCancel={() => setRejectTarget(null)} onConfirm={(reason) => handleModerate(rejectTarget, 'reject', reason)} />}</AnimatePresence>

            {/* Delete user confirm */}
            <AnimatePresence>{deleteTarget && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={() => setDeleteTarget(null)} />
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                        className="relative bg-[#1a1a1a] border border-red-500/30 rounded-[2.5rem] p-8 max-w-sm w-full text-center shadow-2xl">
                        <div className="w-14 h-14 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-5"><Trash2 size={28} className="text-red-500" /></div>
                        <h3 className="text-lg font-bold text-white mb-2">Delete Account?</h3>
                        <p className="text-white/40 text-xs mb-6">This will permanently delete the user, their posts, chats, and messages. This cannot be undone.</p>
                        <div className="space-y-3">
                            <button onClick={() => handleDeleteUser(deleteTarget)} disabled={processing}
                                className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs tracking-widest flex items-center justify-center gap-2 disabled:opacity-50">
                                {processing ? <Loader2 size={14} className="animate-spin" /> : <><Trash2 size={14} /> DELETE ACCOUNT</>}
                            </button>
                            <button onClick={() => setDeleteTarget(null)} className="w-full py-3 bg-white/5 hover:bg-white/10 text-white/60 rounded-xl font-bold text-xs tracking-widest">CANCEL</button>
                        </div>
                    </motion.div>
                </div>
            )}</AnimatePresence>

            {/* Batch delete confirm */}
            <AnimatePresence>{batchDeleteConfirm && (
                <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="absolute inset-0 bg-black/90 backdrop-blur-sm" onClick={() => setBatchDeleteConfirm(false)} />
                    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                        className="relative bg-[#1a1a1a] border border-red-500/30 rounded-[2.5rem] p-8 max-w-sm w-full text-center shadow-2xl">
                        <div className="w-14 h-14 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-5"><AlertTriangle size={28} className="text-red-500" /></div>
                        <h3 className="text-lg font-bold text-white mb-2">Delete {selectedUsers.size} account(s)?</h3>
                        <p className="text-white/40 text-xs mb-6">All their posts, chats, and messages will be permanently deleted.</p>
                        <div className="space-y-3">
                            <button onClick={handleBatchDelete} disabled={processing}
                                className="w-full py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-xs tracking-widest flex items-center justify-center gap-2 disabled:opacity-50">
                                {processing ? <Loader2 size={14} className="animate-spin" /> : <><Trash2 size={14} /> DELETE ALL</>}
                            </button>
                            <button onClick={() => setBatchDeleteConfirm(false)} className="w-full py-3 bg-white/5 hover:bg-white/10 text-white/60 rounded-xl font-bold text-xs tracking-widest">CANCEL</button>
                        </div>
                    </motion.div>
                </div>
            )}</AnimatePresence>

            {/* Batch action bar */}
            <AnimatePresence>
                {selectedUsers.size > 0 && (
                    <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }}
                        className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-6 py-4 bg-[#1a1a1a]/95 border border-white/10 rounded-2xl backdrop-blur-2xl shadow-2xl">
                        <span className="text-xs font-black text-white/60 uppercase tracking-widest mr-2">{selectedUsers.size} selected</span>
                        <button onClick={() => handleBatchModerate('approve')} disabled={processing}
                            className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white border-2 border-transparent rounded-xl text-[10px] font-black tracking-widest transition-all flex items-center gap-1.5 disabled:opacity-50">
                            <CheckCircle size={12} /> Approve
                        </button>
                        <button onClick={() => handleBatchModerate('reject')} disabled={processing}
                            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 border-2 border-red-500/30 rounded-xl text-[10px] font-black tracking-widest transition-all flex items-center gap-1.5 disabled:opacity-50">
                            <XCircle size={12} /> Reject
                        </button>
                        <button onClick={() => setBatchDeleteConfirm(true)} disabled={processing}
                            className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white border-2 border-transparent rounded-xl text-[10px] font-black tracking-widest transition-all flex items-center gap-1.5 disabled:opacity-50">
                            <Trash2 size={12} /> Delete
                        </button>
                        <button onClick={() => setSelectedUsers(new Set())}
                            className="px-3 py-2.5 bg-white/5 hover:bg-white/10 text-white/40 rounded-xl text-[10px] font-black tracking-widest">Cancel</button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
