# Supabase Connection & Error Handling Solutions

## Problem Analysis

Your current Supabase configuration lacks:
1. **No retry logic** - Failed connections don't recover
2. **No error boundaries** - Errors crash components
3. **No connection pooling** - Each request creates new connection
4. **Inconsistent env variable names** - Fallback logic is fragile
5. **No request/response interceptors** - Can't log or handle auth errors globally
6. **Missing timeout handling** - Long-running requests hang

---

## Solution 1: Enhanced Supabase Client with Retry Logic

**File: `/lib/supabase-with-retry.js`** (NEW FILE)

```javascript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase configuration. Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set.'
  )
}

// Create base client
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  global: {
    headers: {
      'X-Client-Info': 'found-it-v1',
    },
  },
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
        error.code === 'TIMEOUT'

      if (!isRetryableError) {
        throw error
      }

      // Calculate exponential backoff: 1s, 2s, 4s
      const delay = delayMs * Math.pow(2, attempt)
      console.warn(
        `Supabase operation failed (attempt ${attempt + 1}/${maxRetries}). Retrying in ${delay}ms...`,
        error.message
      )

      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw new Error(
    `Operation failed after ${maxRetries} retries. Last error: ${lastError?.message}`
  )
}

/**
 * Connection health check
 * Verifies Supabase is reachable before critical operations
 */
export async function checkSupabaseHealth() {
  try {
    const { data, error } = await withRetry(
      () => supabase.from('_health').select('*').limit(1),
      2,
      500
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
```

---

## Solution 2: Error Boundary Component

**File: `/components/SupabaseErrorBoundary.js`** (NEW FILE)

```javascript
'use client'

import React from 'react'
import { AlertCircle, RotateCcw } from 'lucide-react'
import { motion } from 'framer-motion'

export class SupabaseErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      errorCode: null,
      retryCount: 0,
    }
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error: error.message,
      errorCode: error.status || 'UNKNOWN',
    }
  }

  componentDidCatch(error, errorInfo) {
    console.error('Supabase Error caught by boundary:', {
      error: error.message,
      errorInfo,
      timestamp: new Date().toISOString(),
    })

    // Log to monitoring service (e.g., Sentry)
    // logErrorToMonitoring(error, errorInfo)
  }

  handleRetry = () => {
    this.setState((prev) => ({
      hasError: false,
      error: null,
      errorCode: null,
      retryCount: prev.retryCount + 1,
    }))
  }

  getErrorMessage() {
    const { error, errorCode } = this.state

    const errorMap = {
      401: 'Unauthorized. Please log in again.',
      403: 'You do not have permission to perform this action.',
      404: 'Resource not found.',
      500: 'Server error. Please try again later.',
      NETWORK_ERROR: 'Network connection failed. Check your internet.',
      TIMEOUT: 'Request timed out. Please try again.',
      UNKNOWN: 'An unexpected error occurred.',
    }

    return errorMap[errorCode] || error || errorMap.UNKNOWN
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children
    }

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="min-h-screen bg-linear-to-br from-[#0a0a0a] via-[#1a1a1a] to-[#7c2d1233] flex items-center justify-center p-4"
      >
        <div className="bg-black/40 backdrop-blur-2xl border border-red-500/30 rounded-3xl p-8 max-w-md text-center">
          <AlertCircle className="mx-auto mb-4 text-red-500" size={48} />

          <h2 className="text-xl font-bold text-white mb-2">Connection Error</h2>
          <p className="text-red-300/80 text-sm mb-6">{this.getErrorMessage()}</p>

          <div className="space-y-3">
            <button
              onClick={this.handleRetry}
              className="w-full bg-linear-to-r from-orange-500 to-orange-700 hover:from-orange-600 hover:to-orange-800 text-white font-bold py-3 px-6 rounded-2xl transition flex items-center justify-center gap-2"
            >
              <RotateCcw size={18} />
              Try Again
            </button>

            <button
              onClick={() => window.location.href = '/login'}
              className="w-full bg-white/10 border border-white/20 hover:bg-white/20 text-white font-bold py-3 px-6 rounded-2xl transition"
            >
              Return to Login
            </button>
          </div>

          {this.state.retryCount > 2 && (
            <p className="text-white/50 text-xs mt-4">
              Retry #{this.state.retryCount} - If issues persist, contact support.
            </p>
          )}
        </div>
      </motion.div>
    )
  }
}
```

---

## Solution 3: Request Timeout Wrapper

**File: `/lib/supabase-timeout.js`** (NEW FILE)

```javascript
/**
 * Wraps Supabase queries with timeout protection
 * Prevents hanging requests
 */
export function withTimeout(promise, timeoutMs = 10000) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error(`Request timeout after ${timeoutMs}ms`)),
        timeoutMs
      )
    ),
  ])
}

/**
 * Usage example:
 * 
 * const data = await withTimeout(
 *   supabase.from('items').select('*'),
 *   8000 // 8 second timeout
 * )
 */
```

---

## Solution 4: Global Error Handler Hook

**File: `/hooks/useSupabaseError.js`** (NEW FILE)

```javascript
'use client'

import { useCallback, useState } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * Hook for handling Supabase errors globally
 * Provides retry logic and error state management
 */
export function useSupabaseError() {
  const [error, setError] = useState(null)
  const [isRetrying, setIsRetrying] = useState(false)

  const handleError = useCallback((error) => {
    console.error('Supabase Error:', {
      message: error.message,
      status: error.status,
      code: error.code,
      details: error.details,
      hint: error.hint,
    })

    setError({
      message: error.message,
      status: error.status,
      code: error.code,
      timestamp: new Date(),
    })
  }, [])

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  return {
    error,
    handleError,
    clearError,
    isRetrying,
  }
}
```

