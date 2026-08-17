# Supabase setup

1. Create a Supabase project, then open its SQL Editor and run [supabase-schema.sql](supabase-schema.sql). If the project already exists, run the updated script again to add the progress-restoration column.
2. In Vercel, open the project’s **Settings → Environment Variables** and add:
   - `SUPABASE_URL` — the Project URL from Supabase’s API settings.
   - `SUPABASE_SERVICE_ROLE_KEY` — the service-role key from the same screen. Do not put this key in the browser or commit it to Git.
   - `ADMIN_PASSWORD` — a strong password for [admin.html](admin.html). This is checked only by the server and must not be committed to Git.
3. Redeploy the Vercel project.

The site registers a learner by name and email. It records video/check progress and marks `completed_at` only when the server independently scores a submitted capstone at 12 or more out of 15. When a learner enters a previously registered email, their saved videos, knowledge checks, and latest capstone result are restored from Supabase. Query `training_records` in Supabase to see completions; `training_attempts` keeps each scored submission.

Open `/admin.html` and enter `ADMIN_PASSWORD` to view completed learners, their capstone scores, and completion dates. The page itself contains no learner data; it receives records only from the password-protected `/api/admin` endpoint.
