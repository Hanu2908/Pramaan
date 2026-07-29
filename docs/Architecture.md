# Pramaan Architecture

This document provides a visual and structural overview of the Pramaan system architecture.

## High-Level System Flow

```mermaid
flowchart TD
    subgraph Ingestion["Data Ingestion Sources"]
        PIB[PIB RSS & Telegram]
        AltNews[Alt News RSS]
        ACLED[ACLED API]
        NewsData[NewsData.io]
        Factly[Factly Web Scraping]
    end

    subgraph Backend["Supabase (Backend)"]
        EdgeIngest[Edge Function: Ingest]
        DB[(PostgreSQL + pgvector)]
        EdgeCheck[Edge Function: Check Claim]
    end

    subgraph AIEngine["AI/ML Services"]
        GroqVision[Groq Vision OCR]
        GroqWhisper[Groq Whisper]
        RealityDef[Reality Defender]
        GroqLLM[Groq LLM: Entity & Synthesis]
        Gemini[Gemini: Embeddings & Grounding]
    end

    subgraph Frontend["React Frontend (Vite)"]
        Timeline[Proactive Timeline UI]
        Checker[Reactive Checker UI]
    end

    PIB --> EdgeIngest
    AltNews --> EdgeIngest
    ACLED --> EdgeIngest
    NewsData --> EdgeIngest
    Factly --> EdgeIngest

    EdgeIngest --> DB

    DB -->|Realtime Push| Timeline
    
    Checker -->|User Input| EdgeCheck
    EdgeCheck <--> AIEngine
    EdgeCheck <--> DB
    EdgeCheck -->|Verdict & Confidence| Checker
```

## The Two-Lane Model

Incoming data is categorized into two lanes to optimize processing and ensure reliability.

```mermaid
flowchart LR
    Data[Incoming News Data]
    
    Data --> Lane1{Is it an undisputed primary source?}
    
    Lane1 -->|Yes| Direct[Lane 1: Direct Record]
    Lane1 -->|No| Contentious[Lane 2: Verified Claims]

    Direct --> UI1[Display directly on Timeline with attribution]
    Contentious --> Engine[7-Stage Matching Engine]
    Engine --> UI2[Display Verdict & Synthesized Evidence]
```

## The 7-Stage Matching Engine

This engine powers the reactive checker and processes contentious news for the timeline.

```mermaid
flowchart TD
    Input[User Input: Text, Image, or Audio]
    
    S1[Stage 1: Input Normalization]
    S1a(Groq Vision / Whisper)
    S1b(Reality Defender Synthetic Score)
    
    S2[Stage 2: Entity Extraction]
    S2a(Groq LLM: Location, Date, Actors, Topic -> JSON)
    
    S3[Stage 3: Structured Filtering]
    S3a(SQL query against Supabase using entities)
    
    S4[Stage 4: Semantic Re-ranking]
    S4a(Gemini Embeddings + pgvector cosine similarity)
    
    S5[Stage 5: Confidence & Refutation Scoring]
    S5a(Rules: CONFIRMED, REFUTED, DEVELOPING, UNVERIFIED, NO_RECORD based on agreement & refutation keywords)
    
    S6[Stage 6: Fallback]
    S6a(If S4 is empty: Gemini Web Grounding)
    
    S7[Stage 7: Constrained Synthesis]
    S7a(Groq LLM explains matched evidence. No outside knowledge.)
    
    Verdict[Final Verdict & Cited Sources]

    Input --> S1
    S1 --- S1a & S1b
    S1 --> S2
    S2 --- S2a
    S2 --> S3
    S3 --- S3a
    S3 --> S4
    S4 --- S4a
    S4 --> S5
    S5 --- S5a
    S5 -->|Match found| S7
    S5 -->|No match| S6
    S6 --> S7
    S7 --- S7a
    S7 --> Verdict
```
