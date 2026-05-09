'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useAdminGuard } from '@/hooks/useAdminGuard';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ArrowLeft, Shield, CheckCircle, XCircle, Trash2, Clock,
    Package, Search, RefreshCw, AlertTriangle, Loader2,
    Eye, ChevronDown, MapPin, User, Filter, Users, Calendar, X,
    Flag, Ban, MessageSquare
} from 'lucide-react';
import AdminUsersSection from '@/components/AdminUsersSection';
import CustomDateRangePicker from '@/components/CustomDateRangePicker';
import { ITEM_CATEGORIES } from '@/app/Home/page';

/* ─────────────────────────── STATUS TABS ─────────────────────────── */
const TABS = [
    { key: 'pending', label: 'Pending', icon: Clock, color: 'text-orange-400', bg: 'bg-orange-500' },
    { key: 'approved', label: 'Approved', icon: CheckCircle, color: 'text-orange-400', bg: 'bg-orange-500' },
    { key: 'rejected', label: 'Rejected', icon: XCircle, color: 'text-orange-400', bg: 'bg-orange-500' },
    { key: 'all', label: 'All Items', icon: Package, color: 'text-orange-400', bg: 'bg-orange-500' },
];

const LOCATIONS = ['Shed', 'Activity Center', 'ER Bldg.', 'ENB Bldg.', 'Volleyball Court', 'Basketball Court', 'Admin Bldg.', 'Quadrangle'];

