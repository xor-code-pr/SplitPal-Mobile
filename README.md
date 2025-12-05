# SplitPal Mobile (React Native)

A lightweight React Native (Expo) client for the SplitPal backend. Optimized for Android development with Expo Go or an Android emulator.

## Prerequisites

- Node.js 18 LTS or newer
- npm 9+ (or yarn / pnpm)
- Expo CLI (`npm install -g expo@^51`)
- Android Studio with an emulator **or** the Expo Go app on a physical Android device
- The SplitPal backend running locally (default `http://localhost:7071/api`)

Set an Expo public env var if your backend runs elsewhere:

```sh
# Example when the API runs on a different host/port
export EXPO_PUBLIC_API_BASE_URL="https://your-host/api"
```

On Windows PowerShell:

```powershell
$Env:EXPO_PUBLIC_API_BASE_URL = "https://your-host/api"
```

## Install & Run

```bash
cd mobile
npm install
npm run android        # launches Expo dev server and opens Android target
```

Other useful scripts:

```bash
npm run start          # Expo dev server only
npm run web            # run the app in a web browser (limited styling differences)
```

## Features

- Email/password login wired to `POST /users/login`
- Secure token storage via context and automatic Authorization headers
- Group listing (`GET /groups`)
- Group detail view with balances (`GET /groups/:id/balances`) and transactions (`GET /groups/:id/transactions`)
- Transaction creation form with configurable payer and split percentages (`POST /groups/:id/transactions`)
- TypeScript-first Expo configuration and navigation setup

## Project Structure

```
mobile/
├── App.tsx                     # Entry point
├── app.json                    # Expo configuration
├── package.json
├── src/
│   ├── api/client.ts           # Axios instance + auth header management
│   ├── contexts/AuthContext.tsx
│   ├── navigation/RootNavigator.tsx
│   ├── screens/                # Login, Groups, GroupDetail, CreateTransaction
│   ├── components/             # Reusable UI primitives
│   ├── hooks/                  # Custom hooks (useAuth)
│   └── types.ts                # Shared TypeScript types
└── README.md
```

## Future Enhancements

1. Persist auth token across app restarts (SecureStore or AsyncStorage)
2. Add registration and group creation flows directly in the app
3. Provide richer transaction details (split breakdown, receipts upload)
4. Integrate push notifications for activity alerts

## Troubleshooting

- **Cannot reach backend**: Ensure the backend function host is running and accessible from your device/emulator. Update `EXPO_PUBLIC_API_BASE_URL` if necessary.
- **Android emulator networking**: Use `http://10.0.2.2:7071/api` as the base URL when the backend runs on the same Windows machine as the emulator.
- **Expo Go on device**: The device must share the same network as your machine. Base URL should reference your machine's LAN IP.
