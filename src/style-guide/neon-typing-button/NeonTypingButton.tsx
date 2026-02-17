'use client';

import React from 'react';
import styles from './neon-typing-button.module.css';

export interface NeonTypingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  text: string;
  baseTextColor?: string;
  revealTextColor?: string;
  glowColor?: string;
  cursorColor?: string;
  cursorSymbol?: string;
  pulse?: boolean;
  revealLengthPadding?: number;
}

export function NeonTypingButton({
  text,
  baseTextColor = 'rgba(255, 255, 255, 0.55)',
  revealTextColor = '#ffe7ff',
  glowColor = '#c026d3',
  cursorColor = '#f8c7ff',
  cursorSymbol = '▌',
  className = '',
  pulse = true,
  revealLengthPadding = 2,
  children,
  type = 'button',
  ...props
}: NeonTypingButtonProps) {
  const revealLength = `${Math.max(text.length + Math.max(revealLengthPadding, 0), 1)}ch`;
  const computedAriaLabel = props['aria-label'] ?? `Neon action: ${text}`;

  return (
    <button
      {...props}
      type={type}
      aria-label={computedAriaLabel}
      className={`${styles.neonTypingButton} ${className}`}
      style={{
        '--neon-base-text': baseTextColor,
        '--neon-reveal-text': revealTextColor,
        '--neon-glow': glowColor,
        '--neon-cursor': cursorColor,
        '--neon-reveal-length': revealLength,
        '--neon-pulse-opacity': pulse ? '1' : '0',
        ...(props.style as React.CSSProperties)
      } as React.CSSProperties}
    >
      <span className={styles.labelBase} aria-hidden={!!children}>
        {children ?? text}
      </span>
      <span className={styles.labelReveal}>
        <span className={styles.labelRevealText} aria-hidden>
          {text}
          <span className={styles.typingCursor} aria-hidden>
            {cursorSymbol}
          </span>
        </span>
      </span>
    </button>
  );
}

export default NeonTypingButton;
