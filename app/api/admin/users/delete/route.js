import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

/**
 * Shared admin auth — same pattern as other admin routes.
 */
async function authenticateAdmin(request) {
    const authHeader = request.headers.get('Authorization')
    if (!authHeader?.startsWith('Bearer ')) {
        return { user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
    }

    const token = authHeader.replace('Bearer ', '')
    const userClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        { global: { headers: { Authorization: `Bearer ${token}` } } }
    )

    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) {
        return { user: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
    }

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
 * DELETE /api/admin/users/delete
 * Body: { userId } or { userIds: [...] }
 * Admin-only: Deletes user(s) from auth.users, cascading to all related data.
 */
export async function DELETE(request) {
    try {
        const { user: adminUser, error } = await authenticateAdmin(request)
        if (error) return error

        const body = await request.json()
        const { userId, userIds } = body

        // Support both single and batch delete
        const idsToDelete = userIds || (userId ? [userId] : [])

        if (idsToDelete.length === 0) {
            return NextResponse.json({ error: 'userId or userIds is required' }, { status: 400 })
        }

        // Prevent self-deletion via admin panel
        if (idsToDelete.includes(adminUser.id)) {
            return NextResponse.json({ error: 'Cannot delete your own admin account' }, { status: 400 })
        }

        const adminClient = getSupabaseAdmin()
        const results = { deleted: [], failed: [] }

        for (const id of idsToDelete) {
            const { error: deleteError } = await adminClient.auth.admin.deleteUser(id)
            if (deleteError) {
                console.error(`Failed to delete user ${id}:`, deleteError)
                results.failed.push({ id, error: deleteError.message })
            } else {
                results.deleted.push(id)
            }
        }

        if (results.failed.length > 0 && results.deleted.length === 0) {
            return NextResponse.json({ error: 'Failed to delete user(s)', details: results.failed }, { status: 500 })
        }

        return NextResponse.json({
            message: `${results.deleted.length} user(s) deleted successfully`,
            ...results
        }, { status: 200 })
    } catch (err) {
        console.error('Admin user delete error:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
