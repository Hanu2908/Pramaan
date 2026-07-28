import { motion, AnimatePresence } from 'framer-motion';
import { Sun, Moon, Search } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

interface NavProps {
  activeView: 'timeline' | 'checker';
  onViewChange: (v: 'timeline' | 'checker') => void;
}

export function Navbar({ activeView, onViewChange }: NavProps) {
  const { theme, toggle } = useTheme();

  return (
    <div style={{ position: 'fixed', top: 24, left: 0, right: 0, zIndex: 100, pointerEvents: 'none' }}>
      <div className="container" style={{ display: 'flex', justifyContent: 'center' }}>
        <header className="glass-pill" style={{ 
          display: 'flex', alignItems: 'center', height: 56, padding: '0 8px 0 24px', gap: 32,
          pointerEvents: 'auto',
        }}>

          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: 20, letterSpacing: '-0.02em', fontStyle: 'italic' }}>
              Pramaan.
            </span>
          </div>

          {/* Minimal Nav */}
          <nav style={{ display: 'flex', gap: 4 }}>
            {(['timeline', 'checker'] as const).map(v => (
              <button key={v} onClick={() => onViewChange(v)}
                style={{
                  position: 'relative', padding: '8px 16px',
                  fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 500,
                  color: activeView === v ? 'var(--text-primary)' : 'var(--text-secondary)',
                  transition: 'color var(--dur-base) var(--ease-out)',
                }}>
                {v === 'timeline' ? 'Briefing' : 'Verify'}
                {activeView === v && (
                  <motion.div layoutId="nav-bg"
                    style={{
                      position: 'absolute', inset: 0,
                      background: 'var(--bg-surface-2)', borderRadius: 'var(--r-full)', zIndex: -1,
                    }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            ))}
          </nav>

          {/* Right Tools */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button className="btn-icon" onClick={() => onViewChange('checker')} aria-label="Search" style={{ border: 'none', width: 36, height: 36 }}>
              <Search size={16} />
            </button>
            <div style={{ width: 1, height: 16, background: 'var(--border)', margin: '0 4px' }} />
            <motion.button onClick={toggle} className="btn-icon" style={{ border: 'none', width: 36, height: 36 }} whileTap={{ scale: 0.9 }}>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={theme}
                  initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}
                  transition={{ duration: 0.2 }}>
                  {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
                </motion.div>
              </AnimatePresence>
            </motion.button>
          </div>

        </header>
      </div>
    </div>
  );
}
