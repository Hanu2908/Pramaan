-- ============================================================
-- Migration 004: Cleaned Mock Seed Data for MVP Demo
-- Injects verified records with proper Foreign Key mappings
-- ============================================================

-- Clean up orphan records with NULL source_id
DELETE FROM public.evidence_items WHERE source_id IS NULL;

DO $$
DECLARE
  pib_source_id uuid;
  altnews_source_id uuid;
  elec_topic_id uuid;
  health_topic_id uuid;
  fake_vector vector(768);
BEGIN
  -- Get source IDs
  SELECT id INTO pib_source_id FROM public.sources WHERE name = 'PIB' LIMIT 1;
  SELECT id INTO altnews_source_id FROM public.sources WHERE name = 'Alt News' LIMIT 1;
  
  -- Get topic IDs by slug
  SELECT id INTO elec_topic_id FROM public.topics WHERE slug = 'elections' LIMIT 1;
  SELECT id INTO health_topic_id FROM public.topics WHERE slug = 'health' LIMIT 1;

  -- Create a dummy 768-dimensional vector
  SELECT array_agg(0.001::real)::vector INTO fake_vector FROM generate_series(1, 768);

  IF pib_source_id IS NOT NULL AND elec_topic_id IS NOT NULL THEN
    INSERT INTO public.evidence_items 
      (source_id, topic_id, raw_content, normalized_content, embedding, published_at, source_url, is_direct_record, headline, entities)
    VALUES (
      pib_source_id, 
      elec_topic_id, 
      'A fake notification is circulating claiming the Election Commission introduced online voting for non-resident citizens. This is FALSE. ECI has not enabled online voting.', 
      'fake notification circulating claiming election commission introduced online voting non resident citizens false eci not enabled online voting', 
      fake_vector, 
      now() - interval '2 hours', 
      'https://pib.gov.in/press-release-mock-1', 
      true, 
      'Fake Notification on ECI Online Voting Scheme',
      '{"verdict": "FALSE"}'::jsonb
    ) ON CONFLICT DO NOTHING;
  END IF;

  IF altnews_source_id IS NOT NULL AND health_topic_id IS NOT NULL THEN
    INSERT INTO public.evidence_items 
      (source_id, topic_id, raw_content, normalized_content, embedding, published_at, source_url, is_direct_record, headline, entities)
    VALUES (
      altnews_source_id, 
      health_topic_id, 
      'Viral video claims a local hospital is turning away dengue patients due to scarcity of beds. Investigation shows the video is from 2019 in a different country.', 
      'viral video claims local hospital turning away dengue patients investigation shows video 2019 different country', 
      fake_vector, 
      now() - interval '5 hours', 
      'https://altnews.in/mock-dengue-video-factcheck', 
      false, 
      'Old hospital video shared as recent dengue crisis',
      '{"verdict": "MISLEADING"}'::jsonb
    ) ON CONFLICT DO NOTHING;
  END IF;

END $$;
