import { motion } from 'framer-motion';

interface StatCardProps {
  value: string;
  label: string;
  color?: string;
  delay?: number;
}

function StatCard({ value, label, color = 'var(--color-accent)', delay = 0 }: StatCardProps) {
  return (
    <motion.div
      className="card"
      style={{ padding: '16px 20px', textAlign: 'center' }}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <div style={{
        fontFamily: 'var(--font-heading)', fontSize: 'clamp(1.4rem, 3vw, 2rem)',
        fontWeight: 700, color, marginBottom: 4,
      }}>{value}</div>
      <div style={{ fontSize: 11, fontFamily: 'var(--font-mono)', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#64748B' }}>{label}</div>
    </motion.div>
  );
}

export function StatsBar() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
      <StatCard value="847"  label="Claims Checked"      color="var(--color-accent)"          delay={0} />
      <StatCard value="312"  label="Confirmed"            color="var(--color-confirmed)"       delay={0.05} />
      <StatCard value="189"  label="Developing"           color="var(--color-developing)"      delay={0.10} />
      <StatCard value="64"   label="AI-Generated Media"   color="var(--color-accent-red)"      delay={0.15} />
      <StatCard value="6"    label="Live Sources"         color="var(--color-accent-blue)"     delay={0.20} />
    </div>
  );
}
