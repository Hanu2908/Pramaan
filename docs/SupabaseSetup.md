# Supabase Setup Guide — Pramaan

## Step 1: Create Supabase Project

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Create a new project → name it **pramaan**
3. Note your `Project URL` and `anon` key and `service_role` key from **Settings → API**

## Step 2: Enable Required Extensions

In the Supabase Dashboard → **Database → Extensions**, enable:
- `vector` (pgvector) — for semantic search
- `pg_cron` — for scheduled ingestion
- `pg_net` — for HTTP calls from cron jobs

## Step 3: Link CLI to your project

```bash
supabase login
supabase link --project-ref YOUR_PROJECT_REF
```

## Step 4: Push Database Migrations

```bash
supabase db push
```

This runs all three migrations:
- `001_core_schema.sql` — tables, indexes, RLS, seeded sources/topics
- `002_rpc_functions.sql` — match_evidence() and get_timeline_feed() RPCs
- `003_cron_schedule.sql` — pg_cron jobs for automatic ingestion

## Step 5: Set Secrets for Edge Functions

```bash
supabase secrets set GROQ_API_KEY=gsk_...
supabase secrets set GEMINI_API_KEY=AIza...
supabase secrets set NEWSDATA_API_KEY=pub_...
supabase secrets set GOOGLE_FACTCHECK_API_KEY=AIza...
supabase secrets set ACLED_KEY=...
supabase secrets set ACLED_EMAIL=your@email.com
supabase secrets set REALITY_DEFENDER_KEY=...
```

## Step 6: Set Vault Secrets for pg_cron (in SQL Editor)

```sql
select vault.create_secret(
  'https://YOUR_PROJECT_REF.supabase.co',
  'project_url'
);

select vault.create_secret(
  'YOUR_SERVICE_ROLE_KEY',
  'service_role_key'
);
```

## Step 7: Deploy Edge Functions

```bash
supabase functions deploy ingest-news
supabase functions deploy check-claim
supabase functions deploy fact-check-lookup
```

## Step 8: Set Frontend Environment Variables

Create `pramaan-app/.env.local`:
```
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
```

## Step 9: Manually Trigger First Ingestion

Once deployed, trigger the first ingestion manually to seed the database:

```bash
supabase functions invoke ingest-news --body '{"source":"all"}'
```

## Step 10: Verify

Check `evidence_items` table in the Dashboard Table Editor — rows should be appearing.

---

## Edge Function URLs (once deployed)

| Function | URL |
|---|---|
| `ingest-news` | `https://YOUR_REF.supabase.co/functions/v1/ingest-news` |
| `check-claim` | `https://YOUR_REF.supabase.co/functions/v1/check-claim` |
| `fact-check-lookup` | `https://YOUR_REF.supabase.co/functions/v1/fact-check-lookup` |
