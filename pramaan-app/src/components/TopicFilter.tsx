import { motion } from 'framer-motion';
import { Shield, Globe, AlertTriangle, Activity, Zap } from 'lucide-react';
import type { TopicCategory } from '../data/mockData';

const TOPICS: { id: TopicCategory; label: string; icon: React.ReactNode }[] = [
  { id: 'all',        label: 'All',              icon: <Globe size={13} /> },
  { id: 'government', label: 'Government',        icon: <Shield size={13} /> },
  { id: 'protests',   label: 'Protests',          icon: <Activity size={13} /> },
  { id: 'conflict',   label: 'Conflict',          icon: <AlertTriangle size={13} /> },
  { id: 'health',     label: 'Health',            icon: <Zap size={13} /> },
  { id: 'deepfake',   label: 'Deepfakes',         icon: <span style={{ fontSize: 11 }}>🤖</span> },
];

interface TopicFilterProps {
  active: TopicCategory;
  onChange: (topic: TopicCategory) => void;
}

export function TopicFilter({ active, onChange }: TopicFilterProps) {
  return (
    <div style={{
      display: 'flex', gap: 6, flexWrap: 'wrap',
      padding: '10px 0',
    }}>
      {TOPICS.map(topic => {
        const isActive = topic.id === active;
        return (
          <button key={topic.id}
            onClick={() => onChange(topic.id)}
            style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '7px 13px', borderRadius: 8, border: '1px solid',
              borderColor: isActive ? 'var(--color-accent)' : 'var(--color-border-subtle)',
              background: isActive ? 'rgba(34,197,94,0.1)' : 'var(--color-surface)',
              color: isActive ? 'var(--color-accent)' : '#64748B',
              fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: isActive ? 700 : 500,
              cursor: 'pointer', transition: 'all 0.2s ease',
              minHeight: 36,
              position: 'relative',
            }}
          >
            {topic.icon}
            {topic.label}
            {isActive && (
              <motion.div
                layoutId="topic-indicator"
                style={{
                  position: 'absolute', inset: -1, borderRadius: 8,
                  border: '1px solid var(--color-accent)',
                  pointerEvents: 'none',
                }}
                transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
