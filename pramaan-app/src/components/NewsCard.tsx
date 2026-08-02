import { motion } from 'framer-motion';
import { ShieldAlert, Info, Database, Layers, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { NewsItem } from '../data/mockData';

// ── Minimalist Confidence Indicator ──────────────────────────────
const TIER_COLORS = {
  confirmed:  'var(--confirmed)',
  developing: 'var(--developing)',
  unverified: 'var(--unverified)',
  norecord:   'var(--text-tertiary)',
  refuted:    'var(--synthetic)',
};

export function NewsCard({ item, index }: { item: NewsItem; index: number }) {
  const color = TIER_COLORS[item.confidence] || 'var(--developing)';
  const storyTargetId = item.storyId || item.id;
  const count = item.clusterCount ?? 1;

  return (
    <motion.article
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
      style={{
        padding: '32px 0',
        borderBottom: '1px solid var(--border)',
        position: 'relative',
        display: 'flex', gap: 24,
      }}
    >
      {/* Visual Data Column */}
      <div style={{ width: 140, flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 12 }} className="hide-mobile">
        {/* Tier Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: color }} />
          <span className="mono" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-secondary)' }}>
            {item.confidence}
          </span>
        </div>
        
        {/* Lane Indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--text-tertiary)' }}>
          {item.lane === 'direct' ? <Database size={12} /> : <ShieldAlert size={12} />}
          <span className="mono" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {item.lane === 'direct' ? 'Direct Record' : 'Verified Claim'}
          </span>
        </div>

        {/* Cluster Indicator */}
        {count > 1 && (
          <Link
            to={`/story/${storyTargetId}`}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              color: 'var(--accent)',
              textDecoration: 'none',
              marginTop: 4,
            }}
          >
            <Layers size={12} />
            <span className="mono" style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase' }}>
              {count} Sources Clustered
            </span>
          </Link>
        )}

        {item.isSynthetic && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--synthetic)', marginTop: 8 }}>
            <Info size={12} />
            <span className="mono" style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Synthetic ({Math.round((item.syntheticScore || 0)*100)}%)
            </span>
          </div>
        )}
      </div>

      {/* Editorial Content Column */}
      <div style={{ flex: 1 }}>
        <h3 style={{ marginBottom: 16 }}>
          <Link
            to={`/story/${storyTargetId}`}
            style={{ color: 'inherit', textDecoration: 'none' }}
          >
            {item.headline}
          </Link>
        </h3>
        <p style={{ fontSize: 15, color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 24, maxWidth: '65ch' }}>
          {item.summary}
        </p>

        {/* Metadata Footer */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {item.sources.map(src => (
              <span key={src} className="mono" style={{
                fontSize: 10, padding: '4px 10px', borderRadius: 'var(--r-sm)',
                background: 'var(--bg-surface-2)', color: 'var(--text-secondary)',
                border: '1px solid var(--border)', textTransform: 'uppercase', letterSpacing: '0.05em'
              }}>
                {src}
              </span>
            ))}
          </div>
          
          <div style={{ flex: 1 }} />
          
          <Link
            to={`/story/${storyTargetId}`}
            className="mono"
            style={{
              fontSize: 11,
              color: 'var(--accent)',
              textDecoration: 'none',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              marginRight: 12,
            }}
          >
            Story Cluster <ArrowRight size={12} />
          </Link>

          <span className="mono" style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
            {new Date(item.timestamp).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
      </div>
    </motion.article>
  );
}

export function NewsList({ items }: { items: NewsItem[] }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {items.map((item, i) => <NewsCard key={item.id} item={item} index={i} />)}
    </div>
  );
}
