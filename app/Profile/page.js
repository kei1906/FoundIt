'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Search, Tag, Plus, MessageCircle, User, ChevronRight, LogOut, Trash2, Camera, Image, X, Send, Loader2, ArrowLeft, Lock, Shield } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthGuard } from '@/hooks/useAuthGuard';

export default function ProfilePage() {
  const { user: authUser, authLoading } = useAuthGuard();
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPostModal, setShowPostModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [posting, setPosting] = useState(false);

  const [profile, setProfile] = useState({
    full_name: "",
    student_number: "",
    email: "",
    avatar_url: ""
  });

  // Change password state
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  const router = useRouter();

  const getProfile = useCallback(async () => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();

      if (user) {
        const { data, error } = await supabase
          .from('profiles')
          .select('full_name, student_number, email, avatar_url, role')
          .eq('id', user.id)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          setProfile({
            full_name: data.full_name || "LSPU Student",
            student_number: data.student_number || "No ID Set",
            email: data.email || user.email,
            avatar_url: data.avatar_url || ""
          });
          setIsAdmin(data.role === 'admin');
        }
      }
    } catch (error) {
      console.error('Error fetching profile:', error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authUser) {
      getProfile();
    }
  }, [authUser, getProfile]);

  const handleUpload = async (event) => {
    try {
      setUploading(true);
      const file = event.target.files[0];
      if (!file) return;

      const { data: { user } } = await supabase.auth.getUser();
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Math.random()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', user.id);

      if (updateError) throw updateError;

      setProfile(prev => ({ ...prev, avatar_url: publicUrl }));
    } catch (error) {
      alert('Upload failed: ' + error.message);
    } finally {
      setUploading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const handleChangePassword = async () => {
    setPasswordMsg('');
    if (newPassword.length < 6) { setPasswordMsg('Password must be at least 6 characters.'); return; }
    if (newPassword !== confirmPassword) { setPasswordMsg('Passwords do not match.'); return; }
    try {
      setChangingPassword(true);
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setPasswordMsg('✅ Password updated successfully!');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => { setShowPasswordModal(false); setPasswordMsg(''); }, 1500);
    } catch (err) {
      setPasswordMsg(`❌ ${err.message}`);
    } finally {
      setChangingPassword(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { alert('You must be logged in.'); return; }

      const res = await fetch('/api/account/delete', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to delete account');

      await supabase.auth.signOut();
      router.push('/login');
    } catch (error) {
      alert("Error deleting account: " + error.message);
    } finally {
      setLoading(false);
      setShowDeleteModal(false);
    }
  };

  const handleImageSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => setSelectedImage(e.target.result);
      reader.readAsDataURL(file);
    }
  };

  const handlePost = async () => {
    if (!title || !description || !selectedImage) return alert("Please fill in all fields");
    try {
      setPosting(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("You must be logged in to post.");

      const response = await fetch(selectedImage);
      const blob = await response.blob();
      const fileExt = blob.type.split('/')[1];
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('items')
        .upload(fileName, blob);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('items')
        .getPublicUrl(fileName);

      const { error: dbError } = await supabase
        .from('items')
        .insert([{ title, description, image_url: publicUrl, finder_id: user.id }]);

      if (dbError) throw dbError;

      alert("Item successfully posted to FoundIt!");
      setShowPostModal(false);
      setSelectedImage(null);
      setTitle('');
      setDescription('');
    } catch (error) {
      alert(error.message);
    } finally {
      setPosting(false);
    }
  };

  if (authLoading || loading) return (
    <div className="min-h-screen flex flex-col items-center justify-center text-white bg-black">
      <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mb-4" />
      <p className="font-medium opacity-50">Loading profile...</p>
    </div>
  );

  return (
    <div className="min-h-screen text-white pb-20 font-sans bg-linear-to-br from-[#0a0a0a] via-[#1a1a1a] to-[#7c2d1233]">
      {/* Header */}
      <div className="sticky top-0 z-20 backdrop-blur-md bg-black/40 border-b border-orange-500/20 px-6 pt-4 pb-6 flex items-center justify-between">
        <button onClick={() => router.push('/Home')} className="p-2 hover:bg-white/5 rounded-full transition text-orange-400">
          <ArrowLeft size={24} />
        </button>
        <h1 className="text-3xl font-extrabold tracking-tight text-orange-400">Profile</h1>
        <img src="/logo.png" alt="Logo" className="w-8 h-8 rounded-xl mix-blend-screen drop-shadow-[0_0_8px_rgba(249,115,22,0.4)]" />
      </div>

      <main className="px-6 mt-10 max-w-lg mx-auto space-y-8">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-3xl bg-black/40 border border-orange-500/30 p-8 flex flex-col items-center shadow-2xl shadow-orange-500/10">

          <div className="relative mb-4 group">
            <div className="w-32 h-32 rounded-full bg-black border-2 border-orange-500/50 flex items-center justify-center overflow-hidden relative shadow-inner">
              {profile.avatar_url ? (
                <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <User size={64} className="text-orange-300" />
              )}
            </div>
            <label className="absolute bottom-0 right-0 bg-orange-500 p-2.5 rounded-full border-4 border-black cursor-pointer hover:bg-orange-600 transition-colors z-10 shadow-lg">
              <Camera size={18} className="text-white" />
              <input type="file" className="hidden" accept="image/*" onChange={handleUpload} disabled={uploading} />
            </label>
          </div>

          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-white tracking-tight">{profile.full_name}</h2>
            <div className="inline-block text-orange-300 text-[10px] uppercase tracking-widest font-bold bg-orange-500/10 px-4 py-1.5 rounded-full border border-orange-500/20">
              Verified LSPU Account
            </div>
            <div className="pt-2">
              <p className="text-orange-300 font-mono text-sm tracking-[0.2em] uppercase font-semibold">
                {profile.student_number}
              </p>
              <p className="text-orange-300/60 text-xs font-medium tracking-wide">
                {profile.email}
              </p>
              {isAdmin && (
                <div className="mt-2 inline-flex items-center gap-1.5 text-orange-400 text-[10px] uppercase tracking-widest font-black bg-orange-500/15 px-3 py-1 rounded-full border border-orange-500/30">
                  <Shield size={12} /> Admin
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Menu Sections */}
        <div className="rounded-3xl bg-black/40 border border-orange-500/30 overflow-hidden">
          {isAdmin && (
            <button
              onClick={() => router.push('/admin')}
              className="w-full flex items-center justify-between px-6 py-5 border-b border-orange-500/20 hover:bg-orange-500/5 transition-all group text-orange-300"
            >
              <div className="flex items-center gap-4">
                <Shield size={20} className="opacity-40" />
                <span className="font-medium text-lg">Admin Dashboard</span>
              </div>
              <ChevronRight size={20} className="opacity-20" />
            </button>
          )}
          <button
            onClick={() => setShowPasswordModal(true)}
            className="w-full flex items-center justify-between px-6 py-5 border-b border-orange-500/20 hover:bg-orange-500/5 transition-all group text-orange-300"
          >
            <div className="flex items-center gap-4">
              <Lock size={20} className="opacity-40" />
              <span className="font-medium text-lg">Change Password</span>
            </div>
            <ChevronRight size={20} className="opacity-20" />
          </button>


          <button onClick={handleLogout} className="w-full flex items-center justify-between px-6 py-5 border-b border-orange-500/20 hover:bg-orange-500/5 transition-all group text-orange-300">
            <div className="flex items-center gap-4">
              <LogOut size={20} className="group-hover:translate-x-1 transition-transform" />
              <span className="font-semibold text-lg">Log Out</span>
            </div>
            <ChevronRight size={20} className="opacity-20" />
          </button>

          <button onClick={() => setShowDeleteModal(true)} className="w-full flex items-center justify-between px-6 py-5 hover:bg-red-500/5 transition-all group text-red-400/80">
            <div className="flex items-center gap-4">
              <Trash2 size={20} />
              <span className="font-semibold text-lg">Delete Account</span>
            </div>
            <ChevronRight size={20} className="opacity-20" />
          </button>
        </div>
      </main>



      {/* Modals */}
      <AnimatePresence>
        {showPasswordModal && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center backdrop-blur-sm p-8">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-black/60 border border-orange-500/30 p-8 rounded-[2.5rem] w-full max-w-xs">
              <h3 className="text-xl font-bold mb-1">Change Password</h3>
              <p className="text-orange-300/50 text-xs mb-6">Must be at least 6 characters.</p>
              <div className="space-y-3">
                <input
                  type="password"
                  placeholder="New Password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  className="w-full bg-white/5 border border-orange-500/20 p-4 rounded-2xl text-white outline-none placeholder:text-white/30 focus:border-orange-500/50"
                />
                <input
                  type="password"
                  placeholder="Confirm Password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full bg-white/5 border border-orange-500/20 p-4 rounded-2xl text-white outline-none placeholder:text-white/30 focus:border-orange-500/50"
                />
                {passwordMsg && <p className="text-xs text-center text-orange-300/80 px-2">{passwordMsg}</p>}
                <button onClick={handleChangePassword} disabled={changingPassword} className="w-full py-4 bg-orange-500 hover:bg-orange-600 rounded-2xl font-bold disabled:opacity-50 transition-all">
                  {changingPassword ? <Loader2 className="animate-spin mx-auto" size={20} /> : 'Update Password'}
                </button>
                <button onClick={() => { setShowPasswordModal(false); setPasswordMsg(''); setNewPassword(''); setConfirmPassword(''); }} className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl text-white/50">
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}

        {showDeleteModal && (
          <div className="fixed inset-0 bg-black/80 z-100 flex items-center justify-center backdrop-blur-sm p-8">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-black/60 border border-orange-500/30 p-8 rounded-[2.5rem] w-full max-w-xs text-center">
              <Trash2 size={48} className="text-red-500 mx-auto mb-4" />
              <h3 className="text-xl font-bold mb-2">Delete Account?</h3>
              <p className="text-sm text-orange-300/60 mb-8">This action is permanent.</p>
              <div className="flex flex-col gap-3">
                <button onClick={handleDeleteAccount} className="w-full py-4 bg-red-600 hover:bg-red-700 rounded-2xl font-bold">Yes, Delete</button>
                <button onClick={() => setShowDeleteModal(false)} className="w-full py-4 bg-orange-500/10 border border-orange-500/20 rounded-2xl">Cancel</button>
              </div>
            </motion.div>
          </div>
        )}

        {showPostModal && (
          <div className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-black border border-orange-500/30 rounded-[2.5rem] w-full max-w-md overflow-hidden">
              <div className="flex items-center justify-between p-6 border-b border-orange-500/20">
                <h2 className="text-xl font-bold">Report Found Item</h2>
                <button onClick={() => setShowPostModal(false)} className="text-orange-400"><X size={20} /></button>
              </div>
              <div className="p-6 space-y-4">
                {!selectedImage ? (
                  <div className="grid grid-cols-2 gap-4">
                    <label className="flex flex-col items-center gap-3 p-6 bg-white/5 border border-orange-500/20 rounded-2xl cursor-pointer">
                      <Camera size={32} className="text-orange-400" />
                      <span className="text-xs font-bold uppercase tracking-widest">Camera</span>
                      <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageSelect} />
                    </label>
                    <label className="flex flex-col items-center gap-3 p-6 bg-white/5 border border-orange-500/20 rounded-2xl cursor-pointer">
                      <Image size={32} className="text-orange-400" />
                      <span className="text-xs font-bold uppercase tracking-widest">Gallery</span>
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageSelect} />
                    </label>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <img src={selectedImage} alt="Preview" className="w-full h-40 object-cover rounded-2xl border border-orange-500/30" />
                    <input className="w-full bg-white/5 border border-orange-500/20 p-4 rounded-2xl text-white outline-none" placeholder="Item Name" value={title} onChange={(e) => setTitle(e.target.value)} />
                    <textarea className="w-full bg-white/5 border border-orange-500/20 p-4 rounded-2xl h-24 text-white outline-none resize-none" placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
                    <button onClick={handlePost} disabled={posting} className="w-full py-4 bg-orange-500 rounded-2xl font-bold active:scale-95 transition-all">
                      {posting ? <Loader2 className="animate-spin mx-auto" /> : "Post to FoundIt"}
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}



function NavIcon({ icon, label, active = false, onClick }) {
  return (
    <button onClick={onClick} className={`flex flex-col items-center gap-1 ${active ? 'text-orange-400' : 'text-orange-300/50'}`}>
      <div className={`${active ? 'bg-orange-500/10 p-2 rounded-xl' : ''}`}>{icon}</div>
      <span className="text-[10px] font-bold uppercase tracking-tighter">{label}</span>
    </button>
  );
}