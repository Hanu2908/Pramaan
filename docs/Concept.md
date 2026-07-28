# TechFusion — Pramaan Concept

## The Problem
During fast-moving events—such as protests, elections, or geopolitical conflicts—false information spreads faster than confirmed updates. Users often default to algorithm-driven platforms (like Instagram or X) where rumor freely mixes with fact. There is a lack of a centralized, verified, and objective source of truth that operates in real-time.

## The Solution: Pramaan
**Pramaan** (Hindi for "proof" or "verified evidence") is an India-focused, real-time news and verification pipeline. It is a retrieval-augmented system designed to ingest verified data, store it securely, and serve it to users through two primary interfaces. 

**Important Note**: Pramaan is *not* a chatbot wrapper. It is a highly structured verification engine built on deterministic rules and transparent citations.

## The Core Interfaces

### 1. Proactive Timeline
A chronological, newspaper-style feed of verified updates. 
- **No Inferred Personalization**: We do not build recommendation algorithms based on user behavior, preventing echo chambers.
- **Rule-Based Ranking**: Importance ranking is based on source authority, recency, and severity. The feed is identical for every user who selects the same topics.
- **Filterable**: Users can filter by topics such as Government Claims & Policy, Protests, or International Conflict.

### 2. Reactive Checker
A tool where users can paste a text claim, screenshot, or voice note. The system checks the input against our verified database and returns an evidence-grounded verdict (e.g., Confirmed, Developing, Unverified, or No Record Found).

## How We Ensure Trust: The Two-Lane Model

Not all ingested data requires machine learning verification. We route incoming data into two lanes:

- **Lane 1: Direct Record**: Undisputed facts from primary sources (e.g., ISRO, PIB releases, NewsData.io, Factly). These are shown as-is, with direct attribution to the source.
- **Lane 2: Verified Claims**: Contentious news (e.g., protests, political claims) that require rigorous fact-checking. These claims pass through our 7-Stage Matching Engine, which normalizes the input, extracts entities, filters against our database, calculates confidence scoring, and ultimately synthesizes a grounded verdict.

By explicitly separating direct records from contentious claims, Pramaan ensures high performance while maintaining strict neutrality and transparency.
