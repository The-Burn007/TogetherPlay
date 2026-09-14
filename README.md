# TogetherPlay Starter

Production-oriented foundation for the TogetherPlay LDR multiplayer game platform.

## Stack

- Next.js + TypeScript
- Firebase Authentication
- Cloud Firestore
- Firebase Realtime Database
- Cloud Storage
- Firebase Cloud Functions 2nd gen
- Firebase App Check
- WebRTC signaling through Realtime Database
- GitHub Actions
- Firebase App Hosting

## What is included

- Firestore schema conventions
- Firestore Security Rules
- Realtime Database Security Rules
- Cloud Storage Security Rules
- TypeScript domain types
- Server-authoritative game action contract
- Find It First game-engine skeleton
- Cloud Function for game actions
- App Check enforcement on callable functions
- Emulator configuration
- GitHub CI workflow
- App Hosting configuration
- Environment template

## First setup

1. Create three Firebase projects:
   - togetherplay-dev
   - togetherplay-staging
   - togetherplay-prod

2. Enable Authentication, Firestore, Realtime Database and Storage.

3. Configure Firebase App Check for the web app. Use reCAPTCHA Enterprise in production.

4. Copy `.env.example` to `.env.local` and fill in the Firebase web configuration.

5. Install dependencies:

```bash
npm install
cd functions && npm install
```

6. Start the Firebase emulators:

```bash
firebase emulators:start
```

7. Start Next.js:

```bash
npm run dev
```

## Important

The included rules are a secure starting point, not a substitute for the project's complete authorization test suite.

Do not connect local development to production.

Do not commit `.env.local`, service-account JSON, private keys, Gemini secrets, or App Check debug tokens.

## Deployment

Firebase App Hosting is intended to be connected to the GitHub repository and a live branch. The production branch should be protected and should only receive reviewed, passing changes.
