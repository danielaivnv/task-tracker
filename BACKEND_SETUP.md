# Backend Push Setup

This project now includes an optional backend in `/backend` for true Web Push reminders (works when app is closed, as long as iPhone supports Web Push for Home Screen apps).

## 1. Install requirements

- Node.js 20+ (includes npm)

Check:

```bash
node -v
npm -v
```

## 2. Install backend dependencies

```bash
cd backend
npm install
```

## 3. Generate VAPID keys

```bash
npm run generate:vapid
```

Copy output values into `backend/.env`:

```bash
cp .env.example .env
```

Set:

- `VAPID_PUBLIC_KEY`
- `VAPID_PRIVATE_KEY`
- `VAPID_SUBJECT` (your email, mailto format)
- `CORS_ORIGINS` (your GitHub Pages URL)
- `APP_TASKS_URL` (full URL to `tasks.html`)

## 4. Run backend

```bash
npm start
```

Health check:

```bash
curl http://localhost:8787/health
```

## 5. Deploy backend

Deploy `/backend` to any Node host (Render, Railway, Fly.io, VPS).  
After deploy, copy backend base URL, for example:

`https://focus-backend.example.com`

## 6. Connect frontend to backend

Edit these meta tags in:

- `index.html`
- `tasks.html`
- `completed.html`

Set:

- `focus-backend-url` to backend URL
- `focus-vapid-public-key` to your `VAPID_PUBLIC_KEY`

Example:

```html
<meta name="focus-backend-url" content="https://focus-backend.example.com" />
<meta name="focus-vapid-public-key" content="YOUR_VAPID_PUBLIC_KEY" />
```

## 7. iPhone usage

1. Open website in Safari.
2. Add to Home Screen.
3. Launch app from Home Screen.
4. Tap `Enable alerts`.
5. Allow notifications in iOS prompt.

## API endpoints used by frontend

- `POST /api/devices/register`
- `POST /api/tasks/sync`
