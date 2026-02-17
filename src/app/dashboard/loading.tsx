import styles from "./dashboard-loading.module.css";

export default function DashboardLoading() {
  return (
    <main className={styles.page}>
      <div className={styles.pageHeader}>
        <div className={styles.skeletonTitle} />
        <div className={styles.skeletonSubtitle} />
      </div>

      <section className={styles.section}>
        <div className={styles.skeletonSectionLabel} />
        <div className={styles.skeletonFilterBar} />
      </section>

      <section className={styles.section}>
        <div className={styles.skeletonSectionLabel} />
        <div className={styles.statGrid}>
          <div className={styles.skeletonCard} />
          <div className={styles.skeletonCard} />
          <div className={styles.skeletonCard} />
          <div className={styles.skeletonCard} />
        </div>
      </section>

      <section className={styles.section}>
        <div className={styles.skeletonSectionLabel} />
        <div className={styles.skeletonBlock} />
      </section>

      <section className={styles.section}>
        <div className={styles.skeletonSectionLabel} />
        <div className={styles.skeletonBlock} />
      </section>
    </main>
  );
}
