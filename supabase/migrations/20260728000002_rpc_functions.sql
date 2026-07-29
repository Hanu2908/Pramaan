-- ============================================================
-- Migration 002: RPC Functions for pgvector Semantic Search & Timeline Feed
-- Called by the Matching Engine (Stage 4) and React Frontend via supabase.rpc()
-- ============================================================

-- ============================================================
-- FUNCTION: match_evidence
-- Stage 4: Cosine similarity search against evidence_items.
-- Uses gemini-embedding-001 vectors (768 dims).
-- Includes source_name and source_type via JOIN.
-- ============================================================
create or replace function public.match_evidence(
  query_embedding extensions.vector(768),
  match_threshold  float    default 0.60,
  match_count      int      default 10,
  filter_topic_id  uuid     default null,
  filter_source_ids uuid[]  default null
)
returns table (
  id               uuid,
  headline         text,
  normalized_content text,
  source_url       text,
  published_at     timestamptz,
  source_id        uuid,
  source_name      text,
  source_type      text,
  topic_id         uuid,
  entities         jsonb,
  is_direct_record boolean,
  similarity       float
)
language sql stable
as $$
  select
    e.id,
    e.headline,
    e.normalized_content,
    e.source_url,
    e.published_at,
    e.source_id,
    s.name as source_name,
    s.type as source_type,
    e.topic_id,
    e.entities,
    e.is_direct_record,
    1 - (e.embedding <=> query_embedding) as similarity
  from public.evidence_items e
  left join public.sources s on s.id = e.source_id
  where
    e.embedding is not null
    and e.is_archived = false
    and 1 - (e.embedding <=> query_embedding) > match_threshold
    and (filter_topic_id is null or e.topic_id = filter_topic_id)
    and (filter_source_ids is null or e.source_id = any(filter_source_ids))
  order by similarity desc
  limit match_count;
$$;

comment on function public.match_evidence is
  'Stage 4 semantic re-ranking. Cosine similarity via pgvector HNSW with source_name JOIN.';

-- ============================================================
-- FUNCTION: get_timeline_feed
-- Efficient paginated query for the Proactive Timeline UI.
-- Returns topic_slug, entities, and calculates confidence_tier.
-- ============================================================
create or replace function public.get_timeline_feed(
  topic_slugs   text[]    default null,
  cursor_date   timestamptz default now(),
  page_size     int       default 20,
  lane          text      default 'all'  -- 'all' | 'direct' | 'verified'
)
returns table (
  id               uuid,
  headline         text,
  normalized_content text,
  source_url       text,
  image_url        text,
  published_at     timestamptz,
  ingested_at      timestamptz,
  is_direct_record boolean,
  topic_slug       text,
  topic_name       text,
  source_name      text,
  source_type      text,
  authority_level  int,
  entities         jsonb,
  confidence_tier  text
)
language sql stable
as $$
  select
    e.id,
    e.headline,
    e.normalized_content,
    e.source_url,
    e.image_url,
    e.published_at,
    e.ingested_at,
    e.is_direct_record,
    coalesce(t.slug, 'government') as topic_slug,
    coalesce(t.name, 'Government & Policy') as topic_name,
    s.name    as source_name,
    s.type    as source_type,
    s.authority_level,
    coalesce(e.entities, '{}'::jsonb) as entities,
    case
      when (lower(e.headline || ' ' || e.normalized_content) ~* '(fake|false|hoax|busted|debunked|misleading|untrue)') then 'refuted'
      when e.is_direct_record = true then 'confirmed'
      when s.authority_level <= 2 then 'developing'
      else 'unverified'
    end as confidence_tier
  from public.evidence_items e
  join public.sources s on s.id = e.source_id
  left join public.topics t on t.id = e.topic_id
  where
    e.is_archived = false
    and e.published_at < cursor_date
    and (topic_slugs is null or t.slug = any(topic_slugs))
    and (
      lane = 'all'
      or (lane = 'direct'   and e.is_direct_record = true)
      or (lane = 'verified' and e.is_direct_record = false)
    )
  order by e.published_at desc
  limit page_size;
$$;

comment on function public.get_timeline_feed is
  'Paginated timeline feed RPC. Returns topic_slug, entities, and calculated confidence_tier.';

-- Enable Realtime
alter table public.evidence_items replica identity full;
alter publication supabase_realtime add table public.evidence_items;

alter table public.claim_checks replica identity full;
alter publication supabase_realtime add table public.claim_checks;
