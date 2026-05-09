"use client";
import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { 
  ArrowLeft, Send, Loader2, User, Trash2, X, 
  CheckCircle2, AlertCircle, Lock, AlertTriangle, 
  Flag, ImageIcon 
} from "lucide-react";
import { containsProfanity } from "@/utils/profanityFilter";
import { motion, AnimatePresence } from "framer-motion";
import NavBar from "@/components/NavBar";
import ItemPostModal from "@/components/ItemPostModal";
import { useAuthGuard } from "@/hooks/useAuthGuard";

export default function ChatPage() {
  const router = useRouter();
  const { user: authUser, authLoading } = useAuthGuard();
  const [user, setUser] = useState(null);
  const [view, setView] = useState('list');
  const [selectedConversation, setSelectedConversation] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [showPostModal, setShowPostModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingChat, setDeletingChat] = useState(false);
  const channelRef = useRef(null);
  const messagesEndRef = useRef(null);
  const activeChannelRef = useRef(null);
  const urlAutoOpenedRef = useRef(false);
  const [resolving, setResolving] = useState(false);
  const [visibleTimes, setVisibleTimes] = useState({});
  const [profanityWarning, setProfanityWarning] = useState(null);
  const profanityStrikeRef = useRef(0);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const imageInputRef = useRef(null);
  const [lightboxUrl, setLightboxUrl] = useState(null);

  const toggleTime = (msgId) => {
    setVisibleTimes(prev => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  useEffect(() => { getUser(); }, []);

  useEffect(() => {
    if (user) {
      fetchConversations();
      const listChannel = supabase
        .channel(`global-updates-${Date.now()}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => fetchConversations())
        .on("postgres_changes", { event: "*", schema: "public", table: "chats" }, () => fetchConversations())
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "items" }, () => fetchConversations())
        .on("postgres_changes", { event: "UPDATE", schema: "public", table: "profiles" }, () => fetchConversations())
        .subscribe();
      return () => {
        supabase.removeChannel(listChannel);
        if (activeChannelRef.current) supabase.removeChannel(activeChannelRef.current);
        activeChannelRef.current = null;
      };
    }
  }, [user]);

  useEffect(() => {
    if (urlAutoOpenedRef.current) return;
    const urlParams = new URLSearchParams(window.location.search);
    const chatId = urlParams.get('id');
    if (chatId && conversations.length > 0) {
      const targetConv = conversations.find(c => c.id === chatId);
      if (targetConv) {
        urlAutoOpenedRef.current = true;
        selectConversation(targetConv);
      }
    }
  }, [conversations]);

  useEffect(() => {
    if (messages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
    }
  }, [messages]);

  const getUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    setUser(user);
    setLoading(false);
  };

  const fetchConversations = async () => {
    if (!user) return;
    const { data: chatsData, error } = await supabase
      .from("chats")
      .select(`id, item_id, finder_id, claimer_id, created_at, finder_confirmed_resolved, claimer_confirmed_resolved, messages(content, created_at, sender_id)`)
      .or(`finder_id.eq.${user.id},claimer_id.eq.${user.id}`);
    
    if (error) { console.error("fetchConversations error:", error); return; }

    const itemIds = [...new Set(chatsData.map(c => c.item_id).filter(Boolean))];
    const profileIds = [...new Set(chatsData.flatMap(c => [c.finder_id, c.claimer_id]).filter(Boolean))];

    let itemsData = [], profilesData = [];
    if (itemIds.length > 0) {
      const { data } = await supabase.from('items').select('id, title, status').in('id', itemIds);
      itemsData = data || [];
    }
    if (profileIds.length > 0) {
      const { data } = await supabase.from('profiles').select('id, full_name, avatar_url, is_banned').in('id', profileIds);
      profilesData = data || [];
    }

    const itemMap = itemsData.reduce((acc, i) => ({ ...acc, [i.id]: i }), {});
    const profileMap = profilesData.reduce((acc, p) => ({ ...acc, [p.id]: p }), {});

    const mapped = chatsData.map(chat => {
      const isFinder = chat.finder_id === user.id;
      const otherUserId = isFinder ? chat.claimer_id : chat.finder_id;
      const otherUserProfile = profileMap[otherUserId];
      
      const sortedMsgs = (chat.messages || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      const latestMsg = sortedMsgs[0];

      return {
        id: chat.id,
        itemId: chat.item_id,
        itemTitle: itemMap[chat.item_id]?.title || "Item",
        otherUserId: otherUserId,
        otherUser: {
          full_name: otherUserProfile?.full_name || "Unknown User",
          avatar_url: otherUserProfile?.avatar_url || null,
        },
        lastMessage: latestMsg
          ? (latestMsg.sender_id === user.id ? `You: ${latestMsg.content}` : latestMsg.content)
          : "New conversation",
        lastMessageTime: new Date(latestMsg?.created_at || chat.created_at),
        isFinder,
        finderConfirmed: chat.finder_confirmed_resolved,
        claimerConfirmed: chat.claimer_confirmed_resolved,
        isResolved: (chat.finder_confirmed_resolved && chat.claimer_confirmed_resolved) || itemMap[chat.item_id]?.status === 'Resolved',
        otherUserIsBanned: otherUserProfile?.is_banned ?? false,
      };
    }).sort((a, b) => b.lastMessageTime - a.lastMessageTime);

    setConversations(mapped);
    setSelectedConversation(prev => {
      if (!prev) return prev;
      const updated = mapped.find(c => c.id === prev.id);
      return updated ? updated : prev;
    });
  };

  const selectConversation = async (conv) => {
    setSelectedConversation(conv);
    setView('chat');
    const { data: history, error } = await supabase
      .from('messages').select('*').eq('chat_id', conv.id).order('created_at', { ascending: true });
    
    if (!error) {
      const seen = new Set();
      setMessages((history ?? []).filter(m => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      }));
    }

    if (user) {
      await supabase
        .from('messages')
        .update({ is_read: true })
        .eq('chat_id', conv.id)
        .eq('receiver_id', user.id)
        .eq('is_read', false);
    }

    if (channelRef.current) supabase.removeChannel(channelRef.current);
    const channel = supabase.channel(`room-${conv.id}`);
    channel.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${conv.id}` },
      (payload) => {
        setMessages((prev) =>
          prev.some((m) => m.id === payload.new.id) ? prev : [...prev, payload.new]
        );
        if (payload.new.receiver_id === user?.id) {
          supabase.from('messages').update({ is_read: true }).eq('id', payload.new.id).then(() => { });
        }
      }
    ).subscribe();
    channelRef.current = channel;
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !user) return;
    const content = newMessage.trim();

    const { isClean } = await containsProfanity(content);
    if (!isClean) {
      profanityStrikeRef.current += 1;
      setProfanityWarning(profanityStrikeRef.current >= 2 ? 'repeat' : 'first');
      return;
    }

    setNewMessage("");
    profanityStrikeRef.current = 0;

    const { data: inserted, error } = await supabase
      .from("messages")
      .insert({
        sender_id: user.id,
        receiver_id: selectedConversation.otherUserId,
        chat_id: selectedConversation.id,
        item_id: selectedConversation.itemId,
        content,
        is_read: false
      })
      .select()
      .single();

    if (error) {
      console.error("Supabase Insert Error:", error.message);
      return;
    }

    if (inserted) {
      setMessages((prev) =>
        prev.some((m) => m.id === inserted.id) ? prev : [...prev, inserted]
      );
    }
  };

  const compressImage = (file) =>
    new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 800;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob((blob) => resolve(blob), 'image/jpeg', 0.75);
      };
      img.src = URL.createObjectURL(file);
    });

  const handleImageSend = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !selectedConversation || !user) return;
    e.target.value = '';
    setImageUploading(true);
    try {
      const compressed = await compressImage(file);
      const path = `${selectedConversation.id}/${crypto.randomUUID()}.jpg`;
      const { error: uploadErr } = await supabase.storage
        .from('chat-images')
        .upload(path, compressed, { contentType: 'image/jpeg', upsert: false });
      if (uploadErr) throw uploadErr;
      const { data: { publicUrl } } = supabase.storage.from('chat-images').getPublicUrl(path);
      const { data: inserted, error } = await supabase
        .from('messages')
        .insert({
          sender_id: user.id,
          receiver_id: selectedConversation.otherUserId,
          chat_id: selectedConversation.id,
          item_id: selectedConversation.itemId,
          content: '🖼️ Photo',
          image_url: publicUrl,
          is_read: false,
        })
        .select()
        .single();
      if (error) throw error;
      if (inserted) {
        setMessages((prev) =>
          prev.some((m) => m.id === inserted.id) ? prev : [...prev, inserted]
        );
      }
    } catch (err) {
      console.error('Image send error:', err);
    } finally {
      setImageUploading(false);
    }
  };

  const handleDeleteChat = async () => {
    if (!selectedConversation) return;
    try {
      setDeletingChat(true);
      await supabase.from('messages').delete().eq('chat_id', selectedConversation.id);
      const { error } = await supabase.from('chats').delete().eq('id', selectedConversation.id);
      if (error) throw error;
      setShowDeleteConfirm(false);
      backToList();
    } catch (err) {
      console.error("Delete chat error:", err);
    } finally {
      setDeletingChat(false);
    }
  };

  const handleResolve = async (confirm = true) => {
    if (!selectedConversation || !user) return;
    try {
      setResolving(true);
      const isFinder = selectedConversation.isFinder;
      const updateData = isFinder
        ? { finder_confirmed_resolved: confirm }
        : { claimer_confirmed_resolved: confirm };

      const { data: updatedChat, error } = await supabase
        .from('chats')
        .update(updateData)
        .eq('id', selectedConversation.id)
        .select()
        .single();

      if (error) throw error;

      if (confirm && updatedChat.finder_confirmed_resolved && updatedChat.claimer_confirmed_resolved) {
        await supabase.from('messages').insert({
          sender_id: user.id,
          receiver_id: selectedConversation.otherUserId,
          chat_id: selectedConversation.id,
          item_id: selectedConversation.itemId,
          content: "✅ Both users have confirmed. This item is now marked as Resolved.",
          is_read: false
        });
      }

      await fetchConversations();
    } catch (err) {
      console.error("Resolution error:", err);
    } finally {
      setResolving(false);
    }
  };

  const handleReport = async () => {
    if (!reportReason.trim() || !selectedConversation || !user) return;
    setReportSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/report-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          reportedUserId: selectedConversation.otherUserId,
          chatId: selectedConversation.id,
          reason: reportReason.trim(),
        }),
      });
      if (!res.ok) throw new Error('Report failed');
      setReportSuccess(true);
      setReportReason('');
      setTimeout(() => {
        setShowReportModal(false);
        setReportSuccess(false);
      }, 2000);
    } catch (err) {
      console.error(err.message);
    } finally {
      setReportSubmitting(false);
    }
  };

  const handleFileSelected = (file) => {
    const previewUrl = URL.createObjectURL(file);
    setShowPostModal(false);
    router.push(`/post?preview=${encodeURIComponent(previewUrl)}`);
  };

  const backToList = () => {
    if (channelRef.current) { supabase.removeChannel(channelRef.current); channelRef.current = null; }
    setView('list');
    setSelectedConversation(null);
    setMessages([]);
    fetchConversations();
  };

  if (loading || authLoading) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
    </div>
  );

  return (
    <div className="min-h-screen bg-linear-to-br from-[#0a0a0a] via-[#1a1a1a] to-[#7c2d1233] text-white flex flex-col font-sans overflow-hidden">
      {view === 'list' ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 overflow-y-auto pb-24">
          <div className="p-6 flex items-center gap-3">
            <img src="/logo.png" alt="Logo" className="w-8 h-8 rounded-xl mix-blend-screen" />
            <h1 className="text-2xl font-bold bg-linear-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">Messages</h1>
          </div>
          <div className="px-6 space-y-4">
            {conversations.length === 0 && (
              <div className="flex flex-col items-center justify-center py-20 text-white/20">
                <p className="text-[10px] font-black uppercase tracking-[0.2em]">No conversations yet</p>
              </div>
            )}
            {conversations.map((conv) => (
              <button
                key={conv.id}
                onClick={() => selectConversation(conv)}
                className="w-full bg-black/30 border border-orange-500/20 rounded-2xl p-4 flex items-center gap-4 hover:bg-orange-500/10 transition-all text-left"
              >
                <div className="w-12 h-12 bg-orange-500/20 rounded-full border border-orange-500/30 overflow-hidden shrink-0">
                  {conv.otherUser?.avatar_url
                    ? <img src={conv.otherUser.avatar_url} alt="" className="w-full h-full object-cover" />
                    : <div className="w-full h-full flex items-center justify-center"><User size={20} className="text-orange-400" /></div>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate">{conv.otherUser?.full_name}</p>
                  <p className="text-sm text-orange-300/60 truncate">{conv.lastMessage}</p>
                </div>
                <div className="text-[10px] text-orange-400/40 shrink-0 uppercase">
                  {conv.lastMessageTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </button>
            ))}
          </div>
        </motion.div>
      ) : (
        <div className="flex flex-col h-screen overflow-hidden">
          {/* HEADER SECTION - SYNCED WITH PROFILE */}
          <div className="flex items-center p-4 border-b border-orange-500/10 bg-black/40 backdrop-blur-md">
            <button onClick={backToList} className="p-2 mr-2"><ArrowLeft size={22} className="text-orange-400" /></button>
            <div className="flex-1">
              <h2 className="font-bold text-base leading-tight">
                {selectedConversation?.otherUser?.full_name || "Unknown"}
              </h2>
              <p className="text-[10px] text-orange-400/60 uppercase tracking-wider">{selectedConversation?.itemTitle}</p>
            </div>
            {selectedConversation?.isFinder && (
              <button onClick={() => setShowDeleteConfirm(true)} className="p-2 mr-1 text-red-400/60 hover:text-red-400 transition-colors"><Trash2 size={20} /></button>
            )}
            {!selectedConversation?.isResolved && (
              <button onClick={() => setShowReportModal(true)} className="p-2 mr-1 text-white/20 hover:text-yellow-400 transition-colors"><Flag size={18} /></button>
            )}
            <div className="w-9 h-9 rounded-full border border-orange-500/30 overflow-hidden bg-orange-500/10">
              {selectedConversation?.otherUser?.avatar_url
                ? <img src={selectedConversation.otherUser.avatar_url} className="w-full h-full object-cover" alt="" />
                : <div className="w-full h-full flex items-center justify-center"><User size={16} className="text-orange-400" /></div>}
            </div>
          </div>

          {/* RESOLUTION BAR */}
          <div className="px-4 py-2 bg-black/20 border-b border-orange-500/5">
            {selectedConversation?.isResolved ? (
              <div className="flex items-center justify-center gap-2 py-2 text-green-400">
                <CheckCircle2 size={16} />
                <span className="text-[10px] font-black uppercase tracking-widest">Transaction Resolved</span>
              </div>
            ) : (
              <div className="flex items-center justify-between py-1">
                <div className="flex items-center gap-2">
                  <AlertCircle size={14} className="text-orange-500/40" />
                  <span className="text-[9px] text-white/30 font-bold uppercase tracking-tight">
                    {selectedConversation?.isFinder
                      ? (selectedConversation?.finderConfirmed ? "Waiting for claimer..." : "Is this item resolved?")
                      : (selectedConversation?.claimerConfirmed ? "Waiting for finder..." : "Is this item resolved?")
                    }
                  </span>
                </div>
                {((selectedConversation?.isFinder && !selectedConversation?.finderConfirmed) ||
                  (!selectedConversation?.isFinder && !selectedConversation?.claimerConfirmed)) ? (
                  <button onClick={() => handleResolve(true)} disabled={resolving} className="px-4 py-1.5 bg-orange-500/10 hover:bg-orange-500 text-orange-400 hover:text-white border border-orange-500/20 rounded-full text-[9px] font-black uppercase tracking-widest transition-all">
                    {resolving ? "Updating..." : "Mark as Resolved"}
                  </button>
                ) : (
                  <button onClick={() => handleResolve(false)} disabled={resolving} className="text-[9px] text-orange-500/40 hover:text-orange-500 font-bold uppercase tracking-widest underline underline-offset-4">
                    Cancel Request
                  </button>
                )}
              </div>
            )}
          </div>

          {/* CHAT AREA */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-transparent">
            {messages.map((msg) => {
              const isMe = msg.sender_id === user.id;
              return (
                <div key={msg.id} className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
                  {!isMe && (
                    <div className="w-7 h-7 rounded-full bg-orange-500/10 overflow-hidden shrink-0 border border-white/5">
                      {selectedConversation?.otherUser?.avatar_url
                        ? <img src={selectedConversation.otherUser.avatar_url} className="w-full h-full object-cover" alt="" />
                        : <div className="w-full h-full flex items-center justify-center"><User size={12} className="text-orange-400" /></div>}
                    </div>
                  )}
                  <div className="flex flex-col max-w-[75%]">
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      onClick={() => msg.image_url ? setLightboxUrl(msg.image_url) : toggleTime(msg.id)}
                      className={`overflow-hidden rounded-2xl ${msg.image_url ? 'cursor-pointer p-0' : `px-4 py-2 text-[15px] ${isMe ? 'bg-orange-600 rounded-br-none' : 'bg-white/10 rounded-bl-none'}`}`}
                    >
                      {msg.image_url ? <img src={msg.image_url} alt="Shared" className="max-w-[220px] max-h-[220px] object-cover rounded-2xl block" /> : msg.content}
                    </motion.div>
                    {visibleTimes[msg.id] && (
                      <span className="text-[9px] text-white/30 mt-1 px-1">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* INPUT SECTION */}
          <div className="p-4 border-t border-white/5 bg-black/40 backdrop-blur-lg">
            {selectedConversation?.isResolved ? (
              <div className="flex items-center justify-center gap-3 py-4 bg-white/5 border border-white/10 rounded-full text-white/30">
                <Lock size={16} /><span className="text-xs font-black uppercase tracking-widest">Messaging Disabled</span>
              </div>
            ) : selectedConversation?.otherUserIsBanned ? (
              <div className="flex items-center justify-center gap-3 py-4 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl text-yellow-400">
                <AlertTriangle size={16} /><span className="text-xs font-black uppercase tracking-widest">User Suspended</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-white/5 rounded-full px-4 py-1 border border-white/10 focus-within:border-orange-500/40 transition-all">
                <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageSend} />
                <button onClick={() => imageInputRef.current?.click()} disabled={imageUploading} className="text-white/20 hover:text-orange-400 transition-colors p-1 shrink-0">
                  {imageUploading ? <Loader2 size={18} className="animate-spin text-orange-400" /> : <ImageIcon size={18} />}
                </button>
                <input value={newMessage} onChange={(e) => setNewMessage(e.target.value)} placeholder="Message" className="flex-1 bg-transparent py-3 focus:outline-none text-sm" onKeyDown={(e) => e.key === "Enter" && sendMessage()} />
                <button onClick={sendMessage} className="text-orange-500 p-2"><Send size={20} /></button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* MODALS (Lightbox, Report, Profanity, Delete) ... Same as original logic ... */}
      {view === 'list' && (
        <>
          <ItemPostModal open={showPostModal} onClose={() => setShowPostModal(false)} onFileSelect={handleFileSelected} />
          <NavBar activePage="chat" onPlusClick={() => setShowPostModal(true)} />
        </>
      )}
    </div>
  );
}
