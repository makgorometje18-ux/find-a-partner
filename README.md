# Find A Partner

Standalone partner matching app copied out from the Life Game project.

## Routes

- `/` - Find Partner app: swipe, explore, likes, chat, profile.
- `/setup` - Dating profile setup and live verification.
- `/auth` - Sign in and sign up.

## Development

```bash
npm install
npm run dev
```

The app uses Supabase and expects the same environment variables and dating schema used by the original project.

For reliable voice/video calls across different networks, add TURN credentials in Vercel:

- `NEXT_PUBLIC_TURN_URLS` comma-separated TURN URLs
- `NEXT_PUBLIC_TURN_USERNAME`
- `NEXT_PUBLIC_TURN_CREDENTIAL`

Without TURN, browsers can call on many networks through STUN, but strict mobile/carrier NATs may block WebRTC media.
