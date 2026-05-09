# FoundIt: LSPU Lost and Found Web Application System
A Final Project  
Presented as Partial Fulfillment  
of the Requirements for the subject:  
Software Design (CpE 8)

Submitted by:  
[SURNAME, FIRST NAME M.I.]  
[SURNAME, FIRST NAME M.I.]  
[SURNAME, FIRST NAME M.I.]  
BSCpE 2-A

Submitted to:  
PRINCESS PLEBISCITE B. TOPE  
Instructor  
May 2025

---

## I. INTRODUCTION

### a. Brief Background

Losing personal belongings on a university campus is a common and frustrating experience for students. At Laguna State Polytechnic University (LSPU), students who lose or find items often have no formal, efficient channel to report or search for them. The existing informal methods — posting in group chats, taping paper notices on bulletin boards, or relying on word-of-mouth — are fragmented, inconsistent, and often go unnoticed. This results in unclaimed lost items, wasted time, and unnecessary stress for students who may have lost valuable belongings such as IDs, electronic devices, keys, or school materials.

To address this campus-wide problem, our group developed **FoundIt** — a mobile-first, web-based Lost and Found system tailored for LSPU students. FoundIt provides a centralized, real-time digital platform where students can report found items, post lost item notices, and communicate directly with each other through a built-in private messaging system. The system also features an administrative moderation layer to ensure that all postings are reviewed and verified before going public, preventing spam or inappropriate content.

> **[COMMENT — SUGGESTED ADDITION]:** Consider adding a specific observed scenario here — e.g., "During our observations at the campus, we noted that lost items reported informally are rarely recovered." This makes the background more compelling and grounded in real experience.

### b. Objectives

FoundIt was developed with the following specific objectives:

1. **To design and develop** a mobile-first web application that provides LSPU students with a centralized platform for reporting and searching for lost and found items on campus.
2. **To implement** a secure, role-based authentication and identity verification system that ensures only legitimate LSPU students can access and interact with the platform.
3. **To provide** a real-time private messaging feature that allows the finder and the owner of an item to communicate directly and coordinate item retrieval.
4. **To establish** an administrative moderation layer that reviews, approves, or rejects item postings before they appear publicly, ensuring content quality and appropriateness.
5. **To forecast and document** potential future enhancements of the system that can further improve the lost and found experience within the university.

### c. Significance of the Project

FoundIt provides measurable benefits to multiple stakeholders within the LSPU community:

**Students (Regular Users)** are the primary beneficiaries. They can post photographs of found items with campus location tags, search and filter the items database by category or area, and directly message item posters through the built-in chat to arrange retrieval — all without relying on third-party messaging apps.

**Students (Item Owners)** who have lost belongings can browse the Found items list with powerful filters (category, location, date, status), or post a Lost item report so that finders can reach out proactively.

**System Administrators** gain a dedicated desktop dashboard to moderate all item postings (approve/reject), manage user accounts and verification statuses, and maintain the overall health of the platform.

**The Institution (LSPU)** benefits from an organized, digital process for handling lost and found cases — reflecting the university's commitment to student welfare and digital modernization.

> **[COMMENT — SUGGESTED ADDITION]:** You may also note that this system could be adopted by other LSPU campuses or by other Philippine State Universities as a lightweight, open-source campus utility — this shows scalability awareness.

---

## II. FUNCTIONALITIES

FoundIt provides a comprehensive set of features organized by user role. The system follows a **modular architecture** where each feature is a self-contained unit with **high cohesion** (each module does one thing well) and **low coupling** (modules interact through well-defined interfaces), making the system maintainable and extensible.

### Regular User Features

