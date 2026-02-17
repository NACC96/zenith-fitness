import Link from 'next/link';
import styles from './style-guide-page.module.css';

const nodes = [
  { href: '/style-guide/magnification-dock', label: 'Magnification Dock', hint: 'Distance-aware spring dock' },
  { href: '/style-guide/pill-nav', label: 'Pill Navigation', hint: 'GSAP-powered pill interactions' },
  { href: '/style-guide/animated-list', label: 'Animated List', hint: 'Scroll + keyboard list system' },
  { href: '/style-guide/glowing-edge-card', label: 'Glowing Edge Card', hint: 'Pointer-reactive glow shell' },
  { href: '/style-guide/neon-typing-button', label: 'Neon Typing Button', hint: 'Typing-reveal action control' }
];

export default function StyleGuideHomePage() {
  return (
    <div className={styles.showcase}>
      <article className={styles.showcaseCard}>
        <p className={styles.showcaseHeader}>Style Guide</p>
        <h1 className={styles.showcaseTitle}>Obsidian / Lime UI Library</h1>
        <p className={styles.showcaseSubtext}>
          A shared visual system with glass surfaces, high-contrast shell, and kinetic interaction patterns.
        </p>

        <div className={styles.componentSurface}>
          <div className={styles.guideIndexGrid}>
            {nodes.map((node) => (
              <Link
                key={node.href}
                href={node.href}
                className={styles.guideIndexLink}
              >
                <span>{node.label}</span>
                <span className={styles.guideIndexHint}>{node.hint}</span>
              </Link>
            ))}
          </div>
        </div>
      </article>
    </div>
  );
}
