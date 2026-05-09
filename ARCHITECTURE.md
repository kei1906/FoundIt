# FoundIt System Architecture
## Comprehensive Technical Reference

---

## 1. SYSTEM ARCHITECTURE OVERVIEW

### 1.1 High-Level Architecture
```
┌──────────────────────────────────────────────────────────────────┐
│                    CLIENT (Next.js 16 App Router)                │
│  React 19 | Tailwind CSS 4 | Framer Motion | Lucide Icons       │
│                                                                  │
│  Pages:  /login  /pending-verification  /Home  /items            │
│          /post   /chat                  /Profile  /admin         │
│                                                                  │
│  Hooks:  useAuthGuard  useAdminGuard                             │
│  Components: NavBar  ItemDetailModal  ItemPostModal              │
│              AdminUsersSection                                    │
└───────────────────────┬──────────────────────────────────────────┘
                        │
          ┌─────────────┼─────────────────┐
          │             │                 │
   ┌──────▼──────┐ ┌───▼─────────┐ ┌─────▼──────────┐
   │  Supabase   │ │  API Routes │ │  Supabase      │
   │  Auth       │ │  /api/...   │ │  Realtime      │
   │  (JWT)      │ │  (Server)   │ │  (WebSocket)   │
   └──────┬──────┘ └───┬─────────┘ └─────┬──────────┘
          │            │                  │
   ┌──────▼────────────▼──────────────────▼──────────┐
   │              SUPABASE BACKEND                    │
   │  PostgreSQL 17 | Row-Level Security | Triggers   │
   │  Storage Buckets: items, avatars, verifications  │
   └──────────────────────────────────────────────────┘
```

### 1.2 Tech Stack
| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Frontend Framework | Next.js | 16.2.4 | App Router, SSR, API Routes |
| UI Library | React | 19.2.4 | Component rendering, hooks |
| Styling | Tailwind CSS | 4.x | Utility-first responsive CSS |
| Animations | Framer Motion | 12.38.0 | Transitions, glassmorphism |
| Icons | Lucide React | 1.14.0 | SVG icon library |
| Image Cropping | react-easy-crop | 5.5.7 | Client-side crop before upload |
| BaaS | Supabase | 2.105.1 | Auth, DB, Storage, Realtime |
| SSR Auth | @supabase/ssr | 0.10.2 | Server-side session handling |
| Email Validation | Nodemailer | 8.0.7 | MX record verification |
| Database | PostgreSQL 17 | via Supabase | Relational data, RLS, triggers |

