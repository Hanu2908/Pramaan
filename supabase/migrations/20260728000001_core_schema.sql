-- ============================================================
-- Migration 001: Core Schema for Pramaan News Engine
-- Includes pgvector extension, sources, topics, evidence_items,
-- claim_checks, and evidence_matches.
-- ============================================================

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "vector" with schema extensions;

-- ============================================================
-- TABLE: sources
-- Catalog of all ingested sources with authority level.
-- authority_level: 1 (highest / primary gov) to 10 (lowest)
-- ============================================================
create table public.sources (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null unique,
  type            text not null check (type in ('GOV', 'INDEPENDENT', 'AGGREGATOR', 'EVENT_DATA', 'SYNTHETIC_DETECTOR')),
  base_url        text,
  authority_level int  not null default 5 check (authority_level between 1 and 10),
  is_active       boolean not null default true,
  created_at      timestamptz not null default now()
);

-- Seed initial sources
insert into public.sources (name, type, base_url, authority_level) values
  ('PIB',              'GOV',                'https://pib.gov.in',                1),
  ('Alt News',         'INDEPENDENT',        'https://altnews.in',                2),
  ('Factly',           'INDEPENDENT',        'https://factly.in',                 2),
  ('ACLED',            'EVENT_DATA',         'https://acleddata.com',             2),
  ('NewsData.io',      'AGGREGATOR',         'https://newsdata.io',               4),
  ('Reality Defender', 'SYNTHETIC_DETECTOR', 'https://realitydefender.com',       1)
on conflict (name) do nothing;

-- ============================================================
-- TABLE: topics
-- Categorization tags for timeline items.
-- ============================================================
create table public.topics (
  id          uuid primary key default uuid_generate_v4(),
  slug        text not null unique,
  name        text not null,
  icon        text,
  sort_order  int  not null default 0
);

-- Seed initial topics (includes conflict & deepfake)
insert into public.topics (slug, name, icon, sort_order) values
  ('government',    'Government & Policy',    '🏛️', 1),
  ('protests',      'Protests & Civil Unrest','✊', 2),
  ('elections',     'Elections & Politics',   '🗳️', 3),
  ('conflict',       'Conflict & Security',    '🛡️', 4),
  ('international', 'International Conflict', '🌐', 5),
  ('science-tech',  'Science & Technology',   '🔬', 6),
  ('health',        'Health & Medicine',      '🏥', 7),
  ('deepfake',      'Deepfakes & Synthetic',  '🤖', 8),
  ('economy',       'Economy & Finance',      '📈', 9),
  ('disaster',      'Disasters & Crisis',     '🚨', 10)
on conflict (slug) do nothing;

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

  -- Archival flag (for soft deletes / data retention)
  is_archived         boolean not null default false,

  -- Timestamps
  published_at        timestamptz default now(),
  ingested_at         timestamptz not null default now()
);

-- HNSW index for fast cosine similarity search
create index on public.evidence_items
  using hnsw (embedding extensions.vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- Standard B-tree indices
create index idx_evidence_source    on public.evidence_items (source_id);
create index idx_evidence_topic     on public.evidence_items (topic_id);
create index idx_evidence_published on public.evidence_items (published_at desc);

-- ============================================================
-- TABLE: claim_checks
-- Audit log for every user query submitted to the Reactive Checker.
-- Stores full 7-stage output for debugging, re-scoring & analytics.
-- ============================================================
create table public.claim_checks (
  id                    uuid primary key default uuid_generate_v4(),

  -- Input payload
  user_input            text not null,
  input_type            text not null default 'text' check (input_type in ('text', 'image', 'audio')),
  media_url             text,

  -- Stage 1: Normalization
  normalized_text       text,
  synthetic_score       float,
  is_synthetic          boolean,

  -- Stage 2: Entity Extraction
  extracted_entities    jsonb default '{}',

  -- Stage 5 & 7: Output
  confidence_tier       text check (confidence_tier in ('CONFIRMED', 'REFUTED', 'DEVELOPING', 'UNVERIFIED', 'NO_RECORD')),
  confidence_score      float,
  used_web_grounding    boolean default false,
  web_grounding_note    text,
  synthesized_verdict   text,
  verdict_sources       jsonb default '[]',  -- array of {name, url, excerpt, similarity}

  -- Execution tracking
  status                text not null default 'processing' check (status in ('processing', 'complete', 'error')),
  error_message         text,
  created_at            timestamptz not null default now(),
  completed_at          timestamptz
);

create index idx_claim_checks_created on public.claim_checks (created_at desc);

-- ============================================================
-- TABLE: evidence_matches
-- Junction table tracking which evidence_items matched a claim_check.
-- ============================================================
create table public.evidence_matches (
  id                uuid primary key default uuid_generate_v4(),
  claim_check_id    uuid not null references public.claim_checks(id) on delete cascade,
  evidence_item_id  uuid not null references public.evidence_items(id) on delete cascade,
  similarity_score  float not null,
  match_stage       text not null check (match_stage in ('sql_filter', 'semantic')),
  created_at        timestamptz not null default now()
);

create index idx_matches_claim    on public.evidence_matches (claim_check_id);
create index idx_matches_evidence on public.evidence_matches (evidence_item_id);
