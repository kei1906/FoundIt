import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'
import { sendItemApproved, sendItemRejected } from '@/lib/mailer'

/**
 * Extracts and validates the user from the Authorization header.
 * Returns { user, error } — error is a NextResponse if auth fails.
 */
async function authenticateAdmin(request) {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return { user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
    }

    const token = authHeader.replace('Bearer ', '')
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
    })

    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
        return { user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
    }

    // Verify admin role
    const adminClient = getSupabaseAdmin()
    const { data: profile } = await adminClient
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single()

    if (!profile || profile.role !== 'admin') {
        return { user: null, error: NextResponse.json({ error: 'Forbidden — admin access required' }, { status: 403 }) }
    }

    return { user, error: null }
}

/**
 * GET /api/admin/items?status=pending|approved|rejected|all
 * Returns items for admin moderation dashboard, including poster profile info.
 */
export async function GET(request) {
    try {
        const { user, error } = await authenticateAdmin(request)
        if (error) return error

        const { searchParams } = new URL(request.url)
        const statusFilter = searchParams.get('status') || 'pending'

        const adminClient = getSupabaseAdmin()
        let query = adminClient
            .from('items')
            .select('*, profiles:user_id(full_name, email, avatar_url, student_number)')
            .order('created_at', { ascending: false })

        if (statusFilter !== 'all') {
            query = query.eq('moderation_status', statusFilter)
        }

        const { data: items, error: fetchError } = await query

        if (fetchError) {
            console.error('Admin items fetch error:', fetchError)
            return NextResponse.json({ error: 'Failed to fetch items' }, { status: 500 })
        }

        return NextResponse.json({ items: items || [] }, { status: 200 })
    } catch (err) {
        console.error('Admin items GET error:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

/**
 * PATCH /api/admin/items
 * Body: { itemId, action: 'approve' | 'reject' }
 * Updates the item's moderation_status, records the reviewer, and emails the poster.
 */
export async function PATCH(request) {
    try {
        const { user, error } = await authenticateAdmin(request)
        if (error) return error

        const body = await request.json()
        const { itemId, itemIds, action } = body

        // Support both single and batch
        const ids = itemIds || (itemId ? [itemId] : [])

        if (ids.length === 0 || !['approve', 'reject'].includes(action)) {
            return NextResponse.json({ error: 'Invalid request — itemId/itemIds and action (approve/reject) required' }, { status: 400 })
        }

        const newStatus = action === 'approve' ? 'approved' : 'rejected'

        const adminClient = getSupabaseAdmin()
        const { data: updatedItems, error: updateError } = await adminClient
            .from('items')
            .update({
                moderation_status: newStatus,
                reviewed_by: user.id,
                reviewed_at: new Date().toISOString(),
            })
            .in('id', ids)
            .select('*, profiles:user_id(full_name, email)')

        if (updateError) {
            console.error('Admin item update error:', updateError)
            return NextResponse.json({ error: 'Failed to update item(s)' }, { status: 500 })
        }

        // Send email notifications to poster(s) — fire-and-forget, don't block the response
        if (updatedItems && updatedItems.length > 0) {
            for (const item of updatedItems) {
                const posterEmail = item.profiles?.email;
                const posterName = item.profiles?.full_name;
                if (posterEmail) {
                    try {
                        if (newStatus === 'approved') {
                            await sendItemApproved(posterEmail, posterName, item.title);
                        } else {
                            await sendItemRejected(posterEmail, posterName, item.title);
                        }
                    } catch (emailErr) {
                        // Log but don't fail the moderation action
                        console.error(`Failed to send moderation email to ${posterEmail}:`, emailErr);
                    }
                }
            }
        }

        return NextResponse.json({
            items: updatedItems,
            message: `${updatedItems?.length || 0} item(s) ${newStatus} successfully`
        }, { status: 200 })
    } catch (err) {
        console.error('Admin items PATCH error:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}

/**
 * DELETE /api/admin/items
 * Body: { itemId }
 * Hard-deletes an item (admin only).
 */
export async function DELETE(request) {
    try {
        const { user, error } = await authenticateAdmin(request)
        if (error) return error

        const body = await request.json()
        const { itemId, itemIds } = body

        // Support both single and batch
        const ids = itemIds || (itemId ? [itemId] : [])

        if (ids.length === 0) {
            return NextResponse.json({ error: 'itemId or itemIds is required' }, { status: 400 })
        }

        const adminClient = getSupabaseAdmin()
        const { error: deleteError } = await adminClient
            .from('items')
            .delete()
            .in('id', ids)

        if (deleteError) {
            console.error('Admin item delete error:', deleteError)
            return NextResponse.json({ error: 'Failed to delete item(s)' }, { status: 500 })
        }

        return NextResponse.json({ message: `${ids.length} item(s) deleted successfully` }, { status: 200 })
    } catch (err) {
        console.error('Admin items DELETE error:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
