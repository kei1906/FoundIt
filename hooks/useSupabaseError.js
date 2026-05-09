'use client'

import { useCallback, useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase-enhanced'

/**
 * Hook for handling Supabase errors globally
 * Provides retry logic and error state management
 *
 * Usage:
 * const { error, handleError, clearError, isRetrying } = useSupabaseError()
 */
export function useSupabaseError() {
    const [error, setError] = useState(null)
    const [isRetrying, setIsRetrying] = useState(false)
    const [retryCount, setRetryCount] = useState(0)

    const handleError = useCallback((error) => {
        console.error('Supabase Error:', {
            message: error?.message,
            status: error?.status,
            code: error?.code,
            details: error?.details,
            hint: error?.hint,
            timestamp: new Date().toISOString(),
        })

        setError({
            message: error?.message || 'Unknown error',
            status: error?.status,
            code: error?.code,
            details: error?.details,
            hint: error?.hint,
            timestamp: new Date(),
        })
    }, [])

    const clearError = useCallback(() => {
        setError(null)
        setIsRetrying(false)
        setRetryCount(0)
    }, [])

    const retry = useCallback(() => {
        setIsRetrying(true)
        setRetryCount((prev) => prev + 1)
        // Retrying state will be cleared by caller after operation
    }, [])

    return {
        error,
        handleError,
        clearError,
        retry,
        isRetrying,
        retryCount,
    }
}

/**
 * Hook for managing connection status
 * Monitors Supabase connection health
 */
export function useSupabaseConnection() {
    const [isConnected, setIsConnected] = useState(true)
    const [isChecking, setIsChecking] = useState(false)

    const checkConnection = useCallback(async () => {
        setIsChecking(true)
        try {
            const { data, error } = await supabase.auth.getSession()

            if (error) {
                console.warn('Connection check failed:', error.message)
                setIsConnected(false)
                return false
            }

            setIsConnected(true)
            return true
        } catch (error) {
            console.warn('Connection check error:', error.message)
            setIsConnected(false)
            return false
        } finally {
            setIsChecking(false)
        }
    }, [])

    useEffect(() => {
        // Check connection on mount
        checkConnection()

        // Periodically check connection (every 30 seconds)
        const interval = setInterval(checkConnection, 30000)

        // Listen for online/offline events
        window.addEventListener('online', checkConnection)
        window.addEventListener('offline', () => setIsConnected(false))

        return () => {
            clearInterval(interval)
            window.removeEventListener('online', checkConnection)
            window.removeEventListener('offline', () => setIsConnected(false))
        }
    }, [checkConnection])

    return {
        isConnected,
        isChecking,
        checkConnection,
    }
}

/**
 * Hook for async data fetching with error handling
 *
 * Usage:
 * const { data, loading, error } = useSupabaseQuery(
 *   () => supabase.from('items').select('*'),
 *   [dependencies]
 * )
 */
export function useSupabaseQuery(queryFn, dependencies = []) {
    const [data, setData] = useState(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    const { handleError: logError } = useSupabaseError()

    useEffect(() => {
        let isMounted = true

        const fetchData = async () => {
            try {
                setLoading(true)
                setError(null)

                const result = await queryFn()

                if (isMounted) {
                    if (result.error) {
                        throw result.error
                    }
                    setData(result.data)
                }
            } catch (err) {
                if (isMounted) {
                    logError(err)
                    setError(err)
                }
            } finally {
                if (isMounted) {
                    setLoading(false)
                }
            }
        }

        fetchData()

        return () => {
            isMounted = false
        }
    }, dependencies)

    return { data, loading, error }
}

/**
 * Hook for mutation operations (insert, update, delete)
 *
 * Usage:
 * const { mutate, loading, error } = useSupabaseMutation(
 *   (data) => supabase.from('items').insert(data)
 * )
 *
 * // Later:
 * await mutate({ title: 'New Item' })
 */
export function useSupabaseMutation(mutationFn) {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState(null)
    const [data, setData] = useState(null)

    const { handleError: logError } = useSupabaseError()

    const mutate = useCallback(
        async (payload) => {
            try {
                setLoading(true)
                setError(null)

                const result = await mutationFn(payload)

                if (result.error) {
                    throw result.error
                }

                setData(result.data)
                return result.data
            } catch (err) {
                logError(err)
                setError(err)
                throw err
            } finally {
                setLoading(false)
            }
        },
        [mutationFn, logError]
    )

    const clearError = useCallback(() => setError(null), [])
    const reset = useCallback(() => {
        setData(null)
        setError(null)
        setLoading(false)
    }, [])

    return {
        mutate,
        loading,
        error,
        data,
        clearError,
        reset,
    }
}
