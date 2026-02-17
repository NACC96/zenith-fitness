'use client';

import { useState } from 'react';
import type { CSSProperties } from 'react';
import Link from 'next/link';
import { ExternalLink, Github, Moon, Sun, Twitter } from 'lucide-react';
import { GlowingEdgeCard } from '../../../style-guide/glowing-edge-card';
import styles from '../style-guide-page.module.css';

export default function StyleGuideGlowingEdgeCardPage() {
  const [mode, setMode] = useState<'dark' | 'light'>('dark');

  return (
    <div className={styles.showcase}>
      <article className={`${styles.showcaseCard} ${styles.glowPanel}`}>
        <div style={{ marginBottom: '1rem', display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={() => setMode('light')}
            className={styles.linkPill}
            style={{
              background: mode === 'light' ? 'var(--sg-accent)' : 'transparent',
              color: mode === 'light' ? '#000' : 'var(--sg-text-secondary)',
              boxShadow: mode === 'light' ? '0 8px 24px rgb(0 0 0 / 0.2)' : 'none',
              transform: mode === 'light' ? 'scale(1.06)' : 'none'
            }}
          >
            <Sun size={18} />
          </button>
          <button
            onClick={() => setMode('dark')}
            className={styles.linkPill}
            style={{
              background: mode === 'dark' ? 'var(--sg-accent-soft)' : 'transparent',
              color: mode === 'dark' ? '#000' : 'var(--sg-text-secondary)',
              boxShadow: mode === 'dark' ? '0 8px 24px rgb(0 0 0 / 0.2)' : 'none',
              transform: mode === 'dark' ? 'scale(1.06)' : 'none'
            }}
          >
            <Moon size={18} />
          </button>
        </div>

        <GlowingEdgeCard
          mode={mode}
          className="glowing-preview"
          style={
            {
              '--glow-color': mode === 'light' ? '78 80% 58%' : '78 100% 45%',
              '--glow-boost': mode === 'light' ? '12%' : '8%',
              '--glow-blend': mode === 'light' ? 'screen' : 'plus-lighter',
              '--card-bg':
                mode === 'light'
                  ? 'linear-gradient(8deg, #f4ffd5 75%, #fefef7 75.5%)'
                  : 'linear-gradient(8deg, #060606 75%, color-mix(in hsl, #060606, white 5%) 75.5%)'
            } as CSSProperties
          }
        >
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '1.5rem', boxSizing: 'border-box' }}>
            <header
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '1.5rem',
                color: mode === 'light' ? '#ca8a04' : 'inherit'
              }}
            >
              <Sun size={24} color={mode === 'light' ? '#ca8a04' : 'inherit'} opacity={mode === 'light' ? 1 : 0.25} />
              <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 500, letterSpacing: '0.02em' }}>
                Colored, Glowing Edges
              </h1>
              <Moon size={24} color={mode === 'dark' ? '#60a5fa' : 'inherit'} opacity={mode === 'dark' ? 1 : 0.25} />
            </header>

            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '0.5rem' }}>
              <p style={{ margin: '0 0 1.4rem', opacity: 0.95 }}>
                This is <strong>somewhat different</strong> to the usual colored, glowing cards you may have seen before.
              </p>
              <p style={{ marginBottom: '1.4rem', opacity: 0.8 }}>
                It uses layered mesh gradients with masks to let pointer direction sculpt the edges.
              </p>
              <p style={{ marginBottom: '1.4rem', opacity: 0.8 }}>
                The glow responds with distance and proximity, creating a magnetic edge reaction.
              </p>
            </div>

            <div
              style={{
                marginTop: '1.5rem',
                paddingTop: '1rem',
                borderTop: '1px solid rgb(255 255 255 / 0.12)',
                display: 'flex',
                justifyContent: 'center',
                gap: '1.5rem'
              }}
            >
              <a href="#" style={{ opacity: 0.5, color: 'inherit', textDecoration: 'none' }}>
                <Github size={20} />
              </a>
              <a href="#" style={{ opacity: 0.5, color: 'inherit', textDecoration: 'none' }}>
                <Twitter size={20} />
              </a>
            </div>
          </div>
        </GlowingEdgeCard>

        <p className={styles.statusMono}>
          <ExternalLink size={14} />
          <span>Interact with the card to see edge response</span>
        </p>

        <div className={styles.linkRow}>
          <Link href="/style-guide/animated-list" className={styles.linkPill}>
            Next: Animated List
          </Link>
          <Link href="/style-guide/neon-typing-button" className={styles.linkPill}>
            Next: Neon Typing Button
          </Link>
        </div>
      </article>
    </div>
  );
}
