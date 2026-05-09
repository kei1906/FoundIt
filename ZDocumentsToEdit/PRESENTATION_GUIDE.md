# FoundIt — Presentation & Brochure Guide

> This document provides a step-by-step plan for your **5–10 minute presentation** (PowerPoint or Canva) and a layout guide for the **brochure** required for submission.

---

## PART 1 — PRESENTATION SLIDE FLOW (PowerPoint / Canva)

**Recommended total: 12–15 slides | Time: 5–10 minutes**

### Slide 1 — Title Slide
- **FoundIt**: LSPU Lost and Found Web Application
- Subtitle: *A Software Design (CpE 8) Final Project*
- Group members' names, BSCpE 2-A
- Instructor: PRINCESS PLEBISCITE B. TOPE
- Date: May 2025
- **Design tip**: Use the FoundIt logo, dark background (#0a0a0a), orange accent (#F97316)

### Slide 2 — The Problem (30 seconds)
- Title: *"The Problem"*
- 2–3 bullet points:
  - Students lose items on campus with no formal way to report or recover them
  - Current methods (group chats, paper notices) are fragmented and unreliable
  - No centralized tracking means most lost items are never returned
- **Design tip**: Use a sad/frustrated emoji or icon. Keep text minimal.

### Slide 3 — Our Solution (30 seconds)
- Title: *"FoundIt — Our Solution"*
- One-liner: *"A mobile-first, real-time lost and found platform for LSPU students"*
- 3 key features as icons:
  - 📸 Report Found/Lost items with photos
  - 💬 Chat directly with the item poster
  - 🛡️ Admin-moderated for quality and safety
- **Design tip**: Show the FoundIt logo prominently

### Slide 4 — Objectives (30 seconds)
- Title: *"Project Objectives"*
- List the 5 objectives from Section I.b of the report
- **Design tip**: Numbered list with checkmarks ✅

### Slide 5 — Tech Stack (30 seconds)
- Title: *"Technology Stack"*
- Visual layout (icons + labels):
  - Next.js 16 + React 19 (Frontend)
  - Tailwind CSS + Framer Motion (Styling & Animation)
  - Supabase (Auth + Database + Storage + Realtime)
  - PostgreSQL (Database with RLS & Triggers)
- Mention: *"All free/open-source tools — zero cost"*
- **Design tip**: Use tech logos arranged in a horizontal strip

### Slide 6 — System Architecture (45 seconds)
- Title: *"How It Works — Architecture"*
- Show a simplified diagram:
  - Frontend (Next.js) → Supabase Auth + PostgreSQL + Storage
  - Real-time subscriptions for chat
  - API routes for admin operations
- Mention: **Modularization, High Cohesion, Low Coupling**
- **Design tip**: Use a simple 3-layer diagram (Client → API → Database)

### Slide 7 — Flowchart (45 seconds)
- Title: *"System Flowchart"*
- Embed the exported flowchart image (from FLOWCHART_AND_UML.md)
- Walk through the flow verbally:
  - User visits → Auth → Verification → Home → Post/Browse → Chat → Resolve
- **Key talking point**: "Both users must confirm resolution — a DB trigger handles this automatically"

### Slide 8 — Key Features Demo: User Side (1–2 minutes)
- Title: *"Live Demo — Student Experience"*
- Screenshots or live demo of:
  1. Login / Sign Up (with document upload)
  2. Home page (greeting, search, category chips, recent feed)
  3. Items page (grid view, filters)
  4. Item Detail Modal → Contact Owner
  5. Chat with real-time messaging
  6. Mark as Resolved flow
- **Design tip**: If using slides, arrange 2–3 screenshots per slide with captions

### Slide 9 — Key Features Demo: Admin Side (1 minute)
- Title: *"Live Demo — Admin Dashboard"*
- Screenshots or live demo of:
  1. Admin dashboard with stat cards
  2. Post moderation (Approve/Reject)
  3. User verification management
  4. Batch actions
- **Talking point**: "Admin moderation ensures only appropriate, verified content is visible"

### Slide 10 — Software Design Principles (45 seconds)
- Title: *"Design Principles Applied"*
- Three columns:
  - **Modularization**: Code split into `app/`, `components/`, `hooks/`, `lib/`, `utils/`, `api/`
  - **High Cohesion**: Each module has a single responsibility (e.g., `useAuthGuard` only does auth)
  - **Low Coupling**: Pages use Supabase client abstraction, admin logic is server-side only
- **This slide is important for your professor** — emphasize these software design concepts

### Slide 11 — Limitations (30 seconds)
- Title: *"Current Limitations"*
- Quick bullet list (pick top 4):
  - Text-only chat (no image sharing yet)
  - No push notifications
  - No profanity filter in chat
  - Admin dashboard not fully mobile-optimized
- Frame as: *"We're aware of these and have plans to address them"*

### Slide 12 — Future Enhancements (30 seconds)
- Title: *"Future Roadmap"*
- Visual roadmap or numbered list:
  1. User reporting & ban system
  2. In-chat image sharing
  3. AI-powered content moderation
  4. Push notifications
  5. Multi-campus support
- **Design tip**: Use a timeline or roadmap visual

### Slide 13 — UML Class Diagram (30 seconds, optional)
- Title: *"Database Design — UML Class Diagram"*
- Embed the exported UML diagram
- Briefly mention: *"6 core entities with PostgreSQL triggers for automation"*

### Slide 14 — Thank You / Q&A
- Title: *"Thank You!"*
- Team names
- *"Questions?"*
- Include the live URL or QR code if deployed

---

## PART 2 — BROCHURE LAYOUT GUIDE

> Per the instructions, the brochure covers Sections 1–4, 6–7 (Section 5 — System Development is NOT in the brochure).

### Recommended Format: **Tri-fold brochure** (6 panels)

```
OUTSIDE (when folded, reader sees these 3 panels):

┌─────────────────┬─────────────────┬─────────────────┐
│   BACK PANEL    │   BACK FLAP     │   FRONT COVER   │
│                 │                 │                 │
│ VII. Future     │ VI. Limitations │  FoundIt Logo   │
│ Enhancements    │ & Assumptions   │  Title          │
│                 │                 │  Tagline        │
│ - Roadmap list  │ - Quick bullet  │  Team Names     │
│ - 5 key items   │   list          │  BSCpE 2-A      │
│                 │                 │  May 2025       │
└─────────────────┴─────────────────┴─────────────────┘

INSIDE (when unfolded, reader sees these 3 panels):

┌─────────────────┬─────────────────┬─────────────────┐
│   LEFT PANEL    │  CENTER PANEL   │  RIGHT PANEL    │
│                 │                 │                 │
│ I. Introduction │ II. Functions   │ III. Flowchart  │
│                 │                 │ IV. Screenshots │
│ - Background    │ - User Features │                 │
│   (2 paragraphs)│   table         │ - Flowchart     │
│ - Objectives    │ - Admin Features│   image         │
│   (5 items)     │   table         │ - 3-4 key       │
│ - Significance  │                 │   screenshots   │
│   (3 groups)    │                 │   with captions │
└─────────────────┴─────────────────┴─────────────────┘
```

### Panel Content Details:

#### Front Cover (Outside Right Panel)
- **FoundIt** logo (large, centered)
- Tagline: *"Reuniting Items with Owners"*
- Subtitle: *LSPU Lost and Found Web Application*
- *Software Design (CpE 8) Final Project*
- Team member names
- Instructor name
- Date: May 2025
- **Design**: Dark background, orange accent, clean and premium

#### Panel 1 — Introduction (Inside Left)
- **Brief Background**: 2 concise paragraphs about the problem and the solution
- **Objectives**: Numbered list of 5 objectives
- **Significance**: 3 stakeholder groups (Students, Admins, Institution)
- Keep text small but readable (~9pt in print)

#### Panel 2 — Functionalities (Inside Center)
- **User Features**: Compact table or bullet list (8–10 key features)
- **Admin Features**: Compact table or bullet list (5–6 key features)
- Use icons/emojis for visual appeal: 📸 🔍 💬 ✅ 🛡️

#### Panel 3 — Flowchart & Screenshots (Inside Right)
- **Flowchart**: Embed the flowchart image (scaled to fit)
- **Screenshots**: 3–4 key screenshots (Login, Home, Items, Chat) arranged in a 2x2 grid with small captions
- This is the most visual panel — let the images speak

#### Panel 4 — Limitations (Outside Center Flap)
- Compact bullet list of 5–6 limitations
- Title: *"Current Limitations & Assumptions"*

#### Panel 5 — Future Enhancements (Outside Left / Back)
- Numbered roadmap list of 5–7 planned improvements
- Title: *"Future Roadmap"*
- Optional: include QR code linking to the live app

---

## PART 3 — DESIGN TIPS FOR CANVA

### Color Palette (match the app's design)
| Color | Hex | Usage |
|---|---|---|
| Background | `#0A0A0A` | Primary background |
| Surface | `#1A1A1A` | Card backgrounds |
| Primary | `#F97316` | Orange accent (headings, buttons, highlights) |
| Primary Light | `#FB923C` | Secondary orange |
| Text Primary | `#FFFFFF` | Main text |
| Text Secondary | `#FFFFFF80` | Muted text (50% opacity) |
| Success | `#22C55E` | Approved / Active states |
| Error | `#EF4444` | Rejected / Error states |
| Warning | `#EAB308` | Pending states |

### Typography
- **Headings**: Inter Black or SF Pro Display Bold
- **Body**: Inter Regular or SF Pro Text
- **Monospace**: JetBrains Mono (for student numbers, code references)

### Canva Templates to Search For
- Search: "Dark tech presentation" or "Dark startup pitch deck"
- Search: "Dark tri-fold brochure template"
- Apply the orange color palette above to customize

---

## PART 4 — PRESENTATION TIPS

1. **Start with the problem, not the tech** — your professor cares about *why* you built this
2. **Show the live demo** if possible — even 60 seconds of a real demo is more impactful than 10 slides of screenshots
3. **Say the magic words**: Explicitly mention "modularization," "high cohesion," and "low coupling" during the architecture slide — these are Software Design course terms
4. **Time yourselves** — practice to stay within 5–10 minutes
5. **Split the presentation**: Each team member should present their area of contribution
6. **End with future vision** — showing you thought beyond the assignment impresses professors

---

*Good luck with the presentation! 🎯*
