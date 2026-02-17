'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { gsap } from 'gsap';
import { Menu, X } from 'lucide-react';
import styles from './pill-nav.module.css';

export type PillNavItem = {
  label: string;
  href: string;
  ariaLabel?: string;
};

export interface PillNavProps {
  logo: React.ReactNode | string;
  logoAlt?: string;
  items: PillNavItem[];
  activeHref?: string;
  className?: string;
  ease?: string;
  baseColor?: string;
  pillColor?: string;
  hoveredPillTextColor?: string;
  pillTextColor?: string;
  initialLoadAnimation?: boolean;
}

const isExternalLink = (href: string) => {
  const value = href.trim();
  return (
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('//') ||
    value.startsWith('mailto:') ||
    value.startsWith('tel:') ||
    value.startsWith('#')
  );
};

const isInternalLink = (href: string) => href && !isExternalLink(href);

export function PillNav({
  logo,
  logoAlt = 'Logo',
  items,
  activeHref,
  className = '',
  ease = 'power3.out',
  baseColor = 'hsl(var(--primary))',
  pillColor = 'hsl(var(--background))',
  hoveredPillTextColor = 'hsl(var(--primary-foreground))',
  pillTextColor = 'hsl(var(--foreground))',
  initialLoadAnimation = true
}: PillNavProps) {
  const resolvedPillTextColor = pillTextColor;
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const circleRefs = useRef<Array<HTMLSpanElement | null>>([]);
  const timelineRefs = useRef<Array<gsap.core.Timeline | null>>([]);
  const activeTweenRefs = useRef<Array<gsap.core.Tween | null>>([]);
  const logoNodeRef = useRef<HTMLElement | null>(null);
  const mobileMenuRef = useRef<HTMLDivElement | null>(null);
  const navItemsRef = useRef<HTMLUListElement | null>(null);
  const logoWrapperRef = useRef<HTMLDivElement | null>(null);

  const renderLogo = () => {
    if (typeof logo === 'string') {
      return (
        <img src={logo} alt={logoAlt} ref={logoNodeRef as React.Ref<HTMLImageElement>} className={styles.logoVisual} />
      );
    }

    return (
      <span ref={logoNodeRef as React.Ref<HTMLSpanElement>} className={styles.logoNodeWrapper}>
        {logo}
      </span>
    );
  };

  useEffect(() => {
    const layout = () => {
      circleRefs.current.forEach((circle, index) => {
        if (!circle || !circle.parentElement) return;

        const pill = circle.parentElement as HTMLElement;
        const rect = pill.getBoundingClientRect();
        const { width, height } = rect;

        const radius = ((width * width) / 4 + height * height) / (2 * height);
        const diameter = Math.ceil(2 * radius) + 2;
        const delta = Math.ceil(radius - Math.sqrt(Math.max(0, radius * radius - (width * width) / 4)) + 1;
        const originY = diameter - delta;

        circle.style.width = `${diameter}px`;
        circle.style.height = `${diameter}px`;
        circle.style.bottom = `-${delta}px`;

        gsap.set(circle, {
          xPercent: -50,
          scale: 0,
          transformOrigin: `50% ${originY}px`
        });

        const label = pill.querySelector<HTMLElement>(`.${styles.pillLabel}`);
        const hover = pill.querySelector<HTMLElement>(`.${styles.pillLabelHover}`);

        if (label) gsap.set(label, { y: 0 });
        if (hover) gsap.set(hover, { y: height + 12, opacity: 0 });

        timelineRefs.current[index]?.kill();
        const tl = gsap.timeline({ paused: true });
        tl.to(circle, { scale: 1.2, xPercent: -50, duration: 0.8, ease, overwrite: 'auto' }, 0);

        if (label) {
          tl.to(label, { y: -(height + 8), duration: 0.6, ease, overwrite: 'auto' }, 0);
        }

        if (hover) {
          tl.to(hover, { y: 0, opacity: 1, duration: 0.6, ease, overwrite: 'auto' }, 0);
        }

        timelineRefs.current[index] = tl;
      });
    };

    layout();
    const onResize = () => layout();
    window.addEventListener('resize', onResize);

    if (document.fonts) {
      document.fonts.ready.then(layout).catch(() => {});
    }

    if (initialLoadAnimation) {
      if (logoWrapperRef.current) {
        gsap.set(logoWrapperRef.current, { scale: 0, opacity: 0 });
        gsap.to(logoWrapperRef.current, { scale: 1, opacity: 1, duration: 0.8, ease: 'back.out(1.7)' });
      }

      if (navItemsRef.current) {
        const links = navItemsRef.current.querySelectorAll('li');
        gsap.set(links, { opacity: 0, x: -20 });
        gsap.to(links, {
          opacity: 1,
          x: 0,
          duration: 0.6,
          stagger: 0.05,
          ease: 'power2.out',
          delay: 0.2
        });
      }
    }

    return () => {
      window.removeEventListener('resize', onResize);
      timelineRefs.current.forEach((timeline) => timeline?.kill());
      activeTweenRefs.current.forEach((tween) => tween?.kill());
    };
  }, [items, ease, initialLoadAnimation]);

  const handleEnter = (index: number) => {
    const timeline = timelineRefs.current[index];
    if (!timeline) return;
    activeTweenRefs.current[index]?.kill();
    activeTweenRefs.current[index] = timeline.tweenTo(timeline.duration(), {
      duration: 0.4,
      ease,
      overwrite: 'auto'
    });
  };

  const handleLeave = (index: number) => {
    const timeline = timelineRefs.current[index];
    if (!timeline) return;
    activeTweenRefs.current[index]?.kill();
    activeTweenRefs.current[index] = timeline.tweenTo(0, {
      duration: 0.3,
      ease,
      overwrite: 'auto'
    });
  };

  const handleLogoRotate = () => {
    if (!logoNodeRef.current) return;
    gsap.killTweensOf(logoNodeRef.current);
    gsap.to(logoNodeRef.current, {
      rotate: 360,
      duration: 0.8,
      ease: 'elastic.out(1, 0.5)',
      overwrite: 'auto',
      onComplete: () => gsap.set(logoNodeRef.current, { rotate: 0 })
    });
  };

  const toggleMobileMenu = () => {
    const nextOpenState = !isMobileMenuOpen;
    setIsMobileMenuOpen(nextOpenState);

    const menu = mobileMenuRef.current;
    if (!menu) return;

    if (nextOpenState) {
      gsap.set(menu, { display: 'block', opacity: 0, y: -20 });
      gsap.to(menu, { opacity: 1, y: 0, duration: 0.4, ease: 'power3.out' });
    } else {
      gsap.to(menu, {
        opacity: 0,
        y: -20,
        duration: 0.3,
        ease: 'power3.in',
        onComplete: () => gsap.set(menu, { display: 'none' })
      });
    }
  };

  const closeMobileMenu = () => {
    if (!isMobileMenuOpen) return;

    setIsMobileMenuOpen(false);
    const menu = mobileMenuRef.current;
    if (!menu) return;

    gsap.to(menu, {
      opacity: 0,
      y: -20,
      duration: 0.25,
      ease: 'power3.in',
      onComplete: () => gsap.set(menu, { display: 'none' })
    });
  };

  const cssVars: React.CSSProperties = {
    '--base': baseColor,
    '--pill-bg': pillColor,
    '--hover-text': hoveredPillTextColor,
    '--pill-text': resolvedPillTextColor,
    '--nav-h': '48px',
    '--logo-size': '40px',
    '--pill-pad-x': '20px',
    '--pill-gap': '6px'
  } as React.CSSProperties;

  const logoTarget = items[0]?.href ?? '/';

  const logoElement = isInternalLink(logoTarget) ? (
    <Link href={logoTarget} className={styles.logoLink}>
      {renderLogo()}
    </Link>
  ) : (
    <a href={logoTarget} className={styles.logoLink}>
      {renderLogo()}
    </a>
  );

  return (
    <div className={`${styles.navShell} ${className}`} style={cssVars}>
      <nav className={styles.nav} aria-label="Primary">
        <div className={styles.logoWrap} ref={logoWrapperRef} onMouseEnter={handleLogoRotate}>
          {logoElement}
        </div>

        <div className={styles.desktopMenu}>
          <ul ref={navItemsRef} role="menubar" className={styles.pillList}>
            {items.map((item, index) => {
              const active = activeHref === item.href;
              const commonPillStyle = {
                background: 'var(--pill-bg)',
                color: 'var(--pill-text)',
                paddingLeft: 'var(--pill-pad-x)',
                paddingRight: 'var(--pill-pad-x)'
              };

              const content = (
                <>
                  <span
                    className={styles.hoverCircle}
                    style={{ background: 'var(--base)' }}
                    aria-hidden
                    ref={(el) => {
                      circleRefs.current[index] = el;
                    }}
                  />
                  <span className={styles.labelStack}>
                    <span className={styles.pillLabel}>{item.label}</span>
                    <span className={styles.pillLabelHover} aria-hidden>
                      {item.label}
                    </span>
                  </span>
                  {active && <span className={styles.activeDot} aria-hidden />}
                </>
              );

              const linkProps = {
                className: `${styles.navPill} ${active ? styles.navPillActive : ''}`,
                style: commonPillStyle,
                onMouseEnter: () => handleEnter(index),
                onMouseLeave: () => handleLeave(index),
                'aria-label': item.ariaLabel || item.label,
                role: 'menuitem'
              };

              return (
                <li key={`${item.href}-${index}`} className={styles.pillListItem} role="none">
                  {isInternalLink(item.href) ? (
                    <Link href={item.href} {...linkProps}>
                      {content}
                    </Link>
                  ) : (
                    <a href={item.href} {...linkProps}>
                      {content}
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        <button
          type="button"
          onClick={toggleMobileMenu}
          aria-label="Toggle menu"
          aria-expanded={isMobileMenuOpen}
          className={styles.mobileMenuToggle}
        >
          {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </nav>

      <div ref={mobileMenuRef} className={styles.mobileMenu}>
        <ul>
          {items.map((item) => {
            const isActive = activeHref === item.href;
            return (
              <li key={`mobile-${item.href}`}>
                    {isInternalLink(item.href) ? (
                      <Link
                        href={item.href}
                        className={`${styles.mobileLink} ${isActive ? styles.mobileLinkActive : ''}`}
                        onClick={closeMobileMenu}
                      >
                        {item.label}
                      </Link>
                    ) : (
                      <a
                        href={item.href}
                        className={`${styles.mobileLink} ${isActive ? styles.mobileLinkActive : ''}`}
                        onClick={closeMobileMenu}
                      >
                        {item.label}
                      </a>
                    )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

export default PillNav;
