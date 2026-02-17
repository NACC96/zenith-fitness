'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import styles from './glowing-edge-card.module.css';

function round(value: number, precision = 3): number {
  return Number(value.toFixed(precision));
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.min(Math.max(value, min), max);
}

function getCenter(rect: DOMRect): [number, number] {
  return [rect.width / 2, rect.height / 2];
}

function getPointerData(rect: DOMRect, event: React.MouseEvent<HTMLDivElement>) {
  const x = event.clientX - rect.left;
  const y = event.clientY - rect.top;
  const pointerX = clamp((100 / rect.width) * x);
  const pointerY = clamp((100 / rect.height) * y);
  return { pixels: [x, y], percent: [pointerX, pointerY] } as const;
}

function angleFromPointer(dx: number, dy: number): number {
  if (dx === 0 && dy === 0) {
    return 0;
  }
  let angleRadians = Math.atan2(dy, dx);
  let angleDegrees = angleRadians * (180 / Math.PI) + 90;
  if (angleDegrees < 0) {
    angleDegrees += 360;
  }
  return angleDegrees;
}

function edgeProximity(rect: DOMRect, x: number, y: number): number {
  const [cx, cy] = getCenter(rect);
  const dx = x - cx;
  const dy = y - cy;

  let proximityX = Infinity;
  let proximityY = Infinity;

  if (dx !== 0) {
    proximityX = cx / Math.abs(dx);
  }

  if (dy !== 0) {
    proximityY = cy / Math.abs(dy);
  }

  return clamp(1 / Math.min(proximityX, proximityY));
}

export interface GlowingEdgeCardProps extends React.HTMLAttributes<HTMLDivElement> {
  mode?: 'dark' | 'light';
  children?: React.ReactNode;
}

export function GlowingEdgeCard({
  mode = 'dark',
  className = '',
  children,
  onPointerMove,
  style,
  ...props
}: GlowingEdgeCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef<number | null>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isAnimatingRef = useRef(false);
  const [isAnimating, setIsAnimating] = useState(false);

  const stopAnimation = useCallback(() => {
    isAnimatingRef.current = false;
    setIsAnimating(false);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }

    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  const startIntroAnimation = useCallback(() => {
    const card = cardRef.current;
    if (!card) {
      return;
    }

    stopAnimation();

    const angleStart = 110;
    const angleEnd = 465;
    const now = performance.now();
    isAnimatingRef.current = true;
    card.style.setProperty('--pointer-deg', `${angleStart}deg`);
    card.style.setProperty('--pointer-d', '0');
    setIsAnimating(true);

    timeoutRef.current = window.setTimeout(() => {
      const animate = (timestamp: number) => {
        if (!isAnimatingRef.current || !cardRef.current) {
          return;
        }

        const elapsed = timestamp - now;

        if (elapsed > 500 && elapsed < 1000) {
          const t = (elapsed - 500) / 500;
          const ease = 1 - Math.pow(1 - t, 3);
          card.style.setProperty('--pointer-d', `${ease * 100}`);
        }

        if (elapsed > 500 && elapsed < 2000) {
          const t = (elapsed - 500) / 1500;
          const ease = t * t * t;
          const degree = (angleEnd - angleStart) * (ease * 0.5) + angleStart;
          card.style.setProperty('--pointer-deg', `${degree}deg`);
        }

        if (elapsed >= 2000 && elapsed < 4250) {
          const t = (elapsed - 2000) / 2250;
          const ease = 1 - Math.pow(1 - t, 3);
          const degree = (angleEnd - angleStart) * (0.5 + ease * 0.5) + angleStart;
          card.style.setProperty('--pointer-deg', `${degree}deg`);
        }

        if (elapsed > 3000 && elapsed < 4500) {
          const t = (elapsed - 3000) / 1500;
          const ease = t * t * t;
          card.style.setProperty('--pointer-d', `${(1 - ease) * 100}`);
        }

        if (elapsed < 4500) {
          rafRef.current = requestAnimationFrame(animate);
        } else {
          stopAnimation();
        }
      };

      rafRef.current = requestAnimationFrame(animate);
    }, 500);
  }, [stopAnimation]);

  useEffect(() => {
    startIntroAnimation();
    return stopAnimation;
  }, [startIntroAnimation, stopAnimation]);

  const handlePointerMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (onPointerMove) {
        onPointerMove(event);
      }

      const card = cardRef.current;
      if (!card) {
        return;
      }

      if (isAnimatingRef.current) {
        stopAnimation();
      }

      const rect = card.getBoundingClientRect();
      const position = getPointerData(rect, event);
      const [px, py] = position.pixels;
      const [perx, pery] = position.percent;
      const [cx, cy] = getCenter(rect);

      const dx = px - cx;
      const dy = py - cy;

      card.style.setProperty('--pointer-x', `${round(perx)}%`);
      card.style.setProperty('--pointer-y', `${round(pery)}%`);
      card.style.setProperty('--pointer-deg', `${round(angleFromPointer(dx, dy))}deg`);
      card.style.setProperty('--pointer-d', `${round(edgeProximity(rect, px, py) * 100)}`);
    },
    [onPointerMove, stopAnimation]
  );

  const variables =
    mode === 'light'
      ? {
          '--card-bg':
            'linear-gradient(8deg, color-mix(in hsl, hsl(260, 25%, 95%), #000 2.5%) 75%, hsl(260, 25%, 95%) 75.5%)',
          '--blend': 'darken',
          '--glow-blend': 'luminosity',
          '--glow-color': '280deg 90% 95%',
          '--glow-boost': '15%',
          '--fg': 'black'
        }
      : {
          '--card-bg':
            'linear-gradient(8deg, #1a1a1a 75%, color-mix(in hsl, #1a1a1a, white 2.5%) 75.5%)',
          '--blend': 'soft-light',
          '--glow-blend': 'plus-lighter',
          '--glow-color': '40deg 80% 80%',
          '--glow-boost': '0%',
          '--fg': 'white'
        };

  return (
    <div
      ref={cardRef}
      onPointerMove={handlePointerMove}
      className={`${styles.shell} ${mode === 'light' ? styles.lightMode : styles.darkMode} ${isAnimating ? styles.animating : ''} ${className}`}
      style={{
        '--glow-sens': '30',
        '--pointer-x': '50%',
        '--pointer-y': '50%',
        '--pointer-deg': '45deg',
        '--pointer-d': '0',
        '--color-sens': 'calc(var(--glow-sens) + 20)',
        ...variables,
        ...style
      } as React.CSSProperties}
      {...props}
    >
      <div className={styles.meshBorder} aria-hidden />
      <div className={styles.meshBg} aria-hidden />
      <div className={styles.meshGlow} aria-hidden />
      <div className={styles.content}>{children}</div>
    </div>
  );
}

export default GlowingEdgeCard;
