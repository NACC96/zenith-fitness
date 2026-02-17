'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AnimatedList } from '../../../style-guide/animated-list';
import styles from '../style-guide-page.module.css';

const items = Array.from({ length: 24 }, (_, index) => `Interactive Item ${index + 1}`);

export default function StyleGuideAnimatedListPage() {
  const [lastSelected, setLastSelected] = useState<string | null>(null);

  return (
    <div className={styles.showcase}>
      <article className={styles.showcaseCard}>
        <p className={styles.showcaseHeader}>Data Layer</p>
        <h1 className={styles.showcaseTitle}>Animated List</h1>
        <p className={styles.showcaseSubtext}>Scroll entry + keyboard focus demo with automatic edge gradients and snap behavior.</p>

        <div className={styles.componentSurface}>
          <div style={{ marginBottom: '1rem', textAlign: 'center' }}>
            <p className={styles.showcaseSubtext} style={{ margin: 0 }}>
              Scroll + Arrow keys (Up/Down), Enter to select
            </p>
          </div>

          <AnimatedList
            items={items}
            onItemSelect={(item) => setLastSelected(item)}
            showGradients
            enableArrowNavigation
            displayScrollbar
            className={styles.listTheme}
            itemClassName={styles.monoItem}
          />

          <p className={styles.footnote} style={{ textAlign: 'center', marginTop: '0.95rem' }}>
            {lastSelected ? `Last selected: ${lastSelected}` : 'Use mouse or keyboard to select an item.'}
          </p>
        </div>

        <div className={styles.linkRow}>
          <Link href="/style-guide/pill-nav" className={styles.linkPill}>
            Next: PillNav
          </Link>
          <Link href="/style-guide/glowing-edge-card" className={styles.linkPill}>
            Next: Glowing Edge Card
          </Link>
        </div>
      </article>
    </div>
  );
}
