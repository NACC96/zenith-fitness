'use client';

import { Dumbbell, Layers, Repeat, CalendarCheck } from 'lucide-react';
import { GlowingEdgeCard } from '../../../style-guide';
import type { DashboardKeyStats } from '../../../workouts/dashboard-analytics';
import styles from './dashboard-stat-cards.module.css';

interface StatCardDef {
  icon: React.ReactNode;
  label: string;
  value: string;
}

function formatNumber(value: number): string {
  return value.toLocaleString('en-US');
}

interface DashboardStatCardsProps {
  keyStats: DashboardKeyStats;
}

export function DashboardStatCards({ keyStats }: DashboardStatCardsProps) {
  const cards: StatCardDef[] = [
    {
      icon: <Dumbbell size={20} strokeWidth={1.5} />,
      label: 'Total lbs lifted',
      value: formatNumber(keyStats.totalLbsLifted),
    },
    {
      icon: <Layers size={20} strokeWidth={1.5} />,
      label: 'Total sets',
      value: formatNumber(keyStats.totalSets),
    },
    {
      icon: <Repeat size={20} strokeWidth={1.5} />,
      label: 'Total reps',
      value: formatNumber(keyStats.totalReps),
    },
    {
      icon: <CalendarCheck size={20} strokeWidth={1.5} />,
      label: 'Sessions',
      value: formatNumber(keyStats.totalSessions),
    },
  ];

  return (
    <div className={styles.grid}>
      {cards.map((card) => (
        <GlowingEdgeCard
          key={card.label}
          mode="dark"
          className={styles.card}
        >
          <div className={styles.cardInner}>
            <div className={styles.iconRow}>
              <span className={styles.icon}>{card.icon}</span>
            </div>
            <p className={styles.value}>{card.value}</p>
            <p className={styles.label}>{card.label}</p>
          </div>
        </GlowingEdgeCard>
      ))}
    </div>
  );
}

export default DashboardStatCards;