---

## Solution 5: Improved Admin Client with Error Handling

**File: `/lib/supabaseAdmin.js`** (UPDATED)

```javascript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SERVICE_ROLE

if (!supabaseUrl) {
  throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL environment variable')
}

if (!supabaseServiceRoleKey) {
  console.error(
    'WARNING: SUPABASE_SERVICE_ROLE_KEY is not configured. Admin operations will fail.'
  )
  console.error('Please set SUPABASE_SERVICE_ROLE_KEY in your .env.local file.')
}

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
}

/**
 * Get or initialize the Supabase admin client
 * @throws Error if service role key is not configured
 */
export function getSupabaseAdmin() {
  if (!adminClient) {
    throw new Error(
      'Supabase admin client not initialized. ' +
      'Ensure SUPABASE_SERVICE_ROLE_KEY is set in environment variables.'
    )
  }
  return adminClient
}

/**
 * Check if admin client is available
 * Safe to use for conditional logic
 */
export function isAdminClientAvailable() {
  return adminClient !== null
}
```

---

## Solution 6: Connection Configuration Best Practices

**File: `/lib/supabase-config.js`** (NEW FILE)

```javascript
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
    serviceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  },

  // Client options for connection pool management
  clientOptions: {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    global: {
      headers: {
        'X-Client-Version': '1.0.0',
      },
    },
    // Connection pooling settings
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  },

  // Timeouts (milliseconds)
  timeouts: {
    query: 10000,     // 10 seconds for queries
    upload: 30000,    // 30 seconds for file uploads
    auth: 5000,       // 5 seconds for auth operations
    realtime: 5000,   // 5 seconds for realtime subscriptions
  },

  // Retry strategy
  retryConfig: {
    maxRetries: 3,
    initialDelayMs: 1000,
    maxDelayMs: 10000,
    backoffMultiplier: 2,
  },
}

/**
 * Validate configuration
 */
export function validateSupabaseConfig() {
  const errors = []

  if (!supabaseConfig.publicConfig.url) {
    errors.push('NEXT_PUBLIC_SUPABASE_URL not set')
  }
  if (!supabaseConfig.publicConfig.anonKey) {
    errors.push('NEXT_PUBLIC_SUPABASE_ANON_KEY not set')
  }

  if (typeof window === 'undefined') {
    // Server-side checks
    if (!supabaseConfig.serverConfig.serviceRoleKey) {
      console.warn('SUPABASE_SERVICE_ROLE_KEY not set - admin operations disabled')
    }
  }

  if (errors.length > 0) {
    throw new Error(`Supabase config validation failed:\n${errors.join('\n')}`)
  }

  return true
}
```

---

## Solution 7: Update Your Components to Use Enhanced Client

### Example 1: Items Page with Error Handling

**File: `/app/items/page.js`** (Replace fetchItems function)

```javascript
const fetchItems = async () => {
  try {
    setLoading(true)
    const formattedCategory =
      activeTab.charAt(0).toUpperCase() + activeTab.slice(1)

    const { data: { user } } = await supabase.auth.getUser()

    // Wrap query with retry logic
    const { data, error } = await withRetry(
      () =>
        supabase
          .from('items')
          .select('*')
          .eq('category', formattedCategory)
          .order('created_at', { ascending: false }),
      3,      // maxRetries
      1000    // initialDelayMs
    )

    if (error) {
      console.error('Failed to fetch items:', error)
      setError('Failed to load items. Please try again.')
      return
    }

    setItems(data || [])
    if (user) {
      setUserItems(data?.filter((item) => item.user_id === user.id) || [])
    }
    setError(null) // Clear error on success
  } catch (err) {
    console.error('Fetch error:', err)
    setError(err.message || 'Unable to load items')
  } finally {
    setTimeout(() => setLoading(false), 100)
  }
}
```

### Example 2: Login Page with Connection Check

**File: `/app/login/page.js`** (Add connection check)

```javascript
import { useEffect, useState } from 'react'
import { checkSupabaseHealth } from '@/lib/supabase-with-retry'

// Inside component:
useEffect(() => {
  const checkConnection = async () => {
    const isHealthy = await checkSupabaseHealth()
    if (!isHealthy) {
      setError('Unable to connect to database. Please check your connection.')
    }
  }

  checkConnection()
}, [])
```

---

## Implementation Checklist

- [ ] Create `/lib/supabase-with-retry.js`
- [ ] Create `/components/SupabaseErrorBoundary.js`
- [ ] Create `/lib/supabase-timeout.js`
- [ ] Create `/hooks/useSupabaseError.js`
- [ ] Update `/lib/supabaseAdmin.js`
- [ ] Create `/lib/supabase-config.js`
- [ ] Wrap app with SupabaseErrorBoundary in layout.js
- [ ] Update fetchItems() and other queries with withRetry()
- [ ] Add error state management to components
- [ ] Test connection failures by disconnecting internet
- [ ] Monitor logs in production

---

## Environment Variables Checklist

Ensure your `.env.local` has:

```env
# REQUIRED for all users
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...

# REQUIRED for server-side operations
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

**Do NOT commit these to version control!**

---

## Testing Connection Issues

### Test 1: Simulate Network Failure
```javascript
// Temporarily add to browser console:
window.navigator.onLine = false
// Then try an operation and observe error handling
```

### Test 2: Timeout Behavior
```javascript
// Monitor Network tab in DevTools
// Look for hanging requests
// They should auto-retry and eventually timeout gracefully
```

### Test 3: Error Recovery
- Sign in successfully
- Disconnect internet
- Try to fetch items
- Observe error boundary displays gracefully
- Reconnect internet
- Click "Try Again"
- Should recover

---

## End of Solutions Document
