-- ============================================================
-- Migration 001: Core Schema Setup & pgvector
-- Pramaan — TechFusion Innovation Challenge 2026
-- ============================================================

-- Enable the pgvector extension for semantic search
create extension if not exists vector with schema extensions;

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ============================================================
-- TABLE: sources
-- Registry of all ingested data sources with authority metadata.
-- Used by the Matching Engine to weight evidence appropriately.
-- ============================================================
create table public.sources (
  id            uuid primary key default uuid_generate_v4(),
  name          text not null unique,
  type          text not null check (type in ('GOV', 'INDEPENDENT', 'AGGREGATOR')),
  authority_level integer not null check (authority_level between 1 and 10),
  base_url      text not null,
  rss_url       text,
  created_at    timestamptz not null default now()
);

comment on table public.sources is 'Registry of all data sources. authority_level (1-10) is used in Stage 5 confidence scoring.';
comment on column public.sources.type is 'GOV=government, INDEPENDENT=independent journalism, AGGREGATOR=news aggregator';
comment on column public.sources.authority_level is '10=highest trust (e.g. PIB), 1=lowest. Requires independent corroboration for GOV sources.';

-- Seed initial sources
insert into public.sources (name, type, authority_level, base_url, rss_url) values
  ('PIB',       'GOV',         8,  'https://pib.gov.in',        'https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3'),
  ('PIB Fact Check', 'GOV',    7,  'https://factcheck.pib.gov.in', 'https://factcheck.pib.gov.in/api/rss'),
  ('Alt News',  'INDEPENDENT', 9,  'https://www.altnews.in',    'https://www.altnews.in/feed/'),
  ('Factly',    'INDEPENDENT', 8,  'https://factly.in',         'https://factly.in/category/fact-check/feed/'),
  ('NewsData.io','AGGREGATOR', 5,  'https://newsdata.io',       null),
  ('ACLED',     'AGGREGATOR',  9,  'https://acleddata.com',     null),
  ('Google Fact Check', 'AGGREGATOR', 6, 'https://toolbox.google.com/factcheck', null);

-- ============================================================
-- TABLE: topics
-- Predefined filterable categories for the Proactive Timeline.
-- No algorithmic personalization — user selects topics explicitly.
-- ============================================================
create table public.topics (
  id    uuid primary key default uuid_generate_v4(),
  slug  text not null unique,
  name  text not null,
  icon  text,
  "order" integer not null default 0
);

comment on table public.topics is 'Predefined topics for user-controlled timeline filtering. No ML-based personalization.';

insert into public.topics (slug, name, icon, "order") values
  ('government',       'Government & Policy',    '🏛️', 1),
  ('protests',         'Protests & Civil Unrest', '✊', 2),
  ('elections',        'Elections',              '🗳️', 3),
  ('international',    'International Conflict', '🌐', 4),
  ('science-tech',     'Science & Technology',   '🔬', 5),
  ('health',           'Health & Medicine',      '🏥', 6),
  ('economy',          'Economy & Finance',      '📈', 7),
  ('disaster',         'Disasters & Crisis',     '🚨', 8);

-- ============================================================
-- TABLE: evidence_items
-- Core store of all ingested & normalized facts.
-- Lane 1 (is_direct_record=true): trusted primary source facts.
-- Lane 2 (is_direct_record=false): contentious items that need matching engine.
-- ============================================================
create table public.evidence_items (
  id                  uuid primary key default uuid_generate_v4(),
  source_id           uuid not null references public.sources(id) on delete cascade,
  topic_id            uuid references public.topics(id) on delete set null,

  -- Content
  raw_content         text not null,
  normalized_content  text not null,
  headline            text,
  source_url          text,
  image_url           text,

  -- Location/Date entities (extracted in Stage 2)
  entities            jsonb default '{}',   -- {location, date_range, actors, keywords}

  -- Lane classification
  is_direct_record    boolean not null default false,

  -- Semantic vector (Gemini text-embedding-004 → 768 dimensions)
  embedding           extensions.vector(768),

  -- Metadata
  published_at        timestamptz,
  ingested_at         timestamptz not null default now(),
  language            text not null default 'en',
  is_archived         boolean not null default false
);

comment on table public.evidence_items is 'Core evidence store. embedding uses pgvector for Stage 4 semantic re-ranking.';
comment on column public.evidence_items.is_direct_record is 'true = Lane 1 (Direct Record), false = Lane 2 (requires Matching Engine)';
comment on column public.evidence_items.embedding is 'Gemini text-embedding-004, 768 dimensions. Populated async after ingestion.';
comment on column public.evidence_items.entities is 'JSON: {location: string, date_range: {start, end}, actors: string[], keywords: string[], topic_slug: string}';

