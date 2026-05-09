'use client'

import React from 'react'
import { AlertCircle, RotateCcw, Home } from 'lucide-react'
import { motion } from 'framer-motion'

/**
 * Error Boundary Component
 * Catches and handles Supabase connection errors gracefully
 * Prevents entire app from crashing due to database issues
 */
export class SupabaseErrorBoundary extends React.Component {
    constructor(props) {
        super(props)
        this.state = {
            hasError: false,
            error: null,
            errorCode: null,
            errorDetails: null,
            retryCount: 0,
            timestamp: null,
        }
    }

    static getDerivedStateFromError(error) {
        return {
            hasError: true,
            error: error.message,
            errorCode: error.status || error.code || 'UNKNOWN',
            errorDetails: error.details || error.hint,
            timestamp: new Date(),
        }
    }

    componentDidCatch(error, errorInfo) {
        // Log error details
        console.error('=== Supabase Error Caught ===')
        console.error('Message:', error.message)
        console.error('Code:', error.status || error.code)
        console.error('Details:', error.details)
        console.error('Component Stack:', errorInfo.componentStack)
        console.error('Timestamp:', new Date().toISOString())
        console.error('===============================')

        // In production, you might send this to a monitoring service
        // logErrorToMonitoring(error, errorInfo)
    }

    handleRetry = () => {
        this.setState((prev) => ({
            hasError: false,
            error: null,
            errorCode: null,
            errorDetails: null,
            retryCount: prev.retryCount + 1,
        }))
    }

    getErrorMessage() {
        const { error, errorCode } = this.state

        const errorMap = {
            401: 'Session expired. Please log in again.',
            403: 'You do not have permission to perform this action.',
            404: 'The requested resource was not found.',
            408: 'Request timed out. Please try again.',
            429: 'Too many requests. Please wait a moment.',
            500: 'Server error. Our team has been notified.',
            502: 'Gateway error. Please try again later.',
            503: 'Service temporarily unavailable.',
            NETWORK_ERROR: 'Network connection failed. Check your internet connection.',
            TIMEOUT: 'Request timed out. Please check your connection.',
            PGSQL_ERROR: 'Database error. Please try again.',
            INVALID_JWT: 'Authentication token is invalid. Please log in again.',
            UNKNOWN: 'An unexpected error occurred. Please try again.',
        }

        return errorMap[errorCode] || error || errorMap.UNKNOWN
    }

    getErrorSuggestion() {
        const { errorCode } = this.state

        const suggestions = {
            401: 'Try logging in again with your credentials.',
            403: 'Contact support if you believe this is an error.',
            404: 'The item or resource may have been deleted.',
            408: 'Check your internet connection and try again.',
            429: 'Wait a few seconds before trying again.',
            500: 'Try again in a few moments.',
            502: 'Try again in a few moments.',
            503: 'The service is undergoing maintenance. Please try again later.',
            NETWORK_ERROR: 'Ensure you have a stable internet connection.',
            TIMEOUT: 'Your connection may be slow. Try again when connection improves.',
        }

        return suggestions[errorCode] || 'Refresh the page or try again later.'
    }

    render() {
        if (!this.state.hasError) {
            return this.props.children
        }

        const { errorCode, retryCount, timestamp } = this.state

        return (
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="min-h-screen bg-gradient-to-br from-[#0a0a0a] via-[#1a1a1a] to-[#7c2d1233] flex items-center justify-center p-4"
            >
                <div className="bg-black/40 backdrop-blur-2xl border border-red-500/30 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl shadow-red-500/10">
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.1 }}
                    >
                        <AlertCircle className="mx-auto mb-6 text-red-500" size={56} />
                    </motion.div>

                    <h1 className="text-2xl font-bold text-white mb-2">
                        Connection Error
                    </h1>

                    <p className="text-red-300/80 text-sm mb-4 leading-relaxed">
                        {this.getErrorMessage()}
                    </p>

                    <p className="text-white/60 text-xs mb-6 bg-white/5 p-3 rounded-lg">
                        {this.getErrorSuggestion()}
                    </p>

                    {this.state.errorDetails && (
                        <details className="text-left mb-6">
                            <summary className="text-xs text-white/40 cursor-pointer hover:text-white/60">
                                Technical Details
                            </summary>
                            <p className="text-[11px] text-white/30 mt-2 p-2 bg-white/5 rounded font-mono">
                                {this.state.errorDetails}
                            </p>
                        </details>
                    )}

                    <div className="space-y-3">
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={this.handleRetry}
                            className="w-full bg-gradient-to-r from-orange-500 to-orange-700 hover:from-orange-600 hover:to-orange-800 text-white font-bold py-3 px-6 rounded-2xl transition flex items-center justify-center gap-2 shadow-lg shadow-orange-500/20"
                        >
                            <RotateCcw size={18} />
                            Try Again
                        </motion.button>

                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => {
                                window.location.href = '/Home'
                            }}
                            className="w-full bg-white/10 border border-white/20 hover:bg-white/20 text-white font-bold py-3 px-6 rounded-2xl transition flex items-center justify-center gap-2"
                        >
                            <Home size={18} />
                            Back to Home
                        </motion.button>

                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => {
                                window.location.href = '/login'
                            }}
                            className="w-full bg-white/5 border border-white/10 hover:bg-white/10 text-white/70 font-bold py-3 px-6 rounded-2xl transition"
                        >
                            Log In Again
                        </motion.button>
                    </div>

                    <div className="mt-6 pt-4 border-t border-white/10">
                        <p className="text-white/40 text-xs">
                            Error Code: {errorCode}
                        </p>
                        {retryCount > 0 && (
                            <p className="text-white/40 text-xs mt-1">
                                Retry attempt: {retryCount}
                            </p>
                        )}
                        {timestamp && (
                            <p className="text-white/40 text-xs mt-1">
                                Time: {timestamp.toLocaleTimeString()}
                            </p>
                        )}
                    </div>

                    {retryCount > 3 && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg"
                        >
                            <p className="text-yellow-300/80 text-xs">
                                ⚠️ Multiple retry failures detected. If the problem persists,
                                please contact support or try again later.
                            </p>
                        </motion.div>
                    )}
                </div>
            </motion.div>
        )
    }
}

/**
 * Error Fallback Component
 * Simple fallback for wrapped children
 */
export function ErrorFallback({ error, resetError }) {
    return (
        <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
            <div className="bg-black/40 backdrop-blur-2xl border border-red-500/30 rounded-3xl p-8 max-w-md text-center">
                <AlertCircle className="mx-auto mb-4 text-red-500" size={48} />
                <h2 className="text-xl font-bold text-white mb-2">Error</h2>
                <p className="text-red-300/80 text-sm mb-4">{error?.message}</p>
                <button
                    onClick={resetError}
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded-xl"
                >
                    Try Again
                </button>
            </div>
        </div>
    )
}
