// hooks/useAuthGuard.js
// Single source of truth for route protection.
// Now also checks verification_status — unverified users get redirected
// to /pending-verification instead of seeing protected content.
//
// Usage in any protected page:
//   const { user, authLoading } = useAuthGuard();
//   if (authLoading) return <Spinner />;

"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export function useAuthGuard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!mounted) return;

      if (!session) {
        router.replace("/login");
        return;
      }

      // Check verification status
      const { data: profile } = await supabase
        .from("profiles")
        .select("verification_status, is_banned, ban_reason")
        .eq("id", session.user.id)
        .maybeSingle();

      if (!mounted) return;

      if (profile && profile.verification_status !== 'approved') {
        router.replace("/pending-verification");
        return;
      }

      if (profile?.is_banned) {
        router.replace("/banned");
        return;
      }

      setUser(session.user);
      setAuthLoading(false);
    };

    checkSession();

    // Also react to auth state changes (e.g. logout in another tab)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (!session) {
        router.replace("/login");
      } else {
        // Re-check verification on auth change
        supabase
          .from("profiles")
          .select("verification_status, is_banned")
          .eq("id", session.user.id)
          .maybeSingle()
          .then(({ data: profile }) => {
            if (!mounted) return;
            if (profile?.is_banned) {
              router.replace("/banned");
            } else if (profile && profile.verification_status !== 'approved') {
              router.replace("/pending-verification");
            } else {
              setUser(session.user);
              setAuthLoading(false);
            }
          });
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  return { user, authLoading };
}
