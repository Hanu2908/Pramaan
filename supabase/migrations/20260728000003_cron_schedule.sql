-- ============================================================
-- Migration 003: Cron Job Schedule for Ingestion
-- Requires pg_cron and pg_net extensions enabled in Dashboard.
--
-- Schedule: ingest-news runs every 4 hours.
-- IMPORTANT: Replace YOUR_PROJECT_REF and YOUR_SERVICE_ROLE_KEY
-- with real values, or set them via Supabase Vault (recommended).
-- ============================================================

-- Enable required extensions (if not already enabled in Dashboard)
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- ============================================================
-- Store secrets in Vault (run once manually in SQL editor)
-- Uncomment and replace values before running:
-- ============================================================
-- select vault.create_secret(
--   'https://YOUR_PROJECT_REF.supabase.co',
--   'project_url'
-- );
-- select vault.create_secret(
--   'YOUR_SERVICE_ROLE_KEY',
--   'service_role_key'
-- );

-- ============================================================
-- Schedule: Ingest all sources every 4 hours
-- ============================================================
select cron.schedule(
  'pramaan-ingest-all-4h',
  '0 */4 * * *',
  $$
    select net.http_post(
      url := (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'project_url'
      ) || '/functions/v1/ingest-news',
      headers := jsonb_build_object(
        'Content-Type',   'application/json',
        'Authorization',  'Bearer ' || (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'service_role_key'
        )
      ),
      body := '{"source":"all"}'::jsonb
    ) as request_id;
  $$
);

-- ============================================================
-- Schedule: Ingest ACLED separately every 24 hours (API is slower)
-- ============================================================
select cron.schedule(
  'pramaan-ingest-acled-24h',
  '0 2 * * *',
  $$
    select net.http_post(
      url := (
        select decrypted_secret
        from vault.decrypted_secrets
        where name = 'project_url'
      ) || '/functions/v1/ingest-news',
      headers := jsonb_build_object(
        'Content-Type',   'application/json',
        'Authorization',  'Bearer ' || (
          select decrypted_secret
          from vault.decrypted_secrets
          where name = 'service_role_key'
        )
      ),
      body := '{"source":"acled"}'::jsonb
    ) as request_id;
  $$
);

-- View scheduled jobs
-- select * from cron.job;

-- Remove jobs if needed
-- select cron.unschedule('pramaan-ingest-all-4h');
-- select cron.unschedule('pramaan-ingest-acled-24h');
