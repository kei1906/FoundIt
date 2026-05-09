'use client'

import { createBrowserClient } from '@supabase/ssr'
import { supabaseConfig, validateSupabaseConfig } from './supabase-config'

// Validate configuration on startup
try {
    validateSupabaseConfig()
} catch (error) {
    console.error('Supabase Configuration Error:', error.message)
}

const supabaseUrl = supabaseConfig.publicConfig.url
const supabaseAnonKey = supabaseConfig.publicConfig.anonKey

if (!supabaseUrl || !supabaseAnonKey) {
    console.error('Supabase environment variables are missing!')
}

// Create the base client with SSR support
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
    ...supabaseConfig.clientOptions,
})

/**
 * Retry wrapper for Supabase operations
 * Automatically retries failed requests with exponential backoff
 *
 * @param {Function} operation - Async function to retry
 * @param {number} maxRetries - Max retry attempts (default: 3)
 * @param {number} delayMs - Initial delay in ms (default: 1000)
 * @returns {Promise} Result of operation
 */
export async function withRetry(operation, maxRetries = 3, delayMs = 1000) {
    let lastError

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await operation()
        } catch (error) {
            lastError = error

            // Don't retry on authentication errors (401, 403)
            if (error.status === 401 || error.status === 403) {
                throw error
            }

            // Don't retry on validation errors (400)
            if (error.status === 400) {
                throw error
            }

            // Only retry on network/server errors (5xx, connection timeout)
            const isRetryableError =
                error.status >= 500 ||
                error.code === 'NETWORK_ERROR' ||
                error.code === 'TIMEOUT' ||
                error.message?.includes('network') ||
                error.message?.includes('timeout')

            if (!isRetryableError) {
                throw error
            }

            // Calculate exponential backoff: 1s, 2s, 4s
            const delay = delayMs * Math.pow(2, attempt)

            console.warn(
                `Supabase operation failed (attempt ${attempt + 1}/${maxRetries}). Retrying in ${delay}ms...`,
                error.message
            )

            // Wait before retrying
            await new Promise((resolve) => setTimeout(resolve, delay))
        }
    }

    throw new Error(
        `Operation failed after ${maxRetries} retries. Last error: ${lastError?.message}`
    )
}

/**
 * Wraps promise with timeout protection
 * Prevents hanging requests
 *
 * @param {Promise} promise - Promise to wrap
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise} Result or timeout error
 */
export function withTimeout(promise, timeoutMs = 10000) {
    return Promise.race([
        promise,
        new Promise((_, reject) =>
            setTimeout(
                () =>
                    reject(
                        new Error(
                            `Request timeout after ${timeoutMs}ms. Check your connection.`
                        )
                    ),
                timeoutMs
            )
        ),
    ])
}

/**
 * Combined retry + timeout wrapper
 * @param {Function} operation - Async function to execute
 * @param {number} timeoutMs - Timeout per attempt
 * @param {number} maxRetries - Number of retries
 * @returns {Promise} Result of operation
 */
export async function withRetryAndTimeout(
    operation,
    timeoutMs = 10000,
    maxRetries = 3
) {
    let lastError

    for (let attempt = 0; attempt < maxRetries; attempt++) {
        try {
            return await withTimeout(operation(), timeoutMs)
        } catch (error) {
            lastError = error

            // Don't retry auth errors
            if (error.status === 401 || error.status === 403) {
                throw error
            }

            // Don't retry validation errors
            if (error.status === 400) {
                throw error
            }

            const isRetryableError =
                error.status >= 500 ||
                error.message?.includes('timeout') ||
                error.message?.includes('network')

            if (!isRetryableError) {
                throw error
            }

            const delay = 1000 * Math.pow(2, attempt)
            console.warn(
                `Attempt ${attempt + 1}/${maxRetries} failed. Retrying in ${delay}ms...`,
                error.message
            )

            await new Promise((resolve) => setTimeout(resolve, delay))
        }
    }

    throw lastError
}

/**
 * Connection health check
 * Verifies Supabase is reachable before critical operations
 *
 * @returns {boolean} True if connection is healthy
 */
export async function checkSupabaseHealth() {
    try {
        // Try a simple query that doesn't require auth
        const { data, error } = await withTimeout(
            supabase.auth.getSession(),
            5000
        )

        if (error) {
            console.error('Supabase health check failed:', error.message)
            return false
        }

        return true
    } catch (error) {
        console.error('Supabase health check error:', error.message)
        return false
    }
}
