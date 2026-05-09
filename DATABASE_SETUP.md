# FoundIt - LSPU Lost and Found System

## Database Setup

### Option 1: Full Setup (Recommended for new projects)

If you're setting up from scratch, run the full `setup-profiles.sql`:

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **SQL Editor**
4. Copy and paste the contents of `setup-profiles.sql`
5. Click **Run**

### Option 2: Trigger Only (If you already have profiles table)

If you already have the profiles table and policies set up but need the automatic profile creation, run `setup-trigger-only.sql`:

1. Go to [Supabase Dashboard](https://supabase.com/dashboard)
2. Select your project
3. Go to **SQL Editor**
4. Copy and paste the contents of `setup-trigger-only.sql`
5. Click **Run**

## What Each Option Does:

### Full Setup (`setup-profiles.sql`):
- ✅ Creates the `profiles` table with proper structure
- ✅ Sets up Row Level Security (RLS) policies
- ✅ Creates a trigger that automatically creates profiles when users sign up
- ✅ Enables automatic profile updates

### Trigger Only (`setup-trigger-only.sql`):
- ✅ Adds automatic profile creation trigger (handles existing profiles gracefully)
- ✅ Adds updated_at timestamp handling
- ✅ Safe to run on existing databases

## Testing the Fix:

1. Sign up a new account
2. Upload a profile picture
3. Refresh the page - the data should persist
4. Check that student number and email are visible in the Profile page

## Database Schema:

```sql
-- Profiles table
CREATE TABLE public.profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  student_number TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Items table (from your schema)
CREATE TABLE public.items (
  id UUID PRIMARY KEY,
  user_id UUID,
  category TEXT, -- 'found' or 'lost'
  title TEXT,
  description TEXT,
  location_tag TEXT, -- e.g., "Shed", "Activity Center - Room 101"
  image_url TEXT,
  status TEXT DEFAULT 'unclaimed', -- 'claimed' or 'unclaimed'
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

## Features Added:

- **Category filtering**: Found/Lost items
- **Location filtering**: Predefined campus locations
- **Status management**: Claimed/Unclaimed items
- **My Posts section**: Users can view and manage their own posts
- **Advanced filtering**: Combine category, location, and status filters