/**
 * Centralized Supabase configuration
 * Ensures consistent setup across client and server
 */

export const supabaseConfig = {
    // Public configuration (safe to expose)
    publicConfig: {
        url: process.env.NEXT_PUBLIC_SUPABASE_URL,
        anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    },

    // Server-only configuration
    serverConfig: {
        url: process.env.NEXT_PUBLIC_SUPABASE_URL,
        serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE,
    },

    // Client options for connection management
    clientOptions: {
        auth: {
            persistSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
        },
        global: {
            headers: {
                'X-Client-Version': '1.0.0',
                'X-App-Name': 'found-it-v1',
            },
        },
    },

    // Timeouts (milliseconds)
    timeouts: {
        query: 10000,      // 10 seconds for database queries
        upload: 30000,     // 30 seconds for file uploads
        auth: 5000,        // 5 seconds for authentication
        realtime: 5000,    // 5 seconds for realtime subscriptions
    },

    // Retry strategy
    retryConfig: {
        maxRetries: 3,
        initialDelayMs: 1000,
        maxDelayMs: 10000,
        backoffMultiplier: 2,
    },

    // Storage buckets
    storage: {
        items: 'items',      // For item photos
        avatars: 'avatars',  // For user avatars
    },

    // Feature flags
    features: {
        enableRetryLogic: true,
        enableErrorBoundary: true,
        enableHealthCheck: true,
    },
}

/**
 * Validate that all required environment variables are set
 * @throws {Error} If configuration is invalid
 */
export function validateSupabaseConfig() {
    const errors = []

    // Check public configuration
    if (!supabaseConfig.publicConfig.url) {
        errors.push(
            'NEXT_PUBLIC_SUPABASE_URL is not set. Add it to .env.local'
        )
    }

    if (!supabaseConfig.publicConfig.anonKey) {
        errors.push(
            'NEXT_PUBLIC_SUPABASE_ANON_KEY is not set. Add it to .env.local'
        )
    }

    // Server-side checks only
    if (typeof window === 'undefined') {
        if (!supabaseConfig.serverConfig.serviceRoleKey) {
            console.warn(
                '⚠️  SUPABASE_SERVICE_ROLE_KEY not set - admin operations disabled'
            )
        }
    }

    if (errors.length > 0) {
        throw new Error(
            `Supabase configuration validation failed:\n${errors.join('\n')}`
        )
    }

    return true
}

/**
 * Get configuration value with fallback
 * @param {string} key - Config key path (e.g., 'publicConfig.url')
 * @param {*} defaultValue - Fallback value
 * @returns {*} Configuration value
 */
export function getConfigValue(key, defaultValue = null) {
    const keys = key.split('.')
    let value = supabaseConfig

    for (const k of keys) {
        value = value?.[k]
    }

    return value ?? defaultValue
}

/**
 * Format Supabase URL for logging (masks sensitive data)
 * @returns {string} Formatted URL
 */
export function getFormattedSupabaseUrl() {
    const url = supabaseConfig.publicConfig.url
    if (!url) return 'NOT SET'
    try {
        const urlObj = new URL(url)
        return `${urlObj.protocol}//${urlObj.hostname}`
    } catch {
        return 'INVALID'
    }
}

/**
 * Get current environment (development/production)
 * @returns {string} Environment name
 */
export function getEnvironment() {
    if (typeof window === 'undefined') {
        return process.env.NODE_ENV || 'development'
    }
    return 'client'
}
