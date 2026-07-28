import { useState, useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Navbar } from './components/Navbar';
import { NewsList } from './components/NewsCard';
import { ClaimChecker } from './components/ClaimChecker';
import { ThemeProvider } from './context/ThemeContext';
import { MOCK_NEWS, SOURCES_META, type TopicCategory, type NewsItem } from './data/mockData';
import { supabase } from './lib/supabase';
import './index.css';

const TOPICS: { id: TopicCategory; label: string }[] = [
  { id: 'all',        label: 'Latest' },
  { id: 'government', label: 'Government' },
  { id: 'protests',   label: 'Protests' },
  { id: 'conflict',   label: 'Conflict' },
  { id: 'health',     label: 'Health' },
  { id: 'deepfake',   label: 'Deepfakes' },
];

function App() {
  const [view, setView] = useState<'timeline' | 'checker'>('timeline');
  const [topic, setTopic] = useState<TopicCategory>('all');
  const [liveNews, setLiveNews] = useState<NewsItem[]>([]);

  useEffect(() => {
    async function fetchLive() {
      const { data, error } = await supabase.rpc('get_timeline_feed', {
        lane: 'all',
        page_size: 10
      });
      if (!error && data) {
        const mapped: NewsItem[] = data.map((item: any) => {
          let conf = 'unverified';
          const verdict = item.entities?.verdict || 'VERIFIED';
          if (verdict === 'VERIFIED' || verdict === 'TRUE') conf = 'confirmed';
          else if (verdict === 'FALSE' || verdict === 'FAKE') conf = 'unverified';
          else conf = 'developing';

          return {
            id: item.id,
            headline: item.headline || "Untitled Record",
            summary: item.normalized_content,
            confidence: conf as any,
            lane: item.is_direct_record ? 'direct' : 'verified',
            topic: item.topic_name as any || 'government',
            sources: [item.source_name as any || 'PIB RSS'],
            timestamp: new Date(item.published_at).toISOString(),
          };
        });
        setLiveNews(mapped);
      }
    }
    fetchLive();
  }, []);

  const filtered = useMemo(() => {
    const combined = [...liveNews, ...MOCK_NEWS];
    return topic === 'all' ? combined : combined.filter(n => n.topic === topic);
  }, [topic, liveNews]);

  return (
    <ThemeProvider>
      <div style={{ minHeight: '100vh', position: 'relative' }}>
        
        {/* Ambient Premium Backgrounds */}
        <div className="mesh-bg" />
        <div className="grain-overlay" />

        <Navbar activeView={view} onViewChange={setView} />

        <main style={{ paddingTop: 140, paddingBottom: 120 }}>
          <div className="container">
            
            <AnimatePresence mode="wait">
              {view === 'timeline' ? (
                <motion.div key="timeline"
                  initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
                  transition={{ duration: 0.4, ease: [0.16,1,0.3,1] }}>
                  
                  {/* Hero Header */}
                  <header style={{ marginBottom: 80, maxWidth: 900 }}>
                    <p className="eyebrow" style={{ marginBottom: 24 }}>TechFusion 2026 · Civic Intelligence</p>
                    <h1 style={{ marginBottom: 32 }}>
                      Verified truth, <br/>
                      <span style={{ color: 'var(--text-tertiary)' }}>not algorithmic rumour.</span>
                    </h1>
                    <p style={{ fontSize: 'clamp(16px, 2vw, 20px)', color: 'var(--text-secondary)', maxWidth: '42ch', lineHeight: 1.6 }}>
                      India's real-time, multi-source news verification pipeline. Evidence-retrieved, not AI-hallucinated.
                    </p>
                  </header>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 64 }} className="main-grid">
                    
                    {/* Left: Feed */}
                    <div>
                      {/* Topics */}
                      <div style={{ display: 'flex', gap: 24, borderBottom: '1px solid var(--border)', paddingBottom: 16, marginBottom: 16, overflowX: 'auto' }}>
                        {TOPICS.map(t => {
                          const active = topic === t.id;
                          return (
                            <button key={t.id} onClick={() => setTopic(t.id)}
                              style={{
                                fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: active ? 600 : 400,
                                color: active ? 'var(--text-primary)' : 'var(--text-tertiary)',
                                transition: 'color var(--dur-base)', whiteSpace: 'nowrap'
                              }}>
                              {t.label}
                            </button>
                          );
                        })}
                      </div>

                      <NewsList items={filtered} />
                    </div>

                    {/* Right: Sources Index */}
                    <aside className="hide-mobile">
                      <div style={{ position: 'sticky', top: 120 }}>
                        <p className="eyebrow" style={{ marginBottom: 24 }}>Verified Sources Index</p>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                          {SOURCES_META.map(src => (
                            <div key={src.name}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
                                <span className="mono" style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{src.name}</span>
                                <span className="mono" style={{ fontSize: 9, color: 'var(--text-tertiary)' }}>{src.cadence}</span>
                              </div>
                              <p style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{src.role}</p>
                            </div>
                          ))}
                        </div>

                        <div style={{ marginTop: 40, paddingTop: 24, borderTop: '1px solid var(--border)' }}>
                          <p className="mono" style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: 8 }}>Architecture Note</p>
                          <p style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                            PIB alone is insufficient for highest confidence. Dual-source verification mandatory.
                          </p>
                        </div>
                      </div>
                    </aside>

                  </div>
                </motion.div>
              ) : (
                <motion.div key="checker"
                  initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -16 }}
                  transition={{ duration: 0.4, ease: [0.16,1,0.3,1] }}>
                  <ClaimChecker />
                </motion.div>
              )}
            </AnimatePresence>

          </div>
        </main>
        
        <style>{`
          @media (max-width: 900px) {
            .main-grid { grid-template-columns: 1fr !important; }
            .hide-mobile { display: none !important; }
          }
        `}</style>
      </div>
    </ThemeProvider>
  );
}

export default App;
