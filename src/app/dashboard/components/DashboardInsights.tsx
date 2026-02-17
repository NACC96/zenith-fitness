'use client';

import React, { useRef } from 'react';
import { motion, useInView } from 'framer-motion';
import { AnimatedList } from '../../../style-guide';
import type { SessionInsight } from '../../../workouts/ingestion-contract';
import type { DashboardSessionHistoryRow } from '../../../workouts/dashboard-analytics';
import styles from './dashboard-insights.module.css';

interface InsightCardProps {
  insight: SessionInsight;
  date: string;
  index: number;
}

function InsightCard({ insight, date, index }: InsightCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.3, once: false });

  return (
    <motion.div
      ref={ref}
      initial={{ scale: 0.85, opacity: 0 }}
      animate={inView ? { scale: 1, opacity: 1 } : { scale: 0.85, opacity: 0 }}
      transition={{ duration: 0.22, delay: index * 0.05 }}
      className={styles.itemWrapper}
    >
      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <span className={styles.date}>{date}</span>
          <span
            className={
              insight.mode === 'actionable'
                ? `${styles.badge} ${styles.badgeActionable}`
                : `${styles.badge} ${styles.badgeReview}`
            }
          >
            {insight.mode}
          </span>
        </div>

        <h3 className={styles.headline}>{insight.headline}</h3>
        <p className={styles.summary}>{insight.summary}</p>

        {insight.recommendations.length > 0 && (
          <ul className={styles.recommendations}>
            {insight.recommendations.map((rec, i) => (
              <li key={i}>{rec}</li>
            ))}
          </ul>
        )}

        {insight.anomalies.length > 0 && (
          <div className={styles.anomalies}>
            {insight.anomalies.map((anomaly, i) => (
              <span key={i} className={styles.anomalyBadge}>
                ⚠ {anomaly}
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

const formatDate = (value: string): string => {
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return value;
  return new Date(timestamp).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

interface DashboardInsightsProps {
  sessionInsights: SessionInsight[];
  sessionHistory: DashboardSessionHistoryRow[];
}

export function DashboardInsights({ sessionInsights, sessionHistory }: DashboardInsightsProps) {
  if (sessionInsights.length === 0) {
    return (
      <AnimatedList
        items={['No AI insights available for the selected filters.']}
        showGradients={false}
        enableArrowNavigation={false}
        className={styles.emptyAnimatedList}
        itemClassName={styles.emptyItem}
      />
    );
  }

  const dateBySessionId = new Map(
    sessionHistory.map((row) => [row.sessionId, row.occurredAt])
  );

  const items = sessionInsights.map((insight) => insight.sessionId);

  return (
    <AnimatedList
      items={items}
      showGradients={true}
      enableArrowNavigation={false}
      displayScrollbar={true}
      renderItem={(_sessionId, index) => {
        const insight = sessionInsights[index];
        const occurredAt = dateBySessionId.get(insight.sessionId);
        const date = occurredAt ? formatDate(occurredAt) : insight.sessionId;
        return <InsightCard insight={insight} date={date} index={index} />;
      }}
    />
  );
}

export default DashboardInsights;