| Feature | Description |
|---|---|
| **Account Registration** | Students sign up with full name, student number (0000-0000 format), and email. A COR or Student ID is required for identity verification. |
| **Identity Verification** | New accounts enter a pending state until an admin approves their uploaded verification document. |
| **Sign In / Sign Out** | Secure authentication via Supabase Auth using email or student number + password. Sessions persist across reloads. |
| **Change Password** | Authenticated users can update their account password from the Profile page. |
| **Item Posting (Found/Lost)** | Users post found or lost items by selecting/capturing a photo, cropping it, and filling in title, category, item type, and location. All new posts enter a moderation queue. |
| **Browse & Filter Items** | Items page displays all approved items (Found/Lost tabs) with filters by item type, location, status, and date range. Grid and list view modes available with persistent preference saved to localStorage. |
| **Item Search** | Real-time search by title, description, or item category from the Home and Items pages. |
| **Item Detail Modal** | Clicking any item shows full details: image, description, location, poster profile, and action buttons. |
| **Direct Messaging (Chat)** | Users initiate private conversations with item posters. Chat delivers messages in real-time via Supabase Realtime subscriptions. |
| **Item Resolution** | Both the poster and claimer confirm resolution in the chat. When both confirm, a PostgreSQL trigger automatically marks the item as "Resolved/Claimed" and disables further messaging. |
| **Delete Own Posts** | Users can delete items they posted, cascading deletion to related chats and messages. |
| **Profile Management** | Users can view their profile, upload an avatar, change their password, or delete their account. |
| **Recently Reported Feed** | Home page shows a horizontally scrollable feed of the 6 most recently approved items. |
| **Category Quick Search** | Draggable category chips on the Home page navigate directly to filtered item results. |
| **Info Modal** | An (i) button on the Home page opens a modal explaining the system to new users. |

### Admin User Features

| Feature | Description |
|---|---|
| **Admin Dashboard** | Protected admin panel (desktop-optimized) accessible only to users with the admin role. |
| **Post Moderation** | Review all pending item postings with image preview; Approve or Reject each with optional reason. |
| **Batch Actions** | Select multiple posts and approve, reject, or permanently delete them all at once. |
| **Re-Approval / Revocation** | Re-approve previously rejected posts or revoke approval from already-approved posts. |
| **User Verification Management** | Review student verification documents and approve or reject each user's account. |
| **User Account Management** | View all registered users, their statuses, and permanently delete accounts. |
| **Advanced Filtering & Search** | Filter items by category, resolution status, item type, location, and date range, plus full-text search. |
| **Statistics Overview** | Live count cards for pending, approved, rejected, and total items. |

---

## III. FLOWCHART

*(Attach the flowchart image here — see `FLOWCHART_AND_UML.md` in the project for the Mermaid source diagram)*

**Figure 1. FoundIt System Flowchart**

The FoundIt flowchart illustrates the complete lifecycle of a user interaction with the system. The logic begins at the entry point (user visits the app) and branches through authentication, verification, item management, moderation, and resolution.

**Flowchart Logic Explained:**

1. **Entry / Auth Check**: The user visits the app. If no session exists, they are redirected to the Login page. If a session exists but their verification status is not "approved," they are sent to the Pending Verification page.
2. **Registration**: New users fill in their credentials and upload a COR or Student ID. The account is created but gated behind admin verification.
3. **Home & Navigation**: Verified users land on the Home page and navigate freely: browse items, post a report, chat, or manage their profile.
4. **Item Posting Flow**: User taps "+", selects/captures a photo, fills in the form, and submits. The post is saved with `moderation_status = 'pending'` — it is invisible to other users until approved.
5. **Admin Moderation**: The admin reviews the post on the dashboard. If approved, it becomes publicly visible. If rejected, the user sees the rejection reason and can re-submit.
6. **Item Discovery & Contact**: A user finds a relevant item, taps it, and opens the detail modal. They tap "Contact Owner" which creates or retrieves a unique chat between them and the poster.
7. **Resolution**: After item retrieval, both users tap "Mark as Resolved." A database trigger fires when both `finder_confirmed_resolved` and `claimer_confirmed_resolved` are true, updating `items.status = 'Resolved'` and disabling the chat.

---

## IV. SCREENSHOTS

*(You will attach actual screenshots here. The table below provides the label captions for each screen.)*

