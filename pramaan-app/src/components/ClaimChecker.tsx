import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, ArrowRight } from 'lucide-react';
import { PIPELINE_STAGES, type CheckResult } from '../data/mockData';

function PipelineMinimal({ currentStage, done }: { currentStage: number; done: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.4 }}
      style={{ padding: '32px 0', borderBottom: '1px solid var(--border)' }}>
      
      <p className="eyebrow" style={{ marginBottom: 24, color: done ? 'var(--confirmed)' : 'var(--text-secondary)' }}>
        {done ? 'PIPELINE COMPLETE' : 'EXECUTING FORENSICS PIPELINE...'}
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
        {PIPELINE_STAGES.map((stage) => {
          const isComplete = currentStage > stage.id;
          const isActive = currentStage === stage.id;
          
          return (
            <motion.div key={stage.id}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              style={{
                paddingLeft: 12, borderLeft: `2px solid ${isActive ? 'var(--accent)' : isComplete ? 'var(--border-strong)' : 'var(--border)'}`,
                opacity: isComplete || isActive ? 1 : 0.4
              }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span className="mono" style={{ fontSize: 10, color: isActive ? 'var(--accent)' : 'var(--text-tertiary)' }}>
                  0{stage.id}
                </span>
                {isActive && (
                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                    <Loader2 size={12} style={{ color: 'var(--accent)' }} />
                  </motion.div>
                )}
              </div>
              <div style={{ fontFamily: 'var(--font-sans)', fontSize: 13, fontWeight: 500, color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)' }}>
                {stage.label}
              </div>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}

function ResultForensics({ result }: { result: CheckResult }) {
  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }} style={{ paddingTop: 32 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 48 }} className="main-grid">
        
        {/* Left: Summary & Evidence */}
        <div>
          <h3 style={{ marginBottom: 16, color: `var(--${result.confidence})` }}>Verdict: {result.confidence.charAt(0).toUpperCase() + result.confidence.slice(1)}</h3>
          <p style={{ fontSize: 16, lineHeight: 1.8, color: 'var(--text-primary)', marginBottom: 40 }}>
            {result.summary}
          </p>

          <p className="eyebrow" style={{ marginBottom: 16 }}>Retrieved Evidence</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {result.evidence.map((ev, i) => (
              <div key={i} style={{ paddingLeft: 16, borderLeft: '1px solid var(--border-strong)' }}>
                <span className="mono" style={{ fontSize: 11, color: 'var(--text-secondary)', display: 'block', marginBottom: 8 }}>{ev.source}</span>
                <p style={{ fontSize: 14, color: 'var(--text-tertiary)', lineHeight: 1.6 }}>"{ev.snippet}"</p>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Extracted Entities (Data view) */}
        <div>
          <div className="glass-panel" style={{ padding: 24 }}>
            <p className="eyebrow" style={{ marginBottom: 20 }}>Stage 2: Entities</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {Object.entries(result.entities).map(([k, v]) => (
                <div key={k}>
                  <div className="mono" style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 4 }}>{k}</div>
                  <div style={{ fontFamily: 'var(--font-sans)', fontSize: 14, color: 'var(--text-primary)' }}>
                    {Array.isArray(v) ? v.join(' • ') : String(v)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </motion.div>
  );
}

export function ClaimChecker() {
  const [query, setQuery] = useState('');
  const [checking, setChecking] = useState(false);
  const [stage, setStage] = useState(0);
  const [result, setResult] = useState<CheckResult | null>(null);

  async function run() {
    if (!query.trim()) return;
    setResult(null); setChecking(true); setStage(0);

    // Simulate stage progression for UI (Edge function does this fast, we just animate it)
    const stageInterval = setInterval(() => {
      setStage(s => (s < 7 ? s + 1 : s));
    }, 400);

    try {
      const response = await fetch('https://isqdqjubveytsvzyusyq.supabase.co/functions/v1/check-claim', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImlzcWRxanVidmV5dHN2enl1c3lxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxOTc4MzAsImV4cCI6MjEwMDc3MzgzMH0.NyD06h8j84FiWl00Cn0RAiIWnGEZzWt0N7k_iOPgK7k` // Anon key
        },
        body: JSON.stringify({ text: query })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to check claim");
      }

      clearInterval(stageInterval);
      setStage(7);

      setResult({
        confidence: data.tier.toLowerCase() as any,
        summary: data.verdict,
        evidence: (data.sources || []).map((s: any) => ({
          source: s.name,
          snippet: s.excerpt
        })),
        entities: {
          topic: "Extracted during Edge Function retrieval"
        },
        isFallback: false
      });
    } catch (e) {
      console.error(e);
      clearInterval(stageInterval);
      alert("Error checking claim. Make sure Edge Function secrets are set.");
      setChecking(false);
      return;
    }

    await new Promise(r => setTimeout(r, 200));
    setChecking(false);
  }

  const showPipeline = checking || (result !== null && stage >= 7);

  return (
    <div style={{ paddingBottom: 80 }}>
      <div style={{ maxWidth: 800, marginBottom: 40 }}>
        <p className="eyebrow" style={{ marginBottom: 12 }}>Reactive Forensics</p>
        <textarea 
          className="input-elegant" 
          rows={1}
          placeholder="Enter a claim to verify..."
          value={query} 
          onChange={e => {
            setQuery(e.target.value);
            e.target.style.height = 'auto';
            e.target.style.height = e.target.scrollHeight + 'px';
          }}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); run(); } }}
        />
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
          <span className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>Press Enter to verify. Cross-references live civic databases.</span>
          <button className="btn-icon" onClick={run} disabled={checking || !query.trim()} style={{ background: query.trim() ? 'var(--text-primary)' : 'transparent', color: query.trim() ? 'var(--bg-base)' : 'var(--text-secondary)' }}>
            <ArrowRight size={18} />
          </button>
        </div>
      </div>

      <AnimatePresence>
        {showPipeline && <PipelineMinimal currentStage={stage} done={!checking && stage === 7} />}
      </AnimatePresence>

      <AnimatePresence>
        {result && <ResultForensics result={result} />}
      </AnimatePresence>
      
      <style>{`
        @media (max-width: 768px) {
          .main-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  );
}