### 1.3 Design Language
- **Theme**: iOS-inspired dark glassmorphism
- **Colors**: Dark background (#0a0a0a), orange accent palette (#F97316 → #FB923C)
- **Corners**: Rounded (2xl–3xl / 1rem–1.5rem)
- **Glass**: `bg-black/40 backdrop-blur-2xl border border-orange-500/20`
- **Typography**: System font stack (SF Pro / Inter via Tailwind default)

---

## 2. SOFTWARE DESIGN PRINCIPLES

### 2.1 Modularization
The codebase is organized into purpose-driven directories:

| Directory | Responsibility |
|---|---|
| `app/` | Page routes and layouts (Next.js App Router convention) |
| `app/api/` | Server-side API route handlers (admin ops, chat creation) |
| `components/` | Reusable UI components shared across pages |
| `hooks/` | Custom React hooks for cross-cutting concerns (auth, admin) |
| `lib/` | Supabase client initialization and configuration |
| `utils/` | Pure helper functions (image cropping, formatting) |
| `public/` | Static assets (logo, favicon) |

### 2.2 High Cohesion
Each module performs a single, well-defined function:
- `useAuthGuard.js` — ONLY checks auth session + verification status
- `useAdminGuard.js` — ONLY extends auth guard with admin role check
- `NavBar.js` — ONLY renders navigation + unread badge
- `ItemDetailModal.js` — ONLY displays item details + owner actions
- `ItemPostModal.js` — ONLY handles image source selection (camera/gallery)
- `AdminUsersSection.js` — ONLY manages user verification in the admin panel

### 2.3 Low Coupling
- Pages access the database exclusively through `lib/supabase.js` (client) or `lib/supabaseAdmin.js` (server) — never direct SQL from components
- Admin-privileged operations route through `/api/admin/` endpoints, keeping the service-role key server-side
- Components communicate via props and callbacks, not shared global mutable state
- The `useAuthGuard` → `useAdminGuard` chain uses composition, not inheritance

---

## 3. PAGE-BY-PAGE ARCHITECTURE

### 3.1 Login Page — `/app/login/page.js`

**What it does:** Handles both Sign Up and Sign In for all users. This is the entry point for unauthenticated visitors.

**Sign Up Flow:**
1. User provides full name, student number (0000-0000 format), email, and password
2. User uploads a verification document (COR or Student ID) — JPEG, PNG, or PDF up to 5 MB
3. The email is validated via the `/api/validate-email` endpoint (MX record check)
4. `supabase.auth.signUp()` creates the auth.users record
5. A PostgreSQL trigger (`handle_new_user`) auto-creates a `profiles` row
6. The verification document is uploaded to Supabase Storage via `/api/upload-verification`
7. The profile's `verification_status` is set to `'pending'`
8. User is redirected — `useAuthGuard` will send them to `/pending-verification`

**Sign In Flow:**
1. User enters student number OR email + password
2. If student number is provided, the system looks up the corresponding email from `profiles`
3. `supabase.auth.signInWithPassword()` authenticates the user
4. On success, redirected to `/Home` (if verified) or `/pending-verification` (if not)

**Design:** Tabbed form (Sign In / Sign Up) with glassmorphic card, orange gradient submit button, FoundIt logo at top.

---

### 3.2 Pending Verification Page — `/app/pending-verification/page.js`

**What it does:** A holding page for users whose `verification_status` is not `'approved'`. Users cannot access any other page until an admin approves their identity document.

**Two states displayed:**
- **Pending** (yellow): "Your verification is under review" — user waits
- **Rejected** (red): Shows the rejection reason from the admin + allows document re-upload

**Re-upload flow:** User selects a new file → uploads via `/api/upload-verification` → status resets to `'pending'`

**Design:** Centered card with status icon (Clock or XCircle), status badge, and action buttons (Refresh / Log Out). Dark gradient background.

---

### 3.3 Home Page — `/app/Home/page.js`

**What it does:** The landing hub for verified users. Provides quick access to search, category browsing, and a recently reported items feed.

**Key sections:**
1. **Header**: FoundIt logo + greeting ("Welcome back") + subtitle
2. **Search Bar**: Real-time search input that navigates to `/items?search={query}` on submit
3. **Category Chips**: Horizontally scrollable, draggable chip row (Electronics, Keys, Bags, Documents, Clothing, Accessories, Others). Clicking navigates to `/items?itemCategory={type}`
4. **Recently Reported Feed**: Horizontal scroll of the 6 most recently approved items (fetched with `moderation_status = 'approved'`, ordered by `created_at DESC`). Each card shows the item image, title (with marquee animation for long text), and category badge
5. **Info Modal**: An (i) button opens a modal explaining how the system works for new users

**Protected by:** `useAuthGuard` — redirects to `/login` if no session, or `/pending-verification` if unverified

**Design:** Full-height dark background with glassmorphic elements, orange accents, Framer Motion entrance animations.

---

### 3.4 Items Page — `/app/items/page.js`

**What it does:** The main browse/discovery interface. Displays all approved (moderated) found and lost items with powerful filtering and dual view modes.

**Features:**
- **Tabs**: "Found" and "Lost" toggle between `category = 'Found'` and `category = 'Lost'`
- **View Modes**: Grid (card-based) and List (compact rows), preference saved to `localStorage`
- **Filters** (applied simultaneously):
  - Item Category: Electronics, Keys, Bags, Documents, Clothing, Accessories, Others
  - Location: Shed, Activity Center, ER Bldg, ENB Bldg, Covered Court, Canteen, and more
  - Status: Unclaimed / Claimed (maps to Active / Resolved in DB)
  - Date Range: Start and end date pickers
- **Search**: Text search on title and description
- **My Posts**: Toggle to show only items posted by the current user
- **Item Click**: Opens `ItemDetailModal` with full details

**Data query:** Fetches from `items` table where `moderation_status = 'approved'`, filtered by the active tab's category, with optional filters applied via Supabase query builder.

**Design:** Filter chips with horizontal drag-scroll, grid cards with glassmorphic backgrounds, orange category badges, location tags, and time-since labels.

---

### 3.5 Post Page — `/app/post/page.js`

**What it does:** Multi-step form for reporting a found or lost item.

**Flow:**
1. User arrives with a pre-selected image (passed via `ItemPostModal` from any page's "+" button)
2. Image is displayed with a crop tool (`react-easy-crop`) — user can adjust the crop area
3. User fills in: Title, Description, Category (Found/Lost dropdown), Item Category (type), Location Tag (campus area dropdown)
4. On submit:
   - Image is cropped on the client side using canvas
   - Cropped image is uploaded to Supabase Storage bucket `items`
   - A new row is inserted into `items` with `moderation_status = 'pending'` and `status = 'Active'`
   - A success toast appears and user is redirected to `/items`

**The post does NOT appear publicly until an admin approves it** from the Admin Dashboard.

**Design:** Full-screen form with image preview at top, glassmorphic form fields, orange gradient submit button.

---

### 3.6 Chat Page — `/app/chat/chat.js`

**What it does:** Real-time private messaging between item posters and interested users. Manages both the conversation list and individual chat threads.

**Dual-view architecture:**
- **Conversation List**: Shows all chats where the user is either `finder_id` or `claimer_id`. Each row shows the other user's avatar, name, item title, and last message preview (with "You:" prefix for own messages)
- **Active Chat**: Full message thread with real-time delivery

**Real-time implementation:**
- Uses Supabase Realtime `postgres_changes` channel on the `messages` table
- Messages from the sender appear immediately (optimistic rendering with deduplication by `nonce`)
- Messages from the other party appear via the realtime subscription
- Chat status changes (resolution confirmations) also trigger UI updates

**Resolution flow:**
- Either user can tap "Mark as Resolved" (or "Mark as Found" for lost items)
- This updates `finder_confirmed_resolved` or `claimer_confirmed_resolved` in the `chats` table
- A PostgreSQL trigger (`trg_auto_resolve_item`) fires on each update — when BOTH flags are true, it automatically sets `items.status = 'Resolved'` and `chats.status = 'resolved'`
- A confirmation banner appears and messaging is disabled

**Chat deletion:** The item poster (finder) can delete a conversation, which cascades to delete all messages in that chat.

**Design:** iOS-style message bubbles (orange for self, dark for other), glassmorphic conversation list cards, resolution confirmation bar at top of chat.

---

### 3.7 Profile Page — `/app/Profile/page.js`

**What it does:** Displays the user's identity and provides account management actions.

**Displayed info:** Full name, student number, email, avatar photo

**Actions available:**
- **Upload Avatar**: Select image → upload to Supabase Storage bucket `avatars` → update `profiles.avatar_url`
- **Change Password**: Opens a form to update the auth password via `supabase.auth.updateUser()`
- **Delete Account**: Calls `/api/admin/delete-user` with the user's own ID — removes auth.users entry (cascades to profile)
- **Log Out**: `supabase.auth.signOut()` → redirect to `/login`
- **Admin Dashboard** (admin users only): Button visible when `profiles.role === 'admin'`, links to `/admin`

**Design:** Centered profile card with large avatar, glassmorphic info fields, action buttons with red delete styling.

---

### 3.8 Admin Dashboard — `/app/admin/page.js`

**What it does:** Desktop-optimized moderation panel for admin users. Provides full control over item moderation and user account management.

**Protected by:** `useAdminGuard` — checks both authentication AND admin role via `/api/admin/verify`. Non-admins are redirected to `/Home`.

**Two sections (tabbed):**

#### Posts Management
- **Stat Cards**: Live counts of Pending, Approved, Rejected, and Total items
- **Filters**: Category (Found/Lost), Resolution Status, Item Category, Location, Date Range, Search
- **Item Grid**: All items (including pending/rejected) displayed as cards with status badges
- **Per-item actions**: Approve, Reject (with reason modal), Delete
- **Batch actions**: Select multiple → Approve All, Reject All, Delete All
- **Re-approval**: Previously rejected items can be re-approved; approved items can be revoked

#### Users Management (`AdminUsersSection.js`)
- **User List**: All registered users with their verification status
- **Actions**: Approve verification, Reject verification (with reason), Delete user account
- **Verification doc preview**: Admin can view the uploaded COR/Student ID before deciding
- **Search**: Filter users by name or student number

**All admin mutations** go through server-side API routes (`/api/admin/`) that use the `SUPABASE_SERVICE_ROLE_KEY` — the anon key's RLS policies prevent these operations from the client.

**Design:** Desktop-optimized grid layout with sidebar filters, stat dashboard at top, glassmorphic cards throughout.

---

## 4. REUSABLE COMPONENTS

### 4.1 NavBar — `/components/NavBar.js`
**Purpose:** Bottom navigation bar visible on all authenticated pages (mobile-first).

**Five navigation items:**
| Icon | Label | Route | Notes |
|---|---|---|---|
| Search | Explore | /Home | |
| Tag | Items | /items | |
| Plus | Post | — | Opens `ItemPostModal`, doesn't navigate |
| MessageSquare | Chat | /chat | Shows unread badge (red dot) |
| User | Profile | /Profile | |

**Unread badge:** Queries `messages` table for `is_read = false AND receiver_id = current_user` — displays a red dot on the Chat icon if unread > 0.

**Design:** Fixed bottom bar with glassmorphism (`bg-black/50 backdrop-blur-2xl`), orange accent for active state, elevated "+" button in the center.

### 4.2 ItemDetailModal — `/components/ItemDetailModal.js`
**Purpose:** Full-screen overlay showing complete item details when any item card is tapped.

**Displays:** Item image (with lightbox zoom on tap), title, description, location tag, status badge, category badge, poster's avatar + name + email, and post date.

**Actions:**
- **"Contact Owner"** — creates or retrieves a chat via `/api/chats` and navigates to the conversation
- **"Delete" (owner only)** — deletes the item + cascading chats/messages
- Self-messaging is prevented (button hidden for own items)

**Loading state:** Shows a skeleton loader while fetching the poster's profile data to prevent stale data from previous items.

### 4.3 ItemPostModal — `/components/ItemPostModal.js`
**Purpose:** Popup that appears when the "+" button is tapped. Offers two image source options.

**Options:**
- 📷 Camera — triggers `<input capture="environment">` for mobile camera
- 🖼️ Gallery — triggers standard file picker

**After selection:** The file is passed to the parent via `onFileSelect(file)`, which navigates to `/post` with the image data.

### 4.4 AdminUsersSection — `/components/AdminUsersSection.js`
**Purpose:** The "Users" tab content within the Admin Dashboard.

**Displays:** All profiles with their verification status (pending/approved/rejected), verification document preview link, and action buttons.

**Actions:** Approve, Reject (with reason input), Delete Account — all via server-side admin API routes.

---

## 5. HOOKS

### 5.1 useAuthGuard — `/hooks/useAuthGuard.js`
**Purpose:** Protects all authenticated routes. Used by every page except `/login` and `/pending-verification`.

**Logic:**
1. Checks `supabase.auth.getSession()` — if no session → redirect to `/login`
2. Fetches `profiles.verification_status` — if not `'approved'` → redirect to `/pending-verification`
3. Listens for `onAuthStateChange` — reacts to logout in other tabs
4. Returns `{ user, authLoading }`

### 5.2 useAdminGuard — `/hooks/useAdminGuard.js`
**Purpose:** Extends `useAuthGuard` with admin role verification. Used only by `/admin`.

**Logic:**
1. Calls `useAuthGuard()` internally — gets auth + verification check for free
2. Calls `/api/admin/verify` — server-side check that `profiles.role === 'admin'`
3. If not admin → redirect to `/Home`
4. Returns `{ user, isAdmin, guardLoading }`

**Composition pattern:** `useAdminGuard` composes `useAuthGuard` rather than duplicating its logic — a clear example of low coupling and code reuse.

---

## 6. API ROUTES

### 6.1 POST /api/chats — Chat Creation
**Purpose:** Creates a new chat or returns an existing one for a given item + user pair.
- Authenticates via Bearer token
- Prevents self-messaging (finder cannot message themselves)
- Deduplicates: checks for existing chat before creating
- Returns `{ chatId }` — client navigates to `/chat?id={chatId}`

### 6.2 GET /api/admin/verify — Admin Role Check
**Purpose:** Server-side verification that the requesting user has `role = 'admin'` in their profile.
- Uses service role key to bypass RLS
- Returns `{ isAdmin: true/false }`

### 6.3 POST /api/admin/delete-user — User Deletion
**Purpose:** Permanently deletes a user's auth.users record (cascading to profiles).
- Requires admin authentication
- Uses `supabase.auth.admin.deleteUser()` via service role

### 6.4 POST /api/upload-verification — Document Upload
**Purpose:** Uploads a COR/Student ID to Supabase Storage and updates the profile.
- Accepts multipart form data with file
- Uploads to `verifications/{userId}/{filename}`
- Updates `profiles.verification_doc_url` and sets status to `'pending'`

### 6.5 POST /api/validate-email — Email MX Validation
**Purpose:** Checks that the provided email domain has valid MX records (is a real email domain).
- Uses Nodemailer's `dns.resolveMx()` under the hood
- Returns `{ valid: true/false }`

---

## 7. DATABASE SCHEMA

### 7.1 profiles
```sql
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  student_number TEXT UNIQUE,
  email TEXT,
  avatar_url TEXT,
  role TEXT DEFAULT 'user',
  verification_status TEXT DEFAULT 'pending',
  verification_doc_url TEXT,
  verification_rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 7.2 items
```sql
CREATE TABLE public.items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id),
  category TEXT,
  item_category TEXT,
  title TEXT NOT NULL,
  description TEXT,
  location_tag TEXT,
  image_url TEXT,
  status TEXT DEFAULT 'Active',
  moderation_status TEXT DEFAULT 'pending',
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 7.3 chats
```sql
CREATE TABLE public.chats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES items(id),
  finder_id UUID REFERENCES profiles(id),
  claimer_id UUID REFERENCES profiles(id),
  status TEXT DEFAULT 'open',
  finder_confirmed_resolved BOOLEAN DEFAULT FALSE,
  claimer_confirmed_resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 7.4 messages
```sql
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id UUID REFERENCES chats(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES profiles(id),
  receiver_id UUID REFERENCES profiles(id),
  item_id UUID,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 7.5 Database Triggers
```sql
-- Auto-create profile on new auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, student_number, email)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name',
          NEW.raw_user_meta_data->>'student_number',
          NEW.email);
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

-- Auto-resolve item when both chat parties confirm
CREATE OR REPLACE FUNCTION public.auto_resolve_item_on_chat_update()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.finder_confirmed_resolved = TRUE
     AND NEW.claimer_confirmed_resolved = TRUE THEN
    UPDATE public.items SET status = 'Resolved'
    WHERE id = NEW.item_id;
    NEW.status := 'resolved';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
```

---

## 8. SECURITY

### 8.1 Row-Level Security (RLS)
All tables have RLS enabled. Key policies:
- **profiles**: All authenticated users can read. Only the profile owner can update.
- **items**: All authenticated users can read approved items. Only the owner can update/delete.
- **chats**: Only participants (finder_id or claimer_id) can read their chats.
- **messages**: Only the sender or receiver can read messages.

### 8.2 Server-Side Admin Operations
Admin mutations (user deletion, role verification) use the `SUPABASE_SERVICE_ROLE_KEY` — this key bypasses RLS and is NEVER exposed to the client. It is only used in `/api/admin/` route handlers.

### 8.3 Environment Variables
```env
# Client-safe (NEXT_PUBLIC_ prefix)
NEXT_PUBLIC_SUPABASE_URL=https://xtqwneuwytxrlepuiyjj.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...

# Server-only (no NEXT_PUBLIC_ prefix)
SUPABASE_SERVICE_ROLE_KEY=eyJ...
```

---

## 9. DIRECTORY STRUCTURE
```
found-it/
├── app/
│   ├── layout.js              # Root layout
│   ├── page.js                # Root redirect → /login
│   ├── login/page.js          # Auth (Sign In / Sign Up)
│   ├── pending-verification/page.js  # Verification gate
│   ├── Home/page.js           # Landing hub
│   ├── items/page.js          # Browse & filter items
│   ├── post/page.js           # Post new item
│   ├── chat/chat.js           # Real-time messaging
│   ├── Profile/page.js        # User profile
│   ├── admin/page.js          # Admin dashboard
│   └── api/
│       ├── chats/route.js     # Chat creation
│       ├── validate-email/route.js  # MX validation
│       ├── upload-verification/route.js  # Doc upload
│       └── admin/
│           ├── verify/route.js     # Admin role check
│           └── delete-user/route.js # User deletion
├── components/
│   ├── NavBar.js              # Bottom navigation
│   ├── ItemDetailModal.js     # Item detail overlay
│   ├── ItemPostModal.js       # Image source picker
│   └── AdminUsersSection.js   # Admin user management
├── hooks/
│   ├── useAuthGuard.js        # Route protection
│   └── useAdminGuard.js       # Admin route protection
├── lib/
│   ├── supabase.js            # Client-side Supabase
│   └── supabaseAdmin.js       # Server-side Supabase
├── utils/
│   └── cropImage.js           # Canvas-based image crop
└── public/
    ├── logo.png               # FoundIt logo
    └── favicon.ico
```

---

## 10. KNOWN LIMITATIONS & FUTURE ROADMAP

### Current Limitations
1. Admin Dashboard not fully optimized for mobile screens
2. Chat supports text only (no image sharing)
3. No push notifications — users must open the app
4. No profanity filter in chat messages
5. No user reporting / ban system
6. No pagination on large item lists
7. No automated email notifications

### Planned Enhancements (Priority 3.5)
1. **User Reporting & Ban System**: Report users for inappropriate chat behavior; admin reviews with chat context; temporary bans with appeal flow
2. **In-Chat Image Sharing**: Photo uploads in chat via Supabase Storage with client-side compression
3. **Profanity Filter**: JSON word-list-based real-time content blocking with user warnings
4. **Dynamic Home Greetings**: Context-aware greetings based on time of day
5. **Admin Mobile Optimization**: Responsive admin dashboard layout

---

## End of Architecture Document
