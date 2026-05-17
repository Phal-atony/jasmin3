# JASMINTOPUP — Deploy to Render + Neon (Free, ~10 min)

## Step 1 — Create Neon database (2 min)

1. Go to https://neon.tech → **Sign up** (GitHub login fastest)
2. Create Project → name it `jasmintopup` → pick region **Singapore** (closest to KH)
3. Copy the **connection string**:
   ```
   postgresql://neondb_owner:xxxxx@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
   ```
   **Save this — you need it in Step 2.**

## Step 2 — Seed the database locally (1 min)

Create a temporary `.env` file in the project folder:
```
DATABASE_URL="<paste your Neon connection string here>"
ADMIN_JWT_SECRET="any-long-random-string-min-32-chars-here"
```

Then run:
```bash
npx prisma db push
npm run db:seed
```

This creates all tables in Neon and loads your games + admin user.

## Step 3 — Push to GitHub (2 min)

```bash
git init
git add .
git commit -m "Initial commit"
```

Create a new private repo on https://github.com/new, then:
```bash
git remote add origin https://github.com/YOUR_USERNAME/jasmintopup.git
git branch -M main
git push -u origin main
```

## Step 4 — Deploy on Render (3 min)

1. Go to https://render.com → Sign up with GitHub
2. Click **New → Web Service** → connect your `jasmintopup` repo
3. Set these in Render dashboard under **Environment**:

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | your Neon connection string |
   | `ADMIN_JWT_SECRET` | your 32+ char random string |
   | `ADMIN_EMAIL` | `admin@jasmintopup.com` |
   | `ADMIN_PASSWORD` | your admin password |
   | `NEXT_PUBLIC_BASE_URL` | leave blank for now |
   | `PAYMENT_SIMULATION_MODE` | `true` for testing; `false` for real payments |
   | `KHPAY_FALLBACK_TO_SIMULATION` | `false` (`true` only for preview/demo while fixing KHPay 401/403) |
   | `CLOUDINARY_CLOUD_NAME` | from Cloudinary dashboard |
   | `CLOUDINARY_API_KEY` | from Cloudinary dashboard |
   | `CLOUDINARY_API_SECRET` | from Cloudinary dashboard |
   | `KHPAY_BASE_URL` | `https://khpay.site/api/v1` |

4. Build Command: `npm install && npm run build`
5. Start Command: `npm run start`
6. Click **Deploy** → wait ~3 min

## Step 5 — Post-deploy

1. Copy your live URL (e.g. `https://jasmintopup.onrender.com`)
2. Render dashboard → **Environment** → set `NEXT_PUBLIC_BASE_URL` to that URL
3. Click **Manual Deploy** → done

## ✅ You're live

- Public site: `https://jasmintopup.onrender.com`
- Admin panel: `https://jasmintopup.onrender.com/admin/login`

## ⚠️ Render Free Tier Note

Free services sleep after 15 min of inactivity — first request after sleep takes ~30s.
Use https://uptimerobot.com (free) to ping your site every 14 min to keep it awake,
or upgrade to Render's $7/month plan.

## When you're ready for real payments

Set `PAYMENT_SIMULATION_MODE=false`, `KHPAY_FALLBACK_TO_SIMULATION=false`, and fill in `KHPAY_API_KEY` + `KHPAY_WEBHOOK_SECRET`
from your KHPay merchant dashboard → redeploy. If Vercel shows `KHPay: HTTP 403`, verify the API key/payment settings in KHPay first.
