import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/lib/supabaseAdmin';
import { sendVerificationApproved, sendVerificationRejected } from '@/lib/mailer';

/**
 * Shared admin auth — same pattern as /api/admin/items
 */
async function authenticateAdmin(request) {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return { user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }

    const token = authHeader.replace('Bearer ', '');
    const userClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        { global: { headers: { Authorization: `Bearer ${token}` } } }
    );

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
        return { user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
    }

    const adminClient = getSupabaseAdmin();
    const { data: profile } = await adminClient
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

    if (!profile || profile.role !== 'admin') {
        return { user: null, error: NextResponse.json({ error: 'Forbidden — admin access required' }, { status: 403 }) };
    }

    return { user, error: null };
}

/**
 * GET /api/admin/users?status=pending|approved|rejected|all
 * Returns user profiles for admin verification dashboard.
 */
export async function GET(request) {
    try {
        const { user, error } = await authenticateAdmin(request);
        if (error) return error;

        const { searchParams } = new URL(request.url);
        const statusFilter = searchParams.get('status') || 'pending';

        const adminClient = getSupabaseAdmin();
        let query = adminClient
            .from('profiles')
            .select('id, full_name, student_number, email, avatar_url, created_at, role, verification_status, verification_doc_url, verification_reviewed_at, verification_rejection_reason')
            .order('created_at', { ascending: false });

        if (statusFilter !== 'all') {
            query = query.eq('verification_status', statusFilter);
        }

        const { data: users, error: fetchError } = await query;

        if (fetchError) {
            console.error('Admin users fetch error:', fetchError);
            return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
        }

        // For each user with a verification doc, generate a signed URL so admin can view it
        const usersWithSignedUrls = await Promise.all(
            (users || []).map(async (u) => {
                if (u.verification_doc_url) {
                    const { data: signedData } = await adminClient.storage
                        .from('verification-docs')
                        .createSignedUrl(u.verification_doc_url, 3600); // 1 hour expiry
                    return { ...u, verification_doc_signed_url: signedData?.signedUrl || null };
                }
                return { ...u, verification_doc_signed_url: null };
            })
        );

        return NextResponse.json({ users: usersWithSignedUrls }, { status: 200 });
    } catch (err) {
        console.error('Admin users GET error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * PATCH /api/admin/users
 * Body: { userId, action: 'approve' | 'reject', reason?: string }
 * Updates verification_status and sends email notification.
 */
export async function PATCH(request) {
    try {
        const { user, error } = await authenticateAdmin(request);
        if (error) return error;

        const body = await request.json();
        const { userId, userIds, action, reason } = body;

        // Support both single and batch
        const ids = userIds || (userId ? [userId] : []);

        if (ids.length === 0 || !['approve', 'reject'].includes(action)) {
            return NextResponse.json(
                { error: 'Invalid request — userId/userIds and action (approve/reject) required' },
                { status: 400 }
            );
        }

        const adminClient = getSupabaseAdmin();

        const newStatus = action === 'approve' ? 'approved' : 'rejected';

        const updateData = {
            verification_status: newStatus,
            verification_reviewed_by: user.id,
            verification_reviewed_at: new Date().toISOString(),
        };

        if (action === 'reject') {
            updateData.verification_rejection_reason = reason || 'Document could not be verified';
        } else {
            updateData.verification_rejection_reason = null;
        }

        // Fetch all target users for email notifications
        const { data: targetUsers } = await adminClient
            .from('profiles')
            .select('id, full_name, email, verification_status')
            .in('id', ids);

        // Batch update
        const { error: updateError } = await adminClient
            .from('profiles')
            .update(updateData)
            .in('id', ids);

        if (updateError) {
            console.error('Admin user update error:', updateError);
            return NextResponse.json({ error: 'Failed to update user(s)' }, { status: 500 });
        }

        // Send email notifications (non-blocking)
        let emailsSent = 0;
        if (targetUsers) {
            for (const targetUser of targetUsers) {
                if (!targetUser.email) continue;
                let emailResult;
                if (action === 'approve') {
                    emailResult = await sendVerificationApproved(targetUser.email, targetUser.full_name);
                } else {
                    emailResult = await sendVerificationRejected(
                        targetUser.email,
                        targetUser.full_name,
                        reason || 'Document could not be verified'
                    );
                }
                if (emailResult?.success) emailsSent++;
            }
        }

        return NextResponse.json({
            message: `${ids.length} user(s) ${newStatus} successfully`,
            emailSent: emailsSent > 0,
            emailCount: emailsSent,
        }, { status: 200 });

    } catch (err) {
        console.error('Admin users PATCH error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
