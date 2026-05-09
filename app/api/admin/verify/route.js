import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseAdmin } from '@/lib/supabaseAdmin'

/**
 * GET /api/admin/verify
 * Verifies whether the calling user has the 'admin' role.
 * Uses the Authorization header (Bearer <access_token>) to identify the user,
 * then checks their profile with the service-role client (bypasses RLS).
 */
export async function GET(request) {
    try {
        // Extract the access token from the Authorization header
        const authHeader = request.headers.get('Authorization')
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return NextResponse.json({ isAdmin: false }, { status: 401 })
        }

        const token = authHeader.replace('Bearer ', '')

        // Create a temporary client with the user's token to get their ID
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
        const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
        const userClient = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: `Bearer ${token}` } },
        })

        const { data: { user }, error: userError } = await userClient.auth.getUser()
        if (userError || !user) {
            return NextResponse.json({ isAdmin: false }, { status: 401 })
        }

        // Use admin client to bypass RLS and check the role
        const adminClient = getSupabaseAdmin()
        const { data: profile, error: profileError } = await adminClient
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single()

        if (profileError || !profile) {
            return NextResponse.json({ isAdmin: false }, { status: 200 })
        }

        return NextResponse.json({ isAdmin: profile.role === 'admin' }, { status: 200 })
    } catch (error) {
        console.error('Admin verify error:', error)
        return NextResponse.json({ isAdmin: false, error: 'Internal server error' }, { status: 500 })
    }
}
