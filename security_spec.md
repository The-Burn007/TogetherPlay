# TogetherPlay Security Specification & Hardening Audit

## 1. Executive Summary & Threat Model
TogetherPlay is a real-time multiplayer application designed for long-distance couples. All security boundaries enforce the core architectural principle: **The browser is untrusted**. All game mutations, invitations, AI generations, and media uploads undergo server-authoritative authorization, validation, and rate limiting.

---

## 2. Core Security Invariants

### 2.1 Default Deny
- **Firestore (`firestore.rules`)**: Root catch-all match rule `match /{document=**} { allow read, write: if false; }`. Any collection or subcollection not explicitly allowed is strictly blocked.
- **Realtime Database (`database.rules.json`)**: Root rules explicitly set `".read": false` and `".write": false`.
- **Firebase Storage (`storage.rules`)**: Root match rule `match /{allPaths=**} { allow read, write: if false; }`.

### 2.2 Couple Isolation & Anti-Cross-Tenant Access
- A user can only access documents belonging to their own user profile or their verified couple.
- `isCoupleMember(coupleId)` requires the requester to be authenticated, the couple document to exist, and `request.auth.uid in memberIds`.
- Couple documents have immutable `memberIds` on client updates. Couple pairing is managed exclusively via server-side atomic transactions (`/api/couples/accept-invite`).

### 2.3 Authoritative Game State Engine
- Game state is strictly non-writable by clients (`/games/{gameId}` has `allow write: if false;`).
- All gameplay mutations flow through `/api/games/action` -> `submitGameAction`.
- The authoritative server enforces:
  - **Scores**: Client cannot submit scores. Scores are computed exclusively on the server based on round rules, time deltas, and authoritative target matching.
  - **Winners**: Client cannot forge winners. Winner determination occurs on the server when winning conditions or round limits are satisfied.
  - **Dice & Randomness**: Client dice rolls are discarded. The server computes cryptographic random rolls (`serverRollDice()`).
  - **Timers**: Deadlines and countdowns are calibrated to `serverTimestamp`. Client device clocks are ignored.
  - **Idempotency**: Duplicate actions (`clientActionId`) are recorded and prevented from duplicate execution.

### 2.4 Invitation Security
- Invitations contain cryptographic SHA-256 token hashes (`tokenHash`).
- Raw invite secrets are never stored in Firestore documents.
- Expired invitations (`Date.now() > invite.expiresAt`) cannot be reused.
- Already accepted or revoked invites (`status !== "pending"`) are rejected with `410 Gone`.

### 2.5 Storage Hardening
- Allowed MIME types: Strictly `image/jpeg`, `image/png`, and `image/webp`.
- **SVG files are strictly rejected** to prevent Stored Cross-Site Scripting (XSS).
- File size caps:
  - User avatars: Maximum 5 MB.
  - Couple memories: Maximum 15 MB.
- Authorization: Couple memories storage paths (`couples/{coupleId}/memories/*`) require couple membership in Firestore before upload or download.

### 2.6 Server-Side AI & Prompt Security
- `GEMINI_API_KEY` is server-only (`process.env.GEMINI_API_KEY`) and never prefixed with `NEXT_PUBLIC_`.
- All requests to `/api/ai/challenge` require user authentication.
- Sliding window rate limiting is enforced per user/couple.
- All untrusted text inputs (hints, partner names, partner cities) pass through `sanitizeUntrustedInput`:
  - Strips HTML tags, delimiters, and control characters.
  - Strips prompt injection directives (`"ignore previous instructions"`, `"system:"`, `"developer mode"`, etc.).
  - Strips prompt extraction attacks (`"reveal api key"`, `"print system prompt"`).
  - Redacts PII (emails and phone numbers) to minimize private context leaks.
  - Enforces strict length limits.
- AI outputs are validated against a strict Zod schema (`AIChallengeOutputSchema`) with HTML tag stripping.

### 2.7 WebRTC Signaling & Ephemeral Privacy
- WebRTC signaling uses Firebase Realtime Database strictly for SDP offer/answer exchange and ICE candidates.
- Realtime Database rules require authenticated user matches on offer, answer, and participant nodes.
- **Zero Media Storage / No Recording**: Audio and video streams flow exclusively peer-to-peer over encrypted WebRTC (DTLS/SRTP). No media is recorded, transcribed, or stored on servers or cloud buckets.

### 2.8 Client Hardening & XSS Prevention
- Removed `dangerouslySetInnerHTML` in `features/games/GameExperienceCard.tsx` in favor of standard React text node rendering.
- Open redirect defense: login query parameter redirects (`?redirect=`) are validated to ensure they are relative internal paths starting with a single `/` (rejecting `//` and external protocols).
- Safe notification hrefs: links inside `NotificationDrawer` validate that URLs are safe relative paths before rendering.
