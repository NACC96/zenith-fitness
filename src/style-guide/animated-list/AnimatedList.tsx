'use client';

import React, {
  type KeyboardEvent,
  type MouseEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
  type UIEvent
} from 'react';
import { motion, useInView } from 'framer-motion';
import styles from './animated-list.module.css';

type AnimatedItemProps = {
  children: React.ReactNode;
  delay?: number;
  index: number;
  selected: boolean;
  onMouseEnter?: (event: MouseEvent<HTMLDivElement>) => void;
  onClick?: (event: MouseEvent<HTMLDivElement>) => void;
};

function AnimatedItem({
  children,
  delay = 0,
  index,
  selected,
  onMouseEnter,
  onClick
}: AnimatedItemProps) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { amount: 0.5, once: false });

  return (
    <motion.div
      ref={ref}
      data-index={index}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
      initial={{ scale: 0.7, opacity: 0 }}
      animate={inView ? { scale: 1, opacity: 1 } : { scale: 0.7, opacity: 0 }}
      transition={{ duration: 0.22, delay }}
      className={`${styles.itemMotion} ${selected ? styles.itemMotionSelected : ''}`}
    >
      {children}
    </motion.div>
  );
}

export interface AnimatedListProps {
  items?: string[];
  onItemSelect?: (item: string, index: number) => void;
  showGradients?: boolean;
  enableArrowNavigation?: boolean;
  className?: string;
  itemClassName?: string;
  displayScrollbar?: boolean;
  initialSelectedIndex?: number;
}

const DEFAULT_ITEMS = [
  'Item 1',
  'Item 2',
  'Item 3',
  'Item 4',
  'Item 5',
  'Item 6',
  'Item 7',
  'Item 8',
  'Item 9',
  'Item 10',
  'Item 11',
  'Item 12',
  'Item 13',
  'Item 14',
  'Item 15'
];

export function AnimatedList({
  items = DEFAULT_ITEMS,
  onItemSelect,
  showGradients = true,
  enableArrowNavigation = true,
  className = '',
  itemClassName = '',
  displayScrollbar = true,
  initialSelectedIndex = -1
}: AnimatedListProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const [selectedIndex, setSelectedIndex] = useState(() =>
    Math.min(Math.max(initialSelectedIndex, -1), items.length - 1)
  );
  const [keyboardNav, setKeyboardNav] = useState(false);
  const [topGradientOpacity, setTopGradientOpacity] = useState(0);
  const [bottomGradientOpacity, setBottomGradientOpacity] = useState(1);

  const updateGradients = useCallback(() => {
    const container = listRef.current;
    if (!container) return;

    const { scrollTop, scrollHeight, clientHeight } = container;
    setTopGradientOpacity(Math.min(scrollTop / 56, 1));
    const distanceToBottom = scrollHeight - (scrollTop + clientHeight);
    setBottomGradientOpacity(scrollHeight <= clientHeight ? 0 : Math.min(distanceToBottom / 56, 1));
  }, []);

  useEffect(() => {
    if (!listRef.current) return;
    updateGradients();
  }, [updateGradients, items]);

  const handleItemMouseEnter = useCallback((index: number) => {
    setSelectedIndex(index);
  }, []);

  const handleItemClick = useCallback(
    (item: string, index: number) => {
      setSelectedIndex(index);
      onItemSelect?.(item, index);
    },
    [onItemSelect]
  );

  const handleScroll = (event: UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
    setTopGradientOpacity(Math.min(scrollTop / 56, 1));
    const distanceToBottom = scrollHeight - (scrollTop + clientHeight);
    setBottomGradientOpacity(scrollHeight <= clientHeight ? 0 : Math.min(distanceToBottom / 56, 1));
  };

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      if (!enableArrowNavigation) {
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setKeyboardNav(true);
        setSelectedIndex((prev) => Math.min(prev + 1, items.length - 1));
      } else if (event.key === 'ArrowUp') {
        event.preventDefault();
        setKeyboardNav(true);
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (event.key === 'Enter') {
        event.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < items.length) {
          onItemSelect?.(items[selectedIndex], selectedIndex);
        }
      }
    },
    [enableArrowNavigation, items, onItemSelect, selectedIndex]
  );

  useEffect(() => {
    const container = listRef.current;
    if (!keyboardNav || selectedIndex < 0 || !container) return;

    const selectedItem = container.querySelector(`[data-index="${selectedIndex}"]`) as HTMLElement | null;
    if (!selectedItem) {
      return;
    }

    const extraMargin = 54;
    const { scrollTop, clientHeight } = container;
    const itemTop = selectedItem.offsetTop;
    const itemBottom = itemTop + selectedItem.offsetHeight;

    if (itemTop < scrollTop + extraMargin) {
      container.scrollTo({ top: itemTop - extraMargin, behavior: 'smooth' });
    } else if (itemBottom > scrollTop + clientHeight - extraMargin) {
      container.scrollTo({
        top: itemBottom - clientHeight + extraMargin,
        behavior: 'smooth'
      });
    }

    setKeyboardNav(false);
  }, [keyboardNav, selectedIndex]);

  useEffect(() => {
    if (initialSelectedIndex < 0) return;
    setSelectedIndex((prev) => {
      const safe = Math.min(Math.max(initialSelectedIndex, -1), items.length - 1);
      return safe >= 0 && prev !== safe ? safe : prev;
    });
  }, [initialSelectedIndex, items.length]);

  return (
    <div className={`${styles.shell} ${className}`}>
      <div
        ref={listRef}
        className={`${styles.viewport} ${displayScrollbar ? styles.viewportScrollable : styles.viewportHideScrollbar}`}
        onScroll={handleScroll}
        onKeyDown={handleKeyDown}
        tabIndex={0}
        role="listbox"
        aria-label="Animated list"
      >
        {items.map((item, index) => (
          <AnimatedItem
            key={`${item}-${index}`}
            delay={0.08}
            index={index}
            selected={selectedIndex === index}
            onMouseEnter={() => handleItemMouseEnter(index)}
            onClick={() => handleItemClick(item, index)}
          >
            <div className={`${styles.itemContent} ${selectedIndex === index ? styles.itemContentSelected : ''} ${itemClassName}`}>
              <p className={styles.itemText}>{item}</p>
            </div>
          </AnimatedItem>
        ))}
      </div>

      {showGradients && (
        <>
          <div className={styles.topGradient} style={{ opacity: topGradientOpacity }} />
          <div className={styles.bottomGradient} style={{ opacity: bottomGradientOpacity }} />
        </>
      )}
    </div>
  );
}

export default AnimatedList;
