'use client';

import { Variants, Transition } from 'framer-motion';

/**
 * ⚡ HIDDEN MUSIC VAULT - UI-UX PRO MAX MOTION DESIGN TOKENS
 *
 * Grounded on UI-UX Pro Max Spring Physics & Distilled Anti-AI Aesthetics:
 * - Asymmetric timing (Exit faster than Enter for responsiveness)
 * - Spring physics instead of rigid linear easings
 * - Zero layout-shifting transforms
 * - Fully accessible & reduced-motion friendly
 */

// ── 1. SPRING PHYSICS PRESETS ──────────────────────────────────────────────────

export const springSnappy: Transition = {
  type: 'spring',
  stiffness: 450,
  damping: 35,
  mass: 0.8,
};

export const springBouncy: Transition = {
  type: 'spring',
  stiffness: 380,
  damping: 24,
  mass: 0.9,
};

export const springSmooth: Transition = {
  type: 'spring',
  stiffness: 280,
  damping: 28,
  mass: 1,
};

export const springGentle: Transition = {
  type: 'spring',
  stiffness: 180,
  damping: 24,
  mass: 1,
};

// ── 2. MODAL & BACKDROP VARIANTS ───────────────────────────────────────────────

export const modalBackdropVariants: Variants = {
  hidden: {
    opacity: 0,
    backdropFilter: 'blur(0px)',
  },
  visible: {
    opacity: 1,
    backdropFilter: 'blur(16px)',
    transition: {
      duration: 0.25,
      ease: [0.16, 1, 0.3, 1],
    },
  },
  exit: {
    opacity: 0,
    backdropFilter: 'blur(0px)',
    transition: {
      duration: 0.18,
      ease: [0.7, 0, 0.84, 0],
    },
  },
};

export const modalContentVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.94,
    y: 16,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: springSnappy,
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    y: 8,
    transition: {
      duration: 0.16,
      ease: [0.7, 0, 0.84, 0],
    },
  },
};

export const modalSlideUpVariants: Variants = {
  hidden: {
    opacity: 0,
    y: '100%',
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: springSmooth,
  },
  exit: {
    opacity: 0,
    y: '100%',
    transition: {
      duration: 0.2,
      ease: [0.7, 0, 0.84, 0],
    },
  },
};

// ── 3. DRAWERS & FLYOUTS ───────────────────────────────────────────────────────

export const drawerSlideRightVariants: Variants = {
  hidden: {
    x: '100%',
    opacity: 0,
  },
  visible: {
    x: 0,
    opacity: 1,
    transition: springSnappy,
  },
  exit: {
    x: '100%',
    opacity: 0,
    transition: {
      duration: 0.18,
      ease: [0.7, 0, 0.84, 0],
    },
  },
};

export const drawerSlideLeftVariants: Variants = {
  hidden: {
    x: '-100%',
    opacity: 0,
  },
  visible: {
    x: 0,
    opacity: 1,
    transition: springSnappy,
  },
  exit: {
    x: '-100%',
    opacity: 0,
    transition: {
      duration: 0.18,
      ease: [0.7, 0, 0.84, 0],
    },
  },
};

// ── 4. STAGGERED LISTS & CONTAINERS ───────────────────────────────────────────

export const staggerContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.04,
      delayChildren: 0.05,
    },
  },
};

export const staggerItemVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 12,
  },
  visible: {
    opacity: 1,
    y: 0,
    transition: springSnappy,
  },
};

export const staggerItemScaleVariants: Variants = {
  hidden: {
    opacity: 0,
    scale: 0.92,
    y: 8,
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: springSnappy,
  },
};

// ── 5. MICRO-INTERACTION BUTTON & CARD PRESETS ─────────────────────────────────

export const buttonTapMotion = {
  whileHover: { scale: 1.02 },
  whileTap: { scale: 0.96 },
  transition: { duration: 0.12 },
};

export const subtleButtonTapMotion = {
  whileHover: { scale: 1.01 },
  whileTap: { scale: 0.98 },
  transition: { duration: 0.1 },
};

export const iconButtonMotion = {
  whileHover: { scale: 1.1 },
  whileTap: { scale: 0.9 },
  transition: { duration: 0.1 },
};

export const cardInteractiveMotion = {
  whileHover: {
    y: -3,
    scale: 1.015,
    transition: springSnappy,
  },
  whileTap: {
    scale: 0.98,
    transition: { duration: 0.08 },
  },
};

// ── 6. ACCESSIBILITY & FADES ──────────────────────────────────────────────────

export const fadeVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.2, ease: 'easeOut' },
  },
  exit: {
    opacity: 0,
    transition: { duration: 0.15, ease: 'easeIn' },
  },
};

export const accordionVariants: Variants = {
  hidden: {
    opacity: 0,
    height: 0,
    overflow: 'hidden',
  },
  visible: {
    opacity: 1,
    height: 'auto',
    transition: springSmooth,
  },
  exit: {
    opacity: 0,
    height: 0,
    transition: {
      duration: 0.2,
      ease: [0.7, 0, 0.84, 0],
    },
  },
};
