"use client";

interface DashboardErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: DashboardErrorProps) {
  return (
    <main style={{ margin: "2rem auto", maxWidth: 960, fontFamily: "sans-serif" }}>
      <h1>Workout Analytics Dashboard</h1>
      <p>We could not load dashboard analytics.</p>
      <p>{error.message}</p>
      <button type="button" onClick={() => reset()}>
        Try again
      </button>
    </main>
  );
}
