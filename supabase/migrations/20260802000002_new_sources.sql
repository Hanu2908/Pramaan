-- ============================================================
-- Migration 006: Register New Sources
-- Adds Indian Express, The Hindu, Zee News, TV9 Hindi, Vishvas News,
-- and GDELT as new sources with tiered authority weights.
--
-- ANI skipped: B2B wire service, no public RSS feed (403).
-- Jagran skipped: no maintained public RSS feed (404).
-- IANS skipped per user request (no public feed confirmed;
--   Adani Group majority ownership since Dec 2023 would need
--   factoring into authority tier if revisited).
-- ============================================================

-- ── Update sources_type_check constraint ────────────────────
alter table public.sources drop constraint if exists sources_type_check;
alter table public.sources add constraint sources_type_check
  check (type in ('GOV', 'INDEPENDENT', 'AGGREGATOR', 'EVENT_DATA', 'SYNTHETIC_DETECTOR'));

-- ── Direct Record Lane Sources ──────────────────────────────

-- Indian Express: national mainstream English daily, high authority
insert into public.sources (name, type, base_url, authority_level, authority_weight) values
  ('Indian Express', 'AGGREGATOR', 'https://indianexpress.com', 2, 0.85)
on conflict (name) do update set authority_weight = excluded.authority_weight, authority_level = excluded.authority_level;

-- The Hindu: national mainstream English daily, high authority
insert into public.sources (name, type, base_url, authority_level, authority_weight) values
  ('The Hindu', 'AGGREGATOR', 'https://www.thehindu.com', 2, 0.85)
on conflict (name) do update set authority_weight = excluded.authority_weight, authority_level = excluded.authority_level;

-- Zee News: national mainstream English, medium-high authority
insert into public.sources (name, type, base_url, authority_level, authority_weight) values
  ('Zee News', 'AGGREGATOR', 'https://zeenews.india.com', 3, 0.70)
on conflict (name) do update set authority_weight = excluded.authority_weight, authority_level = excluded.authority_level;

-- TV9 Hindi: regional/Hindi outlet, medium authority
insert into public.sources (name, type, base_url, authority_level, authority_weight) values
  ('TV9 Hindi', 'AGGREGATOR', 'https://tv9hindi.com', 4, 0.60)
on conflict (name) do update set authority_weight = excluded.authority_weight, authority_level = excluded.authority_level;

-- GDELT: structured global event data, high authority (research dataset)
insert into public.sources (name, type, base_url, authority_level, authority_weight) values
  ('GDELT', 'EVENT_DATA', 'https://api.gdeltproject.org', 2, 0.85)
on conflict (name) do update set authority_weight = excluded.authority_weight, authority_level = excluded.authority_level;


-- ── Verified Claims Lane Sources ────────────────────────────

-- Vishvas News: India-focused fact-checker (IFCN certified)
-- Scored on its own track record, not blended into general authority.
insert into public.sources (name, type, base_url, authority_level, authority_weight) values
  ('Vishvas News', 'INDEPENDENT', 'https://vishvasnews.com', 2, 0.78)
on conflict (name) do update set authority_weight = excluded.authority_weight, authority_level = excluded.authority_level;


-- ── Extend ingestion_queue source_type constraint ───────────
-- Add 'gdelt' to the allowed source_type values for the queue.
-- We need to drop and recreate the check constraint.
alter table public.ingestion_queue drop constraint if exists ingestion_queue_source_type_check;
alter table public.ingestion_queue add constraint ingestion_queue_source_type_check
  check (source_type in ('rss', 'telegram', 'acled', 'newsdata', 'gdelt'));


-- ── New cron schedules for GDELT ────────────────────────────
-- GDELT DOC API: poll every 30 minutes for India events
select cron.schedule(
  'pramaan-ingest-gdelt-30m',
  '*/30 * * * *',
  $cron$
    do $body$
    declare
      v_project_url text;
      v_service_key text;
    begin
      select decrypted_secret into v_project_url
      from vault.decrypted_secrets where name = 'project_url' limit 1;
      select decrypted_secret into v_service_key
      from vault.decrypted_secrets where name = 'service_role_key' limit 1;

      if v_project_url is not null and v_service_key is not null then
        perform net.http_post(
          url := v_project_url || '/functions/v1/ingest-gdelt',
          headers := jsonb_build_object(
            'Content-Type',  'application/json',
            'Authorization', 'Bearer ' || v_service_key
          ),
          body := '{}'::jsonb
        );
      end if;
    end $body$;
  $cron$
);
