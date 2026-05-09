"use client";
import React, { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, MapPin, Clock, User, MessageCircle, Lock } from "lucide-react";
import { motion } from "framer-motion";
import NavBar from "@/components/NavBar";
import ItemPostModal from "@/components/ItemPostModal";


export default function ItemDetailPage() {
    const router = useRouter();
    const params = useParams();
    const [item, setItem] = useState(null);
    const [loading, setLoading] = useState(true);
    const [owner, setOwner] = useState(null);
    const [user, setUser] = useState(null);
    const [showPostModal, setShowPostModal] = useState(false);
    const isOwner = user?.id === item?.user_id;

    useEffect(() => {
        fetchItemDetail();
    }, [params.id]);

    useEffect(() => {
        const getUser = async () => {
            const {
                data: { user },
            } = await supabase.auth.getUser();
            setUser(user);
        };
        getUser();
    }, []);

    const fetchItemDetail = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from("items")
                .select("*")
                .eq("id", params.id)
                .single();

            if (error) throw error;
            setItem(data);

            // Fetch owner profile
            if (data.user_id) {
                const { data: profileData } = await supabase
                    .from("profiles")
                    .select("*")
                    .eq("id", data.user_id)
                    .single();
                setOwner(profileData);
            }
        } catch (error) {
            console.error("Error fetching item:", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center text-white bg-gradient-to-br from-[#0a0a0a] via-[#1a1a1a] to-[#7c2d1233]">
                <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4" />
                <p className="font-medium opacity-50">Loading item...</p>
            </div>
        );
    }

    if (!item) {
        return (
            <div className="min-h-screen flex flex-col items-center justify-center text-white bg-gradient-to-br from-[#0a0a0a] via-[#1a1a1a] to-[#7c2d1233]">
                <p className="text-lg font-semibold text-orange-400">Item not found</p>
                <button
                    onClick={() => router.back()}
                    className="mt-4 px-6 py-2 bg-orange-500 rounded-2xl font-bold hover:bg-orange-600 transition"
                >
                    Go Back
                </button>
            </div>
        );
    }

    const statusMap = { "Active": "Unclaimed", "Resolved": "Claimed" };
    const displayStatus = statusMap[item.status] || item.status;

    const handleToggleStatus = async () => {
        if (!isOwner) return;

        const newStatus = item.status === 'Active' ? 'Resolved' : 'Active';

        const { error } = await supabase
            .from('items')
            .update({ status: newStatus })
            .eq('id', item.id);

        if (error) {
            console.error("Error updating status:", error);
            alert("Failed to update status.");
        } else {
            setItem({ ...item, status: newStatus });
        }
    };

    const handleContactOwner = async () => {
        if (!user) {
            alert('Please log in to message the poster.');
            return;
        }

        if (user.id === item.user_id) {
            alert('This is your own item.');
            return;
        }

        try {
            // 1. Check for existing chat between these users for this specific item
            const { data: existingChats, error: fetchError } = await supabase
                .from('chats')
                .select('id')
                .eq('item_id', item.id)
                .or(`claimer_id.eq.${user.id},finder_id.eq.${user.id}`);

            if (fetchError) throw fetchError;

            if (existingChats && existingChats.length > 0) {
                router.push(`/chat?id=${existingChats[0].id}`);
                return;
            }

            // 2. Create new chat record
            const { data: newChat, error: createError } = await supabase
                .from('chats')
                .insert({
                    item_id: item.id,
                    finder_id: item.user_id,
                    claimer_id: user.id,
                    status: 'open'
                })
                .select()
                .single();

            if (createError) throw createError;

            // 3. Prepare the automated initial message using post data
            const initialMessage = `Hi! I'm reaching out about your post "${item.title}" at ${item.location_tag}. Is this still available?`;

            // --- THE FIX: We added "const { error: msgError }" here to define the variable[cite: 5] ---
            const { error: msgError } = await supabase.from('messages').insert({
                chat_id: newChat.id,
                item_id: item.id,
                sender_id: user.id,
                receiver_id: item.user_id,
                content: initialMessage,
                is_read: false
            });

            if (msgError) throw msgError;

            // 4. Redirect the user to the chat page with the new ID[cite: 6]
            router.push(`/chat?id=${newChat.id}`);

        } catch (error) {
            console.error("Detailed Chat Error:", error.message || error);
            alert(`Could not start conversation: ${error.message || 'Unknown error'}`);
        }
    };

    const handleFileSelected = (file) => {
        const previewUrl = URL.createObjectURL(file);
        setShowPostModal(false);
        router.push(`/post?preview=${encodeURIComponent(previewUrl)}`);
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-[#0a0a0a] via-[#1a1a1a] to-[#7c2d1233] text-white pb-32 font-sans">
            {/* Header */}
            <header className="sticky top-0 z-50 bg-black/40 backdrop-blur-xl border-b border-orange-500/20 p-5">
                <div className="max-w-6xl mx-auto flex items-center justify-between">
                    <button
                        onClick={() => router.back()}
                        className="p-2.5 bg-white/5 rounded-xl text-orange-500 border border-white/10 hover:bg-white/10 transition-all"
                    >
                        <ArrowLeft size={22} />
                    </button>
                    <h1 className="text-2xl font-bold text-orange-400">Item Details</h1>
                    <div className="w-10" />
                </div>
            </header>

            <main className="max-w-2xl mx-auto px-6 pt-6 pb-6 space-y-6">
                {/* Item Image */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    layout="position"
                    className="rounded-[2.5rem] overflow-hidden border border-orange-500/30 shadow-2xl"
                >
                    <img
                        src={item.image_url}
                        alt={item.title}
                        className="w-full h-96 object-cover"
                    />
                </motion.div>

                {/* Item Info */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="rounded-[2.5rem] bg-black/40 border border-orange-500/30 p-8"
                >
                    <div className="space-y-4">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <h2 className="text-3xl font-bold text-white">{item.title}</h2>
                                <p className="text-orange-300/70 text-sm mt-2">{item.category}</p>
                            </div>
                            <span className="text-[10px] font-black uppercase text-orange-500 bg-orange-500/10 px-4 py-2 rounded-full border border-orange-500/20 whitespace-nowrap">
                                {displayStatus}
                            </span>
                        </div>

                        <div className="border-t border-orange-500/20 pt-4">
                            <h3 className="text-sm font-semibold text-orange-400 uppercase tracking-widest mb-2">Description</h3>
                            <p className="text-white/80 text-base leading-relaxed">{item.description}</p>
                        </div>

                        {item.location_tag && (
                            <div className="flex items-center gap-3 text-white/80">
                                <MapPin size={18} className="text-orange-500" />
                                <div>
                                    <p className="text-[10px] uppercase tracking-widest text-orange-400">Location</p>
                                    <p className="text-sm font-medium">{item.location_tag}</p>
                                </div>
                            </div>
                        )}

                        {item.created_at && (
                            <div className="flex items-center gap-3 text-white/80">
                                <Clock size={18} className="text-orange-500" />
                                <div>
                                    <p className="text-[10px] uppercase tracking-widest text-orange-400">Posted</p>
                                    <p className="text-sm font-medium">
                                        {new Date(item.created_at).toLocaleDateString()}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                </motion.div>
                {/* Poster Info Card */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center gap-4 p-5 bg-black/40 rounded-[2rem] border border-orange-500/20"
                >
                    <div className="w-14 h-14 rounded-full bg-orange-500/20 flex items-center justify-center overflow-hidden border border-orange-500/30">
                        {owner?.avatar_url ? (
                            <img src={owner.avatar_url} className="w-full h-full object-cover" alt={owner.full_name} />
                        ) : (
                            <User className="text-orange-500" size={24} />
                        )}
                    </div>
                    <div>
                        <p className="text-[10px] uppercase tracking-widest text-orange-400/60 font-bold">Posted By</p>
                        <p className="font-bold text-xl text-white">{owner?.full_name || "LSPU Student"}</p>
                    </div>
                </motion.div>
                {/* Owner Info */}
                {isOwner ? (
                    <div className="space-y-3 w-full">
                        <div className="w-full py-3 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center gap-2 text-white/50 font-black tracking-widest text-xs">
                            <User size={16} />
                            YOU POSTED THIS ITEM
                        </div>
                        <button
                            onClick={handleToggleStatus}
                            className={`w-full py-4 rounded-2xl font-black tracking-widest transition-all shadow-lg ${item.status === 'Active'
                                ? 'bg-green-600 hover:bg-green-700 text-white'
                                : 'bg-orange-500 hover:bg-orange-600 text-white'
                                }`}
                        >
                            MARK AS {item.status === 'Active' ? 'CLAIMED' : 'UNCLAIMED'}
                        </button>
                    </div>
                ) : item.status === 'Resolved' ? (
                    <div className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center gap-2 text-white/30 font-black tracking-widest text-xs">
                        <Lock size={16} />
                        ITEM CLAIMED / RESOLVED
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
            </main>

            {/* Item Post Modal */}
            <ItemPostModal
                open={showPostModal}
                onClose={() => setShowPostModal(false)}
                onFileSelect={handleFileSelected}
            />

            {/* Navigation Bar */}
            <NavBar activePage="items" onPlusClick={() => setShowPostModal(true)} />
        </div>
    );
}
