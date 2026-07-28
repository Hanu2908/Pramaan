---
name: ui-ux-pro-max
description: Enforces the premium 2025 "Award-Winning Civic Tech" design system. Stops the generation of generic, AI-slop template UI.
---

# Premium UI/UX Pro Max Skill

When making ANY visual or CSS changes to this project, you must enforce the premium design system established for the Pramaan application.

## 1. The Anti-Template Rule (No AI-Slop)
*   **No Generic Grids**: Avoid standard 3-column equal-height card grids. Use asymmetric, editorial layouts.
*   **No Pointless Text**: Do not add generic badges like "Live Now", "Updated", or "Trending" unless specifically requested and hooked up to real data. Keep the UI ultra-minimal.
*   **No Flat Black/White**: Never use `#000000` or `#FFFFFF` as primary backgrounds.

## 2. Typography Stack
*   **Headlines**: Use `Newsreader` (or similar cinematic serif) for all primary headings (`h1`, `h2`). Often italicized for emphasis.
*   **Body Text**: Use `Manrope` for maximum legibility.
*   **Metadata/Data**: Use `Space Mono` for source names, confidence tags, and timestamps.

## 3. Color Palette: "Grounded Warmth"
*   **Dark Mode Foundation**: Base is Deep Charcoal/Slate (`#0C0D10` to `#16171B`). Text is Warm Off-White (`#E8E6E3`).
*   **Semantic Accents**: Use muted, earthy tones instead of harsh neons.
    *   Confirmed: Sage Green (`#84A98C`)
    *   Developing: Terracotta (`#E07A5F`)
    *   Unverified: Muted Crimson (`#9A3434`)

## 4. Backgrounds & Depth
*   **Liquid Grain**: The primary background must utilize the `.mesh-bg` (slow-moving radial mesh gradients) and `.grain-overlay` (SVG turbulence noise) established in `index.css`.
*   **Glassmorphism**: Use `backdrop-filter: blur(24px)` on floating elements (navbars, modals) to create depth over the grain background.

## 5. Motion
*   **Purposeful Animation**: Use `framer-motion` for staggered reveals and spring physics. No generic "fade-ins".
