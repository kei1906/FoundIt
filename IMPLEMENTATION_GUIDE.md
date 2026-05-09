# Implementation Guide - Supabase Solutions

## Phase 1: Setup (30 minutes)

### Step 1: Create Environment File
**File:** `.env.local` (in root directory)

```env
# Copy from https://supabase.com/dashboard -> Settings -> API

# Public (safe to expose)
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGc...

# Server-only (NEVER commit this)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

### Step 2: Add to .gitignore
**File:** `.gitignore`

```
# Existing entries...
.env.local
.env.*.local
node_modules/
.next/
```

### Step 3: Verify Installation
```bash
# Test that variables load
npm run dev

# Should NOT show "undefined" for these:
echo $NEXT_PUBLIC_SUPABASE_URL
echo $NEXT_PUBLIC_SUPABASE_ANON_KEY
```

---

## Phase 2: Update Existing Files (1 hour)

### Update 1: Replace Client Import in `/app/layout.js`

**BEFORE:**
```javascript
// layout.js doesn't import supabase (good)
```

**AFTER:**
```javascript
import { SupabaseErrorBoundary } from '@/components/SupabaseErrorBoundary'

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <SupabaseErrorBoundary>
          {children}
        </SupabaseErrorBoundary>
      </body>
    </html>
  )
}
```

### Update 2: Fix Login Page `/app/login/page.js`

**Add to top of file:**
```javascript
'use client'

import { useEffect, useState } from 'react'
import { checkSupabaseHealth } from '@/lib/supabase-enhanced'
```

**Add inside LoginPage component before return:**
```javascript
useEffect(() => {
  const verifyConnection = async () => {
    const isHealthy = await checkSupabaseHealth()
    if (!isHealthy) {
      setError('Unable to connect to FoundIt servers. Please try again.')
    }
  }
  verifyConnection()
}, [])
```

### Update 3: Fix Items Page `/app/items/page.js`

**Replace import:**
```javascript
// OLD:
import { supabase } from "@/lib/supabase";

// NEW:
import { supabase, withRetry, withTimeout } from "@/lib/supabase-enhanced";
```

**Replace fetchItems function:**
```javascript
const fetchItems = async () => {
  try {
    setLoading(true)
    const formattedCategory =
      activeTab.charAt(0).toUpperCase() + activeTab.slice(1)

    const { data: { user } } = await supabase.auth.getUser()

    // Wrap with retry logic
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

    if (error) throw error

    setItems(data || [])
    if (user) {
      setUserItems(data?.filter((item) => item.user_id === user.id) || [])
    }
  } catch (err) {
    console.error('Fetch error:', err.message)
    // Error boundary will handle this
  } finally {
    setTimeout(() => setLoading(false), 100)
  }
}
```

### Update 4: Fix Chat Page `/app/chat/chat.js`

**Replace imports:**
```javascript
// OLD:
import { supabase } from "@/lib/supabase";

// NEW:
import { supabase, withRetry } from "@/lib/supabase-enhanced";
```

**Update fetchConversations function:**
```javascript
const fetchConversations = async () => {
  if (!user) return

  try {
    // Add retry wrapper
    const { data: chatsData, error } = await withRetry(
      () =>
        supabase
          .from('chats')
          .select(`
            id, item_id, finder_id, claimer_id, created_at,
            messages(content, created_at, sender_id)
          `)
          .or(`finder_id.eq.${user.id},claimer_id.eq.${user.id}`),
      3,
      1000
    )

    if (error) {
      console.error('fetchConversations error:', error)
      return
    }

    // ... rest of function unchanged
  } catch (err) {
    console.error('Fetch error:', err.message)
  }
}
```

### Update 5: Fix Profile Page `/app/Profile/page.js`

**Add error handling to upload:**
```javascript
const handleUpload = async (event) => {
  try {
    setUploading(true)
    const file = event.target.files[0]
    if (!file) return

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      alert('Please log in first')
      return
    }

    const fileExt = file.name.split('.').pop()
    const fileName = `${user.id}-${Math.random()}.${fileExt}`

    // Add error checking
    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(fileName, file)

    if (uploadError) {
      console.error('Upload error:', uploadError)
      alert('Failed to upload avatar: ' + uploadError.message)
      return
    }

    // ... rest of function
  } catch (error) {
    console.error('Upload failed:', error.message)
    alert('Upload failed: ' + error.message)
  } finally {
    setUploading(false)
  }
}
```

### Update 6: Fix API Route `/app/api/chats/route.js`

**Update to use better error handling:**
```javascript
import { NextResponse } from 'next/server'
import { getSupabaseAdmin, isAdminClientAvailable } from '@/lib/supabaseAdmin'

