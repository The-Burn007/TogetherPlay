# TogetherPlay

Multiplayer relationship game room for couples living apart. TogetherPlay connects long-distance partners through real-time synchronized gameplay, peer-to-peer video calling, gentle presence rituals, and a shared private memory archive.

---

## Features

### 1. Multiplayer Games Suite
- **Find It First**: Authoritative board scavenger duel. The server randomly generates board item placements and validates the first partner to tap the target item.
- **Speed Duel**: High-speed reflex competition. Tests reaction times with randomized countdowns and server-verified timestamp deltas.
- **Couple Race**: Turn-based board race. Uses server-authoritative fair dice rolls and board progression toward the finish line.
- **Camera Challenge**: Interactive scavenger quest. Partners capture and share photos matching creative prompts with mutual verification.
- **AI Game Night**: Gemini-powered custom date nights with personalized themes, trivia, and playful commentary.
- **AI Relationship Challenge**: AI-guided connection questions and intimate conversation prompts designed to deepen understanding across time zones.

### 2. Low-Latency WebRTC Video Calling
- 1-on-1 audio/video calling running alongside games or as a standalone call.
- Peer-to-peer WebRTC connection with Realtime Database signaling (`/webrtc_signaling/{roomId}`).
- Audio mute, camera toggle, picture-in-picture modes, and full teardown on room departure to eliminate memory leaks and camera lockups.

### 3. Privacy-Preserving Presence & Rituals
- Realtime socket presence (`ONLINE`, `IN_GAME`, `AWAY`, `OFFLINE`) via Firebase Realtime Database with `onDisconnect` synchronization.
- High-level city and timezone indicators (London ↔ Tokyo) without collecting or storing precise GPS coordinates.
- "Thinking of You" presence nudges and heart rituals delivering instant feedback to your partner.

### 4. Private Couple Memory Vault
- Secure relationship archive storing shared moments, game victories, and milestone snapshots.
- Stored under `couples/{coupleId}/memories` with binary assets in Cloud Storage `couples/{coupleId}/memories/{fileName}`.
- Automated client-side blob URL caching to prevent redundant downloads and browser memory leaks.

---

## Architecture & Security

- **Server-Authoritative Game Engine**: Clients never mutate game state directly. State transitions are processed exclusively through `/api/games/action` with idempotent action IDs, timestamp freshness checks, and optimistic version tracking.
- **Zero Secrets in Client Bundle**: `GEMINI_API_KEY` and Firebase Admin credentials remain strictly on the server.
- **Default-Deny Security Rules**:
  - `firestore.rules`: Global catch-all deny rule. Direct writes to `games`, `gameResults`, and couple `memberIds` are forbidden from client SDKs.
  - `database.rules.json`: Root deny rule. Client writes to `/gameStates` are disabled (server-only); `/presence` forbids GPS coordinates.
  - `storage.rules`: Uploads are scoped to `/couples/{coupleId}/memories` and `/users/{uid}/avatar` with size limits (5MB/15MB) and strict image MIME-type validation (`jpeg`, `png`, `webp`). SVG files are rejected to prevent stored XSS.
- **Environment Separation**: Test users, sandbox bypasses, and debugging ribbons are strictly guarded behind `process.env.NODE_ENV !== "production"`. In production, all authentication routes enforce real Firebase Auth sessions.
- **AI Guardrails & Rate Limiting**: Anti-prompt-injection filters sanitize untrusted user text and redact PII, while sliding-window rate limiters prevent API overuse.

---

## Tech Stack

- **Framework**: Next.js 15 (App Router)
- **Language**: TypeScript (Strict Mode)
- **UI & Styling**: React 19, Tailwind CSS v4, Motion (`motion/react`), Lucide React
- **Backend & Cloud**:
  - Firebase Authentication (Email/Password & Google Sign-In)
  - Cloud Firestore (Persistent couple documents, invites, memory items)
  - Firebase Realtime Database (Low-latency game state, presence heartbeats, WebRTC signaling)
  - Cloud Storage (Private media attachments and profile photos)
- **AI & LLM**: Google GenAI SDK (`@google/genai`) via server API routes
- **Testing**: Vitest (Unit, Game Engines, Security Rules, Integration, E2E)

---

## Getting Started

### Prerequisites
- Node.js 20+
- npm 10+
- Firebase project with Authentication, Firestore, Realtime Database, and Storage enabled.

### 1. Environment Setup

Copy `.env.example` to `.env.local` and provide your credentials:

```bash
cp .env.example .env.local
```

Populate the required keys:

```env
# Firebase Client Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Server-side Secret (Do NOT prefix with NEXT_PUBLIC_)
GEMINI_API_KEY=your_gemini_api_key
```

### 2. Installation

Install all project dependencies:

```bash
npm install
```

### 3. Development Server

Run the development server on port 3000:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Scripts & Verification

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts the Next.js local development server on port 3000 |
| `npm run build` | Compiles the production build with static route optimization |
| `npm run start` | Runs the production server |
| `npm run lint` | Runs ESLint checks across all TypeScript and React files |
| `npm run typecheck` | Validates TypeScript types across the entire codebase (`tsc --noEmit`) |
| `npm test` | Runs the full Vitest automated test suite (25 suites, 215 tests) |
| `npm run test:game` | Runs game engine unit tests |
| `npm run test:security`| Runs security and rule verification tests |

---

## Project Structure

```text
.
├── app/                        # Next.js App Router
│   ├── api/                    # Server API endpoints
│   │   ├── ai/                 # Gemini game night & relationship prompts
│   │   ├── couples/            # Invite generation and pairing transactions
│   │   └── games/              # Authoritative action submission route
│   ├── games/                  # Game lobbies and active play screens
│   ├── login/                  # Authentication & registration
│   ├── memories/               # Shared couple memory archive
│   └── page.tsx                # Main couple dashboard & presence hub
├── components/                 # Reusable UI & layout components
│   ├── games/                  # Game boards, countdowns, scoreboards
│   ├── layout/                 # Navigation rail, AppShell, header
│   └── ui/                     # Buttons, dialogs, badges, cards, toast
├── features/                   # Core domain feature modules
│   └── video/                  # WebRTC peer connection hooks & UI
├── lib/                        # Infrastructure, utilities, and services
│   ├── ai/                     # Gemini service, prompts, sanitization
│   ├── auth/                   # AuthContext and session state
│   ├── firebase/               # Client SDK, server repository, authoritative engine
│   └── memories/               # Memory upload service and blob cache
├── tests/                      # Automated test suite (215 tests)
│   ├── accessibility/          # WCAG AA contrast & a11y tests
│   ├── ai/                     # AI prompt & rate limiting tests
│   ├── game-engine/            # Authoritative game engine tests
│   ├── integration/            # Multi-service couple gameplay flows
│   ├── network/                # Resilience and disconnect handling tests
│   └── security/               # Rules and App Check tests
├── database.rules.json         # Realtime Database security rules
├── firestore.rules             # Cloud Firestore security rules
├── storage.rules               # Cloud Storage security rules
└── metadata.json               # Platform metadata & permissions
```

---

## Production Deployment

- **Hosting Target**: Firebase App Hosting / Cloud Run container environment.
- **Port**: Bound to port 3000 (`next start -p 3000 -H 0.0.0.0`).
- **Security Check**: Confirm all production branches run `npm run typecheck`, `npm run lint`, and `npm test` before deployment.
