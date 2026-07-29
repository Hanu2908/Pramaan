-- ============================================================
-- Migration 003: Cron Job Schedule for Ingestion
-- Requires pg_cron and pg_net extensions enabled in Dashboard.
--
-- Schedule: ingest-news runs every 4 hours.
-- Now includes fallback logic if Vault secrets are not yet configured.
-- ============================================================

-- Enable required extensions
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

-- ============================================================
-- Schedule: Ingest all sources every 4 hours
-- Safely attempts to fetch Vault secret, or skips gracefully
-- ============================================================
select cron.schedule(
  'pramaan-ingest-all-4h',
  '0 */4 * * *',
  $$
    do $$
    declare
      v_project_url text;
      v_service_key text;
    begin
      select decrypted_secret into v_project_url
      from vault.decrypted_secrets
      where name = 'project_url'
      limit 1;

      select decrypted_secret into v_service_key
      from vault.decrypted_secrets
      where name = 'service_role_key'
      limit 1;

      if v_project_url is not null and v_service_key is not null then
        perform net.http_post(
          url := v_project_url || '/functions/v1/ingest-news',
          headers := jsonb_build_object(
            'Content-Type',  'application/json',
            'Authorization', 'Bearer ' || v_service_key
          ),
          body := '{"source":"all"}'::jsonb
        );
      end if;
    end $$;
  $$
);

-- ============================================================
-- Schedule: Ingest ACLED separately every 24 hours
-- ============================================================
select cron.schedule(
  'pramaan-ingest-acled-24h',
  '0 2 * * *',
  $$
    do $$
    declare
      v_project_url text;
      v_service_key text;
    begin
      select decrypted_secret into v_project_url
      from vault.decrypted_secrets
      where name = 'project_url'
      limit 1;

      select decrypted_secret into v_service_key
      from vault.decrypted_secrets
      where name = 'service_role_key'
      limit 1;

      if v_project_url is not null and v_service_key is not null then
        perform net.http_post(
          url := v_project_url || '/functions/v1/ingest-news',
          headers := jsonb_build_object(
            'Content-Type',  'application/json',
            'Authorization', 'Bearer ' || v_service_key
          ),
          body := '{"source":"acled"}'::jsonb
        );
      end if;
    end $$;
  $$
);
