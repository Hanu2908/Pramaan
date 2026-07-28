// ─── Pramaan Mock Data ───────────────────────────────────────────
export type ConfidenceTier = 'confirmed' | 'developing' | 'unverified' | 'norecord';
export type TopicCategory  = 'all' | 'government' | 'protests' | 'conflict' | 'health' | 'deepfake';
export type LaneType       = 'direct' | 'verified';
export type SourceName     = 'PIB RSS' | 'Alt News' | 'ACLED' | 'NewsData.io' | 'Gemini Grounding' | 'Reality Defender';

export interface NewsItem {
  id: string;
  headline: string;
  summary: string;
  confidence: ConfidenceTier;
  lane: LaneType;
  topic: TopicCategory;
  sources: SourceName[];
  timestamp: string;
  location?: string;
  isSynthetic?: boolean;
  syntheticScore?: number;
}

export interface EvidenceSnippet { source: SourceName; snippet: string; }
export interface CheckResult {
  confidence: ConfidenceTier;
  summary: string;
  evidence: EvidenceSnippet[];
  isFallback: boolean;
  entities: { location?: string; date?: string; actors?: string[]; topic?: string; };
}

export const MOCK_NEWS: NewsItem[] = [
  {
    id: '1',
    headline: 'ISRO successfully launches NVS-02 navigation satellite from Sriharikota',
    summary: "India's space agency confirms NVS-02 placed in geosynchronous transfer orbit. Second satellite in the NavIC constellation, strengthening India's indigenous navigation infrastructure.",
    confidence: 'confirmed', lane: 'direct', topic: 'government',
    sources: ['PIB RSS', 'NewsData.io'],
    timestamp: new Date(Date.now() - 1.5 * 3600000).toISOString(),
    location: 'Sriharikota, Andhra Pradesh',
  },
  {
    id: '2',
    headline: "Farmer convoy resumes near Shambhu border; tension reported, clashes unconfirmed",
    summary: "ACLED records two conflict-adjacent events near the Punjab–Haryana Shambhu border. Alt News monitoring viral clips alleging police action — no independent fact-check published yet. Labeled 'Developing' pending second-source corroboration.",
    confidence: 'developing', lane: 'verified', topic: 'protests',
    sources: ['ACLED', 'Alt News'],
    timestamp: new Date(Date.now() - 4 * 3600000).toISOString(),
    location: 'Shambhu, Haryana',
  },
  {
    id: '3',
    headline: 'Viral video claiming Indian Army withdrawal from Depsang is AI-generated',
    summary: 'Reality Defender returns synthetic score of 0.94 — high confidence this is AI-generated video. No corroborating evidence from PIB or ACLED. Visual artefacts consistent with face-swap diffusion model.',
    confidence: 'unverified', lane: 'verified', topic: 'deepfake',
    sources: ['Alt News'],
    timestamp: new Date(Date.now() - 7 * 3600000).toISOString(),
    location: 'Depsang Plains, Ladakh',
    isSynthetic: true, syntheticScore: 0.94,
  },
  {
    id: '4',
    headline: 'Cabinet approves ₹22,000 crore PLI extension for semiconductor manufacturing',
    summary: 'Official PIB release confirms Cabinet approval. Scheme extended to cover ATMP (Assembly, Testing, Marking and Packaging) facilities in addition to wafer fabrication.',
    confidence: 'confirmed', lane: 'direct', topic: 'government',
    sources: ['PIB RSS'],
    timestamp: new Date(Date.now() - 10 * 3600000).toISOString(),
  },
  {
    id: '5',
    headline: 'Fresh clashes reported in Churachandpur; ACLED records two incidents',
    summary: 'Armed conflict events logged by ACLED in Churachandpur district, 26 July 2026. PIB and Alt News have not independently corroborated. Casualty figures from social media remain unverified.',
    confidence: 'developing', lane: 'verified', topic: 'conflict',
    sources: ['ACLED'],
    timestamp: new Date(Date.now() - 13 * 3600000).toISOString(),
    location: 'Churachandpur, Manipur',
  },
  {
    id: '6',
    headline: 'Health Ministry issues advisory on JN.1 subvariant resurgence in 4 states',
    summary: 'PIB confirms official Ministry advisory covering Maharashtra, Kerala, Tamil Nadu, and Karnataka. No emergency declaration issued. Booster uptake recommended for 60+ and immunocompromised.',
    confidence: 'confirmed', lane: 'direct', topic: 'health',
    sources: ['PIB RSS'],
    timestamp: new Date(Date.now() - 18 * 3600000).toISOString(),
  },
];