-- Indexes for fast retrieval
create index evidence_items_source_id_idx    on public.evidence_items(source_id);
create index evidence_items_topic_id_idx     on public.evidence_items(topic_id);
create index evidence_items_published_at_idx on public.evidence_items(published_at desc);
create index evidence_items_entities_idx     on public.evidence_items using gin(entities);
create index evidence_items_lane_idx         on public.evidence_items(is_direct_record);

-- HNSW index for fast approximate nearest-neighbor search (pgvector)
-- Better recall and no training step vs IVFFlat. Recommended for Supabase.
create index evidence_items_embedding_idx on public.evidence_items
  using hnsw (embedding extensions.vector_cosine_ops);

-- ============================================================
-- TABLE: claim_checks
-- Stores every user verification request and its full result.
-- ============================================================
create table public.claim_checks (
  id                  uuid primary key default uuid_generate_v4(),

  -- Input
  user_input          text not null,
  input_type          text not null default 'text' check (input_type in ('text', 'image', 'audio')),
  media_url           text,

  -- Stage 1 outputs
  normalized_text     text,
  synthetic_score     numeric(4,3),   -- 0.000–1.000 from Reality Defender
  is_synthetic        boolean,        -- true if synthetic_score > 0.7

  -- Stage 2 outputs
  extracted_entities  jsonb default '{}',

  -- Stage 5 outputs
  confidence_tier     text check (confidence_tier in ('CONFIRMED', 'DEVELOPING', 'UNVERIFIED', 'NO_RECORD')),
  confidence_score    numeric(5,4),   -- 0.0000–1.0000 composite score

  -- Stage 6 fallback
  used_web_grounding  boolean not null default false,
  web_grounding_note  text,

  -- Stage 7 output
  synthesized_verdict text,
  verdict_sources     jsonb default '[]', -- [{name, url, excerpt}]

  -- Status
  status              text not null default 'pending' check (status in ('pending', 'processing', 'complete', 'error')),
  error_message       text,

  created_at          timestamptz not null default now(),
  completed_at        timestamptz
);

comment on table public.claim_checks is 'User-submitted verification requests. Tracks all 7 stages of the Matching Engine.';
comment on column public.claim_checks.synthetic_score is 'From Reality Defender. >0.7 = likely synthetic/deepfake.';
comment on column public.claim_checks.confidence_tier is 'CONFIRMED: multi-source verified. DEVELOPING: partial match. UNVERIFIED: conflicting. NO_RECORD: not in DB.';

create index claim_checks_status_idx     on public.claim_checks(status);
create index claim_checks_created_at_idx on public.claim_checks(created_at desc);

-- ============================================================
-- TABLE: evidence_matches
-- Join table: which evidence items supported a specific verdict.
-- ============================================================
create table public.evidence_matches (
  id               uuid primary key default uuid_generate_v4(),
  claim_check_id   uuid not null references public.claim_checks(id) on delete cascade,
  evidence_item_id uuid not null references public.evidence_items(id) on delete cascade,
  similarity_score numeric(6,5),   -- cosine similarity from pgvector (0–1)
  match_stage      text not null check (match_stage in ('sql_filter', 'semantic', 'web_grounding')),
  created_at       timestamptz not null default now(),
  unique(claim_check_id, evidence_item_id)
);

create index evidence_matches_claim_idx    on public.evidence_matches(claim_check_id);
create index evidence_matches_evidence_idx on public.evidence_matches(evidence_item_id);

-- ============================================================
-- ROW LEVEL SECURITY
-- Public read for evidence_items and topics (open data principle).
-- claim_checks are private — only accessible via service role (Edge Functions).
-- ============================================================
alter table public.sources        enable row level security;
alter table public.topics         enable row level security;
alter table public.evidence_items enable row level security;
alter table public.claim_checks   enable row level security;
alter table public.evidence_matches enable row level security;

-- Public can read sources, topics, and direct-record evidence
create policy "public_read_sources"  on public.sources        for select using (true);
create policy "public_read_topics"   on public.topics         for select using (true);
create policy "public_read_evidence" on public.evidence_items for select using (true);

-- claim_checks: public can insert (submit a claim), only service role can update/delete
create policy "public_insert_claims" on public.claim_checks   for insert with check (true);
create policy "public_read_claims"   on public.claim_checks   for select using (true);

-- evidence_matches: only readable via service role (no direct public access)
create policy "service_read_matches" on public.evidence_matches for select using (auth.role() = 'service_role');
