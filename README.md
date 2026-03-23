# La Vie En Rose 34 — POS Desktop Application

Professional desktop POS application built with Electron + React (Vite) and a local Node/Express backend, with Firebase (Spark-plan compatible) licensing and an admin web panel.

## Repository Structure

- `electron/`
  - Electron main process, preload, IPC, updates, licensing client
- `frontend/`
  - React UI (Vite + TypeScript)
- `backend/`
  - Local API server (Express + SQLite)
- `licensing/admin-panel/`
  - Firebase client-side admin panel for license management
- `firestore.rules`
  - Firestore security rules (Spark compatible)

## Key Features

- Desktop-style full-screen app shell (sidebar + workspace)
- Licensing system (Firestore + secure local cache)
- Admin allowlist (`admins/{uid}` with `{ enabled: true }`)
- License keys stored in Firestore (`licenses/{LICENSE_KEY}`)

## Requirements

- Node.js (LTS recommended)
- npm
- Windows (primary target)

## Development

From the repo root:

```bash
npm install
npm run dev
```

This runs:

- Backend dev server
- Frontend dev server

To run Electron in development:

```bash
npm run electron
```

## Build

```bash
npm run build
```

Electron installer output:

- `dist/La Vie En Rose 34-Setup.exe`

## Admin Panel

In development, the backend serves the admin panel at:

- `http://localhost:8787/admin-panel/admin`

## Firebase Notes (Spark)

- Firestore database must exist (created in Firebase Console)
- No Cloud Functions / Admin SDK required

## License Collections

- `admins/{uid}`
- `licenses/{licenseKey}`
- `customers/{customerId}`
- `devices/{machineId}`
- `activations/{activationId}`

## Release Management

- Versions live in root `package.json` (`version` field)
- See `CHANGELOG.md` for release history

