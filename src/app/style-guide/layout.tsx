import type { ReactNode } from 'react';
import Link from 'next/link';
import styles from './style-guide-layout.module.css';

const NAV_ITEMS = [
  { label: 'Dock', href: '/style-guide/magnification-dock' },
  { label: 'Pill', href: '/style-guide/pill-nav' },
  { label: 'List', href: '/style-guide/animated-list' },
  { label: 'Glow', href: '/style-guide/glowing-edge-card' },
  { label: 'Neon', href: '/style-guide/neon-typing-button' }
];

interface StyleGuideLayoutProps {
  children: ReactNode;
}

export default function StyleGuideLayout({ children }: StyleGuideLayoutProps) {
  return (
    <div className={styles.styleGuideViewport}>
      <div className={styles.noiseLayer} />
      <div className={styles.styleGuideShell}>
        <header className={styles.topHeader}>
          <div className={styles.brand}>
            <span className={styles.brandBadge}>Z</span>
            <span className={styles.brandText}>Obsidian UI</span>
          </div>

          <nav aria-label="Style Guide navigation" className={styles.navPill}>
            {NAV_ITEMS.map((item) => (
              <Link key={item.label} href={item.href} className={styles.navLink}>
                {item.label}
              </Link>
            ))}
          </nav>

          <div className={styles.statusWrap}>
            <span className={styles.statusTag} aria-live="polite">
              <span className={styles.statusDot} />
              System Online
            </span>
            <button type="button" className={styles.statusButton} aria-label="System status">
              ◉
            </button>
          </div>
        </header>

        <div className={styles.pageBody}>{children}</div>
      </div>
    </div>
  );
}
