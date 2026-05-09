import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// User-facing report submission
// Uses service role only for insert since RLS WITH CHECK requires auth.uid() match
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// POST /api/report-user
// Body: { reportedUserId, chatId, reason }
export async function POST(req) {
  const auth = req.headers.get("authorization");
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const token = auth.replace("Bearer ", "");
  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { reportedUserId, chatId, reason } = await req.json();

  if (!reportedUserId || !reason?.trim()) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }
  if (reportedUserId === user.id) {
    return NextResponse.json({ error: "Cannot report yourself" }, { status: 400 });
  }

  // Prevent duplicate pending reports from the same reporter for the same user
  const { data: existing } = await supabaseAdmin
    .from("reports")
    .select("id")
    .eq("reporter_id", user.id)
    .eq("reported_user_id", reportedUserId)
    .eq("status", "pending")
    .maybeSingle();

  if (existing) {
    return NextResponse.json(
      { error: "You already have a pending report against this user." },
      { status: 409 }
    );
  }

  const { error: insertErr } = await supabaseAdmin.from("reports").insert({
    reporter_id: user.id,
    reported_user_id: reportedUserId,
    chat_id: chatId || null,
    reason: reason.trim(),
    status: "pending",
  });

  if (insertErr) return NextResponse.json({ error: insertErr.message }, { status: 500 });

  return NextResponse.json({ success: true });
}
