# Contributing to Pramaan

Thank you for your interest in contributing to Pramaan! As part of the TechFusion Innovation Challenge 2026, we are maintaining a rapid 5-day build cycle.

## Branching Strategy

We use a simple feature branch workflow:
- `main` is our stable branch.
- Create feature branches off `main` (e.g., `feature/ingestion-pib`, `ui/timeline-feed`).
- Submit Pull Requests to `main`.

## Commit Messages

Please follow the Conventional Commits format:
- `feat: [description]` for new features
- `fix: [description]` for bug fixes
- `docs: [description]` for documentation
- `chore: [description]` for routine tasks

## AI Agent Rules

If you are an AI agent contributing to this project, you must adhere strictly to these rules:
1. **Architecture Adherence:** Do not deviate from the Two-Lane Model or the 7-Stage Matching Engine outlined in our TRD.
2. **No Hallucinations:** When generating code for Stage 7 (Synthesis), enforce strict system prompts to prevent the LLM from using outside knowledge. It must *only* summarize retrieved context.
3. **Free Tier Awareness:** Do not implement features that require paid APIs (e.g., Twitter API, Reddit API, paid video detection).
4. **Dependency Checks:** Ensure Stage 3 (SQL filtering) is fully operational before testing Stage 4 (Semantic Re-ranking).
5. **Maintain Neutrality:** Ensure the logic requiring independent source agreement with government sources is strictly coded to avoid bias.

## Development Environment Setup

*(Detailed setup instructions will be added here once the Vite+React and Supabase configurations are in place.)*

## Contributors

Thank you to everyone who helps build Pramaan! 

<a href="https://github.com/choudharyms/Pramaan/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=choudharyms/Pramaan" alt="Contributors" />
</a>
