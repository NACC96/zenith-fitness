'use client';

import Link from 'next/link';
import { NeonTypingButton } from '../../../style-guide/neon-typing-button';
import styles from '../style-guide-page.module.css';

export default function StyleGuideNeonTypingButtonPage() {
  return (
    <div className={styles.showcase}>
      <article className={styles.showcaseCard}>
        <p className={styles.showcaseHeader}>Action Layer</p>
        <h1 className={styles.showcaseTitle}>Neon Typing Button</h1>
        <p className={styles.showcaseSubtext}>
          A hover-activated neon control: base label fades, then a colored command string types in with a blinking cursor.
        </p>

        <div className={`${styles.componentSurface} ${styles.typingPreview}`}>
          <NeonTypingButton
            text="Launch Module"
            glowColor="#c026d3"
            revealTextColor="#ffe7ff"
            cursorColor="#fff"
            baseTextColor="rgba(235, 235, 235, 0.6)"
          />
          <NeonTypingButton
            text="Run Sequence"
            glowColor="#d946ef"
            revealTextColor="#ffd9ff"
            cursorColor="#ffd7ff"
            baseTextColor="rgba(235, 235, 235, 0.6)"
          />
          <NeonTypingButton
            text="Neon Sequence"
            glowColor="#a21caf"
            revealTextColor="#f9d3ff"
            cursorColor="#f3c1ff"
            baseTextColor="rgba(226, 232, 240, 0.65)"
          />
          <NeonTypingButton
            text="Neon Purple"
            glowColor="#7e22ce"
            revealTextColor="#ffe8ff"
            cursorColor="#ffe0ff"
            baseTextColor="rgba(243, 244, 246, 0.68)"
          />
        </div>

        <p className={styles.typingMessage}>Tip: this is intended as a hover interaction pattern for primary actions.</p>

        <aside className={styles.contrastSection} aria-label="Contrast callout">
          <p className={styles.contrastTitle}>Implementation Note</p>
          <p className={styles.contrastBody}>
            Use the component for premium micro-actions where text should feel deliberate and command-like.
            Keep the reveal text short, uppercase, and high-contrast against the glow.
          </p>
        </aside>

        <div className={styles.linkRow}>
          <Link href="/style-guide/glowing-edge-card" className={styles.linkPill}>
            Back: Glowing Edge Card
          </Link>
        </div>
      </article>
    </div>
  );
}
