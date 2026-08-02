import { motion, AnimatePresence } from 'framer-motion';
import { NavLink, Link, useLocation } from 'react-router-dom';
import { Sun, Moon, Search } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export function Navbar() {
  const { theme, toggle } = useTheme();
  const location = useLocation();
  const currentPath = location.pathname;

  return (
    <div style={{ position: 'fixed', top: 24, left: 0, right: 0, zIndex: 100, pointerEvents: 'none' }}>
      <div className="container" style={{ display: 'flex', justifyContent: 'center' }}>
        <header className="glass-pill" style={{ 
          display: 'flex', alignItems: 'center', height: 56, padding: '0 8px 0 24px', gap: 32,
          pointerEvents: 'auto',
        }}>

          {/* Logo -> Links to / (Landing) */}
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 12, textDecoration: 'none', color: 'inherit' }}>
            <span style={{ fontFamily: 'var(--font-serif)', fontWeight: 600, fontSize: 20, letterSpacing: '-0.02em', fontStyle: 'italic' }}>
              Pramaan.
            </span>
          </Link>

          {/* Router Nav Links */}
          <nav style={{ display: 'flex', gap: 4 }}>
            {[
              { path: '/timeline', label: 'Briefing' },
              { path: '/checker', label: 'Verify' },
            ].map(navItem => {
              const isActive = currentPath === navItem.path || (navItem.path === '/timeline' && currentPath === '/');

              return (
                <NavLink
                  key={navItem.path}
                  to={navItem.path}
                  style={{
                    position: 'relative',
                    padding: '8px 16px',
                    fontFamily: 'var(--font-sans)',
                    fontSize: 14,
                    fontWeight: 500,
                    color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                    textDecoration: 'none',
                    transition: 'color var(--dur-base) var(--ease-out)',
                  }}
                >
                  {navItem.label}
                  {isActive && (
                    <motion.div
                      layoutId="nav-bg"
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background: 'var(--bg-surface-2)',
                        borderRadius: 'var(--r-full)',
                        zIndex: -1,
                      }}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}
                </NavLink>
              );
            })}
          </nav>

          {/* Right Tools */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <Link to="/checker" className="btn-icon" aria-label="Search" style={{ border: 'none', width: 36, height: 36, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: 'inherit', textDecoration: 'none' }}>
              <Search size={16} />
            </Link>
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
