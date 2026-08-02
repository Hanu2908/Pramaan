import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { ArrowRight, Search, ShieldCheck, Layers, Cpu, Sparkles } from 'lucide-react';
import { StatsBar } from '../components/StatsBar';

export function Landing() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      style={{ paddingBottom: 100 }}
    >
      {/* Hero Header */}
      <header style={{ marginBottom: 64, maxWidth: 920 }}>
        <p className="eyebrow" style={{ marginBottom: 24, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <Sparkles size={14} style={{ color: 'var(--accent)' }} /> TechFusion 2026 · Civic Intelligence Platform
        </p>

        <h1 style={{ marginBottom: 32, fontSize: 'clamp(36px, 5vw, 64px)', lineHeight: 1.1 }}>
          Verified truth, <br />
          <span style={{ color: 'var(--text-tertiary)' }}>not algorithmic rumour.</span>
        </h1>

        <p style={{ fontSize: 'clamp(17px, 2vw, 22px)', color: 'var(--text-secondary)', maxWidth: '44ch', lineHeight: 1.6, marginBottom: 40 }}>
          India's real-time, multi-source news verification pipeline. Evidence-retrieved via 7-stage forensics, not AI-hallucinated.
        </p>

        {/* CTA Action Buttons */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 48 }}>
          <Link
            to="/timeline"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              padding: '14px 28px',
              borderRadius: 'var(--r-full)',
              background: 'var(--text-primary)',
              color: 'var(--bg-base)',
              fontFamily: 'var(--font-sans)',
              fontSize: 15,
              fontWeight: 600,
              textDecoration: 'none',
              transition: 'transform 0.2s ease, opacity 0.2s ease',
            }}
          >
            Explore Proactive Timeline <ArrowRight size={16} />
          </Link>

          <Link
            to="/checker"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 10,
              padding: '14px 28px',
              borderRadius: 'var(--r-full)',
              background: 'var(--bg-surface-2)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-strong)',
              fontFamily: 'var(--font-sans)',
              fontSize: 15,
              fontWeight: 500,
              textDecoration: 'none',
              transition: 'background 0.2s ease',
            }}
          >
            <Search size={16} /> Verify a Claim
          </Link>
        </div>

        <StatsBar />
      </header>

      {/* Feature Grid Highlighting Architecture */}
      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24, marginTop: 64 }}>
        <div className="glass-panel" style={{ padding: 28 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--bg-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            <Layers size={20} style={{ color: 'var(--accent)' }} />
          </div>
          <h3 style={{ fontSize: 18, marginBottom: 10 }}>Deduplicated Story Clustering</h3>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Cosine-vector similarity over a 48h window clusters multiple sources reporting on the same event under a single story thread.
          </p>
        </div>

        <div className="glass-panel" style={{ padding: 28 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--bg-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            <ShieldCheck size={20} style={{ color: 'var(--confirmed)' }} />
          </div>
          <h3 style={{ fontSize: 18, marginBottom: 10 }}>Source Authority Weighting</h3>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Quantified authority weights (PIB 0.95, The Hindu 0.85, Alt News 0.80) dynamically influence matching engine confidence scoring.
          </p>
        </div>

        <div className="glass-panel" style={{ padding: 28 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: 'var(--bg-surface-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            <Cpu size={20} style={{ color: 'var(--developing)' }} />
          </div>
          <h3 style={{ fontSize: 18, marginBottom: 10 }}>7-Stage Forensics Engine</h3>
          <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
            Groq OCR/Whisper normalization, JSON entity extraction, pgvector search, and Gemini web grounding fallback.
          </p>
        </div>
      </section>
    </motion.div>
  );
}
