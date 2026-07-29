import { motion } from 'framer-motion';
import { Shield, Zap, AlertTriangle, HelpCircle, Bot, XCircle } from 'lucide-react';
import type { ConfidenceTier } from '../data/mockData';

interface ConfidenceBadgeProps {
  tier: ConfidenceTier;
  size?: 'sm' | 'md';
  showIcon?: boolean;
  animate?: boolean;
}

const CONFIG = {
  confirmed:  { label: 'Confirmed',      className: 'badge-confirmed',  icon: Shield,       dot: true,  dotClass: '' },
  refuted:    { label: 'Refuted (False)',className: 'badge-unverified', icon: XCircle,      dot: false, dotClass: '' },
  developing: { label: 'Developing',     className: 'badge-developing', icon: Zap,          dot: true,  dotClass: 'amber' },
  unverified: { label: 'Unverified',     className: 'badge-unverified', icon: AlertTriangle, dot: false, dotClass: '' },
  norecord:   { label: 'No Record Found',className: 'badge-no-record',  icon: HelpCircle,   dot: false, dotClass: '' },
  'no-record':{ label: 'No Record Found',className: 'badge-no-record',  icon: HelpCircle,   dot: false, dotClass: '' },
  no_record:  { label: 'No Record Found',className: 'badge-no-record',  icon: HelpCircle,   dot: false, dotClass: '' },
};

export function ConfidenceBadge({ tier, size = 'md', showIcon = true, animate = false }: ConfidenceBadgeProps) {
  const cfg = CONFIG[tier] || CONFIG.unverified;
  const Icon = cfg.icon;
  const iconSize = size === 'sm' ? 10 : 12;

  const isRefuted = tier === 'refuted';
  const customStyle = isRefuted
    ? { backgroundColor: 'rgba(239, 68, 68, 0.15)', color: '#EF4444', borderColor: 'rgba(239, 68, 68, 0.4)' }
    : undefined;

  const inner = (
    <span className={`badge ${cfg.className}`} style={{ fontSize: size === 'sm' ? '9px' : undefined, ...customStyle }}>
      {cfg.dot && <span className={`live-dot ${cfg.dotClass}`} style={{ width: 6, height: 6 }} />}
      {showIcon && !cfg.dot && <Icon size={iconSize} />}
      {cfg.label}
    </span>
  );

  if (animate) {
    return (
      <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 20 }}>
        {inner}
      </motion.div>
    );
  }
  return inner;
}

interface SyntheticBadgeProps { score?: number }
export function SyntheticBadge({ score }: SyntheticBadgeProps) {
  return (
    <span className="badge" style={{ background: 'rgba(239,68,68,0.12)', color: '#F87171', borderColor: 'rgba(239,68,68,0.3)' }}>
      <Bot size={10} />
      AI-Generated {score ? `(${Math.round(score * 100)}%)` : ''}
    </span>
  );
}
