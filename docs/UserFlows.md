# User Flows

## 1. Proactive Timeline Flow (Lane 1 & 2 Output)

This flow describes how a user interacts with the real-time news feed.

```mermaid
sequenceDiagram
    participant User
    participant Frontend
    participant Supabase Realtime
    participant DB
    
    User->>Frontend: Opens Pramaan App
    Frontend->>User: Displays Topic Opt-in Screen
    User->>Frontend: Selects "Protests" & "Elections"
    Frontend->>Supabase Realtime: Subscribe to evidence_items (topics=Protests,Elections)
    
    Note over Supabase Realtime,DB: Ingestion engine runs in background...
    DB-->>Supabase Realtime: New evidence inserted
    
    Supabase Realtime-->>Frontend: Push payload
    Frontend->>User: UI Updates (Timeline card appears)
```

## 2. Reactive Checker Flow (7-Stage Engine)

This flow describes the journey of a user verifying a specific piece of information.

```mermaid
sequenceDiagram
    actor User
    participant Frontend
    participant Edge Function
    participant DB
    participant AI Services
    
    User->>Frontend: Submits Claim (Text/Image/Audio)
    Frontend->>Edge Function: POST /check-claim payload
    
    rect rgb(200, 220, 240)
        Note over Edge Function,AI Services: The 7-Stage Engine
        Edge Function->>AI Services: 1. Normalize (Groq Vision/Whisper + Reality Defender)
        AI Services-->>Edge Function: Clean Text + Synthetic Score
        
        Edge Function->>AI Services: 2. Extract Entities (Groq LLM)
        AI Services-->>Edge Function: JSON {location, date, topic}
        
        Edge Function->>DB: 3. Structured SQL Filter
        DB-->>Edge Function: Subset of evidence
        
        Edge Function->>AI Services: 4. Generate Embedding (Gemini)
        AI Services-->>Edge Function: Vector [0.1, 0.4...]
        
        Edge Function->>DB: 4b. Semantic Search (pgvector cosine similarity)
        DB-->>Edge Function: Matched Evidence Items
        
        Note over Edge Function: 5. Calculate Confidence Tier
        
        alt No Match Found
            Edge Function->>AI Services: 6. Fallback (Gemini Web Grounding)
            AI Services-->>Edge Function: Web Results
        end
        
        Edge Function->>AI Services: 7. Constrained Synthesis (Groq)
        AI Services-->>Edge Function: Plain language verdict citing sources
    end
    
    Edge Function->>DB: Save to claim_checks table
    Edge Function-->>Frontend: Return Verdict & Sources
    Frontend->>User: Displays Verdict Card & Confidence Gauge
```
