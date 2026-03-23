# La Vie En Rose 34 — Fix Report
Generated: 2026-03-22

## Summary
Total fixes applied: 76+
Sessions: 6

---

## CRITICAL FIXES (App-breaking)

### 1. App.tsx — SettingsPage named-import crash
- File: frontend/src/App.tsx
- Bug: `import('./pages/Settings').then(m => m.SettingsPage)` but Settings uses default export
- Fix: Changed to `import('./pages/Settings')` (default export)

### 2. db.ts — ALTER TABLE before table creation
- File: backend/src/storage/db.ts
- Bug: ALTER TABLE customers ran before migrate() created the tables — fresh DB crash
- Fix: Moved migrate() call BEFORE all ALTER TABLE calls

### 3. settings.ts — Non-existent column query
- File: backend/src/routes/settings.ts
- Bug: `SELECT invoice_number FROM orders` — column doesn't exist, silent 500 error
- Fix: COUNT-based invoice number generation

### 4. analytics.ts — UTC timezone (wrong daily boundaries)
- File: backend/src/routes/analytics.ts
- Bug: `new Date(date + 'T00:00:00.000Z')` — UTC midnight ≠ Algeria midnight (UTC+1)
- Fix: Local time boundaries matching pos.ts approach

### 5. Dashboard.tsx — Inventory values always showed dashes
- File: frontend/src/pages/Dashboard.tsx
- Bug: `inventoryReady ? '—' : formatDA(...)` — inverted condition
- Fix: `!inventoryReady ? '—' : formatDA(...)`

### 6. firebaseClient.ts — Hard crash without Firebase config
- File: frontend/src/lib/firebaseClient.ts
- Bug: Threw `Error('Firebase configuration missing...')` for local-only users
- Fix: Returns null gracefully; local auth still works

### 7. pos.ts — mixed payment remapped to cib on receipt
- File: backend/src/routes/pos.ts
- Bug: `method === 'mixed' ? 'cib'` corrupted receipt payment display
- Fix: Only legacy 'card' remapped; 'mixed' preserved

### 8. electron/main.js — Wrong health check URL
- File: electron/main.js
- Bug: Health check polled `GET /` which serves SPA HTML in production
- Fix: Changed to `GET /api/health`

### 9. health.ts — Fake health response
- File: backend/src/routes/health.ts
- Bug: Always returned `{ ok: true }` without checking database
- Fix: Real `SELECT 1` DB check; returns HTTP 503 if DB unavailable

### 10. Login.tsx — Pre-filled 'admin' password
- File: frontend/src/pages/Login.tsx
- Bug: `useState('admin')` exposed default credentials in UI
- Fix: `useState('')`

---

## SECURITY FIXES

### 11. auth.ts — No brute force protection
- Added in-memory rate limiter: 10 failed attempts/IP/15min → HTTP 429

### 12. users.ts — Local user creation without validation
- Added Zod schema + privilege escalation check

### 13. firestore.rules — Over-permissive rules
- Hardened all 8 collections; added default-deny catch-all
- Users can only read own license; audit logs are immutable

### 14. electron/main.js — Backup path traversal
- backup:restore and backup:delete now sanitize filenames
- backup:delete no longer triggers unnecessary backend restart

---

## MISSING API ENDPOINTS ADDED

| Endpoint | Description |
|----------|-------------|
| GET /api/products/:id | Single product with variants |
| PUT /api/products/:id | Update product |
| DELETE /api/products/:id | Soft delete product |
| GET /api/products/meta/categories | List categories |
| POST /api/products/meta/categories | Create category |
| DELETE /api/variants/:id | Delete variant (guards last) |
| GET /api/purchases/ | List purchases |
| GET /api/purchases/:id | Single purchase with items |
| PUT /api/suppliers/:id | Update supplier |
| DELETE /api/suppliers/:id | Delete supplier |
| DELETE /api/customers/:id | Delete/anonymize customer |

---

## PERFORMANCE IMPROVEMENTS

- Input.tsx: Removed re-animation on every keystroke (framer-motion entrance)
- AIAssistantPanel.tsx: Added 5min staleTime to all 5 analytics queries
- Settings.tsx: Added 60s staleTime to all 15 queries
- Customers/Suppliers/Inventory: 280ms debounce on search inputs
- db.ts: SQLite pragmas (synchronous=NORMAL, cache_size=32MB, temp_store=MEMORY)
- server.ts: gzip compression middleware added

---

## UX IMPROVEMENTS

- Every page now shows success/error toasts for all user actions
- Language preference persisted to localStorage on change
- Splash screen: respects duration prop (was always min 4s)
- OrderTracking: Added in_progress/delivered status mappings
- Activation page: Auto-redirects after successful activation
- Date formatting: fr-DZ locale throughout

---

## INFRASTRUCTURE

- backend/.env.example: Documents all environment variables
- frontend/.env.example: Documents all environment variables  
- firestore.indexes.json: 4 composite indexes added
- backend/tsconfig.json: Removed types:["node"] dependency
- frontend/tsconfig.app.json: Relaxed noUnused* rules

---

## BUILD & DEPLOY

To build:
```bash
cd "La Vie En Rose 34_1"
npm install
cd backend && npm install && cd ..
cd frontend && npm install && cd ..
npm run build:local   # unsigned local build
```

Environment variables required:
- LVER_JWT_SECRET (min 32 chars, production only)
- FIREBASE_SERVICE_ACCOUNT_JSON (Firebase mode only)
- VITE_FIREBASE_API_KEY (Firebase mode only)
