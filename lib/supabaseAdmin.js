import { createClient } from '@supabase/supabase-js'
import { supabaseConfig } from './supabase-config'

const supabaseUrl = supabaseConfig.serverConfig.url
const supabaseServiceRoleKey = supabaseConfig.serverConfig.serviceRoleKey

// Initialize admin client if credentials available
let adminClient = null

if (supabaseUrl && supabaseServiceRoleKey) {
    adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
        global: {
            headers: {
                'X-Client-Info': 'found-it-admin-v1',
            },
        },
    })
} else {
    if (!supabaseUrl) {
        console.error('❌ NEXT_PUBLIC_SUPABASE_URL is not configured.')
    }
    if (!supabaseServiceRoleKey) {
        console.error(
            '⚠️  SUPABASE_SERVICE_ROLE_KEY is not configured. ' +
            'Admin operations will not work. Set it in .env.local'
        )
    }
}

/**
 * Get or initialize the Supabase admin client
 * For server-side operations only (API routes, server actions)
 *
 * @throws {Error} if service role key is not configured
 * @returns {Object} Supabase admin client instance
 */
export function getSupabaseAdmin() {
    if (!adminClient) {
        const error =
            'Supabase admin client not initialized. ' +
            'Ensure SUPABASE_SERVICE_ROLE_KEY is set in environment variables.'
        console.error('❌', error)
        throw new Error(error)
    }
    return adminClient
}

/**
 * Check if admin client is available
 * Safe to use for conditional logic
 *
 * @returns {boolean} True if admin client is configured
 */
export function isAdminClientAvailable() {
    return adminClient !== null
}

/**
 * Get admin client with fallback
 * Returns null instead of throwing if not available
 *
 * @returns {Object|null} Supabase admin client or null
 */
export function getSupabaseAdminOrNull() {
    return adminClient
}
