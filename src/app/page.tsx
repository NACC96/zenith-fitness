import Link from "next/link";

export default function HomePage() {
  return (
    <main style={{ margin: "2rem auto", maxWidth: 960, fontFamily: "sans-serif" }}>
      <h1>Zenith Fitness Dashboard</h1>
      <p>Open the dashboard to view filterable workout analytics, or open the style-guide to review the new component library.</p>
      <ul>
        <li><Link href="/dashboard">Go to dashboard</Link></li>
        <li><Link href="/style-guide/magnification-dock">View Magnification Dock style-guide</Link></li>
        <li><Link href="/style-guide/pill-nav">View PillNav style-guide</Link></li>
        <li><Link href="/style-guide/animated-list">View Animated List style-guide</Link></li>
        <li><Link href="/style-guide/glowing-edge-card">View Glowing Edge Card style-guide</Link></li>
        <li><Link href="/style-guide/neon-typing-button">View Neon Typing Button style-guide</Link></li>
      </ul>
    </main>
  );
}
