-- ============================================================
-- Migration 007: Update get_timeline_feed RPC with story_id & cluster_count
-- ============================================================

-- Drop old function signature first
drop function if exists public.get_timeline_feed(text[], timestamptz, int, text);

create or replace function public.get_timeline_feed(
  topic_slugs   text[]    default null,
  cursor_date   timestamptz default now(),
  page_size     int       default 20,
  lane          text      default 'all'
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
  authority_weight float,
  entities         jsonb,
  confidence_tier  text,
  story_id         uuid,
  cluster_count    bigint
)
language sql stable
as $$
  with story_counts as (
    select coalesce(story_id, id) as story_root, count(*) as cnt
    from public.evidence_items
    where is_archived = false
    group by coalesce(story_id, id)
  )
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
    coalesce(s.authority_weight, 0.5)::float as authority_weight,
    coalesce(e.entities, '{}'::jsonb) as entities,
    case
      when (lower(e.headline || ' ' || e.normalized_content) ~* '(fake|false|hoax|busted|debunked|misleading|untrue)') then 'refuted'
      when e.is_direct_record = true then 'confirmed'
      when coalesce(s.authority_weight, 0.5) >= 0.75 then 'developing'
      else 'unverified'
    end as confidence_tier,
    coalesce(e.story_id, e.id) as story_id,
    coalesce(c.cnt, 1) as cluster_count
  from public.evidence_items e
  join public.sources s on s.id = e.source_id
  left join public.topics t on t.id = e.topic_id
  left join story_counts c on c.story_root = coalesce(e.story_id, e.id)
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
  'Paginated timeline feed RPC with story_id and cluster_count for dedup UI.';
