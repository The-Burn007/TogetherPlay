# Security notes

1. Firestore client writes to authoritative game data are denied.
2. Cloud Functions use Admin SDK, so backend authorization is mandatory because Admin SDK access bypasses Firestore Security Rules.
3. Callable game functions enforce App Check.
4. Use reCAPTCHA Enterprise App Check in production web.
5. Do not expose Gemini secrets in client-side code.
6. Do not store video or audio in MVP.
7. Do not trust client timestamps for game outcomes.
8. Use server-side randomness for dice and cards.
9. Use clientActionId for idempotency.
10. Keep App Check debug tokens out of production.
11. Run Security Rules tests in CI.
12. Review Storage rules whenever new upload types are introduced.