/* ─────────────────────────── ITEM CARD ─────────────────────────── */
function AdminItemCard({ item, onApprove, onReject, onDelete, onPreview, processing, selected, onToggleSelect }) {
    const poster = item.profiles;
    const isPending = item.moderation_status === 'pending';
    const isRejected = item.moderation_status === 'rejected';
    const isApproved = item.moderation_status === 'approved';

    const statusColors = {
        pending: 'bg-yellow-500/15 text-yellow-400 border-yellow-500/30',
        approved: 'bg-green-500/15 text-green-400 border-green-500/30',
        rejected: 'bg-red-500/15 text-red-400 border-red-500/30',
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className={`bg-white/4 border rounded-3xl overflow-hidden hover:border-orange-500/30 transition-all duration-300 group flex flex-col h-full ${selected ? 'border-orange-500/60 ring-2 ring-orange-500/30' : 'border-white/10'}`}
        >
            {/* Image + Status Badge + Checkbox */}
            <div className="relative aspect-video w-full cursor-pointer overflow-hidden" onClick={() => onPreview(item)}>
                {/* Selection checkbox */}
                <button onClick={(e) => { e.stopPropagation(); onToggleSelect(item.id); }}
                    className={`absolute top-4 left-4 z-10 w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${selected ? 'bg-orange-500 border-orange-400' : 'bg-black/40 border-white/30 backdrop-blur-md hover:border-orange-500/60'}`}>
                    {selected && <CheckCircle size={14} className="text-white" />}
                </button>
                <img src={item.image_url} alt={item.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0 bg-linear-to-t from-black/60 to-transparent" />

                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Eye size={24} className="text-white" />
                </div>
            </div>

            {/* Details */}
            <div className="p-5 space-y-4 flex-1 flex flex-col">
                <div>
                    <div className="overflow-hidden mb-2">
                        <motion.div 
                            drag="x"
                            dragConstraints={{ left: -200, right: 0 }}
                            className="flex items-center gap-1.5 pb-1 cursor-grab active:cursor-grabbing w-max"
                        >
                            <span className={`shrink-0 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest border ${statusColors[item.moderation_status]}`}>
                                {item.moderation_status}
                            </span>
                            <span className="shrink-0 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest bg-orange-500/20 text-orange-400 border border-orange-500/30">
                                {item.category}
                            </span>
                            <span className={`shrink-0 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest border ${item.status === 'Resolved' ? 'bg-blue-500/15 text-blue-400 border-blue-500/30' : 'bg-white/5 text-white/40 border-white/10'}`}>
                                {item.status === 'Resolved' ? 'RESOLVED' : 'UNRESOLVED'}
                            </span>
                        </motion.div>
                    </div>
                    <h3 className="font-bold text-white text-lg tracking-tight line-clamp-1">{item.title}</h3>
                    <p className="text-white/40 text-xs mt-1 line-clamp-2">{item.description || 'No description'}</p>
                </div>

                {/* Item type + Location */}
                <div className="flex items-center gap-3 text-white/30">
                    {item.item_category && item.item_category !== 'Other' && (
                        <span className="text-[10px] font-bold uppercase tracking-widest text-orange-400/60">{item.item_category}</span>
                    )}
                    <div className="flex items-center gap-1.5">
                        <MapPin size={12} className="text-orange-500" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">{item.location_tag}</span>
                    </div>
                </div>

                {/* ─── FOOTER SECTION ─── */}
                <div className="mt-auto space-y-4 pt-4 border-t border-white/5">
                    {/* Poster info */}
                    <div className="flex items-center gap-3 p-3 bg-white/3 rounded-xl border border-white/5">
                        <div className="w-9 h-9 rounded-full bg-orange-500/20 flex items-center justify-center overflow-hidden shrink-0">
                            {poster?.avatar_url ? (
                                <img src={poster.avatar_url} className="w-full h-full object-cover" alt="" />
                            ) : (
                                <User size={16} className="text-orange-500" />
                            )}
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-white truncate">{poster?.full_name || 'Unknown'}</p>
                            <p className="text-[10px] text-white/30 font-mono">{poster?.student_number || 'N/A'}</p>
                        </div>
                    </div>

                    {/* Timestamp */}
                    <p className="text-[10px] text-white/20 font-bold tracking-widest uppercase">
                        {new Date(item.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </p>

                    {/* Action buttons */}
                    <div className="flex gap-2">
                        {isPending && (
                            <>
                                <button
                                    onClick={() => onApprove(item.id)}
                                    disabled={processing}
                                    className="flex-1 py-2.5 bg-green-600 hover:bg-green-700 text-white border-2 border-transparent rounded-xl font-bold text-xs tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    <CheckCircle size={14} /> APPROVE
                                </button>
                                <button
                                    onClick={() => onReject(item.id)}
                                    disabled={processing}
                                    className="flex-1 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border-2 border-red-500/30 rounded-xl font-bold text-xs tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    <XCircle size={14} /> REJECT
                                </button>
                            </>
                        )}
                        {isRejected && (
                            <button
                                onClick={() => onApprove(item.id)}
                                disabled={processing}
                                className="flex-1 py-2.5 bg-green-600/10 hover:bg-green-600/20 text-green-400 border-2 border-green-500/30 rounded-xl font-bold text-xs tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                <CheckCircle size={14} /> RE-APPROVE
                            </button>
                        )}
                        {isApproved && (
                            <button
                                onClick={() => onReject(item.id)}
                                disabled={processing}
                                className="flex-1 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400/60 border-2 border-red-500/20 rounded-xl font-bold text-xs tracking-widest transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                <XCircle size={14} /> REVOKE
                            </button>
                        )}
                        <button
                            onClick={() => onDelete(item.id)}
                            disabled={processing}
                            className="p-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border-2 border-red-500/20 rounded-xl transition-all active:scale-95 disabled:opacity-50"
                            title="Delete permanently"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

/* ─────────────────────────── PREVIEW MODAL ─────────────────────── */
function PreviewModal({ item, onClose }) {
    if (!item) return null;
    return (
        <div className="fixed inset-0 z-100 flex items-center justify-center p-6">
            <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={onClose}
                className="absolute inset-0 bg-black/85 backdrop-blur-sm"
            />
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="relative w-full max-w-2xl bg-[#121212] border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl max-h-[90vh] overflow-y-auto"
            >
                <img src={item.image_url} alt={item.title} className="w-full aspect-video object-cover" />
                <div className="p-8 space-y-4">
                    <h2 className="text-2xl font-black text-white">{item.title}</h2>
                    <div className="flex items-center gap-2 text-orange-500">
                        <MapPin size={14} />
                        <span className="text-xs font-bold uppercase tracking-widest">{item.location_tag}</span>
                    </div>
                    <p className="text-white/60 text-sm leading-relaxed">{item.description || 'No description provided.'}</p>
                    <div className="grid grid-cols-2 gap-4 text-xs">
                        <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                            <p className="text-white/30 uppercase tracking-widest font-bold mb-1">Category</p>
                            <p className="text-white font-bold">{item.category}</p>
                        </div>
                        <div className="bg-white/5 p-4 rounded-2xl border border-white/5">
                            <p className="text-white/30 uppercase tracking-widest font-bold mb-1">Status</p>
                            <p className="text-white font-bold">{item.status}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-full py-4 bg-white/5 hover:bg-white/10 text-white/60 rounded-2xl font-bold text-xs tracking-widest transition-all mt-4"
                    >
                        CLOSE PREVIEW
                    </button>
                </div>
            </motion.div>
        </div>
    );
}

/* ─────────────────────────── STAT CARD ────────────────────────── */
function StatCard({ label, count, icon: Icon, color, active, onClick }) {
    return (
        <button
            onClick={onClick}
            className={`p-5 rounded-2xl border transition-all text-left ${active ? 'bg-orange-500/10 border-orange-500/40 shadow-[0_0_30px_rgba(249,115,22,0.15)]' : 'bg-white/3 border-white/10 hover:border-white/20'
                }`}
        >
            <div className="flex items-center justify-between mb-3">
                <Icon size={20} className={color} />
                <span className="text-3xl font-black text-white">{count}</span>
            </div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/40">{label}</p>
        </button>
    );
}

/* ─────────────────────────── DELETE CONFIRMATION ────────────────── */
function DeleteConfirmModal({ onConfirm, onCancel, processing, message }) {
    return (
        <div className="fixed inset-0 z-110 flex items-center justify-center p-6">
            <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="absolute inset-0 bg-black/90 backdrop-blur-sm"
                onClick={onCancel}
            />
            <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="relative bg-[#1a1a1a] border border-red-500/30 rounded-[2.5rem] p-8 max-w-sm w-full text-center shadow-2xl shadow-red-900/20"
            >
                <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                    <AlertTriangle size={32} className="text-red-500" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Confirm Delete</h3>
                <p className="text-white/40 text-sm mb-8">{message || 'This will permanently remove the item and all associated data.'}</p>
                <div className="space-y-3">
                    <button
                        onClick={onConfirm}
                        disabled={processing}
                        className="w-full py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black tracking-widest text-xs transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                        {processing ? <Loader2 size={16} className="animate-spin" /> : <><Trash2 size={16} /> YES, DELETE</>}
                    </button>
                    <button
                        onClick={onCancel}
                        className="w-full py-4 bg-white/5 hover:bg-white/10 text-white/60 rounded-2xl font-bold text-xs tracking-widest transition-all"
                    >
                        CANCEL
                    </button>
                </div>
            </motion.div>
        </div>
    );
}

/* ═══════════════════════════ MAIN PAGE ═══════════════════════════ */
export default function AdminPage() {
    const router = useRouter();
    const { user, isAdmin, guardLoading } = useAdminGuard();

    const [adminSection, setAdminSection] = useState('posts'); // 'posts' | 'users' | 'reports'
    const [items, setItems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [processing, setProcessing] = useState(false);
    const [activeTab, setActiveTab] = useState('pending');
    const [searchQuery, setSearchQuery] = useState('');
    const [previewItem, setPreviewItem] = useState(null);
    const [deleteTarget, setDeleteTarget] = useState(null);
    const [toast, setToast] = useState(null);

    // Filters
    const [categoryFilter, setCategoryFilter] = useState('All');
    const [itemTypeFilter, setItemTypeFilter] = useState('All');
    const [statusFilter, setStatusFilter] = useState('All'); // 'All' | 'Active' | 'Resolved'
    const [locationFilter, setLocationFilter] = useState('All');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const [showFilters, setShowFilters] = useState(false);

    // Batch selection
    const [selectedItems, setSelectedItems] = useState(new Set());
    const [batchDeleteConfirm, setBatchDeleteConfirm] = useState(false);

    // Stats
    const [stats, setStats] = useState({ pending: 0, approved: 0, rejected: 0, total: 0 });

    // Reports
    const [reports, setReports] = useState([]);
    const [reportsLoading, setReportsLoading] = useState(false);
    const [reportProcessing, setReportProcessing] = useState(null); // report id being processed
    const [expandedReport, setExpandedReport] = useState(null);

    // Refs for drag constraints calculation
    const typeScrollRef = useRef(null);
    const [typeConstraints, setTypeConstraints] = useState({ left: 0, right: 0 });
    const locScrollRef = useRef(null);
    const [locConstraints, setLocConstraints] = useState({ left: 0, right: 0 });

    useEffect(() => {
        if (typeScrollRef.current) {
            const width = typeScrollRef.current.scrollWidth - typeScrollRef.current.offsetWidth;
            setTypeConstraints({ left: -Math.max(0, width), right: 0 });
        }
    }, [showFilters]);

    useEffect(() => {
        if (locScrollRef.current) {
            const width = locScrollRef.current.scrollWidth - locScrollRef.current.offsetWidth;
            setLocConstraints({ left: -Math.max(0, width), right: 0 });
        }
    }, [showFilters]);

    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3000);
    };

    const fetchReports = async () => {
        if (!user) return;
        setReportsLoading(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch('/api/admin/reports', {
                headers: { Authorization: `Bearer ${session.access_token}` },
            });
            const json = await res.json();
            if (res.ok) setReports(json.reports || []);
        } catch (err) {
            console.error('fetchReports error:', err);
        } finally {
            setReportsLoading(false);
        }
    };

    const handleReportAction = async (reportId, status, reportedUserId, banUser = false) => {
        setReportProcessing(reportId);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch('/api/admin/reports', {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    reportId,
                    status,
                    banUser,
                    banReason: 'Reported and verified by admin for community guideline violations.',
                }),
            });
            if (!res.ok) throw new Error('Failed to update report');
            showToast(status === 'valid' ? (banUser ? 'Report validated & user banned' : 'Report marked as valid') : 'Report dismissed');
            fetchReports();
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setReportProcessing(null);
        }
    };

    const getAuthHeaders = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        return { Authorization: `Bearer ${session?.access_token}` };
    };

    /* ───── Fetch items ───── */
    const fetchItems = useCallback(async () => {
        try {
            setLoading(true);
            const headers = await getAuthHeaders();

            const res = await fetch(`/api/admin/items?status=${activeTab}`, { headers });
            const json = await res.json();

            if (!res.ok) throw new Error(json.error || 'Failed to fetch');
            setItems(json.items || []);
        } catch (err) {
            console.error('Fetch error:', err);
            showToast(err.message, 'error');
        } finally {
            setLoading(false);
        }
    }, [activeTab]);

    /* ───── Fetch stats ───── */
    const fetchStats = useCallback(async () => {
        try {
            const headers = await getAuthHeaders();
            const res = await fetch('/api/admin/items?status=all', { headers });
            const json = await res.json();

            if (res.ok && json.items) {
                const all = json.items;
                setStats({
                    pending: all.filter(i => i.moderation_status === 'pending').length,
                    approved: all.filter(i => i.moderation_status === 'approved').length,
                    rejected: all.filter(i => i.moderation_status === 'rejected').length,
                    total: all.length,
                });
            }
        } catch { /* silent */ }
    }, []);

    useEffect(() => {
        if (!guardLoading && isAdmin) {
            fetchItems();
            fetchStats();
        }
    }, [guardLoading, isAdmin, fetchItems, fetchStats]);

    /* ───── Moderation actions ───── */
    const handleModerate = async (itemId, action) => {
        try {
            setProcessing(true);
            const headers = await getAuthHeaders();
            const res = await fetch('/api/admin/items', {
                method: 'PATCH',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemId, action }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error);

            showToast(`Item ${action === 'approve' ? 'approved' : 'rejected'} successfully`);
            fetchItems();
            fetchStats();
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setProcessing(false);
        }
    };

    const handleDelete = async (itemId) => {
        try {
            setProcessing(true);
            const headers = await getAuthHeaders();
            const res = await fetch('/api/admin/items', {
                method: 'DELETE',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemId }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error);

            showToast('Item deleted permanently');
            setDeleteTarget(null);
            fetchItems();
            fetchStats();
        } catch (err) {
            showToast(err.message, 'error');
        } finally {
            setProcessing(false);
        }
    };

    /* ───── Batch actions ───── */
    const toggleSelect = (id) => setSelectedItems(prev => {
        const next = new Set(prev);
        next.has(id) ? next.delete(id) : next.add(id);
        return next;
    });
    const toggleSelectAll = () => {
        if (selectedItems.size === filteredItems.length) setSelectedItems(new Set());
        else setSelectedItems(new Set(filteredItems.map(i => i.id)));
    };
    const handleBatchModerate = async (action) => {
        if (selectedItems.size === 0) return;
        try {
            setProcessing(true);
            const headers = await getAuthHeaders();
            const res = await fetch('/api/admin/items', {
                method: 'PATCH',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemIds: [...selectedItems], action }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error);
            showToast(json.message);
            setSelectedItems(new Set());
            fetchItems(); fetchStats();
        } catch (err) { showToast(err.message, 'error'); } finally { setProcessing(false); }
    };
    const handleBatchDelete = async () => {
        if (selectedItems.size === 0) return;
        try {
            setProcessing(true);
            const headers = await getAuthHeaders();
            const res = await fetch('/api/admin/items', {
                method: 'DELETE',
                headers: { ...headers, 'Content-Type': 'application/json' },
                body: JSON.stringify({ itemIds: [...selectedItems] }),
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.error);
            showToast(json.message);
            setSelectedItems(new Set());
            setBatchDeleteConfirm(false);
            fetchItems(); fetchStats();
        } catch (err) { showToast(err.message, 'error'); } finally { setProcessing(false); }
    };

    const hasActiveFilters = categoryFilter !== 'All' || itemTypeFilter !== 'All' || statusFilter !== 'All' || locationFilter !== 'All' || dateFrom || dateTo;

    /* ───── Filter by search + filters ───── */
    const filteredItems = items.filter(item => {
        const q = searchQuery.toLowerCase().trim();
        const matchesSearch = !q || (
            item.title?.toLowerCase().includes(q) ||
            item.description?.toLowerCase().includes(q) ||
            item.profiles?.full_name?.toLowerCase().includes(q) ||
            item.profiles?.student_number?.toLowerCase().includes(q)
        );
        const matchesItemType = itemTypeFilter === 'All' || item.item_category === itemTypeFilter;
        const matchesCategory = categoryFilter === 'All' || item.category === categoryFilter;
        const matchesStatus = statusFilter === 'All' || item.status === statusFilter;
        const matchesLocation = locationFilter === 'All' || item.location_tag === locationFilter;
        const itemDate = new Date(item.created_at);
        const matchesDateFrom = !dateFrom || itemDate >= new Date(dateFrom);
        const matchesDateTo = !dateTo || itemDate <= new Date(dateTo + 'T23:59:59');
        return matchesSearch && matchesCategory && matchesItemType && matchesStatus && matchesLocation && matchesDateFrom && matchesDateTo;
    });

    /* ───── Loading guard ───── */
    if (guardLoading) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center gap-4">
                <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-[10px] font-black tracking-widest text-orange-500/40 uppercase">Verifying admin access...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-linear-to-br from-[#0a0a0a] via-[#1a1a1a] to-[#7c2d1233] bg-fixed text-white font-sans">
            {/* ─── HEADER ─── */}
            <header className="sticky top-0 z-50 bg-black/60 backdrop-blur-2xl border-b border-white/5">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => router.push('/Home')}
                            className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl transition-all text-orange-400"
                        >
                            <ArrowLeft size={20} />
                        </button>
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(249,115,22,0.4)]">
                                <Shield size={20} className="text-black" strokeWidth={3} />
                            </div>
                            <div>
                                <h1 className="text-lg sm:text-xl font-black tracking-tight">Admin Dashboard</h1>
                                <p className="text-[10px] text-orange-400/50 font-bold uppercase tracking-widest">
                                    {adminSection === 'posts' ? 'Post Moderation' : adminSection === 'users' ? 'User Verification' : 'User Reports'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* Pending count badge */}
                        {stats.pending > 0 && (
                            <div className="hidden sm:flex items-center gap-2 px-4 py-2 bg-yellow-500/15 border border-yellow-500/30 rounded-xl">
                                <Clock size={14} className="text-yellow-400" />
                                <span className="text-xs font-black text-yellow-400">{stats.pending} pending</span>
                            </div>
                        )}
                        <button
                            onClick={() => { fetchItems(); fetchStats(); }}
                            className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl transition-all text-white/40 hover:text-orange-400"
                            title="Refresh"
                        >
                            <RefreshCw size={18} />
                        </button>
                    </div>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
                {/* ─── SECTION SWITCHER ─── */}
                <div className="overflow-x-auto -mx-1 px-1 pb-1">
                    <div className="flex bg-white/5 p-1.5 rounded-2xl border border-white/10 backdrop-blur-md w-fit min-w-full sm:min-w-0">
                    <button onClick={() => setAdminSection('posts')}
                        className={`flex items-center gap-2 px-6 py-3 rounded-[0.9rem] text-xs font-black tracking-widest transition-all ${adminSection === 'posts' ? 'bg-orange-500 text-white shadow-lg' : 'text-white/30 hover:text-white/50'}`}>
                        <Package size={16} /> Posts
                    </button>
                    <button onClick={() => setAdminSection('users')}
                        className={`flex items-center gap-2 px-6 py-3 rounded-[0.9rem] text-xs font-black tracking-widest transition-all ${adminSection === 'users' ? 'bg-orange-500 text-white shadow-lg' : 'text-white/30 hover:text-white/50'}`}>
                        <Users size={16} /> Users
                    </button>
                    <button onClick={() => { setAdminSection('reports'); fetchReports(); }}
                        className={`relative flex items-center gap-2 px-6 py-3 rounded-[0.9rem] text-xs font-black tracking-widest transition-all ${adminSection === 'reports' ? 'bg-orange-500 text-white shadow-lg' : 'text-white/30 hover:text-white/50'}`}>
                        <Flag size={16} /> Reports
                        {reports.filter(r => r.status === 'pending').length > 0 && (
                            <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[9px] font-black text-white flex items-center justify-center">
                                {reports.filter(r => r.status === 'pending').length}
                            </span>
                        )}
                    </button>
                    </div>
                </div>

                <div className={adminSection === 'users' ? 'block' : 'hidden'}>
                    <AdminUsersSection />
                </div>

                {/* ─── REPORTS SECTION ─── */}
                <div className={adminSection === 'reports' ? 'block' : 'hidden'}>
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-black text-white">User Reports</h2>
                                <p className="text-xs text-white/30 mt-0.5">Review reported users and take action</p>
                            </div>
                            <button onClick={fetchReports} className="p-2.5 bg-white/5 hover:bg-white/10 rounded-xl transition-all text-white/40 hover:text-orange-400">
                                <RefreshCw size={16} className={reportsLoading ? 'animate-spin' : ''} />
                            </button>
                        </div>

                        {reportsLoading ? (
                            <div className="flex items-center justify-center py-16">
                                <Loader2 className="animate-spin text-orange-400" size={28} />
                            </div>
                        ) : reports.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-white/20 border border-white/5 rounded-3xl">
                                <Flag size={32} className="mb-3 opacity-30" />
                                <p className="text-sm font-black uppercase tracking-widest">No reports yet</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {reports.map(report => (
                                    <div key={report.id}
                                        className={`bg-white/[0.04] border rounded-3xl overflow-hidden transition-all ${
                                            report.status === 'pending' ? 'border-red-500/20' :
                                            report.status === 'valid' ? 'border-green-500/20' : 'border-white/10'
                                        }`}>
                                        <div className="p-6">
                                            {/* Header row */}
                                            <div className="flex items-start justify-between gap-4 mb-4">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                                                        <User size={16} className="text-red-400" />
                                                    </div>
                                                    <div>
                                                        <p className="font-black text-sm text-white">{report.reported_user?.full_name || 'Unknown'}</p>
                                                        <p className="text-[10px] text-white/30">{report.reported_user?.student_number}</p>
                                                    </div>
                                                </div>
                                                <span className={`shrink-0 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${
                                                    report.status === 'pending' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' :
                                                    report.status === 'valid' ? 'bg-green-500/10 text-green-400 border-green-500/30' :
                                                    'bg-white/5 text-white/30 border-white/10'
                                                }`}>
                                                    {report.status}
                                                </span>
                                            </div>

                                            {/* Reason */}
                                            <div className="bg-white/[0.04] border border-white/10 rounded-2xl p-4 mb-4">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-1">Reason</p>
                                                <p className="text-white/70 text-sm">{report.reason}</p>
                                            </div>

                                            {/* Meta */}
                                            <div className="flex flex-wrap gap-3 text-[10px] text-white/30 mb-4">
                                                <span>Reporter: <span className="text-white/50">{report.reporter?.full_name}</span></span>
                                                <span>·</span>
                                                <span>{new Date(report.created_at).toLocaleDateString()}</span>
                                                {report.status !== 'pending' && report.reviewer && (
                                                    <><span>·</span><span>Reviewed by <span className="text-white/50">{report.reviewer.full_name}</span></span></>
                                                )}
                                            </div>

                                            {/* Chat preview toggle */}
                                            {report.chatMessages?.length > 0 && (
                                                <button
                                                    onClick={() => setExpandedReport(expandedReport === report.id ? null : report.id)}
                                                    className="flex items-center gap-2 text-[10px] text-orange-400/60 hover:text-orange-400 font-bold uppercase tracking-widest mb-3 transition-colors"
                                                >
                                                    <MessageSquare size={12} />
                                                    {expandedReport === report.id ? 'Hide' : 'View'} Chat Context ({report.chatMessages.length} msgs)
                                                </button>
                                            )}

                                            <AnimatePresence>
                                                {expandedReport === report.id && report.chatMessages?.length > 0 && (
                                                    <motion.div
                                                        initial={{ opacity: 0, height: 0 }}
                                                        animate={{ opacity: 1, height: 'auto' }}
                                                        exit={{ opacity: 0, height: 0 }}
                                                        className="mb-4 bg-black/30 border border-white/5 rounded-2xl p-4 max-h-48 overflow-y-auto space-y-2"
                                                    >
                                                        {report.chatMessages.map(msg => (
                                                            <div key={msg.id} className={`flex ${ msg.sender_id === report.reported_user?.id ? 'justify-end' : 'justify-start' }`}>
                                                                <div className={`px-3 py-1.5 rounded-2xl text-xs max-w-[80%] ${ msg.sender_id === report.reported_user?.id ? 'bg-red-500/20 text-red-200' : 'bg-white/10 text-white/60' }`}>
                                                                    {msg.content}
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </motion.div>
                                                )}
                                            </AnimatePresence>

                                            {/* Actions — only for pending */}
                                            {report.status === 'pending' && (
                                                <div className="flex flex-col sm:flex-row gap-2">
                                                    <button
                                                        onClick={() => handleReportAction(report.id, 'dismissed', report.reported_user?.id)}
                                                        disabled={reportProcessing === report.id}
                                                        className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white/50 border border-white/10 rounded-2xl font-black text-xs tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                                    >
                                                        {reportProcessing === report.id ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
                                                        Dismiss
                                                    </button>
                                                    <button
                                                        onClick={() => handleReportAction(report.id, 'valid', report.reported_user?.id, false)}
                                                        disabled={reportProcessing === report.id}
                                                        className="flex-1 py-3 bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 rounded-2xl font-black text-xs tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                                    >
                                                        {reportProcessing === report.id ? <Loader2 size={14} className="animate-spin" /> : <Flag size={14} />}
                                                        Valid (No Ban)
                                                    </button>
                                                    <button
                                                        onClick={() => handleReportAction(report.id, 'valid', report.reported_user?.id, true)}
                                                        disabled={reportProcessing === report.id || report.reported_user?.is_banned}
                                                        className="flex-1 py-3 bg-red-600/80 hover:bg-red-600 text-white border border-red-500/40 rounded-2xl font-black text-xs tracking-widest transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                                    >
                                                        {reportProcessing === report.id ? <Loader2 size={14} className="animate-spin" /> : <Ban size={14} />}
                                                        {report.reported_user?.is_banned ? 'Already Banned' : 'Valid + Ban'}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className={`${adminSection === 'posts' ? 'block' : 'hidden'} space-y-8`}>
                    {/* ─── STAT CARDS ─── */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard label="Pending Review" count={stats.pending} icon={Clock} color="text-yellow-400" active={activeTab === 'pending'} onClick={() => setActiveTab('pending')} />
                        <StatCard label="Approved" count={stats.approved} icon={CheckCircle} color="text-green-400" active={activeTab === 'approved'} onClick={() => setActiveTab('approved')} />
                        <StatCard label="Rejected" count={stats.rejected} icon={XCircle} color="text-red-400" active={activeTab === 'rejected'} onClick={() => setActiveTab('rejected')} />
                        <StatCard label="Total Items" count={stats.total} icon={Package} color="text-orange-400" active={activeTab === 'all'} onClick={() => setActiveTab('all')} />
                    </div>

                    {/* ─── TABS + SEARCH + FILTERS ─── */}
                    <div className="relative w-full z-60">
                        <div className="flex flex-col lg:flex-row gap-4 items-stretch lg:items-center justify-between">
                            <div className="flex bg-white/5 p-1.5 rounded-2xl border border-white/10 backdrop-blur-md">
                                {TABS.map(tab => (
                                    <button
                                        key={tab.key}
                                        onClick={() => setActiveTab(tab.key)}
                                        className={`flex items-center gap-2 px-5 py-2.5 rounded-[0.9rem] text-xs font-black tracking-widest transition-all ${activeTab === tab.key
                                            ? `${tab.bg} text-white shadow-lg`
                                            : 'text-white/30 hover:text-white/50'
                                            }`}
                                    >
                                        <tab.icon size={14} />
                                        {tab.label}
                                    </button>
                                ))}
                            </div>

                            <div className="flex items-center gap-4 lg:ml-auto w-full lg:w-auto flex-1 lg:justify-end">
                                <div className="relative flex-1 max-w-md">
                                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-500/50" size={18} />
                                    <input
                                        type="text"
                                        placeholder="Search by title, poster, student ID..."
                                        value={searchQuery}
                                        onChange={(e) => setSearchQuery(e.target.value)}
                                        className="w-full bg-white/4 border border-white/10 py-3 pl-11 pr-4 rounded-xl outline-none text-sm focus:border-orange-500/50 transition-all placeholder:text-white/20"
                                    />
                                </div>

                                {/* Filter toggle */}
                                <button onClick={() => setShowFilters(!showFilters)}
                                    className={`relative p-3 rounded-xl border transition-all shrink-0 ${showFilters ? 'bg-orange-500 border-orange-400 text-white' : 'bg-white/5 border-white/10 text-orange-500'}`}>
                                    <Filter size={18} />
                                    {hasActiveFilters && !showFilters && <span className="absolute -top-1 -right-1 w-3 h-3 bg-orange-500 rounded-full border-2 border-[#0a0a0a]" />}
                                </button>
                            </div>
                        </div>

                        {/* ─── FILTER OVERLAY ─── */}
                        <AnimatePresence>
                            {showFilters && (
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95, y: -10 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: -10 }}
                                    transition={{ duration: 0.2 }}
                                    className="absolute top-full right-0 mt-2 z-50 w-full max-w-md md:max-w-lg bg-[#121212]/95 border border-white/10 rounded-4xl backdrop-blur-2xl shadow-2xl p-6 space-y-5"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="text-[10px] uppercase tracking-[0.3em] text-orange-500 font-black">Filters</span>
                                        {hasActiveFilters && <button onClick={() => { setCategoryFilter('All'); setItemTypeFilter('All'); setStatusFilter('All'); setLocationFilter('All'); setDateFrom(''); setDateTo(''); }}
                                            className="flex items-center gap-1 text-[10px] text-orange-400/70 hover:text-orange-400 font-bold transition-colors"><X size={12} /> Clear all</button>}
                                    </div>
                                    {/* Category */}
                                    <div>
                                        <label className="text-[10px] uppercase tracking-[0.3em] text-white/40 font-black mb-2 block">Category</label>
                                        <div className="flex gap-2">
                                            {['All', 'Lost', 'Found'].map(c => (
                                                <button key={c} onClick={() => setCategoryFilter(c)}
                                                    className={`px-4 py-2 rounded-xl text-[10px] font-bold border transition-all ${categoryFilter === c ? 'bg-orange-500 border-orange-400 text-white' : 'bg-white/5 border-white/5 text-white/40'}`}>{c}</button>
                                            ))}
                                        </div>
                                    </div>
                                    {/* Resolution Status */}
                                    <div>
                                        <label className="text-[10px] uppercase tracking-[0.3em] text-white/40 font-black mb-2 block">Resolution</label>
                                        <div className="flex gap-2">
                                            {['All', 'Active', 'Resolved'].map(s => (
                                                <button key={s} onClick={() => setStatusFilter(s)}
                                                    className={`px-4 py-2 rounded-xl text-[10px] font-bold border transition-all ${statusFilter === s ? 'bg-orange-500 border-orange-400 text-white' : 'bg-white/5 border-white/5 text-white/40'}`}>
                                                    {s === 'Active' ? 'Unresolved' : s}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                    {/* Item Type */}
                                    <div>
                                        <label className="text-[10px] uppercase tracking-[0.3em] text-white/40 font-black mb-2 block">Item Type</label>
                                        <div className="relative overflow-hidden rounded-xl -mx-1">
                                            {/* Mobile: horizontal drag scroll */}
                                            <div className="md:hidden" ref={typeScrollRef}>
                                                <motion.div 
                                                    drag="x"
                                                    dragConstraints={typeConstraints}
                                                    className="flex gap-2 px-1 pb-1 cursor-grab active:cursor-grabbing w-max"
                                                >
                                                    <button onClick={() => setItemTypeFilter('All')}
                                                        className={`shrink-0 px-3.5 py-2 rounded-xl text-[10px] font-bold border transition-all whitespace-nowrap ${itemTypeFilter === 'All' ? 'bg-orange-500 border-orange-400 text-white' : 'bg-white/5 border-white/5 text-white/40'}`}>
                                                        All
                                                    </button>
                                                    {ITEM_CATEGORIES.map(cat => (
                                                        <button key={cat.value} onClick={() => setItemTypeFilter(cat.value)}
                                                            className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[10px] font-bold border transition-all whitespace-nowrap ${itemTypeFilter === cat.value ? 'bg-orange-500 border-orange-400 text-white' : 'bg-white/5 border-white/5 text-white/40'}`}>
                                                            <span>{cat.emoji}</span> {cat.label}
                                                        </button>
                                                    ))}
                                                </motion.div>
                                            </div>
                                            {/* Desktop: wrapping grid */}
                                            <div className="hidden md:flex flex-wrap gap-2 px-1 pb-1">
                                                <button onClick={() => setItemTypeFilter('All')}
                                                    className={`px-3.5 py-2 rounded-xl text-[10px] font-bold border transition-all whitespace-nowrap ${itemTypeFilter === 'All' ? 'bg-orange-500 border-orange-400 text-white' : 'bg-white/5 border-white/5 text-white/40'}`}>
                                                    All
                                                </button>
                                                {ITEM_CATEGORIES.map(cat => (
                                                    <button key={cat.value} onClick={() => setItemTypeFilter(cat.value)}
                                                        className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[10px] font-bold border transition-all whitespace-nowrap ${itemTypeFilter === cat.value ? 'bg-orange-500 border-orange-400 text-white' : 'bg-white/5 border-white/5 text-white/40'}`}>
                                                        <span>{cat.emoji}</span> {cat.label}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    {/* Location */}
                                    <div>
                                        <label className="text-[10px] uppercase tracking-[0.3em] text-white/40 font-black mb-2 block">Location</label>
                                        <div className="relative overflow-hidden rounded-xl -mx-1">
                                            {/* Mobile: horizontal drag scroll */}
                                            <div className="md:hidden" ref={locScrollRef}>
                                                <motion.div 
                                                    drag="x"
                                                    dragConstraints={locConstraints}
                                                    className="flex gap-2 px-1 pb-1 cursor-grab active:cursor-grabbing w-max"
                                                >
                                                    <button onClick={() => setLocationFilter('All')}
                                                        className={`shrink-0 px-4 py-2 rounded-xl text-[10px] font-bold border transition-all ${locationFilter === 'All' ? 'bg-orange-500 border-orange-400 text-white' : 'bg-white/5 border-white/5 text-white/40'}`}>All</button>
                                                    {LOCATIONS.map(loc => (
                                                        <button key={loc} onClick={() => setLocationFilter(loc)}
                                                            className={`shrink-0 px-4 py-2 rounded-xl text-[10px] font-bold border transition-all whitespace-nowrap ${locationFilter === loc ? 'bg-orange-500 border-orange-400 text-white' : 'bg-white/5 border-white/5 text-white/40'}`}>{loc}</button>
                                                    ))}
                                                </motion.div>
                                            </div>
                                            {/* Desktop: wrapping grid */}
                                            <div className="hidden md:flex flex-wrap gap-2 px-1 pb-1">
                                                <button onClick={() => setLocationFilter('All')}
                                                    className={`px-4 py-2 rounded-xl text-[10px] font-bold border transition-all ${locationFilter === 'All' ? 'bg-orange-500 border-orange-400 text-white' : 'bg-white/5 border-white/5 text-white/40'}`}>All</button>
                                                {LOCATIONS.map(loc => (
                                                    <button key={loc} onClick={() => setLocationFilter(loc)}
                                                        className={`px-4 py-2 rounded-xl text-[10px] font-bold border transition-all whitespace-nowrap ${locationFilter === loc ? 'bg-orange-500 border-orange-400 text-white' : 'bg-white/5 border-white/5 text-white/40'}`}>{loc}</button>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                    {/* Date Range */}
                                    <div>
                                        <label className="text-[10px] uppercase tracking-[0.3em] text-white/40 font-black mb-2 block">Date Range</label>
                                        <CustomDateRangePicker
                                            dateFrom={dateFrom} setDateFrom={setDateFrom}
                                            dateTo={dateTo} setDateTo={setDateTo}
                                        />
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>

                    {/* ─── ACTIVE FILTER CHIPS ─── */}
                    <AnimatePresence>
                        {hasActiveFilters && !showFilters && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                                className="flex flex-wrap gap-2">
                                {categoryFilter !== 'All' && (
                                    <button onClick={() => setCategoryFilter('All')}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/15 border border-orange-500/30 rounded-xl text-[10px] font-bold text-orange-300 hover:bg-orange-500/25 transition-all">
                                        {categoryFilter} <X size={10} className="opacity-60" />
                                    </button>
                                )}
                                {statusFilter !== 'All' && (
                                    <button onClick={() => setStatusFilter('All')}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/15 border border-orange-500/30 rounded-xl text-[10px] font-bold text-orange-300 hover:bg-orange-500/25 transition-all">
                                        {statusFilter === 'Active' ? 'Unresolved' : 'Resolved'} <X size={10} className="opacity-60" />
                                    </button>
                                )}
                                {itemTypeFilter !== 'All' && (
                                    <button onClick={() => setItemTypeFilter('All')}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/15 border border-orange-500/30 rounded-xl text-[10px] font-bold text-orange-300 hover:bg-orange-500/25 transition-all">
                                        {ITEM_CATEGORIES.find(c => c.value === itemTypeFilter)?.emoji} {itemTypeFilter} <X size={10} className="opacity-60" />
                                    </button>
                                )}
                                {locationFilter !== 'All' && (
                                    <button onClick={() => setLocationFilter('All')}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/15 border border-orange-500/30 rounded-xl text-[10px] font-bold text-orange-300 hover:bg-orange-500/25 transition-all">
                                        <MapPin size={10} /> {locationFilter} <X size={10} className="opacity-60" />
                                    </button>
                                )}
                                {(dateFrom || dateTo) && (
                                    <button onClick={() => { setDateFrom(''); setDateTo(''); }}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500/15 border border-orange-500/30 rounded-xl text-[10px] font-bold text-orange-300 hover:bg-orange-500/25 transition-all">
                                        <Calendar size={10} /> {dateFrom || '...'} — {dateTo || '...'} <X size={10} className="opacity-60" />
                                    </button>
                                )}
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* ─── SELECT ALL / COUNT ─── */}
                    {filteredItems.length > 0 && (
                        <div className="flex items-center gap-3">
                            <button onClick={toggleSelectAll}
                                className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${selectedItems.size === filteredItems.length && filteredItems.length > 0 ? 'bg-orange-500 border-orange-400' : 'bg-white/5 border-white/20 hover:border-orange-500/60'}`}>
                                {selectedItems.size === filteredItems.length && filteredItems.length > 0 && <CheckCircle size={14} className="text-white" />}
                            </button>
                            <span className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
                                {selectedItems.size > 0 ? `${selectedItems.size} selected` : 'Select all'}
                            </span>
                        </div>
                    )}

                    {/* ─── ITEMS GRID ─── */}
                    <div className="relative min-h-[400px]">
                        <AnimatePresence mode="wait">
                            {loading ? (
                                <motion.div
                                    key="loader"
                                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                                    className="flex flex-col items-center justify-center pt-20 gap-4"
                                >
                                    <div className="w-10 h-10 border-4 border-orange-500/20 border-t-orange-500 rounded-full animate-spin" />
                                    <p className="text-[10px] font-black tracking-widest text-orange-500/40 uppercase">Loading items...</p>
                                </motion.div>
                            ) : filteredItems.length > 0 ? (
                                <motion.div
                                    key="grid"
                                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
                                >
                                    <AnimatePresence>
                                        {filteredItems.map(item => (
                                            <AdminItemCard
                                                key={item.id}
                                                item={item}
                                                selected={selectedItems.has(item.id)}
                                                onToggleSelect={toggleSelect}
                                                onApprove={(id) => handleModerate(id, 'approve')}
                                                onReject={(id) => handleModerate(id, 'reject')}
                                                onDelete={(id) => setDeleteTarget(id)}
                                                onPreview={setPreviewItem}
                                                processing={processing}
                                            />
                                        ))}
                                    </AnimatePresence>
                                </motion.div>
                            ) : (
                                <motion.div
                                    key="empty"
                                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                                    className="flex flex-col items-center justify-center py-20 text-white/20"
                                >
                                    <Package size={48} strokeWidth={1} className="mb-4" />
                                    <p className="text-[10px] font-black uppercase tracking-[0.2em]">
                                        {searchQuery ? 'No items match your search' : `No ${activeTab === 'all' ? '' : activeTab} items`}
                                    </p>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </main>

            {/* ─── TOAST ─── */}
            <AnimatePresence>
                {toast && (
                    <motion.div
                        initial={{ opacity: 0, y: 50 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: 50 }}
                        className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[120] px-6 py-4 rounded-2xl font-bold text-sm shadow-2xl border ${toast.type === 'error'
                            ? 'bg-red-500/20 border-red-500/40 text-red-300'
                            : 'bg-green-500/20 border-green-500/40 text-green-300'
                            }`}
                    >
                        {toast.message}
                    </motion.div>
                )}
            </AnimatePresence>

            {/* ─── PREVIEW MODAL ─── */}
            <AnimatePresence>
                {previewItem && <PreviewModal item={previewItem} onClose={() => setPreviewItem(null)} />}
            </AnimatePresence>

            {/* ─── DELETE CONFIRM ─── */}
            <AnimatePresence>
                {deleteTarget && (
                    <DeleteConfirmModal
                        onConfirm={() => handleDelete(deleteTarget)}
                        onCancel={() => setDeleteTarget(null)}
                        processing={processing}
                    />
                )}
            </AnimatePresence>

            {/* ─── BATCH DELETE CONFIRM ─── */}
            <AnimatePresence>
                {batchDeleteConfirm && (
                    <DeleteConfirmModal
                        onConfirm={handleBatchDelete}
                        onCancel={() => setBatchDeleteConfirm(false)}
                        processing={processing}
                        message={`Delete ${selectedItems.size} item(s)? This cannot be undone.`}
                    />
                )}
            </AnimatePresence>

            {/* ─── BATCH ACTION BAR ─── */}
            <AnimatePresence>
                {selectedItems.size > 0 && adminSection === 'posts' && (
                    <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }}
                        className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 px-6 py-4 bg-[#1a1a1a]/95 border border-white/10 rounded-2xl backdrop-blur-2xl shadow-2xl">
                        <span className="text-xs font-black text-white/60 uppercase tracking-widest mr-2">{selectedItems.size} selected</span>
                        <button onClick={() => handleBatchModerate('approve')} disabled={processing}
                            className="px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl text-[10px] font-black tracking-widest transition-all flex items-center gap-1.5 disabled:opacity-50">
                            <CheckCircle size={12} /> Approve
                        </button>
                        <button onClick={() => handleBatchModerate('reject')} disabled={processing}
                            className="px-4 py-2.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/30 rounded-xl text-[10px] font-black tracking-widest transition-all flex items-center gap-1.5 disabled:opacity-50">
                            <XCircle size={12} /> Reject
                        </button>
                        <button onClick={() => setBatchDeleteConfirm(true)} disabled={processing}
                            className="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-[10px] font-black tracking-widest transition-all flex items-center gap-1.5 disabled:opacity-50">
                            <Trash2 size={12} /> Delete
                        </button>
                        <button onClick={() => setSelectedItems(new Set())}
                            className="px-3 py-2.5 bg-white/5 hover:bg-white/10 text-white/40 rounded-xl text-[10px] font-black tracking-widest transition-all">
                            Cancel
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
