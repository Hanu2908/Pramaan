-- ============================================================
-- Migration 005: Dedup Layer + Source Authority Weight + Ingestion Queue
-- Tasks 1, 2, 3 — Additive only, no drops or renames.
-- ============================================================

-- ============================================================
-- TASK 1: Deduplication — story_id clustering
-- Items covering the same real-world event share a story_id.
-- First item in a cluster uses its own id as story_id.
-- ============================================================

alter table public.evidence_items
  add column if not exists story_id uuid references public.evidence_items(id) on delete set null;

create index if not exists idx_evidence_story_id
  on public.evidence_items (story_id);

-- RPC: find best duplicate within a time window using cosine similarity
create or replace function public.find_duplicate_evidence(
  query_embedding       extensions.vector(768),
  time_window_hours     int   default 48,
  similarity_threshold  float default 0.90
)
returns table (
  id          uuid,
  story_id    uuid,
  similarity  float
)
language sql stable
as $$
  select
    e.id,
    e.story_id,
    1 - (e.embedding <=> query_embedding) as similarity
  from public.evidence_items e
  where
    e.embedding is not null
    and e.is_archived = false
    and e.ingested_at >= now() - (time_window_hours || ' hours')::interval
    and 1 - (e.embedding <=> query_embedding) >= similarity_threshold
  order by similarity desc
  limit 1;
$$;

comment on function public.find_duplicate_evidence is
  'Task 1 dedup: finds the single best cosine-similar evidence_item within a time window.';


-- ============================================================
-- TASK 2: Source Authority Weighting
-- Float 0-1 column alongside the existing int authority_level.
-- ============================================================

alter table public.sources
  add column if not exists authority_weight float not null default 0.5
    check (authority_weight between 0 and 1);

-- Seed PIB Fact Check as a separate source row
insert into public.sources (name, type, base_url, authority_level, authority_weight) values
  ('PIB Fact Check', 'GOV', 'https://t.me/PIB_FactCheck', 1, 0.95)
on conflict (name) do update set authority_weight = excluded.authority_weight;

-- Seed weights for existing sources by tier
update public.sources set authority_weight = 0.95 where name = 'PIB';
update public.sources set authority_weight = 0.80 where name = 'Alt News';
update public.sources set authority_weight = 0.75 where name = 'Factly';
update public.sources set authority_weight = 0.90 where name = 'ACLED';
update public.sources set authority_weight = 0.55 where name = 'NewsData.io';
update public.sources set authority_weight = 0.85 where name = 'Reality Defender';

-- Google Fact Check may or may not exist — conditional update
update public.sources set authority_weight = 0.70 where name = 'Google Fact Check';


-- ============================================================
-- TASK 3: Ingestion Queue
-- Each source fetcher writes here; drain-queue worker reads.
-- ============================================================

create table if not exists public.ingestion_queue (
  id            uuid primary key default uuid_generate_v4(),
  source_name   text not null,
  source_type   text not null check (source_type in ('rss', 'telegram', 'acled', 'newsdata')),
  payload       jsonb not null,
  status        text not null default 'pending'
                  check (status in ('pending', 'processing', 'done', 'error')),
  error_message text,
  created_at    timestamptz not null default now(),
  processed_at  timestamptz
);

create index if not exists idx_ingestion_queue_status
  on public.ingestion_queue (status, created_at asc);

-- RLS: service_role only (no anon access)
alter table public.ingestion_queue enable row level security;
-- No anon policies = anon key cannot read or write this table.


-- ============================================================
-- TASK 3: Replace cron schedules
-- Unschedule the old monolithic jobs, add per-source + drain jobs.
-- Uses safe try/catch to avoid errors if old jobs don't exist.
-- ============================================================

-- Remove old cron jobs (safe: select returns nothing if name doesn't exist)
select cron.unschedule('pramaan-ingest-all-4h');
select cron.unschedule('pramaan-ingest-acled-24h');

-- Per-source ingestion schedules
-- Each calls a lightweight Edge Function that writes to ingestion_queue
select cron.schedule(
  'pramaan-ingest-rss-4h',
  '0 */4 * * *',
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
          url := v_project_url || '/functions/v1/ingest-rss',
          headers := jsonb_build_object(
            'Content-Type',  'application/json',
            'Authorization', 'Bearer ' || v_service_key
          ),
          body := '{"sources":["all"]}'::jsonb
        );
      end if;
    end $body$;
  $cron$
);

select cron.schedule(
  'pramaan-ingest-telegram-4h',
  '15 */4 * * *',
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
          url := v_project_url || '/functions/v1/ingest-telegram',
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

select cron.schedule(
  'pramaan-ingest-acled-weekly',
  '0 2 * * 1',
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
          url := v_project_url || '/functions/v1/ingest-acled',
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

select cron.schedule(
  'pramaan-ingest-newsdata-4h',
  '30 */4 * * *',
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
          url := v_project_url || '/functions/v1/ingest-newsdata',
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

-- Queue drain worker: runs every 15 minutes
select cron.schedule(
  'pramaan-drain-queue-15m',
  '*/15 * * * *',
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
          url := v_project_url || '/functions/v1/drain-queue',
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
