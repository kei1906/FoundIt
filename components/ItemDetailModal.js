// components/ItemDetailModal.js
"use client";
import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, MapPin, User, MessageCircle, ExternalLink, Trash2, Maximize2, AlertTriangle, Loader2, Lock, Clock, XCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

export default function ItemDetailModal({ item, isOpen, onClose, onStatusUpdate }) {
    const router = useRouter();
    const [poster, setPoster] = useState(null);
    const [user, setUser] = useState(null);
    // Local status enables optimistic UI update without needing a page refresh
    const [localStatus, setLocalStatus] = useState(item?.status);
    const [isLightboxOpen, setIsLightboxOpen] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [loadingPoster, setLoadingPoster] = useState(false);

    const isOwner = user?.id === item?.user_id;

    // Sync localStatus when a different item is opened
    useEffect(() => {
        setLocalStatus(item?.status);
    }, [item?.id, item?.status]);

    useEffect(() => {
        const checkUser = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                setUser(session.user);
            } else {
                const { data: { user } } = await supabase.auth.getUser();
                setUser(user);
            }
        };
        if (isOpen) checkUser();
    }, [isOpen]);

    useEffect(() => {
        const fetchPosterProfile = async () => {
            if (!item?.user_id) { setPoster(null); return; }
            try {
                setLoadingPoster(true);
                setPoster(null); // Clear previous poster to avoid stale data UI
                const { data: profileData, error } = await supabase
                    .from('profiles')
                    .select('full_name, email, avatar_url')
                    .eq('id', item.user_id)
                    .single();
                if (error) { console.error('Unable to load poster profile:', error.message || error); setPoster(null); return; }
                setPoster(profileData);
            } finally {
                setLoadingPoster(false);
            }
        };
        if (isOpen) fetchPosterProfile();
    }, [isOpen, item?.user_id, item?.id]);

    const handleContactOwner = async () => {
        if (!user) { alert('Please log in to message the poster.'); return; }
        if (user.id === item.user_id) { alert('This is your own item.'); return; }
        try {
            const { data: existingChats, error: fetchError } = await supabase
                .from('chats').select('id').eq('item_id', item.id)
                .or(`claimer_id.eq.${user.id},finder_id.eq.${user.id}`);
            if (fetchError) throw fetchError;
            if (existingChats && existingChats.length > 0) {
                router.push(`/chat?id=${existingChats[0].id}`); return;
            }
            const { data: newChat, error: createError } = await supabase
                .from('chats').insert({ item_id: item.id, finder_id: item.user_id, claimer_id: user.id, status: 'open' })
                .select().single();
            if (createError) throw createError;
            const initialMessage = item.category === 'Lost'
                ? `Hi! I found something that might match your post "${item.title}" at ${item.location_tag}. Is this your item?`
                : `Hi! I'm reaching out about your post "${item.title}" at ${item.location_tag}. Is this still available?`;
            const { error: msgError } = await supabase.from('messages').insert({
                chat_id: newChat.id, item_id: item.id,
                sender_id: user.id, receiver_id: item.user_id,
                content: initialMessage, is_read: false
            });
            if (msgError) throw msgError;
            router.push(`/chat?id=${newChat.id}`);
        } catch (error) {
            console.error("Detailed Chat Error:", error.message || error);
            alert(`Could not start conversation: ${error.message || 'Unknown error'}`);
        }
    };

    const handleToggleStatus = async () => {
        if (!isOwner) return;
        const newStatus = localStatus === 'Active' ? 'Resolved' : 'Active';
        // Optimistic update: change UI instantly
        setLocalStatus(newStatus);
        const { error } = await supabase.from('items').update({ status: newStatus }).eq('id', item.id);
        if (error) {
            console.error("Error updating status:", error);
            alert("Failed to update status.");
            setLocalStatus(localStatus); // revert on failure
        } else {
            if (onStatusUpdate) onStatusUpdate(item.id, newStatus);
        }
    };

    const handleDeleteItem = async () => {
        try {
            setDeleting(true);
            const { error } = await supabase.from('items').delete().eq('id', item.id);
            if (error) throw error;

            // If there's an image, we could delete it too, but let's keep it simple for now
            // as per the "zero-debt" and "maintain stability" goal.

            setShowDeleteConfirm(false);
            onClose();
            if (window.onItemDeleted) window.onItemDeleted(item.id);
        } catch (error) {
            console.error("Error deleting item:", error);
            alert("Failed to delete item.");
        } finally {
            setDeleting(false);
        }
    };

    if (!item) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <div key="detail-modal-overlay" className="fixed inset-0 z-100 flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/80 backdrop-blur-sm"
                    />
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        className="relative w-full max-w-lg bg-[#121212] border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl"
                    >
                        {/* Header Image */}
                        <div className="relative aspect-video w-full group cursor-pointer" onClick={() => setIsLightboxOpen(true)}>
                            <img src={item.image_url} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" alt={item.title} />

                            {/* Tap to enlarge hint */}
                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <div className="bg-black/50 backdrop-blur-md p-3 rounded-full border border-white/20">
                                    <Maximize2 size={24} className="text-white" />
                                </div>
                            </div>

                            <button
                                onClick={(e) => { e.stopPropagation(); onClose(); }}
                                className="absolute top-4 right-4 p-2 bg-black/50 backdrop-blur-md rounded-full text-white/70 hover:text-white z-10"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-8 space-y-6">
                            <div className="flex justify-between items-start">
                                <div>
                                    <h2 className="text-2xl font-black text-white mb-1">{item.title}</h2>
                                    <div className="flex items-center gap-2 text-orange-500">
                                        <MapPin size={14} />
                                        <span className="text-xs font-bold uppercase tracking-widest">{item.location_tag}</span>
                                    </div>
                                </div>
                                <button
                                    onClick={() => router.push(`/items/${item.id}`)}
                                    className="p-3 bg-white/5 rounded-2xl text-white/40 hover:text-orange-500 transition-colors"
                                >
                                    <ExternalLink size={20} />
                                </button>
                            </div>

                            <p className="text-white/60 text-sm leading-relaxed">{item.description || "No description provided."}</p>

                            {/* Poster Info */}
                            <div className="flex items-center gap-4 p-4 bg-white/5 rounded-2xl border border-white/5">
                                <div className="w-12 h-12 rounded-full bg-orange-500/20 flex items-center justify-center overflow-hidden">
                                    {loadingPoster ? (
                                        <Loader2 size={20} className="text-orange-500/40 animate-spin" />
                                    ) : poster?.avatar_url ? (
                                        <img src={poster.avatar_url} className="w-full h-full object-cover" alt="" />
                                    ) : (
                                        <User className="text-orange-500" />
                                    )}
                                </div>
                                <div className="flex-1">
                                    <p className="text-[10px] uppercase tracking-widest text-white/30 font-bold">Posted By</p>
                                    {loadingPoster ? (
                                        <div className="h-4 w-24 bg-white/10 rounded animate-pulse mt-1" />
                                    ) : (
                                        <p className="font-bold text-white">{poster?.full_name || "Unknown User"}</p>
                                    )}
                                </div>
                            </div>

                            {/* Conditional Button Logic — uses localStatus for instant UI feedback */}
                            {isOwner ? (
                                <div className="space-y-3 w-full">
                                    <div className="w-full py-3 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center gap-2 text-white/50 font-black tracking-widest text-xs">
                                        <User size={16} />
                                        YOU POSTED THIS ITEM
                                    </div>

                                    {/* Moderation status banner — only visible to the owner when not approved */}
                                    {item.moderation_status && item.moderation_status !== 'approved' && (
                                        <div className={`w-full p-4 rounded-2xl border flex items-start gap-3 ${
                                            item.moderation_status === 'pending'
                                                ? 'bg-yellow-500/10 border-yellow-500/30'
                                                : 'bg-red-500/10 border-red-500/30'
                                        }`}>
                                            {item.moderation_status === 'pending' ? (
                                                <Clock size={18} className="text-yellow-400 shrink-0 mt-0.5" />
                                            ) : (
                                                <XCircle size={18} className="text-red-400 shrink-0 mt-0.5" />
                                            )}
                                            <div>
                                                <p className={`text-xs font-black uppercase tracking-widest ${
                                                    item.moderation_status === 'pending' ? 'text-yellow-400' : 'text-red-400'
                                                }`}>
                                                    {item.moderation_status === 'pending' ? 'Pending Review' : 'Post Rejected'}
                                                </p>
                                                <p className="text-[11px] text-white/40 mt-1 leading-relaxed">
                                                    {item.moderation_status === 'pending'
                                                        ? 'Your post is awaiting admin approval. It is not visible to other users yet.'
                                                        : 'This post was rejected by an admin and is not visible to other users.'}
                                                </p>
                                            </div>
                                        </div>
                                    )}

                                    <button
                                        onClick={handleToggleStatus}
                                        className={`w-full py-4 rounded-2xl font-black tracking-widest transition-all shadow-lg ${localStatus === 'Active'
                                            ? 'bg-green-600 hover:bg-green-700 text-white'
                                            : 'bg-orange-500 hover:bg-orange-600 text-white'
                                            }`}
                                    >
                                        {/* Context-aware label: Lost items say "FOUND/UNFOUND", Found items say "CLAIMED/UNCLAIMED" */}
                                        MARK AS {localStatus === 'Active'
                                            ? (item.category === 'Lost' ? 'FOUND' : 'CLAIMED')
                                            : (item.category === 'Lost' ? 'UNFOUND' : 'UNCLAIMED')
                                        }
                                    </button>

                                    <button
                                        onClick={() => setShowDeleteConfirm(true)}
                                        className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/30 rounded-2xl font-bold text-xs tracking-widest transition-all mt-2 flex items-center justify-center gap-2"
                                    >
                                        <Trash2 size={14} />
                                        DELETE POST
                                    </button>
                                </div>
                            ) : item.status === 'Resolved' ? (
                                <div className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center gap-2 text-white/30 font-black tracking-widest text-xs">
                                    <Lock size={16} />
                                    {item.category === 'Lost' ? 'ITEM FOUND' : 'ITEM CLAIMED'} / RESOLVED
                                </div>
                            ) : (
                                <button
                                    onClick={handleContactOwner}
                                    className="w-full py-4 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-black tracking-widest flex items-center justify-center gap-3 transition-all shadow-[0_0_30px_rgba(249,115,22,0.3)]"
                                >
                                    <MessageCircle size={20} strokeWidth={3} />
                                    MESSAGE POSTER
                                </button>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
            {/* Lightbox Modal */}
            {isLightboxOpen && (
                <div key="lightbox-overlay" className="fixed inset-0 z-200 flex items-center justify-center bg-black/95" onClick={() => setIsLightboxOpen(false)}>
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="relative w-full h-full flex items-center justify-center p-4"
                    >
                        <img src={item.image_url} className="max-w-full max-h-full object-contain rounded-lg" alt={item.title} />
                        <button className="absolute top-8 right-8 p-3 bg-white/10 hover:bg-white/20 rounded-full backdrop-blur-md border border-white/10 transition-all">
                            <X size={24} className="text-white" />
                        </button>
                    </motion.div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div key="delete-confirm-overlay" className="fixed inset-0 z-210 flex items-center justify-center p-6">
                    <motion.div
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        className="absolute inset-0 bg-black/90 backdrop-blur-sm"
                        onClick={() => setShowDeleteConfirm(false)}
                    />
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="relative bg-[#1a1a1a] border border-red-500/30 rounded-[2.5rem] p-8 max-w-sm w-full text-center shadow-2xl shadow-red-900/20"
                    >
                        <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                            <AlertTriangle size={32} className="text-red-500" />
                        </div>
                        <h3 className="text-xl font-bold text-white mb-2">Delete this post?</h3>
                        <p className="text-white/40 text-sm mb-8 leading-relaxed">This action cannot be undone. All information and images for this item will be removed.</p>
                        <div className="space-y-3">
                            <button
                                onClick={handleDeleteItem}
                                disabled={deleting}
                                className="w-full py-4 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black tracking-widest text-xs transition-all active:scale-95 flex items-center justify-center gap-2"
                            >
                                {deleting ? <Loader2 size={16} className="animate-spin" /> : <><Trash2 size={16} /> YES, DELETE POST</>}
                            </button>
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="w-full py-4 bg-white/5 hover:bg-white/10 text-white/60 rounded-2xl font-bold text-xs tracking-widest transition-all"
                            >
                                CANCEL
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}