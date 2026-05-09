"use client";
import { Search, Tag, Plus, MessageCircle, User, Shield } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function NavBar({ activePage, onPlusClick }) {
    const [unreadCount, setUnreadCount] = useState(0);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isDesktop, setIsDesktop] = useState(false);

    const handlePlusClick = () => {
        if (onPlusClick) {
            onPlusClick();
        } else {
            window.location.href = '/post';
        }
    };

    // Detect desktop viewport
    useEffect(() => {
        const checkDesktop = () => setIsDesktop(window.innerWidth >= 1024);
        checkDesktop();
        window.addEventListener('resize', checkDesktop);
        return () => window.removeEventListener('resize', checkDesktop);
    }, []);

    // Fetch user data (Admin status & Unread messages)
    useEffect(() => {
        let channel;

        const initializeUserData = async () => {
            try {
                // Fetch user once to prevent concurrent lock acquisitions
                const { data: { user }, error: authError } = await supabase.auth.getUser();
                if (authError || !user) return;

                // 1. Check if admin
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('role')
                    .eq('id', user.id)
                    .maybeSingle();

                if (profile?.role === 'admin') {
                    setIsAdmin(true);
                }

                // 2. Fetch unread count
                const fetchUnreadCount = async () => {
                    const { count, error } = await supabase
                        .from('messages')
                        .select('*', { count: 'exact', head: true })
                        .eq('receiver_id', user.id)
                        .eq('is_read', false);

                    if (!error) setUnreadCount(count || 0);
                };

                await fetchUnreadCount();

                // 3. Subscribe to new messages
                channel = supabase
                    .channel(`unread-messages-navbar-${Date.now()}`)
                    .on('postgres_changes', { 
                        event: 'INSERT', 
                        schema: 'public', 
                        table: 'messages' 
                    }, () => fetchUnreadCount())
                    .on('postgres_changes', { 
                        event: 'UPDATE', 
                        schema: 'public', 
                        table: 'messages' 
                    }, () => fetchUnreadCount())
                    .subscribe();
            } catch (error) {
                console.error("Error initializing user data in NavBar:", error);
            }
        };

        initializeUserData();

        return () => { 
            if (channel) supabase.removeChannel(channel); 
        };
    }, []);

    return (
        <nav className="fixed bottom-6 left-6 right-6 h-18 bg-black/50 backdrop-blur-2xl rounded-[2.5rem] border border-orange-500/20 shadow-2xl flex items-center justify-around px-4 z-50">
            <NavIcon icon={<Search size={22} />} label="Explore" active={activePage === 'home'} onClick={() => window.location.href = '/Home'} />
            <NavIcon icon={<Tag size={22} />} label="Items" active={activePage === 'items'} onClick={() => window.location.href = '/items'} />
            <motion.button
                whileTap={{ scale: 0.92 }}
                className="p-4 rounded-full -translate-y-6 border-4 border-black shadow-xl shadow-orange-500/40 bg-linear-to-br from-orange-500 to-orange-700 active:scale-90 transition-transform"
                onClick={handlePlusClick}
            >
                <Plus size={24} color="white" strokeWidth={3} />
            </motion.button>
            <NavIcon icon={<MessageCircle size={22} />} label="Chat" active={activePage === 'chat'} onClick={() => window.location.href = '/chat'} badgeCount={unreadCount} />
            <NavIcon icon={<User size={22} />} label="Profile" active={activePage === 'profile'} onClick={() => window.location.href = '/Profile'} />

            {/* Admin View button — only visible on desktop for admin users */}
            {isAdmin && isDesktop && (
                <motion.button
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileTap={{ scale: 0.92 }}
                    onClick={() => window.location.href = '/admin'}
                    className="absolute -top-14 right-4 flex items-center gap-2 px-4 py-2.5 bg-orange-500 hover:bg-orange-600 text-white rounded-2xl font-black text-[10px] tracking-widest uppercase shadow-lg shadow-orange-500/30 transition-all border-2 border-orange-400/50"
                >
                    <Shield size={14} strokeWidth={3} />
                    Admin View
                </motion.button>
            )}
        </nav>
    );
}

function NavIcon({ icon, label, active = false, onClick, badgeCount = 0 }) {
    return (
        <button onClick={onClick} className={`flex flex-col items-center gap-1 relative ${active ? 'text-orange-400' : 'text-orange-300/50'}`}>
            <div className={`${active ? 'bg-orange-500/10 p-2 rounded-xl' : ''}`}>
                {icon}
                {badgeCount > 0 && (
                    <span className="absolute top-0 right-0 -translate-y-1 translate-x-1 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-black flex items-center justify-center rounded-full border-2 border-black shadow-lg">
                        {badgeCount > 9 ? '9+' : badgeCount}
                    </span>
                )}
            </div>
            <span className="text-[10px] font-bold uppercase tracking-tighter">{label}</span>
        </button>
    );
}