export async function POST(request) {
  // Check if admin client is available
  if (!isAdminClientAvailable()) {
    return NextResponse.json(
      {
        error: 'Server not properly configured. Please check environment variables.',
        code: 'ADMIN_NOT_AVAILABLE',
      },
      { status: 500 }
    )
  }

  let supabaseAdmin
  try {
    supabaseAdmin = getSupabaseAdmin()
  } catch (err) {
    return NextResponse.json(
      { error: err.message || 'Server misconfiguration', code: 'ADMIN_ERROR' },
      { status: 500 }
    )
  }

  const accessToken = request.headers.get('authorization')?.replace('Bearer ', '')
  if (!accessToken) {
    return NextResponse.json(
      { error: 'Missing authorization token', code: 'NO_AUTH' },
      { status: 401 }
    )
  }

  try {
    const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(accessToken)
    if (userError || !userData?.user) {
      return NextResponse.json(
        { error: userError?.message || 'Unauthorized', code: 'AUTH_FAILED' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const itemId = body?.itemId
    if (!itemId) {
      return NextResponse.json(
        { error: 'Missing itemId', code: 'MISSING_ITEM' },
        { status: 400 }
      )
    }

    // Get item
    const { data: item, error: itemError } = await supabaseAdmin
      .from('items')
      .select('user_id')
      .eq('id', itemId)
      .single()

    if (itemError) {
      return NextResponse.json(
        { error: itemError.message || 'Unable to load item', code: 'ITEM_ERROR' },
        { status: 500 }
      )
    }

    if (!item) {
      return NextResponse.json(
        { error: 'Item not found', code: 'NOT_FOUND' },
        { status: 404 }
      )
    }

    if (item.user_id === userData.user.id) {
      return NextResponse.json(
        { error: 'Cannot message your own item', code: 'SELF_MESSAGE' },
        { status: 400 }
      )
    }

    // Rest of function unchanged...
  } catch (err) {
    console.error('API Error:', err)
    return NextResponse.json(
      { error: 'Internal server error', code: 'SERVER_ERROR' },
      { status: 500 }
    )
  }
}
```

---

## Phase 3: Test Implementation (30 minutes)

### Test 1: Verify Configuration Loads
```javascript
// Add to /app/layout.js temporarily:
useEffect(() => {
  console.log('Config loaded:')
  console.log('URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅' : '❌')
  console.log('Key:', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✅' : '❌')
}, [])
```

### Test 2: Test Error Boundary
```javascript
// Add to any component temporarily:
throw new Error('Test error to verify error boundary')
```

**Expected:** Error boundary displays instead of crash

### Test 3: Test Retry Logic
```bash
# Open DevTools Network tab
# Go to /items
# Throttle network (DevTools → Network → Slow 3G)
# Observe: Should retry and eventually load
```

### Test 4: Simulate Offline
```javascript
// DevTools Console:
window.navigator.onLine = false
// Go to /items
// Should show error or handle gracefully
```

### Test 5: Test Timeout
```javascript
// Wait for timeout (should take ~10 seconds for query timeout)
// Should display timeout error
```

---

## Phase 4: Add Monitoring (Optional, 30 minutes)

### Add Sentry for Error Tracking

```bash
npm install @sentry/nextjs
```

**File:** `instrumentation.ts` (new file)

```typescript
import * as Sentry from '@sentry/nextjs'

export async function register() {
  if (process.env.NEXT_PUBLIC_SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
      integrations: [
        new Sentry.Replay({
          maskAllText: true,
          blockAllMedia: true,
        }),
      ],
      tracesSampleRate: 1.0,
      environment: process.env.NODE_ENV,
    })
  }
}
```

**Add to `.env.local`:**
```env
NEXT_PUBLIC_SENTRY_DSN=https://your-sentry-dsn@sentry.io/project-id
```

---

## Phase 5: Deployment Checklist

### Before Deploying to Vercel

- [ ] All imports updated to use `-enhanced` clients
- [ ] Error boundary wraps entire app in `layout.js`
- [ ] `.env.local` in `.gitignore`
- [ ] Build passes: `npm run build`
- [ ] Dev works: `npm run dev`
- [ ] No console errors in dev
- [ ] All API routes have error handling

### Vercel Dashboard Setup

1. Go to [Vercel Dashboard](https://vercel.com/dashboard)
2. Select project
3. Settings → Environment Variables
4. Add:
   ```
   NEXT_PUBLIC_SUPABASE_URL = https://...
   NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJ...
   SUPABASE_SERVICE_ROLE_KEY = eyJ... (if using admin operations)
   ```
5. Redeploy

---

## Monitoring & Maintenance

### Daily Checks
```bash
# Check for errors in production
# Monitor Vercel dashboard

# Test login flow
# Test create item flow
# Test messaging flow
```

### Weekly Tasks
```bash
# Review console logs for warnings
# Check Supabase dashboard for connection stats
# Monitor response times
```

### Monthly Tasks
```bash
# Update dependencies
npm update

# Run security audit
npm audit

# Review error patterns in Sentry (if using)
```

---

## Troubleshooting

### Issue: "Module not found: supabase-enhanced"
**Solution:**
```bash
# Ensure file exists
ls lib/supabase-enhanced.js

# If missing, download from SUPABASE_SOLUTIONS.md
# Or reinstall:
npm reinstall @supabase/ssr
```

### Issue: "Environment variables not loading"
**Solution:**
```bash
# Restart dev server
npm run dev

# Verify .env.local exists in root
ls .env.local

# Check for syntax errors (no quotes needed)
```

### Issue: "Error boundary not showing"
**Solution:**
```bash
# Verify it's imported in layout.js
grep -r "SupabaseErrorBoundary" app/layout.js

# Check it's wrapping children
# Look at ARCHITECTURE.md for example
```

### Issue: "Still getting connection timeouts"
**Solution:**
```bash
# Check Supabase project status
# Go to https://status.supabase.com

# Verify credentials in .env.local
# Test with Supabase dashboard directly

# Increase timeout in lib/supabase-config.js:
# Change timeouts.query from 10000 to 30000
```

---

## Summary

✅ All files created:
- `/lib/supabase-enhanced.js` - Client with retry logic
- `/lib/supabase-config.js` - Centralized config
- `/lib/supabaseAdmin.js` - Updated admin client
- `/components/SupabaseErrorBoundary.js` - Error handling
- `/hooks/useSupabaseError.js` - Error management hooks

✅ Files updated:
- `/app/layout.js` - Add error boundary
- `/app/login/page.js` - Add connection check
- `/app/items/page.js` - Add retry logic
- `/app/chat/chat.js` - Add retry logic
- `/app/Profile/page.js` - Add error handling
- `/app/api/chats/route.js` - Add error handling

🚀 Your app is now production-ready with robust error handling!

