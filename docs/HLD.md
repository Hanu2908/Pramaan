# High-Level Design (HLD)

## 1. Introduction
Pramaan is an India-focused verification pipeline designed to combat misinformation during fast-moving events. It provides a highly credible "Proactive Timeline" and a "Reactive Checker" for user-submitted claims.

## 2. Core Components

### 2.1 Frontend Client (Vite + React + TypeScript)
- **Framework**: React with Vite for fast HMR and compilation.
- **Styling**: Tailwind CSS, heavily utilizing Magic UI for core components (cards, marquees, grids). KokonutUI and React Bits are used selectively for specific gaps.
- **Animations**: Framer Motion for page/gesture transitions, Anime.js for the confidence gauge, and Rive for the state-driven verdict icon.
- **Deployment**: Hosted on Vercel.

### 2.2 Backend API & Database (Supabase)
- **Database**: PostgreSQL with `pgvector` extension for semantic search and cosine similarity.
- **Realtime**: Supabase Realtime is used to push Lane 1 (Direct Record) updates immediately to the frontend Timeline.
- **Compute**: Supabase Edge Functions manage data ingestion scripts and orchestrate the 7-Stage Matching Engine.

### 2.3 Data Ingestion Engine
Responsible for continuously scraping and receiving verified data.
- **PIB RSS & Telegram**: Government releases and official fact checks.
- **Alt News RSS**: Independent journalism and fact-checking.
- **NewsData.io**: Broad news aggregation (India coverage).
- **Factly (Web Scraping)**: Custom scraping logic to ingest fact-checks and verified public data from Factly.
- **ACLED API**: Protest and conflict tracking.

### 2.4 AI/ML Verification Engine (The 7-Stage Engine)
- **Input Processing**: 
  - Groq Whisper (Audio-to-text)
  - Groq Vision (Image OCR)
  - Reality Defender (Synthetic media detection for image/audio)
- **NLP & Entities**: Groq LLMs used strictly for structuring text into JSON (Location, Date, Actors).
- **Embeddings & Grounding**: Gemini API generates embeddings for claim texts and provides a web-grounding fallback if local DB queries fail.
- **Synthesis**: Groq synthesizes the retrieved SQL/vector data into a user-friendly response, strictly prohibited from hallucinating outside the retrieved context.

## 3. Security & Constraints
- **Neutrality**: Algorithm rules require independent validation (e.g., Alt News or Factly) alongside government claims (PIB) for maximum confidence tiers.
- **No Hallucinations**: Synthesis LLM prompts are heavily constrained.
- **Cost**: The architecture strictly utilizes free-tier APIs, avoiding paid tools like Twitter API or premium video deepfake detection.
