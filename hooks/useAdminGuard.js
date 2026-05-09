// hooks/useAdminGuard.js
// Extends useAuthGuard — checks both authentication AND admin role.
// Usage:
//   const { user, isAdmin, guardLoading } = useAdminGuard();
//   if (guardLoading) return <Spinner />;

"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuthGuard } from "./useAuthGuard";
import { supabase } from "@/lib/supabase";

export function useAdminGuard() {
    const { user, authLoading } = useAuthGuard();
    const [isAdmin, setIsAdmin] = useState(false);
    const [adminLoading, setAdminLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        if (authLoading || !user) return;

        const checkAdminRole = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) {
                    router.replace("/login");
                    return;
                }

                const res = await fetch("/api/admin/verify", {
                    headers: { Authorization: `Bearer ${session.access_token}` },
                });

                const json = await res.json();

                if (!json.isAdmin) {
                    router.replace("/Home");
                    return;
                }

                setIsAdmin(true);
            } catch (err) {
                console.error("Admin guard error:", err);
                router.replace("/Home");
            } finally {
                setAdminLoading(false);
            }
        };

        checkAdminRole();
    }, [user, authLoading, router]);

    return {
        user,
        isAdmin,
        guardLoading: authLoading || adminLoading,
    };
}
