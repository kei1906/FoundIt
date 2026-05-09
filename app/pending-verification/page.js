'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Clock, XCircle, Upload, FileText, X, LogOut, RefreshCw, CheckCircle } from 'lucide-react';

export default function PendingVerificationPage() {
    const router = useRouter();
    const [user, setUser] = useState(null);
    const [profile, setProfile] = useState(null);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [reuploadFile, setReuploadFile] = useState(null);
    const [filePreview, setFilePreview] = useState(null);
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const fileInputRef = useRef(null);

    useEffect(() => {
        checkStatus();
    }, []);

    const checkStatus = async () => {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();

        if (!session) {
            router.replace('/login');
            return;
        }

        setUser(session.user);

        const { data: profileData } = await supabase
            .from('profiles')
            .select('full_name, verification_status, verification_rejection_reason, verification_doc_url')
            .eq('id', session.user.id)
            .maybeSingle();

        if (profileData?.verification_status === 'approved') {
            // Already approved — redirect to home
            router.replace('/Home');
            return;
        }

        setProfile(profileData);
        setLoading(false);
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.replace('/login');
    };

    const processFile = (file) => {
        if (!file) return;
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
        if (!allowedTypes.includes(file.type)) {
            setError('Invalid file type. Please upload a JPEG, PNG, or PDF.');
            return;
        }
        if (file.size > 5 * 1024 * 1024) {
            setError('File too large. Maximum size is 5MB.');
            return;
        }
        setError('');
        setReuploadFile(file);
        setFilePreview(file.type.startsWith('image/') ? URL.createObjectURL(file) : null);
    };

    const handleReupload = async () => {
        if (!reuploadFile) return;
        setUploading(true);
        setError('');
        setMessage('');

        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Session expired');

            const uploadForm = new FormData();
            uploadForm.append('file', reuploadFile);

            const res = await fetch('/api/upload-verification', {
                method: 'POST',
                headers: { Authorization: `Bearer ${session.access_token}` },
                body: uploadForm,
            });

            const json = await res.json();
            if (!res.ok) throw new Error(json.error || 'Upload failed');

            setMessage('Document re-uploaded! Your verification is now under review again.');
            setReuploadFile(null);
            setFilePreview(null);

            // Refresh profile status
            await checkStatus();
        } catch (err) {
            setError(err.message);
        } finally {
            setUploading(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
                <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    const isPending = profile?.verification_status === 'pending';
    const isRejected = profile?.verification_status === 'rejected';
    const firstName = profile?.full_name?.split(' ')[0] || 'Student';

    return (
        <div
            style={{ background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, rgba(124, 45, 18, 0.2) 100%)' }}
            className="min-h-screen flex items-center justify-center p-4 font-sans"
        >
            <div className="w-full max-w-md text-center">
                {/* Logo */}
                <div className="flex justify-center mb-6">
                    <img
                        src="/logo.png"
                        alt="FoundIt Logo"
                        className="w-20 h-20 rounded-2xl mix-blend-screen drop-shadow-[0_0_15px_rgba(249,115,22,0.4)]"
                    />
                </div>

                {/* Status Card */}
                <div className="bg-black/40 backdrop-blur-2xl border border-orange-500/20 rounded-3xl p-8 shadow-2xl shadow-orange-500/10 space-y-6">
                    {/* Icon */}
                    <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center ${
                        isPending
                            ? 'bg-yellow-500/10 border-2 border-yellow-500/30'
                            : 'bg-red-500/10 border-2 border-red-500/30'
                    }`}>
                        {isPending ? (
                            <Clock size={36} className="text-yellow-400" />
                        ) : (
                            <XCircle size={36} className="text-red-400" />
                        )}
                    </div>

                    {/* Title */}
                    <div>
                        <h1 className="text-2xl font-black text-white mb-2">
                            {isPending ? 'Verification Pending' : 'Verification Rejected'}
                        </h1>
                        <p className="text-white/50 text-sm">
                            {isPending
                                ? `Hey ${firstName}, your student verification is currently under review. An admin will review your document shortly.`
                                : `Hey ${firstName}, unfortunately your verification was not approved.`
                            }
                        </p>
                    </div>

                    {/* Rejection reason */}
                    {isRejected && profile?.verification_rejection_reason && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-5 text-left">
                            <p className="text-[10px] font-black uppercase tracking-widest text-red-400 mb-2">Reason</p>
                            <p className="text-white/60 text-sm">{profile.verification_rejection_reason}</p>
                        </div>
                    )}

                    {/* Status badge */}
                    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest ${
                        isPending
                            ? 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30'
                            : 'bg-red-500/15 text-red-400 border border-red-500/30'
                    }`}>
                        {isPending ? <Clock size={14} /> : <XCircle size={14} />}
                        {isPending ? 'Under Review' : 'Not Approved'}
                    </div>

                    {/* Success message after re-upload */}
                    {message && (
                        <div className="p-4 bg-emerald-500/15 border border-emerald-500/40 rounded-xl text-emerald-300 text-sm font-semibold">
                            {message}
                        </div>
                    )}

                    {error && (
                        <div className="p-4 bg-red-500/15 border border-red-500/40 rounded-xl text-red-300 text-sm font-semibold">
                            {error}
                        </div>
                    )}

                    {/* Re-upload section (for rejected users) */}
                    {isRejected && (
                        <div className="space-y-4 pt-2">
                            <p className="text-xs text-white/40 font-bold">Upload a new document to re-submit for verification:</p>

                            {!reuploadFile ? (
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    onDrop={(e) => { e.preventDefault(); processFile(e.dataTransfer.files?.[0]); }}
                                    onDragOver={(e) => e.preventDefault()}
                                    className="flex flex-col items-center gap-3 p-6 bg-white/[0.03] border-2 border-dashed border-orange-500/20 rounded-2xl cursor-pointer hover:border-orange-500/40 hover:bg-white/[0.05] transition-all group"
                                >
                                    <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center group-hover:bg-orange-500/20 transition-colors">
                                        <Upload size={22} className="text-orange-500/60 group-hover:text-orange-500 transition-colors" />
                                    </div>
                                    <p className="text-xs font-bold text-white/50">Tap to upload COR or Student ID</p>
                                    <p className="text-[10px] text-white/20">JPEG, PNG, or PDF — Max 5MB</p>
                                </div>
                            ) : (
                                <div className="relative flex items-center gap-3 p-4 bg-white/[0.05] border border-orange-500/30 rounded-2xl">
                                    {filePreview ? (
                                        <img src={filePreview} alt="" className="w-14 h-14 rounded-xl object-cover border border-white/10 shrink-0" />
                                    ) : (
                                        <div className="w-14 h-14 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0 border border-red-500/20">
                                            <FileText size={24} className="text-red-400" />
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0 text-left">
                                        <p className="text-xs font-bold text-white truncate">{reuploadFile.name}</p>
                                        <p className="text-[10px] text-white/30 mt-0.5">{(reuploadFile.size / 1024 / 1024).toFixed(2)} MB</p>
                                    </div>
                                    <button type="button" onClick={() => { setReuploadFile(null); setFilePreview(null); }} className="p-2 bg-red-500/10 rounded-lg text-red-400">
                                        <X size={14} />
                                    </button>
                                </div>
                            )}

                            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={(e) => processFile(e.target.files?.[0])} className="hidden" />

                            {reuploadFile && (
                                <button
                                    onClick={handleReupload}
                                    disabled={uploading}
                                    style={{ background: 'linear-gradient(90deg, #ff6b35 0%, #ff8c42 100%)' }}
                                    className="w-full py-4 text-white font-bold rounded-xl transition-all disabled:opacity-50 shadow-xl shadow-orange-500/30 flex items-center justify-center gap-2"
                                >
                                    {uploading ? (
                                        <><span className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> Uploading...</>
                                    ) : (
                                        <><Upload size={18} /> Re-Submit for Verification</>
                                    )}
                                </button>
                            )}
                        </div>
                    )}

                    {/* Action buttons */}
                    <div className="flex gap-3 pt-2">
                        <button
                            onClick={checkStatus}
                            className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white/60 rounded-xl font-bold text-xs tracking-widest transition-all flex items-center justify-center gap-2"
                        >
                            <RefreshCw size={14} /> Refresh
                        </button>
                        <button
                            onClick={handleLogout}
                            className="flex-1 py-3 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-xl font-bold text-xs tracking-widest transition-all flex items-center justify-center gap-2"
                        >
                            <LogOut size={14} /> Log Out
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
