"use client";
import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Send, Loader2, User, Trash2, X, CheckCircle2, AlertCircle, Lock, AlertTriangle, Flag, ImageIcon } from "lucide-react";
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
  // Guard: track whether we already auto-opened a conversation from the URL.
  // Without this, every fetchConversations() call (triggered by global-updates
  // on every message INSERT) would re-run selectConversation, which calls
  // setMessages(history) and races with the room-channel realtime event,
  // producing duplicate messages with the same id (duplicate key error).
  const urlAutoOpenedRef = useRef(false);
  const [resolving, setResolving] = useState(false);
  const [visibleTimes, setVisibleTimes] = useState({});
  // Profanity filter state
  const [profanityWarning, setProfanityWarning] = useState(null); // null | 'first' | 'repeat'
  const profanityStrikeRef = useRef(0);
  // Report user state
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportSuccess, setReportSuccess] = useState(false);
  // Image sharing state
  const [imageUploading, setImageUploading] = useState(false);
  const imageInputRef = useRef(null);
  // Lightbox for image messages
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
        .subscribe();
      return () => {
        supabase.removeChannel(listChannel);
        if (activeChannelRef.current) supabase.removeChannel(activeChannelRef.current);
        activeChannelRef.current = null;
      };
    }
  }, [user]);

  useEffect(() => {
    // Only auto-open once: subsequent conversations updates (from realtime)
    // must NOT re-trigger selectConversation or we get duplicate-key crashes.
    if (urlAutoOpenedRef.current) return;
    const urlParams = new URLSearchParams(window.location.search);
    const chatId = urlParams.get('id');
    if (chatId && conversations.length > 0) {
      const targetConv = conversations.find(c => c.id === chatId);
      if (targetConv) {
        urlAutoOpenedRef.current = true; // lock — never run again this session
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

    const [{ data: itemsData }, { data: profilesData }] = await Promise.all([
      supabase.from('items').select('id, title, status').in('id', itemIds),
      supabase.from('profiles').select('id, full_name, avatar_url, is_banned').in('id', profileIds)
    ]);

    const itemMap = itemsData?.reduce((acc, i) => ({ ...acc, [i.id]: i }), {}) || {};
    const profileMap = profilesData?.reduce((acc, p) => ({ ...acc, [p.id]: p }), {}) || {};

    const mapped = chatsData.map(chat => {
      const isFinder = chat.finder_id === user.id;
      const otherUser = isFinder ? profileMap[chat.claimer_id] : profileMap[chat.finder_id];
      const sortedMsgs = (chat.messages || []).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      const latestMsg = sortedMsgs[0];
      return {
        id: chat.id,
        itemId: chat.item_id,
        itemTitle: itemMap[chat.item_id]?.title || "Item",
        otherUserId: otherUser?.id,
        otherUser: otherUser || { full_name: "Unknown", avatar_url: null },
        lastMessage: latestMsg
          ? (latestMsg.sender_id === user.id ? `You: ${latestMsg.content}` : latestMsg.content)
          : "New conversation",
        lastMessageTime: new Date(latestMsg?.created_at || chat.created_at),
        // Track if current user is the item finder (poster) so we can show delete button
        isFinder,
        finderConfirmed: chat.finder_confirmed_resolved,
        claimerConfirmed: chat.claimer_confirmed_resolved,
        isResolved: (chat.finder_confirmed_resolved && chat.claimer_confirmed_resolved) || itemMap[chat.item_id]?.status === 'Resolved',
        otherUserIsBanned: otherUser?.is_banned ?? false,
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
      // Deduplicate by id — guards against a racing realtime INSERT event that
      // already appended the newest message before this fetch completed.
      const seen = new Set();
      setMessages((history ?? []).filter(m => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
      }));
    }

    // Mark all unread messages in this chat as read (where current user is receiver).
    // This decrements the NavBar unread badge via its realtime UPDATE subscription.
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
        // Deduplicate: skip if we already added this message optimistically
        // (happens for the sender's own messages via sendMessage).
        setMessages((prev) =>
          prev.some((m) => m.id === payload.new.id) ? prev : [...prev, payload.new]
        );
        // If this incoming message is for the current user, mark it read immediately
        if (payload.new.receiver_id === user?.id) {
          supabase
            .from('messages')
            .update({ is_read: true })
            .eq('id', payload.new.id)
            .then(() => { }); // fire-and-forget
        }
      }
    ).subscribe();
    channelRef.current = channel;
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !user) return;
    const content = newMessage.trim();

    // ─── Profanity Check ───
    // Check before sending — if flagged, show warning modal and do NOT send.
    const { isClean } = await containsProfanity(content);
    if (!isClean) {
      profanityStrikeRef.current += 1;
      setProfanityWarning(profanityStrikeRef.current >= 2 ? 'repeat' : 'first');
      return; // Block the send — message stays in the input box
    }

    // If clean, proceed with sending
    setNewMessage("");
    profanityStrikeRef.current = 0; // Reset strike count on clean message

    // BUG FIX: Supabase Realtime postgres_changes does NOT deliver INSERT events
    // back to the client that performed the insert. This means the sender never
    // saw their own message in real-time — they had to reload. Fix: capture the
    // inserted row from the DB response and append it immediately (optimistic UI).
    // The realtime channel still handles the OTHER user's incoming messages.
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
      console.error("Supabase Insert Error:", error.message, error.details);
      return;
    }

    // Append own message immediately — deduplicate in case the realtime
    // channel ever echoes the event back (edge case on some Supabase plans).
    if (inserted) {
      setMessages((prev) =>
        prev.some((m) => m.id === inserted.id) ? prev : [...prev, inserted]
      );
    }
  };

  // ─── Image sharing helpers ───
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
    if (file.size > 10 * 1024 * 1024) { alert('Image must be under 10 MB'); return; }
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
      alert('Could not send image: ' + (err.message || 'Unknown error'));
    } finally {
      setImageUploading(false);
    }
  };

  const handleDeleteChat = async () => {
    if (!selectedConversation) return;
    try {
      setDeletingChat(true);
      // Delete messages first (no cascade FK), then the chat
      await supabase.from('messages').delete().eq('chat_id', selectedConversation.id);
      const { error } = await supabase.from('chats').delete().eq('id', selectedConversation.id);
      if (error) throw error;
      setShowDeleteConfirm(false);
      backToList();
    } catch (err) {
      console.error("Delete chat error:", err);
      alert("Could not delete chat: " + err.message);
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
      if (!updatedChat) throw new Error("Could not update chat. RLS might be blocking this action.");

      // The DB trigger (trg_auto_resolve_item) automatically sets
      // items.status = 'Resolved' when both flags are true. We just
      // need to send a system message when that happens so both users
      // see confirmation in the chat thread.
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
      alert("Failed to update resolution status: " + err.message);
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
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Report failed');
      setReportSuccess(true);
      setReportReason('');
      setTimeout(() => {
        setShowReportModal(false);
        setReportSuccess(false);
      }, 2000);
    } catch (err) {
      alert(err.message);
    } finally {
      setReportSubmitting(false);
    }
  };

  // Fix: forward file selection to /post page (was missing onFileSelect before)
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
    // Re-fetch conversations so the list shows the latest messages
    fetchConversations();
  };

  if (loading) return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-orange-400" />
    </div>
  );

  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-[#0a0a0a] via-[#1a1a1a] to-[#7c2d1233] text-white flex flex-col font-sans overflow-hidden">

      {view === 'list' ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex-1 overflow-y-auto pb-24">
          <div className="p-6 flex items-center gap-3">
            <img src="/logo.png" alt="Logo" className="w-8 h-8 rounded-xl mix-blend-screen drop-shadow-[0_0_8px_rgba(249,115,22,0.4)]" />
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
          {/* HEADER */}
          <div className="flex items-center p-4 border-b border-orange-500/10 bg-black/40 backdrop-blur-md">
            <button onClick={backToList} className="p-2 mr-2"><ArrowLeft size={22} className="text-orange-400" /></button>
            <div className="flex-1">
              <h2 className="font-bold text-base leading-tight">{selectedConversation?.otherUser?.full_name}</h2>
              <p className="text-[10px] text-orange-400/60 uppercase tracking-wider">{selectedConversation?.itemTitle}</p>
            </div>
            {/* Delete chat button — only visible to the finder (item poster) */}
            {selectedConversation?.isFinder && (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="p-2 mr-1 text-red-400/60 hover:text-red-400 transition-colors"
                title="Delete this conversation"
              >
                <Trash2 size={20} />
              </button>
            )}
            {/* Report user button — visible to all non-poster participants */}
            {!selectedConversation?.isResolved && (
              <button
                onClick={() => setShowReportModal(true)}
                className="p-2 mr-1 text-white/20 hover:text-yellow-400 transition-colors"
                title="Report this user"
              >
                <Flag size={18} />
              </button>
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
                  <button
                    onClick={() => handleResolve(true)}
                    disabled={resolving}
                    className="px-4 py-1.5 bg-orange-500/10 hover:bg-orange-500 text-orange-400 hover:text-white border border-orange-500/20 rounded-full text-[9px] font-black uppercase tracking-widest transition-all disabled:opacity-50"
                  >
                    {resolving ? "Updating..." : "Mark as Resolved"}
                  </button>
                ) : (
                  <button
                    onClick={() => handleResolve(false)}
                    disabled={resolving}
                    className="text-[9px] text-orange-500/40 hover:text-orange-500 font-bold uppercase tracking-widest transition-all underline underline-offset-4"
                  >
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
                      className={`overflow-hidden rounded-2xl ${
                        msg.image_url
                          ? 'cursor-pointer p-0'
                          : `px-4 py-2 text-[15px] ${isMe ? 'bg-orange-600 rounded-br-none' : 'bg-white/10 rounded-bl-none shadow-lg'}`
                      }`}
                    >
                      {msg.image_url ? (
                        <img
                          src={msg.image_url}
                          alt="Shared image"
                          className="max-w-[220px] max-h-[220px] object-cover rounded-2xl block"
                        />
                      ) : (
                        msg.content
                      )}
                    </motion.div>
                    {visibleTimes[msg.id] && (
                      <span className="text-[9px] text-white/30 mt-1 px-1">
                        {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>

          {/* INPUT */}
          <div className="p-4 border-t border-white/5 bg-black/40 backdrop-blur-lg">
            {selectedConversation?.isResolved ? (
              <div className="flex items-center justify-center gap-3 py-4 bg-white/5 border border-white/10 rounded-full text-white/30">
                <Lock size={16} />
                <span className="text-xs font-black uppercase tracking-widest">Messaging Disabled</span>
              </div>
            ) : selectedConversation?.otherUserIsBanned ? (
              <div className="flex items-center justify-center gap-3 py-4 bg-yellow-500/10 border border-yellow-500/20 rounded-2xl text-yellow-400">
                <AlertTriangle size={16} />
                <span className="text-xs font-black uppercase tracking-widest">User Suspended — Messaging Unavailable</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 bg-white/5 rounded-full px-4 py-1 border border-white/10 focus-within:border-orange-500/40 transition-all">
                {/* Hidden file input for image sharing */}
                <input
                  ref={imageInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageSend}
                />
                <button
                  onClick={() => imageInputRef.current?.click()}
                  disabled={imageUploading}
                  className="text-white/20 hover:text-orange-400 transition-colors p-1 shrink-0 disabled:opacity-50"
                  title="Send image"
                >
                  {imageUploading
                    ? <Loader2 size={18} className="animate-spin text-orange-400" />
                    : <ImageIcon size={18} />}
                </button>
                <input
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Message"
                  className="flex-1 bg-transparent py-3 focus:outline-none text-sm"
                  onKeyDown={(e) => e.key === "Enter" && sendMessage()}
                />
                <button onClick={sendMessage} className="text-orange-500 p-2"><Send size={20} /></button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Image Lightbox ─── */}
      <AnimatePresence>
        {lightboxUrl && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setLightboxUrl(null)}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-sm cursor-zoom-out"
          >
            <motion.img
              src={lightboxUrl}
              alt="Full size"
              initial={{ scale: 0.85 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.85 }}
              className="max-w-full max-h-[90vh] object-contain rounded-2xl shadow-2xl"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Report User Modal ─── */}
      <AnimatePresence>
        {showReportModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="w-full max-w-sm bg-[#111] border border-red-500/20 rounded-[2.5rem] p-8"
            >
              <button
                onClick={() => { setShowReportModal(false); setReportReason(''); setReportSuccess(false); }}
                className="absolute top-5 right-5 p-2 bg-white/5 rounded-full text-white/40 hover:text-white transition-colors"
              >
                <X size={16} />
              </button>

              {reportSuccess ? (
                <div className="text-center py-4">
                  <div className="w-16 h-16 rounded-full bg-green-500/10 border-2 border-green-500/30 flex items-center justify-center mx-auto mb-4">
                    <CheckCircle2 size={32} className="text-green-400" />
                  </div>
                  <h3 className="text-xl font-black text-white mb-2">Report Submitted</h3>
                  <p className="text-white/50 text-sm">An admin will review the report and the conversation context shortly.</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-12 h-12 rounded-full bg-red-500/10 border-2 border-red-500/20 flex items-center justify-center shrink-0">
                      <Flag size={22} className="text-red-400" />
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-white leading-tight">Report User</h3>
                      <p className="text-white/40 text-xs">Reporting: {selectedConversation?.otherUser?.full_name}</p>
                    </div>
                  </div>

                  <p className="text-white/50 text-xs mb-4 leading-relaxed">
                    Describe why you are reporting this user. An admin will review the report along with the conversation history before taking action.
                  </p>

                  <textarea
                    value={reportReason}
                    onChange={(e) => setReportReason(e.target.value)}
                    placeholder="e.g. Sending inappropriate messages, trolling, spam..."
                    rows={4}
                    className="w-full bg-white/5 border border-white/10 rounded-2xl p-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-orange-500/40 resize-none transition-all"
                  />

                  <button
                    onClick={handleReport}
                    disabled={reportSubmitting || !reportReason.trim()}
                    className="mt-4 w-full py-4 bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-black rounded-2xl tracking-widest text-sm transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    {reportSubmitting ? <Loader2 size={18} className="animate-spin" /> : <Flag size={16} />}
                    {reportSubmitting ? 'Submitting...' : 'Submit Report'}
                  </button>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── Profanity Warning Modal ─── */}
      <AnimatePresence>
        {profanityWarning && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="w-full max-w-xs bg-[#111] border border-yellow-500/30 rounded-[2.5rem] p-8 text-center"
            >
              <div className="w-16 h-16 rounded-full bg-yellow-500/10 border-2 border-yellow-500/30 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle size={32} className="text-yellow-400" />
              </div>
              <h3 className="text-xl font-black text-white mb-2">
                {profanityWarning === 'repeat' ? 'Final Warning' : 'Inappropriate Message'}
              </h3>
              <p className="text-white/50 text-sm leading-relaxed mb-6">
                {profanityWarning === 'repeat'
                  ? 'You have attempted to send inappropriate content more than once. Continued violations may result in your account being reported and suspended by an admin.'
                  : 'Your message contains inappropriate content and was not sent. Please keep conversations respectful and on-topic.'}
              </p>
              <button
                onClick={() => setProfanityWarning(null)}
                style={{ background: 'linear-gradient(90deg, #f97316, #fb923c)' }}
                className="w-full py-4 text-white font-black rounded-2xl tracking-widest text-sm transition-all active:scale-95 shadow-lg shadow-orange-500/20"
              >
                I UNDERSTAND
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete confirmation modal */}
      <AnimatePresence>
        {showDeleteConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-xs bg-[#111] border border-red-500/20 rounded-[2.5rem] p-8 text-center"
            >
              <Trash2 size={40} className="text-red-400 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">Delete Conversation?</h3>
              <p className="text-white/40 text-sm mb-8">This will permanently remove the chat and all messages for both users.</p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleDeleteChat}
                  disabled={deletingChat}
                  className="w-full py-4 bg-red-600 hover:bg-red-700 rounded-2xl font-bold disabled:opacity-50 transition-all"
                >
                  {deletingChat ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'Yes, Delete'}
                </button>
                <button
                  onClick={() => setShowDeleteConfirm(false)}
                  className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl text-white/50"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {view === 'list' && (
        <>
          {/* Fixed: onFileSelect now properly navigates to /post page */}
          <ItemPostModal
            open={showPostModal}
            onClose={() => setShowPostModal(false)}
            onFileSelect={handleFileSelected}
          />
          <NavBar activePage="chat" onPlusClick={() => setShowPostModal(true)} />
        </>
      )}
    </div>
  );
}