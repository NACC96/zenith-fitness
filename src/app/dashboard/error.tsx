"use client";

import { NeonTypingButton } from "../../style-guide/neon-typing-button/NeonTypingButton";
import styles from "./dashboard-error.module.css";

interface DashboardErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: DashboardErrorProps) {
  return (
    <main className={styles.page}>
      <div className={styles.panel}>
        <div className={styles.iconWrap}>⚠</div>
        <h1 className={styles.title}>Failed to load dashboard</h1>
        <p className={styles.subtitle}>We could not load workout analytics.</p>
        {error.message && (
          <p className={styles.message}>{error.message}</p>
        )}
        <div className={styles.actions}>
          <NeonTypingButton
            text="Try again"
            glowColor="#ef4444"
            revealTextColor="#fca5a5"
            cursorColor="#fca5a5"
            onClick={reset}
          />
        </div>
      </div>
    </main>
  );
}
