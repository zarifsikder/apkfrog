# ApkForge — Build Android APKs Without Coding

Next.js 16 full-stack platform: online APK builder (Kotlin/HTML projects,
cloud build engine via GitHub Actions, store, wallet with AmarPayment auto
payment gateway, realtime events, admin panel with user management and
subscription plans CRUD).

## Deploy to Vercel (with MySQL)

### 1. Prerequisites
- A MySQL database (MySQL 5.7+ / MariaDB 10.2+)
  - Recommended free options: PlanetScale, TiDB Cloud, or Aiven
- A Vercel account
- GitHub account for build engine (GitHub Actions)

### 2. Create MySQL Database
Create a database named `apkforge` on your MySQL server:
```sql
CREATE DATABASE apkforge CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

Your connection string will look like:
```
mysql://USER:PASSWORD@HOST:3306/apkforge
```

### 3. Deploy to Vercel
1. Push this project to a GitHub repository
2. Go to [vercel.com](https://vercel.com) → New Project → Import your repo
3. Vercel auto-detects Next.js — no build config needed
4. Add Environment Variables in Vercel:
   - `DATABASE_URL` = `mysql://USER:PASSWORD@HOST:3306/apkforge`
   - `ADMIN_EMAILS` = `your@email.com` (admin accounts)
5. Click **Deploy**

### 4. Initialize Database
After the first deploy, run Prisma to create all tables:
```bash
# Install Vercel CLI (one time)
npm i -g vercel

# Link to your project
vercel link

# Pull env vars locally
vercel env pull .env

# Push schema to your MySQL database
npx prisma db push

# Seed default subscription plans (optional)
node scripts/seed-plans.mjs

# Seed a demo admin user (optional)
node scripts/seed-demo.mjs
```

Or use Vercel's built-in terminal:
```bash
npx prisma db push
```

### 5. Build Engine Setup (GitHub Actions)
1. Admin Panel → **Engine** tab
2. Paste a GitHub Personal Access Token (classic: repo + workflow scopes)
3. Set the **Public Site URL** (your Vercel URL, e.g. `https://your-app.vercel.app`)
4. Click "Setup repo" — creates/repairs the build repo + workflow

### 6. Payment Gateway (Optional)
Admin Panel → **Pay** tab → Set PAYMENT URL + API KEY for AmarPayment auto payment.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | MySQL connection string |
| `ADMIN_EMAILS` | No | Comma-separated admin emails |

## Features
- 🔐 User authentication (login/register with persistent sessions)
- 📁 Project management (HTML/CSS/JS, WebView, Kotlin/Java, Blank)
- 📦 APK build via GitHub Actions (real Gradle builds in the cloud)
- 🏪 Template store with free + paid templates
- 💰 Wallet with bKash/Nagad/Rocket + auto payment gateway
- 👑 Subscription plans (admin can add/edit/delete)
- 📱 Real-time updates via SSE
- 🛡️ Admin panel (dashboard, users, plans, engine, app, payments)
- 📲 Official Android app download system
- 🔔 Push notifications
- 🎁 Referral system

## Admin Login (after seeding)
- Email: `zarif@apkforge.test`
- Password: `secret123`

## Tech Stack
- Next.js 16 (App Router, Turbopack)
- React 19 + TypeScript 5
- Tailwind CSS 4 + shadcn/ui
- Prisma 6 (MySQL)
- Zustand (state management)
- JSZip (project import/packaging)
- Lucide Icons

## Local Development
```bash
bun install
# Set DATABASE_URL in .env to your MySQL database
bun run db:push
bun run dev
```

## APK Signing Keystore
`db/keystore/wevlo-release.jks` is included. The build workflow signs every
APK with it. Keep it identical to published releases.
