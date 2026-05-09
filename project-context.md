## Project Identity
- **Name:** FoundIt (LSPU Lost and Found System)
- **Theme:** Orange iOS UI (Glassmorphism, backdrop-blur-md, rounded-2xl, thin white borders)

## Tech Stack
- **Framework:** Next.js (App Router)
- **Styling:** Tailwind CSS + Lucide React (Icons)
- **Language:** JavaScript
- **Backend/Auth/Storage:** Supabase
- **Database:** PostgreSQL

## Core Database Schema (SQL)
- **profiles:**
    - id (uuid, references auth.users)
    - student_number (text, unique, format: 0000-0000)
    - full_name (text)
    - email (text)
- **items:**
    - id (uuid)
    - user_id (uuid, references profiles.id)
    - category (Lost / Found)
    - title (text)
    - description (text)
    - location_tag (text, e.g., "Engineering Building", "Canteen", "Shed")
    - image_url (text)
    - status (Active / Resolved)
- **messages:**
    - id (uuid)
    - sender_id (uuid)
    - receiver_id (uuid)
    - item_id (uuid)
    - content (text)
    - created_at (timestamp)

## Functional Requirements
1. **Auth:** Users sign up with Personal Email and LSPU Student Number.
2. **Logic:** On Sign-Up, the `auth.user` is created via Supabase Auth, then a record is manually inserted into the `profiles` table to store the Student Number.
3. **UI Layout:**
    - Bottom Navigation Bar: [Lost, Found, Post (+), Messages, Profile]
    - Mobile-first responsive design.
    - iOS-style transitions and glassmorphic cards for item listings.