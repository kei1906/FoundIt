import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// POST /api/admin/ban-user
// Body: { targetUserId, action: 'ban' | 'unban', reason? }
export async function POST(req) {
  const auth = req.headers.get("authorization");
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = auth.replace("Bearer ", "");
  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabaseAdmin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profile?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { targetUserId, action, reason } = await req.json();
  if (!targetUserId || !action) {
    return NextResponse.json({ error: "Missing targetUserId or action" }, { status: 400 });
  }

  if (action === "ban") {
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({
        is_banned: true,
        ban_reason: reason || "Violated community guidelines.",
        banned_at: new Date().toISOString(),
      })
      .eq("id", targetUserId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, action: "banned" });
  }

  if (action === "unban") {
    const { error } = await supabaseAdmin
      .from("profiles")
      .update({ is_banned: false, ban_reason: null, banned_at: null })
      .eq("id", targetUserId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, action: "unbanned" });
  }

  return NextResponse.json({ error: "Invalid action. Use 'ban' or 'unban'." }, { status: 400 });
}
