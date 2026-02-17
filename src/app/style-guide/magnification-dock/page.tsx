import Link from 'next/link';
import { Bell, Camera, Heart, Home, Search, Settings, User } from 'lucide-react';
import { MagnificationDock, DockItemData } from '../../../style-guide/magnification-dock';
import styles from '../style-guide-page.module.css';

const items: DockItemData[] = [
  { icon: <Home size={22} />, label: 'Home', onClick: () => console.log('Home') },
  { icon: <Search size={22} />, label: 'Search', onClick: () => console.log('Search') },
  { icon: <User size={22} />, label: 'Profile', onClick: () => console.log('Profile') },
  { icon: <Bell size={22} />, label: 'Notifications', onClick: () => console.log('Notifications') },
  { icon: <Camera size={22} />, label: 'Capture', onClick: () => console.log('Capture') },
  { icon: <Heart size={22} />, label: 'Likes', onClick: () => console.log('Likes') },
  { icon: <Settings size={22} />, label: 'Settings', onClick: () => console.log('Settings') }
];

export default function StyleGuideMagnificationDockPage() {
  return (
    <div className={styles.showcase}>
      <article className={styles.showcaseCard}>
        <p className={styles.showcaseHeader}>Interaction Layer</p>
        <h1 className={styles.showcaseTitle}>Magnification Dock</h1>
        <p className={styles.showcaseSubtext}>
          Built for kinetic, icon-first nav surfaces with distance-aware scale physics and glassmorphism accents.
        </p>

        <div className={`${styles.componentSurface} ${styles.floating}`}>
          <div className={styles.componentAlign}>
            <MagnificationDock
              items={items}
              panelHeight={68}
              baseItemSize={50}
              magnification={80}
              className={styles.dockTheme}
            />
          </div>
        </div>

        <p className={styles.footnote}>
          Built from the shared style-guide component in <code>src/style-guide/magnification-dock</code>.
        </p>

        <div className={styles.linkRow}>
          <Link href="/style-guide/pill-nav" className={styles.linkPill}>
            Next: PillNav
          </Link>
        </div>
      </article>
    </div>
  );
}
