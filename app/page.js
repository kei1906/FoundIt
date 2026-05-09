'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

// Root page: checks for an active session and redirects accordingly.
// Without this, navigating to "/" always lands on /login even if already logged in.
export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        router.replace('/Home');
      } else {
        router.replace('/login');
      }
    };
    checkSession();
  }, []);

  // Show spinner while the session check is in flight
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
      <div className="w-10 h-10 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}
