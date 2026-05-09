'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { Ban, LogOut, Mail } from 'lucide-react';

export default function BannedPage() {
  const router = useRouter();
  const [banReason, setBanReason] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const check = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace('/login'); return; }

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_banned, ban_reason, full_name')
        .eq('id', session.user.id)
        .maybeSingle();

      // If they are no longer banned, redirect back to home
      if (!profile?.is_banned) { router.replace('/Home'); return; }

      setBanReason(profile.ban_reason || 'Violated community guidelines.');
      setLoading(false);
    };
    check();
  }, [router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/login');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div
      style={{ background: 'linear-gradient(135deg, #0a0a0a 0%, #1a0000 50%, rgba(127,29,29,0.2) 100%)' }}
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

        {/* Card */}
        <div className="bg-black/40 backdrop-blur-2xl border border-red-500/20 rounded-3xl p-8 shadow-2xl shadow-red-900/20 space-y-6">
          {/* Icon */}
          <div className="w-20 h-20 mx-auto rounded-full bg-red-500/10 border-2 border-red-500/30 flex items-center justify-center">
            <Ban size={36} className="text-red-400" />
          </div>

          {/* Title */}
          <div>
            <h1 className="text-2xl font-black text-white mb-2">Account Suspended</h1>
            <p className="text-white/50 text-sm leading-relaxed">
              Your account has been temporarily suspended by an administrator due to a violation of community guidelines.
            </p>
          </div>

          {/* Reason */}
          <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-5 text-left">
            <p className="text-[10px] font-black uppercase tracking-widest text-red-400 mb-2">Reason</p>
            <p className="text-white/60 text-sm">{banReason}</p>
          </div>

          {/* Status badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest bg-red-500/15 text-red-400 border border-red-500/30">
            <Ban size={14} />
            Suspended
          </div>

          {/* Appeal info */}
          <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-4 text-left space-y-2">
            <p className="text-[10px] font-black uppercase tracking-widest text-white/30 mb-1">Appeal Process</p>
            <p className="text-white/40 text-xs leading-relaxed">
              If you believe this suspension was issued in error, please contact your university administrator directly to appeal.
              Provide your student number and the reason you believe the suspension was unjust.
            </p>
            <div className="flex items-center gap-2 mt-2 text-orange-400/60">
              <Mail size={12} />
              <span className="text-xs">Contact your institution&apos;s admin office</span>
            </div>
          </div>

          {/* Log out */}
          <button
            onClick={handleLogout}
            className="w-full py-4 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-2xl font-bold text-xs tracking-widest transition-all flex items-center justify-center gap-2"
          >
            <LogOut size={14} />
            Log Out
          </button>
        </div>
      </div>
    </div>
  );
}
