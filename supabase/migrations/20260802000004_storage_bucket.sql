-- ============================================================
-- Migration 008: Storage Bucket for Evidence Uploads
-- Enables public file uploads for image OCR and audio transcription.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('evidence_uploads', 'evidence_uploads', true)
on conflict (id) do update set public = true;

-- Drop existing policies if any
drop policy if exists "Public Access Evidence Uploads" on storage.objects;
drop policy if exists "Public Insert Evidence Uploads" on storage.objects;

-- Allow public read access to evidence_uploads bucket
create policy "Public Access Evidence Uploads"
  on storage.objects for select
  using ( bucket_id = 'evidence_uploads' );

-- Allow public insert access to evidence_uploads bucket
create policy "Public Insert Evidence Uploads"
  on storage.objects for insert
  with check ( bucket_id = 'evidence_uploads' );
