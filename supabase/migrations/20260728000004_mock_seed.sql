-- ============================================================
-- Migration 004: Mock Seed Data for MVP Demo
-- Injects verified records into the DB so the frontend has
-- data to display without needing live API keys.
-- ============================================================

DO $$
DECLARE
  pib_source_id uuid;
  altnews_source_id uuid;
  pol_topic_id uuid;
  health_topic_id uuid;
  fake_vector vector(768);
BEGIN
  -- Get source IDs
  SELECT id INTO pib_source_id FROM public.sources WHERE name = 'PIB Fact Check' LIMIT 1;
  SELECT id INTO altnews_source_id FROM public.sources WHERE name = 'Alt News' LIMIT 1;
  
  -- Get topic IDs
  SELECT id INTO pol_topic_id FROM public.topics WHERE name = 'Politics' LIMIT 1;
  SELECT id INTO health_topic_id FROM public.topics WHERE name = 'Public Health' LIMIT 1;

  -- Create a dummy 768-dimensional vector
  SELECT array_agg(0.001::real)::vector INTO fake_vector FROM generate_series(1, 768);

  -- Insert Mock Record 1 (Lane 1: Government Direct Record)
  INSERT INTO public.evidence_items 
    (source_id, topic_id, raw_content, normalized_content, embedding, published_at, source_url, is_direct_record, headline, entities)
  VALUES (
    pib_source_id, 
    pol_topic_id, 
    'A fake notification is circulating claiming the Ministry of Finance has introduced a new tax on cash withdrawals. This is FALSE. No such tax exists.', 
    'fake notification circulating claiming ministry finance introduced new tax cash withdrawals false no such tax exists', 
    fake_vector, 
    now() - interval '2 hours', 
    'https://pib.gov.in/mock1', 
    true, 
    'Fake Tax Notification',
    '{"verdict": "FALSE"}'::jsonb
  ) ;

  -- Insert Mock Record 2 (Lane 2: Independent Verification)
  INSERT INTO public.evidence_items 
    (source_id, topic_id, raw_content, normalized_content, embedding, published_at, source_url, is_direct_record, headline, entities)
  VALUES (
    altnews_source_id, 
    health_topic_id, 
    'Viral video claims a local hospital is turning away dengue patients. Investigation shows the video is from 2019 in a different country.', 
    'viral video claims local hospital turning away dengue patients investigation shows video 2019 different country', 
    fake_vector, 
    now() - interval '5 hours', 
    'https://altnews.in/mock2', 
    false, 
    'Old hospital video shared as recent dengue crisis',
    '{"verdict": "MISLEADING"}'::jsonb
  ) ;

  -- Insert Mock Record 3 (Lane 1: Government Direct Record)
  INSERT INTO public.evidence_items 
    (source_id, topic_id, raw_content, normalized_content, embedding, published_at, source_url, is_direct_record, headline, entities)
  VALUES (
    pib_source_id, 
    health_topic_id, 
    'Claims regarding a new variant of COVID-19 causing immediate paralysis are completely baseless. The Ministry of Health advises citizens to ignore such WhatsApp forwards.', 
    'claims regarding new variant covid19 causing immediate paralysis completely baseless ministry health advises citizens ignore whatsapp forwards', 
    fake_vector, 
    now() - interval '1 day', 
    'https://pib.gov.in/mock3', 
    true, 
    'WhatsApp Forward on New COVID Variant',
    '{"verdict": "FAKE"}'::jsonb
  ) ;

END $$;
