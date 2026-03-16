# Local and Deployment Setup

## 1. Run the SQL schema

Open the Supabase SQL editor and run:

`supabase/schema.sql`

That creates the tables used by the backend:

- `profiles`
- `rooms`
- `room_members`
- `chat_messages`

## 2. Configure Supabase Auth

In Supabase Auth settings:

1. Add redirect URLs:
   - `http://localhost:5173/auth/callback`
   - `http://localhost:5173/auth/reset-password`
   - your Vercel production URL equivalents
2. Enable email/password auth.
3. Enable email OTP / passwordless auth if you want the login-page OTP flow.
   Supabase can send a magic link or an OTP depending on your email template/configuration, so make sure the Auth email template is configured for code-based login if you want the in-app OTP entry flow.
4. Enable Google provider if you want Google sign-in.

### Gmail SMTP for auth emails

Auth emails are sent by Supabase, not by the Render server.

In Supabase Auth SMTP settings, configure:

- SMTP host: `smtp.gmail.com`
- SMTP port: `465`
- Username: your Gmail address
- Password: your Gmail app password
- Sender email: your Gmail address

Important:

- Gmail SMTP configured on Render is only used by `/api/contact`.
- Render free services do not support outbound SMTP for production email delivery, so auth mail should stay on Supabase SMTP.

## 3. Local `.env`

Create a local `.env` from `.env.example`.

Frontend values:

- `VITE_API_URL=http://localhost:3001`
- `VITE_SOCKET_URL=http://localhost:3001`
- `VITE_SUPABASE_URL=...`
- `VITE_SUPABASE_ANON_KEY=...`

Backend values:

- `PORT=3001`
- `CLIENT_ORIGINS=http://localhost:5173,http://127.0.0.1:5173`
- `SUPABASE_URL=...`
- `SUPABASE_SERVICE_ROLE_KEY=...`

Optional contact-form SMTP:

- `SMTP_USER=...`
- `SMTP_PASS=...`
- `SMTP_FROM_EMAIL=...`
- `CONTACT_TO_EMAIL=...`

## 4. Run locally

```bash
npm install
npm run dev:full
```

Frontend:

- `http://localhost:5173`

Backend:

- `http://localhost:3001`

## 5. Deploy

### Vercel

Deploy the Vite frontend and set:

- `VITE_API_URL=https://your-render-service.onrender.com`
- `VITE_SOCKET_URL=https://your-render-service.onrender.com`
- `VITE_SUPABASE_URL=...`
- `VITE_SUPABASE_ANON_KEY=...`

### Render

Deploy the backend as a web service and set:

- `PORT=10000` or Render default
- `CLIENT_ORIGINS=https://your-vercel-app.vercel.app`
- `SUPABASE_URL=...`
- `SUPABASE_SERVICE_ROLE_KEY=...`

Optional contact-form SMTP variables can be added, but on Render free they should not be relied on for production email.

## 6. Missing manual setup

These are still dashboard/manual tasks outside the repo:

- Add Google OAuth client ID/secret inside Supabase Auth provider settings.
- Add matching redirect URLs in both Supabase and Google Cloud.
- Configure Supabase custom SMTP with Gmail if you want email verification, OTP, and reset emails to come from Gmail.
- Add the Vercel and Render production URLs to Supabase redirect settings after deployment.
