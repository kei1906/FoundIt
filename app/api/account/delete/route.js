import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

/**
 * DELETE /api/account/delete
 * Self-delete: authenticated user deletes their own account.
 * Uses the service-role client to call auth.admin.deleteUser(),
 * which cascades through: auth.users → profiles → items → chats → messages.
 */
export async function DELETE(request) {
    try {
        const authHeader = request.headers.get('Authorization')
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const token = authHeader.replace('Bearer ', '')
        const userClient = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
            { global: { headers: { Authorization: `Bearer ${token}` } } }
        )

        const { data: { user }, error: userError } = await userClient.auth.getUser()
        if (userError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Use admin client to delete the auth user — cascades everything
        const adminClient = getSupabaseAdmin()
        const { error: deleteError } = await adminClient.auth.admin.deleteUser(user.id)

        if (deleteError) {
            console.error('Account delete error:', deleteError)
            return NextResponse.json({ error: 'Failed to delete account' }, { status: 500 })
        }

        return NextResponse.json({ message: 'Account deleted successfully' }, { status: 200 })
    } catch (err) {
        console.error('Account delete error:', err)
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
    }
}
