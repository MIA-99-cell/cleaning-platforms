# Deploy frontend on Vercel

## 1. Push latest code to GitHub

From the project root:

```powershell
cd "C:\Users\Emmanuela\Desktop\cleaning report"
git add .
git commit -m "Prepare frontend for Vercel"
git push
```

## 2. Create Vercel project

1. Go to https://vercel.com and sign up with **GitHub**.
2. Click **Add New… → Project**.
3. Import **MIA-99-cell/cleaning-platforms**.
4. Settings:
   - **Framework Preset:** Vite
   - **Root Directory:** `frontend` (click Edit, select `frontend`)
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
5. **Environment Variables** (add now or after backend is live):
   - `VITE_API_URL` = `https://YOUR-BACKEND-URL/api` (see step 4 below)
   - `VITE_SUPABASE_URL` = same as in your local `frontend/.env`
   - `VITE_SUPABASE_ANON_KEY` = same as local (public anon key is OK)
6. Click **Deploy**.

Your site will be like: `https://cleaning-platforms.vercel.app`

## 3. Does the app work without `.env` on GitHub?

**Yes.** Secrets stay off GitHub. You paste the same values into **Vercel → Project → Settings → Environment Variables** (and later into your backend host).

## 4. Backend (required for login, bookings, payments)

Vercel hosts the **React frontend only**. The **Node backend** must run elsewhere (e.g. [Render](https://render.com) free tier):

- Root directory: `backend`
- Start: `npm start`
- Add all variables from `backend/.env.example` (real values)

Then on Vercel, set:

`VITE_API_URL` = `https://your-backend.onrender.com/api`

Redeploy Vercel. On the backend, set:

`FRONTEND_URL` = your Vercel URL (for CORS and email links).

## 5. Local development (unchanged)

Keep using `frontend/.env` with:

`VITE_API_URL=http://localhost:5000/api`

If unset, the app uses `/api` and Vite proxy (as before).