| Figure | Page / Screen | Purpose | User Role |
|---|---|---|---|
| Figure 2 | Login / Sign Up Page | Authentication and registration with document upload | All Users |
| Figure 3 | Pending Verification Page | Shows verification status; allows document re-upload if rejected | Unverified Users |
| Figure 4 | Home Page | Landing hub: greeting, search, category chips, recent feed | Verified Students |
| Figure 5 | Items Page — Grid View | Browse approved found/lost items with category and location badges | Verified Students |
| Figure 6 | Items Page — Filter Panel | Category, location, status, and date range filter controls | Verified Students |
| Figure 7 | Item Detail Modal | Full item details, poster profile, contact action | Verified Students |
| Figure 8 | Post Report Page | Image crop, category/location selectors, submit form | Verified Students |
| Figure 9 | Chat — Conversation List | All active chats with preview of last message | Verified Students |
| Figure 10 | Chat — Active Conversation | Real-time messages, resolution confirmation bar | Verified Students |
| Figure 11 | Profile Page | Avatar, account details, change password, admin badge | Verified Students |
| Figure 12 | Admin — Post Moderation | Approve/Reject controls, batch selection, stat cards | Admin Users |
| Figure 13 | Admin — User Management | User list with verification controls and account deletion | Admin Users |

---

## V. SYSTEM DEVELOPMENT

### Tools & Technologies Used

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| Frontend Framework | Next.js | 16.2.4 | App Router, SSR, API Routes, file-based routing |
| UI Library | React | 19.2.4 | Component rendering, hooks, state management |
| Styling | Tailwind CSS | 4.x | Utility-first CSS for responsive mobile-first layouts |
| Animations | Framer Motion | 12.38.0 | Page transitions, glassmorphism, micro-animations |
| Icons | Lucide React | 1.14.0 | Consistent SVG icon library |
| Image Cropping | react-easy-crop | 5.5.7 | Client-side image crop before upload |
| Backend-as-a-Service | Supabase | 2.105.1 | Auth, PostgreSQL DB, real-time subscriptions, file storage |
| SSR Auth | @supabase/ssr | 0.10.2 | Server-side session handling for Next.js App Router |
| Email Validation | Nodemailer | 8.0.7 | MX record validation API endpoint |
| Language | JavaScript (ES2022+) | — | Primary development language |
| Database | PostgreSQL 17 | via Supabase | Relational data, row-level security (RLS), triggers |
| Version Control | Git / GitHub | — | Source code management and team collaboration |

### Development Methodology

The team followed a **simplified Agile / Iterative approach** with priority-based sprints. Features were organized into four priority levels (Priority 1 through Priority 4) using a shared backlog (`To Do.md`). Each sprint focused on a batch of features before advancing to the next priority tier.

> **[REGARDING MODULARIZATION, COHESION & COUPLING]:**
>
> The system's architecture was deliberately designed to achieve **high cohesion** and **low coupling** through modularization:
>
> - **Modularization**: The codebase is divided into purpose-driven modules — `app/` (pages/routes), `components/` (reusable UI elements), `hooks/` (encapsulated custom logic), `lib/` (Supabase client abstractions), `utils/` (helper functions), and `app/api/` (server-side route handlers). Each directory has a single, clear area of responsibility.
>
> - **High Cohesion**: Each component or module performs exactly one well-defined function. For example, `NavBar.js` only handles navigation rendering and unread badge display. `ItemDetailModal.js` only handles item detail display and user actions. `useAuthGuard.js` only handles route protection and session verification. `useAdminGuard.js` extends `useAuthGuard` with only admin-role enforcement logic.
>
> - **Low Coupling**: Pages interact with the database exclusively through the Supabase client abstraction (`lib/supabase.js`), never via direct SQL from the client. Admin-privileged operations are routed through server-side API routes (`/api/admin/`), keeping sensitive logic server-side and decoupled from the frontend UI. Components communicate through clearly defined props and callbacks rather than shared global mutable state.

### Development Phases

