/**
 * ScrollReveal — Apple-style bidirectional scroll animation wrapper.
 *
 * Fades + slides content into view as you scroll down; reverses out on scroll up.
 * Animations are intentionally subtle — small offsets, smooth easing.
 *
 * Props:
 *   children   — any React node
 *   delay      — stagger delay in seconds (default 0)
 *   direction  — 'up' | 'down' | 'left' | 'right' (default 'up')
 *   distance   — px translate offset (default 24 — kept subtle)
 *   className  — extra classes forwarded to the motion wrapper
 *   once       — animate only on first enter (default false = bidirectional)
 */

import { motion } from 'framer-motion';

// 'direction' describes which axis/sign the element starts offset on before animating in.
// 'up'    → starts below, rises up          (y: +dist → 0)
// 'down'  → starts above, falls down         (y: -dist → 0)
// 'left'  → starts right, slides left        (x: +dist → 0)
// 'right' → starts left,  slides right       (x: -dist → 0)
const directionOffset = (dir, dist) => {
  switch (dir) {
    case 'down':  return { y: -dist };
    case 'left':  return { x:  dist };
    case 'right': return { x: -dist };
    case 'up':
    default:      return { y:  dist };
  }
};

// Apple-style ease: fast start, smooth deceleration
const APPLE_EASE = [0.22, 1, 0.36, 1];

const ScrollReveal = ({
  children,
  delay = 0,
  direction = 'up',
  distance = 24,
  className = '',
  once = false,
}) => {
  const hidden  = { opacity: 0, ...directionOffset(direction, distance) };
  const visible = { opacity: 1, x: 0, y: 0 };

  return (
    <motion.div
      className={className}
      initial={hidden}
      whileInView={visible}
      viewport={{ once, margin: '-60px 0px' }}
      transition={{
        duration: 0.72,
        delay,
        ease: APPLE_EASE,
      }}
    >
      {children}
    </motion.div>
  );
};

export default ScrollReveal;
