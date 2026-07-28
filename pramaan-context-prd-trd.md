# Pramaan: AI Model Context, PRD, TRD & Rules

This document serves as the comprehensive context, Product Requirements Document (PRD), Technical Requirements Document (TRD), and rule set for any AI agent or developer working on the **Pramaan** project.

## 1. Project Context
**Project Name:** Pramaan (Hindi for "proof" or "verified evidence")
**Target Event:** TechFusion Innovation Challenge 2026 (AI & ML Track)
**The Problem:** During fast-moving events (protests, elections, geopolitics), false information spreads faster than confirmed updates. Users default to algorithm-driven platforms (Instagram, X) where rumor mixes with fact. 
**The Solution:** An India-focused, real-time news and verification pipeline. A retrieval-augmented system that ingests verified data, stores it, and serves it through two interfaces (Timeline and Checker). *It is not a chatbot wrapper.*

---

## 2. Product Requirements Document (PRD)

### 2.1 Core Interfaces
1.  **Proactive Timeline:** A chronological, newspaper-style feed of verified updates. Filterable by topic (e.g., Government Claims & Policy, Protests, International Conflict).
2.  **Reactive Checker:** A tool where users can paste a claim, screenshot, or voice note. The system checks it against the verified database and returns an evidence-grounded verdict.

### 2.2 Feed Philosophy (Strict Rules)
*   **No Inferred Personalization:** Do not build recommendation algorithms based on user behavior.
*   **Identical Ranking:** Importance ranking is rule-based (source authority, recency, severity) and identical for every user.
*   **Transparent Sources:** Every claim must clearly cite its source.

### 2.3 Out of Scope (Do Not Build)
*   **Direct Ingestion from X (Twitter) or Reddit:** Cut due to lack of free API access.
*   **Official X Account Monitoring:** Deferred to Phase 2.
*   **Text-based "Fake News" Classifier:** Do not build a black-box text classifier. Fake text lacks forensic artifacts; rely on the Retrieval/Matching Engine instead.
*   **Video Deepfake Detection:** Deferred to Phase 2 (Reality Defender API is image/audio only for the free tier).

---

## 3. Technical Requirements Document (TRD)

### 3.1 Architecture: The Two-Lane Model
Not all ingested data needs ML verification. Route incoming data into two lanes:
*   **Lane 1: Direct Record:** Undisputed facts from primary sources (ISRO, PIB releases, NewsData.io). Shown as-is with attribution.
*   **Lane 2: Verified Claims:** Contentious news (protests, political claims) that require the full 7-Stage Matching Engine.

### 3.2 The 7-Stage Matching Engine (Critical Flow)
This engine powers both the proactive feed (auto-corroboration) and the reactive checker.
1.  **Input Normalization:** Convert text, image (Groq Vision OCR), or audio (Groq Whisper) into standard `claim_text`. Append `synthetic_score` via Reality Defender.
2.  **Entity Extraction (NLP):** Groq extracts location, date range, actors, and topic into a strict JSON schema.
3.  **Structured Filtering:** Fast SQL filter against the Supabase evidence store using extracted entities.
4.  **Semantic Re-ranking:** Gemini generates embeddings for `claim_text`. Compare via cosine similarity (Supabase pgvector).
5.  **Confidence Scoring:** Calculate tier (Confirmed / Developing / Unverified / No Record Found) based on source agreement, similarity score, source authority, and recency. *Note: PIB Fact Check alone is insufficient for top-tier; requires agreement with an independent source like Alt News.*
6.  **Fallback:** If Stage 4 yields nothing, use Gemini web grounding (strictly labeled "unofficial").
7.  **Constrained Synthesis:** Groq explains matched evidence in plain language. *Must cite sources by name; must not state anything unsupported by evidence.*

### 3.3 Data Sources & Constraints
*   **PIB RSS + Telegram:** Live. Government releases and Fact Checks.
*   **Alt News RSS:** Near-daily. Independent fact-checking (vital for balance against PIB).
*   **ACLED API:** Weekly. Protest and conflict event data.
*   **NewsData.io:** Live. Broad news aggregation.
*   **Reality Defender:** Free tier (50/month) for image/audio synthetic detection.
*   **Groq (Whisper/Vision/LLM):** 2,000 requests/day for Whisper; use existing API key.
*   **Gemini:** Embeddings and fallback web grounding.

### 3.4 Tech Stack
*   **Frontend:** React, TypeScript, Vite, Tailwind CSS (UI: Magic UI, KokonutUI, React Bits, Motion, Anime.js, Rive, Bklit).
*   **Backend/Database:** Supabase (PostgreSQL, Edge Functions, Realtime, pgvector).
*   **Ingestion:** RSS parsing, Telegram Bot API, ACLED API, NewsData.io.
*   **AI/ML:** Groq, Gemini, Reality Defender.
*   **Hosting:** Vercel (Frontend), Supabase (Backend).

---

## 4. AI Agent Rules & Progress Checklist

### 4.1 Strict Operating Rules for AI Models
1.  **Architecture Adherence:** Do not deviate from the Two-Lane Model or the 7-Stage Matching Engine.
2.  **No Hallucinations:** When generating code for Stage 7 (Synthesis), enforce strict system prompts to prevent the LLM from using outside knowledge. It must *only* summarize retrieved context.
3.  **Free Tier Awareness:** Do not implement features that require paid APIs (e.g., Twitter API, Reddit API, paid video detection).
4.  **Dependency Checks:** Ensure Stage 3 (SQL filtering) is fully operational before testing Stage 4 (Semantic Re-ranking).
5.  **Maintain Neutrality:** Ensure the logic requiring Alt News agreement with PIB is strictly coded to avoid government bias.

### 4.2 5-Day Sprint Progress Checklist
Use this checklist to track development progress. Mark as `[x]` when complete.

**Day 1: Ingestion & Infrastructure**
- [ ] Initialize Git repository.
- [ ] Set up Supabase project and schema (including pgvector).
- [ ] Build ingestion script: PIB RSS.
- [ ] Build ingestion script: PIB Telegram Bot API.

**Day 2: External Data & Matching Logic**
- [ ] Build ingestion script: ACLED API pull.
- [ ] Build ingestion script: Alt News RSS pull.
- [ ] Implement Stage 1: Normalization (Groq OCR / Whisper + Reality Defender).
- [ ] Implement Stage 2: Entity Extraction (Groq -> JSON).
- [ ] Implement Stage 3 & 4: Retrieval logic (Supabase SQL + pgvector semantic search).

**Day 3: Frontend Foundations**
- [ ] Setup Vite + React + TypeScript + Tailwind.
- [ ] Build Proactive Timeline view.
- [ ] Build Topic Filters (Government, Protests, Conflict).
- [ ] Build Reactive Checker UI (Text input, File upload for img/audio).

**Day 4: AI Synthesis & Integration**
- [ ] Implement Stage 5: Confidence Scoring logic.
- [ ] Implement Stage 6: Fallback (Gemini Grounding).
- [ ] Implement Stage 7: Constrained Synthesis (Groq LLM integration).
- [ ] End-to-end testing of the 7-Stage pipeline with test data.
- [ ] Finalize architecture diagram and wireframes for submission.

**Day 5: Polish & Submission**
- [ ] Polish UI with micro-animations (Magic UI, Framer Motion).
- [ ] Finalize concept document and pitch deck.
- [ ] Deploy frontend to Vercel.
- [ ] Submit project.
