# Pramaan - India-Focused Verified News Timeline & Claim Checker

Pramaan (Hindi for "proof" or "verified evidence") is a real-time news and verification pipeline designed for fast-moving events (protests, elections, geopolitics) in India. It is a retrieval-augmented system that ingests verified data, stores it, and serves it through two primary interfaces.

## Features

1. **Proactive Timeline**: A chronological, newspaper-style feed of verified updates. Filterable by topic (e.g., Government Claims & Policy, Protests, International Conflict).
2. **Reactive Checker**: A tool where users can paste a claim, screenshot, or voice note. The system checks it against the verified database and returns an evidence-grounded verdict.

## The Two-Lane Model

- **Lane 1: Direct Record**: Undisputed facts from primary sources (ISRO, PIB releases, NewsData.io, Factly). Shown as-is with attribution.
- **Lane 2: Verified Claims**: Contentious news (protests, political claims) that require the full 7-Stage Matching Engine.

## The 7-Stage Matching Engine

1. **Input Normalization**: Convert text, image (Groq Vision OCR), or audio (Groq Whisper) into standard text.
2. **Entity Extraction (NLP)**: Groq extracts location, date range, actors, and topic into a strict JSON schema.
3. **Structured Filtering**: Fast SQL filter against the Supabase evidence store using extracted entities.
4. **Semantic Re-ranking**: Gemini generates embeddings. Compare via cosine similarity (Supabase pgvector).
5. **Confidence Scoring**: Calculate tier based on source agreement, similarity score, source authority, and recency.
6. **Fallback**: Gemini web grounding (labeled "unofficial").
7. **Constrained Synthesis**: Groq explains matched evidence in plain language.

## Data Sources

- **PIB RSS + Telegram Bot API**: Government releases and Fact Checks.
- **Alt News RSS**: Independent fact-checking.
- **ACLED API**: Protest and conflict event data.
- **NewsData.io**: Broad news aggregation.
- **Factly (Web Scraping)**: Additional fact-checking and public data verification.

## Tech Stack

- **Frontend**: React, TypeScript, Vite, Tailwind CSS (UI: Magic UI, KokonutUI, React Bits, Motion, Anime.js, Rive)
- **Backend**: Supabase (PostgreSQL, Edge Functions, Realtime, pgvector)
- **AI/ML**: Groq, Gemini, Reality Defender

## Getting Started

### 1. Backend Setup (Supabase)
This project uses Supabase for database, Edge Functions, and vector search.
The remote database is currently populated with curated initial data and Gemini embeddings.

If you are setting this up locally or pushing to a new project:
1. Install the [Supabase CLI](https://supabase.com/docs/guides/cli).
2. Login and link to your project:
   ```bash
   supabase login
   supabase link --project-ref your_project_ref
   ```
3. Push the database schema:
   ```bash
   supabase db push
   ```
4. Set the Edge Function Secrets (REQUIRED for the ClaimChecker engine):
   ```bash
   supabase secrets set GROQ_API_KEY=your_key GEMINI_API_KEY=your_key
   ```
5. Deploy Edge Functions:
   ```bash
   supabase functions deploy
   ```
6. Run the seed script to populate the database with real records and embeddings:
   ```bash
   cd scripts
   npm install
   # Set environment variables for the seed script
   export SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   export GEMINI_API_KEY=your_gemini_key
   node seed_database.js
   ```

### 2. Frontend Setup (React App)
The frontend is a Vite + React application. The UI is currently connected to the remote Supabase instance.
1. Navigate to the app directory:
   ```bash
   cd pramaan-app
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Environment Variables:
   Create a `.env.local` in `pramaan-app` (the project currently uses the provided Anon Key directly in `src/lib/supabase.ts` for MVP purposes, but this should be moved to `.env.local` for production).
4. Run the development server:
   ```bash
   npm run dev
   ```

## Architecture Documentation
For deeper technical understanding, please refer to the `docs/` folder:
- [Concept & UI Strategy](docs/Concept.md)
- [System Architecture](docs/Architecture.md)
- [Low-Level Design (LLD)](docs/LLD.md)
- [Supabase Setup Guide](docs/SupabaseSetup.md)

## Contributors

<a href="https://github.com/choudharyms/Pramaan/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=choudharyms/Pramaan" alt="Contributors" />
</a>
