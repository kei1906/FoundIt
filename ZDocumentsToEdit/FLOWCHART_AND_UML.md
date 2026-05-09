# FoundIt — Flowchart & UML Class Diagram

> This file contains the Mermaid source code for the system flowchart and UML Class Diagram.
> Paste these into [Mermaid Live Editor](https://mermaid.live) to render them, or use any tool that supports Mermaid (Notion, VS Code with Mermaid extension, etc.).

---

## PART 1 — SYSTEM FLOWCHART

### Why these nodes are included:

| Node / Decision | Reason for Inclusion |
|---|---|
| **Visit App** | Every system starts with the entry point — the user accessing the URL |
| **Active Session?** | Supabase Auth uses JWT sessions; this check prevents unauthenticated access to all protected routes (enforced by `useAuthGuard`) |
| **Verification Approved?** | The identity gate — only verified LSPU students access the main app. Unverified users see the Pending Verification page |
| **Registration + Doc Upload** | New user flow — captures name, student number, email, password, and COR/Student ID for admin review |
| **Home Page / Navigation** | Hub of the application — from here users branch into all major features |
| **Browse / Search Items** | Core read operation — the most common user action |
| **Post Item** | Core write operation — the user reports a found or lost item |
| **Moderation Queue** | Admin must approve before the post is visible — critical content control decision point |
| **Admin Approve/Reject** | The admin's two possible moderation outcomes |
| **Contact Owner** | Triggers the chat creation flow — key interaction between finder and claimer |
| **Chat Created** | One-per-pair deduplication enforced by the API route |
| **Mark as Resolved** | Both-sides confirmation — the final state transition requiring a DB trigger |
| **Both Confirmed?** | Database trigger `trg_auto_resolve_item` checks both flags — only resolves when BOTH are true |
| **Item Resolved** | Terminal state — item is marked Claimed/Found, chat is locked |

```mermaid
flowchart TD
    A([🌐 User Visits App]) --> B{Active Session?}
    B -- No --> C[Login Page]
    C --> D{New User?}
    D -- Yes --> E[Sign Up Form]
    E --> F[Upload COR / Student ID]
    F --> G[Account Created — Pending Verification]
    G --> H[Pending Verification Page]
    D -- No --> I[Sign In with Email or Student Number]
    I --> J{Auth Valid?}
    J -- No --> K[Show Error Message]
    K --> C
    J -- Yes --> L{Verification Approved?}
    B -- Yes --> L
    L -- No --> H
    H --> M{Status = Rejected?}
    M -- Yes --> N[Re-upload Document]
    N --> H
    M -- No --> H
    L -- Yes --> O([🏠 Home Page])

    O --> P[Browse / Search Items]
    O --> Q[Post an Item]
    O --> R[Open Chat List]
    O --> S[View Profile]

    P --> T[Items Page — Filter & Search]
    T --> U[Tap Item → Detail Modal]
    U --> V{Is Own Item?}
    V -- Yes --> W[Edit Status / Delete Item]
    V -- No --> X[Contact Owner]
    X --> Y[/api/chats — Create or Retrieve Chat/]
    Y --> Z[Open Chat Conversation]
    Z --> AA[Send / Receive Messages in Real-time]
    AA --> AB{Item Resolved?}
    AB -- No --> AC[Mark as Resolved Button]
    AC --> AD[Update finder_confirmed or claimer_confirmed in DB]
    AD --> AE{Both Confirmed?}
    AE -- No --> AA
    AE -- Yes --> AF[🔁 DB Trigger fires — item.status = Resolved]
    AF --> AG([✅ Chat Locked — Item Claimed/Found])

    Q --> AH[Select Photo — Camera or Gallery]
    AH --> AI[Crop Image]
    AI --> AJ[Fill Form — Title, Category, Location]
    AJ --> AK[Submit → moderation_status = pending]
    AK --> AL{Admin Reviews Post}
    AL -- Approve --> AM[Post Visible Publicly]
    AL -- Reject --> AN[User Notified — Rejection Reason Shown]
    AN --> AJ

    S --> AO[View Profile Info]
    AO --> AP[Upload Avatar]
    AO --> AQ[Change Password]
    AO --> AR{Is Admin?}
    AR -- Yes --> AS[Admin Dashboard]
    AS --> AT[Review Pending Posts]
    AT --> AL
    AS --> AU[Manage User Verifications]
    AU --> AV{Approve or Reject User?}
    AV -- Approve --> AW[User Access Granted]
    AV -- Reject --> AX[User Notified with Reason]
```

---

## PART 2 — UML CLASS DIAGRAM

### Why these classes and relationships are included:

| Class | Why Included |
|---|---|
| **User (AuthUser)** | Represents the Supabase `auth.users` record — the root authentication identity. Every other entity traces back to this |
| **Profile** | Extends the auth user with LSPU-specific data (student number, verification status, role). Has a 1-to-1 relationship with User |
| **Item** | The primary content entity. Belongs to a poster (Profile), has a category (Lost/Found), moderation status, and resolution status |
| **Chat** | The connection entity between a finder (poster) and a claimer (interested party) for a specific item. Has dual-confirmation fields for resolution |
| **Message** | The content within a Chat. Belongs to both a sender and receiver Profile, and links to the item context |
| **AdminAction** | Represents the admin's moderation decision on an Item or Profile — captures who acted, when, and what reason was given |
| **VerificationDocument** | Represents the COR/Student ID uploaded during signup — links to the Profile and tracks upload URL and review status |

**Key Relationships explained:**
- **Profile → Item (1-to-many)**: One student can post many items
- **Item → Chat (1-to-many)**: One item can generate multiple chats (from multiple interested parties)
- **Chat → Message (1-to-many)**: One conversation has many messages
- **Profile → Message (1-to-many, sender + receiver)**: A profile sends and receives messages
- **Profile → VerificationDocument (1-to-1)**: Each student has one verification document per registration
- **AdminAction → Item / Profile**: Admins act on items (approve/reject) and profiles (approve/reject user)

```mermaid
classDiagram
    class AuthUser {
        +UUID id
        +String email
        +String encrypted_password
        +Timestamp created_at
        +signUp()
        +signIn()
        +signOut()
        +updatePassword()
    }

    class Profile {
        +UUID id
        +String full_name
        +String student_number
        +String email
        +String avatar_url
        +String role
        +String verification_status
        +String verification_doc_url
        +String verification_rejection_reason
        +Timestamp created_at
        +Timestamp updated_at
        +getProfile()
        +updateAvatar()
        +deleteAccount()
    }

    class Item {
        +UUID id
        +UUID user_id
        +String category
        +String item_category
        +String title
        +String description
        +String location_tag
        +String image_url
        +String status
        +String moderation_status
        +Timestamp created_at
        +createItem()
        +updateStatus()
        +deleteItem()
        +approve()
        +reject()
    }

    class Chat {
        +UUID id
        +UUID item_id
        +UUID finder_id
        +UUID claimer_id
        +String status
        +Boolean finder_confirmed_resolved
        +Boolean claimer_confirmed_resolved
        +Timestamp created_at
        +createChat()
        +confirmResolution()
        +deleteChat()
    }

    class Message {
        +UUID id
        +UUID chat_id
        +UUID sender_id
        +UUID receiver_id
        +UUID item_id
        +String content
        +Boolean is_read
        +Timestamp created_at
        +sendMessage()
        +markAsRead()
    }

    class VerificationDocument {
        +UUID id
        +UUID profile_id
        +String doc_url
        +String file_type
        +Timestamp uploaded_at
        +upload()
        +reUpload()
    }

    class AdminAction {
        +UUID id
        +UUID admin_id
        +String target_type
        +UUID target_id
        +String action
        +String reason
        +Timestamp created_at
        +approveItem()
        +rejectItem()
        +approveUser()
        +rejectUser()
        +deleteUser()
    }

    class DBTrigger {
        <<trigger>>
        +handle_new_user()
        +auto_resolve_item_on_chat_update()
        +handle_updated_at()
    }

    AuthUser "1" --> "1" Profile : creates via trigger
    Profile "1" --> "0..*" Item : posts
    Item "1" --> "0..*" Chat : generates
    Profile "1" --> "0..*" Chat : participates as finder
    Profile "1" --> "0..*" Chat : participates as claimer
    Chat "1" --> "0..*" Message : contains
    Profile "1" --> "0..*" Message : sends
    Profile "1" --> "0..*" Message : receives
    Profile "1" --> "0..1" VerificationDocument : uploads
    Profile "1" --> "0..*" AdminAction : performs (as admin)
    Item "1" --> "0..*" AdminAction : subject of
    DBTrigger ..> Profile : auto-creates profile on signup
    DBTrigger ..> Item : auto-resolves when both confirmed
```

---

## HOW TO USE THESE DIAGRAMS

### Option 1 — Mermaid Live (Free, No Account Needed)
1. Go to **https://mermaid.live**
2. Paste the code block (without the triple backticks) into the editor
3. The diagram renders on the right
4. Click **Export → PNG** or **SVG** to download

### Option 2 — draw.io (Free)
1. Go to **https://app.diagrams.net**
2. Use the flowchart shapes to manually recreate the diagram (use the Mermaid diagram as your blueprint)
3. Export as PNG/PDF for submission

### Option 3 — VS Code
1. Install the **"Mermaid Preview"** extension (free)
2. Open this file — diagrams render inline in the preview panel

---

*For the final submission, export the diagrams as PNG images and insert them into Section III (Flowchart) of the project report.*
