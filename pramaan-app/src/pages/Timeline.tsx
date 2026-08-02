import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Loader2, AlertCircle, Inbox } from 'lucide-react';
import { NewsList } from '../components/NewsCard';
import { TopicFilter } from '../components/TopicFilter';
import { MOCK_NEWS, SOURCES_META, type TopicCategory, type NewsItem, type ConfidenceTier } from '../data/mockData';
import { supabase } from '../lib/supabase';

const VALID_TOPICS: Set<TopicCategory> = new Set([
  'government',
  'protests',
  'conflict',
  'health',
  'deepfake',
  'other',
]);

export function Timeline() {
  const [topic, setTopic] = useState<TopicCategory>('all');
  const [liveNews, setLiveNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchErrorMessage, setFetchErrorMessage] = useState<string | null>(null);
  const [isUsingFallback, setIsUsingFallback] = useState(false);

  useEffect(() => {
    async function fetchLive() {
      setLoading(true);
      setFetchErrorMessage(null);
      setIsUsingFallback(false);

      try {
        const { data, error: rpcErr } = await supabase.rpc('get_timeline_feed', {
          lane: 'all',
          page_size: 30,
        });

        if (rpcErr) {
          console.warn('Supabase RPC get_timeline_feed error:', rpcErr.message);
          throw rpcErr;
        }

        if (!data || data.length === 0) {
          console.warn('Live timeline fetch returned 0 items. Falling back to mock news dataset.');
          setLiveNews([]);
          setIsUsingFallback(true);
          setLoading(false);
          return;
        }

        // Task 4: Fix live-data mapping fragility
        const mapped: NewsItem[] = data.map((item: any) => {
          // 1. Confidence tier: prefer confidence_tier directly when present
          let conf: ConfidenceTier;
          if (item.confidence_tier && typeof item.confidence_tier === 'string') {
            conf = item.confidence_tier.toLowerCase() as ConfidenceTier;
          } else {
            console.warn(
              `Confidence tier missing for evidence item ${item.id}. Falling back to is_direct_record heuristic.`,
              item
            );
            conf = item.is_direct_record ? 'confirmed' : 'developing';
          }

          // 2. Topic slug: map or bucket unrecognized into 'other' + console.warn
          const rawSlug = (item.topic_slug || '').toLowerCase();
          let matchedTopic: TopicCategory;
          if (VALID_TOPICS.has(rawSlug as TopicCategory)) {
            matchedTopic = rawSlug as TopicCategory;
          } else if (rawSlug === 'international' || rawSlug === 'science-tech' || rawSlug === 'economy' || rawSlug === 'disaster') {
            matchedTopic = 'other';
          } else {
            console.warn(
              `Unrecognized topic slug "${item.topic_slug}" on item ${item.id}. Bucketing into "other" category.`,
              item
            );
            matchedTopic = 'other';
          }

          // 3. Source name: don't default missing source_name to 'PIB RSS'. Use 'Unknown source' + console.warn
          let sourceName = item.source_name;
          if (!sourceName) {
            console.warn(`Missing source_name for evidence item ${item.id}. Using "Unknown source" fallback.`, item);
            sourceName = 'Unknown source';
          }

          return {
            id: item.id,
            headline: item.headline || 'Untitled Record',
            summary: item.normalized_content || '',
            confidence: conf,
            lane: item.is_direct_record ? 'direct' : 'verified',
            topic: matchedTopic,
            sources: [sourceName as any],
            timestamp: item.published_at ? new Date(item.published_at).toISOString() : new Date().toISOString(),
            storyId: item.story_id || item.id,
            clusterCount: item.cluster_count ? Number(item.cluster_count) : 1,
            entities: item.entities || {},
          };
        });

        // Deduplicate timeline list by storyId so duplicate story cards don't clutter feed
        const seenStoryIds = new Set<string>();
        const dedupedLive: NewsItem[] = [];
        for (const m of mapped) {
          const sId = m.storyId || m.id;
          if (!seenStoryIds.has(sId)) {
            seenStoryIds.add(sId);
            dedupedLive.push(m);
          }
        }

        setLiveNews(dedupedLive);
        setIsUsingFallback(false);
      } catch (err: any) {
        console.error('Timeline fetch error:', err);
        setFetchErrorMessage(err.message || 'Failed to load live feed');
        setIsUsingFallback(true);
      } finally {
        setLoading(false);
      }
    }

    fetchLive();
  }, []);

  // Task 3: Remove unconditional [...liveNews, ...MOCK_NEWS] merge
  // MOCK_NEWS only renders as fallback when live fetch returns 0 items or errors
  const activeItems = useMemo(() => {
    const list = isUsingFallback ? MOCK_NEWS : liveNews;
    return topic === 'all' ? list : list.filter((n) => n.topic === topic);
  }, [topic, liveNews, isUsingFallback]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      style={{ paddingBottom: 100 }}
    >
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: 64 }} className="main-grid">
        
        {/* Left: Feed Column */}
        <div>
          {/* Topic Filter */}
          <div style={{ marginBottom: 24, borderBottom: '1px solid var(--border)', paddingBottom: 16 }}>
            <TopicFilter active={topic} onChange={setTopic} />
          </div>

          {/* Status Banners */}
          {isUsingFallback && !loading && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '12px 16px',
                borderRadius: 'var(--r-sm)',
                background: 'var(--bg-surface-2)',
                border: '1px solid var(--border)',
                marginBottom: 24,
                fontSize: 13,
                color: 'var(--text-secondary)',
              }}
            >
              <AlertCircle size={16} style={{ color: 'var(--developing)', flexShrink: 0 }} />
              <span>
                {fetchErrorMessage
                  ? `Viewing offline mock dataset (Live fetch info: ${fetchErrorMessage}).`
                  : 'Viewing offline mock briefing dataset. Live Supabase database returned zero records or connection is pending.'}
              </span>
            </div>
          )}

          {/* Loading State */}
          {loading ? (
            <div style={{ padding: '60px 0', textAlign: 'center' }}>
              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }} style={{ display: 'inline-block', marginBottom: 12 }}>
                <Loader2 size={24} style={{ color: 'var(--accent)' }} />
              </motion.div>
              <p className="mono" style={{ fontSize: 12, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Fetching Proactive Timeline Feed...
              </p>
            </div>
          ) : activeItems.length === 0 ? (
            /* Explicit Empty State */
            <div className="glass-panel" style={{ padding: 48, textAlign: 'center', margin: '32px 0' }}>
              <Inbox size={32} style={{ color: 'var(--text-tertiary)', marginBottom: 16 }} />
              <h3 style={{ fontSize: 18, marginBottom: 8 }}>No updates found for this topic</h3>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', maxWidth: '40ch', margin: '0 auto' }}>
                There are currently no verified news records or story clusters under the selected filter category.
              </p>
            </div>
          ) : (
            /* Active News List */
            <NewsList items={activeItems} />
          )}
        </div>

        {/* Right: Verified Sources Sidebar Index */}
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

      <style>{`
        @media (max-width: 900px) {
          .main-grid { grid-template-columns: 1fr !important; }
          .hide-mobile { display: none !important; }
        }
      `}</style>
    </motion.div>
  );
}
