import type { ReactNode } from 'react';
import Link from 'next/link';
import styles from './dashboard-layout.module.css';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Style Guide', href: '/style-guide' },
];

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className={styles.dashboardViewport}>
      <div className={styles.noiseLayer} />
      <div className={styles.dashboardShell}>
        <header className={styles.topHeader}>
          <div className={styles.brand}>
            <span className={styles.brandBadge}>Z</span>
            <span className={styles.brandText}>Zenith Fitness</span>
          </div>

          <nav aria-label="Dashboard navigation" className={styles.navPill}>
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