export const MOCK_CHECK: CheckResult = {
  confidence: 'developing',
  summary: "Based on retrieved evidence, ACLED records two conflict-adjacent events near Churachandpur on 26 July 2026. However, no independent corroboration has been received from PIB or Alt News at this time. This claim is labeled 'Developing' — the highest 'Confirmed' tier requires agreement between at least two independent sources, of which PIB alone is insufficient per Pramaan's bias-mitigation rules.",
  evidence: [
    { source: 'ACLED', snippet: 'Armed clash between state forces and non-state armed group, Churachandpur district, 26 Jul 2026. Fatalities: unconfirmed. Source coding: violence against civilians (provisional).' },
    { source: 'Alt News', snippet: 'Monitoring social media claims about Manipur clashes. No fact-check article published as of 27 Jul 00:30 IST. Clips under review.' },
  ],
  isFallback: false,
  entities: { location: 'Churachandpur, Manipur', date: '26 Jul 2026', actors: ['State security forces', 'Non-state armed group'], topic: 'conflict' },
};

export const PIPELINE_STAGES = [
  { id: 1, label: 'Input Normalization',   tool: 'Groq Vision OCR / Whisper',        desc: 'Converts text, image, or audio to claim_text. Appends synthetic_score if media is involved.' },
  { id: 2, label: 'Entity Extraction',     tool: 'Groq NLP → JSON',                  desc: 'Extracts location, date range, actors, and topic into a structured JSON schema.' },
  { id: 3, label: 'Structured Filtering',  tool: 'Supabase SQL',                     desc: 'Fast SQL filter against the tagged evidence store using extracted entities.' },
  { id: 4, label: 'Semantic Re-ranking',   tool: 'Gemini Embeddings + pgvector',     desc: 'Cosine similarity search over embedded claim against candidate evidence.' },
  { id: 5, label: 'Confidence Scoring',    tool: 'Logic Engine',                     desc: 'Combines source agreement, similarity, authority, and recency into a tier.' },
  { id: 6, label: 'Fallback (if needed)',  tool: 'Gemini Grounding',                 desc: 'Only triggers if Stage 4 returns nothing. Labeled unofficial.' },
  { id: 7, label: 'Constrained Synthesis', tool: 'Groq LLM',                         desc: 'Explains matched evidence in plain language. Never cites unverified sources.' },
];

export const SOURCES_META = [
  { name: 'PIB RSS' as SourceName,         cadence: 'Live',       role: 'Gov releases + official Fact Checks', color: 'var(--src-pib)',      note: 'Never sufficient alone for Confirmed tier — bias safeguard.' },
  { name: 'Alt News' as SourceName,        cadence: 'Near-daily', role: 'Independent fact-checking',           color: 'var(--src-altnews)',   note: 'Required co-signatory for highest tier alongside PIB.' },
  { name: 'NewsData.io' as SourceName,     cadence: 'Live',       role: 'Broad aggregation (Direct lane)',      color: 'var(--src-newsdata)',  note: 'Free tier permits demo/deployed use.' },
  { name: 'ACLED' as SourceName,           cadence: 'Weekly',     role: 'Protest & conflict event data',        color: 'var(--src-acled)',     note: 'Free after registration. Repositioned as corroboration layer.' },
  { name: 'Reality Defender' as SourceName,cadence: 'On-demand',  role: 'Deepfake / synthetic media detection', color: 'var(--src-reality)',   note: 'Free tier: 50 req/month. Image + audio only. Video is Phase 2.' },
  { name: 'Gemini Grounding' as SourceName,cadence: 'Fallback',   role: 'Web grounding (unofficial fallback)',  color: 'var(--src-gemini)',    note: 'Always labeled unofficial. Never primary source.' },
];