| Phase | Description | Key Deliverables |
|---|---|---|
| Phase 1 — Foundation | Project setup, Supabase config, auth flow, base UI design system | Login page, auth session, database schema |
| Phase 2 — Core Features | Item posting, browsing, detail modal, basic chat | Items page, Post page, Chat page, NavBar |
| Phase 3 — Admin & Realtime | Admin dashboard, moderation workflow, image cropping, real-time chat | Admin page, AdminUsersSection, ItemPostModal |
| Phase 4 — Polish & Security | Verification system, Recent feed, category filters, responsive improvements | Pending verification, Home feed, filter chips |

### Team Member Roles

> **[FILL IN YOUR ACTUAL NAMES AND CONTRIBUTIONS HERE]**

| Member | Role | Key Contributions |
|---|---|---|
| [Name 1] | Full-Stack Developer / Lead | Architecture, Supabase schema, auth flow, admin dashboard |
| [Name 2] | Frontend Developer / UI | Items page, cards, Home page, responsive layout |
| [Name 3] | Frontend Developer | Chat feature, real-time, Profile page, NavBar |

---

## VI. LIMITATIONS AND ASSUMPTIONS

### Known Limitations

1. **Admin Mobile View**: The Admin Dashboard is desktop-optimized. While accessible on mobile, the UX is suboptimal for small screens.
2. **Text-Only Chat**: The current chat system only supports text messages. In-chat image sharing is a planned future feature.
3. **No Push Notifications**: The system has no push notification support. Users must open the app to check for updates.
4. **No Chat Content Moderation**: Real-time profanity filtering in chat messages has not yet been implemented. A word-list-based filter is planned.
5. **No User Report / Ban System**: The ability for users to report others for trolling or harassment, and for admins to issue temporary bans, is pending implementation.
6. **No Pagination**: The Items page fetches all matching records at once — this may impact performance at scale.
7. **No Automated Email Notifications**: No outbound emails are sent for events like post approval or new messages.

### Assumptions Made During Development

1. All users are LSPU students or authorized personnel — the document verification step enforces this.
2. Campus location labels in the system accurately reflect the LSPU campus geography.
3. Users report items in good faith; the admin moderation layer is the primary defense against misuse.
4. Users have access to a mobile device with a camera and a stable internet connection.
5. The Supabase free tier is sufficient for the current academic/demo scale of the project.

---

## VII. FUTURE ENHANCEMENTS

The following improvements are planned for future versions of FoundIt:

1. **User Reporting & Ban System**: Allow users to report others for inappropriate chat behavior. Admins review the report (with chat context visible) and can issue temporary bans or dismiss false reports.
2. **In-Chat Image Sharing**: Enable photo uploads within chat conversations, with client-side compression before upload to Supabase Storage.
3. **Profanity / Content Filter**: Implement a JSON word-list-based real-time filter that warns users and blocks sending of inappropriate messages in chat.
4. **Dynamic Home Greetings**: Replace the static subtitle text with context-aware greetings that change based on the time of day or day of the week to increase user engagement.
5. **Push Notifications**: Integrate browser push notifications or an in-app notification center for events like post approval, new messages, and item resolution.
6. **AI-Powered Image Moderation**: Auto-scan uploaded item images using an AI/ML model to flag inappropriate content before it reaches the admin review queue.
7. **AI-Powered Item Matching**: Suggest potential matches between Lost and Found posts based on similarity of description, category, and location.
8. **Multi-Campus Support**: Extend the system to serve multiple LSPU campuses with campus-specific feeds and admin accounts.
9. **Pagination / Infinite Scroll**: Add cursor-based pagination to the Items page for scalable performance with large datasets.
10. **Native Mobile App (REST API)**: Expose a public REST API to enable development of a native Android/iOS companion app.

> **[COMMENT]:** Each enhancement above directly addresses a specific limitation listed in Section VI. Framing it this way shows your professor that your future work is grounded in observed real gaps — demonstrating systematic engineering thinking.

---

*Group 1 | BSCpE 2-A | Software Design (CpE 8) | May 2025*  
*Instructor: PRINCESS PLEBISCITE B. TOPE*