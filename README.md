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

*(Instructions will be added once the initial boilerplate is configured)*

## Contributors

<a href="https://github.com/choudharyms/Pramaan/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=choudharyms/Pramaan" alt="Contributors" />
</a>
