# 🗂️ RECENT FEED — Home Page Feature Plan
> **Status:** READY TO IMPLEMENT — use this file as the full prompt when you tell the agent "implement the Recent Feed"

---

## 🎯 Goal
Replace the current minimal Home page (`app/Home/page.js`) with a richer version that adds a **"Recently Reported" horizontal scroll feed** while preserving all existing functionality (logo, search bar, info modal, NavBar, ItemPostModal).

---

## 📋 Full Agent Prompt (copy-paste this when ready)

```
You are implementing the "Recent Feed" feature on the FoundIt Home page.

CONTEXT:
- Project: Next.js app at app/Home/page.js
- Styling: Tailwind CSS (already configured)
- Design language: iOS-feel, glassmorphism, dark mode, orange (#f97316) / black (#0a0a0a) palette
- Fonts: already imported via globals — use font-sans (Inter)
- All existing features must be preserved:
  • Logo image (/logo.png) centered at top
  • "FoundIt" h1 gradient title
  • Tagline "Reuniting items with owners"
  • Search bar (navigates to /items?search=... on Enter or button click)
  • Info (i) button top-right → existing showInfoModal + INFO_SECTIONS
  • <ItemPostModal> + <NavBar activePage="home">

TASK — Add a "Recently Reported" section:

1. MOCK DATA
   Add a const MOCK_ITEMS array (6 items, before the component):
   [
     { id: 1, name: "Key Ring", status: "Just Found", location: "Library"         },
     { id: 2, name: "iPhone 13",  status: "Awaiting Owner", location: "Cafeteria"       },
     { id: 3, name: "Blue Wallet",status: "Just Found", location: "Gym"              },
     { id: 4, name: "AirPods",    status: "Awaiting Owner", location: "Room 204"         },
     { id: 5, name: "Notebook",   status: "Just Found", location: "Quad"             },
     { id: 6, name: "Umbrella",   status: "Awaiting Owner",  location: "Main Gate"       },
   ]

2. SECTION LAYOUT
   - Place it BELOW the search bar, ABOVE the NavBar
   - Section heading: "Recently Reported" — small, uppercase, tracking-widest, orange-tinted
   - Full-width horizontal scroll container: overflow-x-auto, flex, gap-4, px-6, pb-4
   - Hide scrollbar (scrollbar-hide utility or inline CSS: scrollbarWidth:'none')
   - NO left/right hard margins that cut off cards — use scroll-snap-x mandatory + scroll-snap-align start

3. CARD DESIGN (glassmorphism)
   Each card must be:
   - Width: w-36 (144px), shrink-0
   - Background: bg-white/[0.05] backdrop-blur-xl
   - Border: border border-white/10 rounded-3xl
   - Padding: p-4
   - Emoji: centered, text-4xl, in a rounded-2xl bg-orange-500/10 p-3 mb-3
   - Item name: font-bold text-sm truncate text-white
   - Location: text-[10px] text-white/40 truncate mb-2
   - Status tag:
       "Just Found"      → bg-green-500/20  text-green-400  border-green-500/30
       "Awaiting Owner"  → bg-orange-500/20 text-orange-400 border-orange-500/30
     Tag style: inline-flex items-center px-2 py-0.5 rounded-full text-[9px] font-black uppercase tracking-widest border
   - Hover: hover:border-orange-500/40 hover:bg-white/[0.08] transition-all duration-200 cursor-pointer
   - Entry animation: use framer-motion — stagger each card with initial={{opacity:0, y:16}} animate={{opacity:1,y:0}} transition={{delay: index*0.07}}
   - onClick: navigate to /items (router.push('/items')) — clicking any card goes to items list

4. LAYOUT STRUCTURE (full page top→bottom)
   [Info button absolute top-right]
   [Logo + Title + Tagline]       ← keep existing
   [Search bar]                   ← keep existing
   [Recently Reported heading + horizontal scroll]  ← NEW
   [NavBar fixed bottom]          ← keep existing

5. CONSTRAINTS
   - Do NOT connect to Supabase — use MOCK_ITEMS only for the feed
   - Do NOT remove or break the Info modal, search navigation, or NavBar
   - Do NOT use any paid libraries
   - Keep the outer div background: bg-gradient-to-br from-[#0a0a0a] via-[#1a1a1a] to-[#7c2d1233]
   - Change the outer div from `flex flex-col items-center justify-center` to `flex flex-col items-center` with `min-h-screen` so the feed has room below the search

6. REAL DATA (future — do NOT implement yet, just leave a comment)
   // TODO: Replace MOCK_ITEMS with a Supabase query:
   // const { data } = await supabase.from('items').select('id,title,status,location').order('created_at',{ascending:false}).limit(10)
   // Map status to tag labels and emojis as needed

FILE TO EDIT: app/Home/page.js
```

---

## 🧩 Key Design Tokens (reference)
| Token | Value |
|---|---|
| Primary orange | `#f97316` / `orange-500` |
| Background | `#0a0a0a` |
| Card bg | `bg-white/[0.05] backdrop-blur-xl` |
| Card border | `border-white/10` |
| Card hover border | `border-orange-500/40` |
| Tag — Found | `bg-green-500/20 text-green-400` |
| Tag — Awaiting | `bg-orange-500/20 text-orange-400` |
| Border radius | `rounded-3xl` (cards), `rounded-full` (tags) |

---

## ✅ Checklist (agent should verify before finishing)
- [ ] MOCK_ITEMS array present with 6 items
- [ ] Horizontal scroll renders without clipping on mobile widths (375px)
- [ ] Cards animate in with stagger
- [ ] Status tags render correct color per status value
- [ ] Search bar still navigates to `/items?search=`
- [ ] Info modal still opens and closes correctly
- [ ] NavBar still shows at bottom with correct `activePage="home"`
- [ ] No Supabase calls added to this component
- [ ] TODO comment left for future real-data wiring

---

## 📍 Files Affected
| File | Change |
|---|---|
| `app/Home/page.js` | Add MOCK_ITEMS, Recently Reported section, adjust outer layout |

> No other files need to change. NavBar, ItemPostModal, useAuthGuard are unchanged.
