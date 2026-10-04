import type { Variants } from "motion/react";

// One easing and timing for the storefront (home, products, product details) so pages move as a set.
export const ease = [0.22, 1, 0.36, 1] as const;

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease } },
};

// Used inside horizontal scrollers, where a vertical offset would briefly add a scrollbar.
export const fadeScale: Variants = {
  hidden: { opacity: 0, scale: 0.94 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.45, ease } },
};

export const stagger = (gap = 0.08, delay = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: gap, delayChildren: delay } },
});

// Reveal once, when a fifth of the element is on screen.
export const revealOnScroll = { initial: "hidden", whileInView: "show", viewport: { once: true, amount: 0.2 } } as const;

// Product cards reveal as they scroll in; `custom` is the card's index so columns ripple left to right.
export const cardIn: Variants = {
  hidden: { opacity: 0, y: 20 },
  show: (index: number = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.5, ease, delay: (index % 4) * 0.06 } }),
};
