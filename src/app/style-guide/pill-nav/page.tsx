import Link from 'next/link';
import { CircleFadingArrowUp } from 'lucide-react';
import { PillNav, type PillNavItem } from '../../../style-guide/pill-nav';
import styles from '../style-guide-page.module.css';

const items: PillNavItem[] = [
  { label: 'Home', href: '/' },
  { label: 'Collection', href: '/collection' },
  { label: 'About', href: '/about' },
  { label: 'Contact', href: '/contact' }
];

export default function StyleGuidePillNavPage() {
  return (
    <div className={styles.showcase}>
      <article className={styles.showcaseCard}>
        <p className={styles.showcaseHeader}>Navigation Layer</p>
        <h1 className={styles.showcaseTitle}>Pill Nav</h1>
        <p className={styles.showcaseSubtext}>GSAP-enhanced pills with hover rise animations and external-link aware routing.</p>

        <div className={styles.componentSurface}>
          <PillNav
            logo={<CircleFadingArrowUp size={22} />}
            items={items}
            activeHref="/"
            baseColor="rgba(255, 255, 255, 0.05)"
            pillColor="rgba(255, 255, 255, 0.04)"
            hoveredPillTextColor="#ccff00"
            pillTextColor="#ebebeb"
            className={styles.pillTheme}
          />
        </div>

        <p className={styles.footnote}>
          Component lives in <code>src/style-guide/pill-nav</code> and uses GSAP for hover transitions.
        </p>

        <div className={styles.linkRow}>
          <Link href="/style-guide/magnification-dock" className={styles.linkPill}>
            Back: Magnification Dock
          </Link>
          <Link href="/style-guide/animated-list" className={styles.linkPill}>
            Next: Animated List
          </Link>
        </div>
      </article>
    </div>
  );
}
