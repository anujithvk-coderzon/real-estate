"use client";

import { useEffect, useRef, type ReactNode } from "react";

// Cards that pin as you scroll and settle into a deck behind the one you are
// filling in. Each card that has been passed tips back, shrinks a little,
// lifts and shades — so the page reads as a stack you are working down rather
// than a form that goes on for ever.
//
// Driven by CSS custom properties rather than React state: a scroll handler
// that calls setState would re-render every card on every frame. Here React
// renders once and the loop writes --card-scale / --card-lift / --card-tilt /
// --shade straight onto the nodes.
//
// Values are eased toward their targets with an exponential blend keyed on
// elapsed time, so the motion is the same on a 60Hz and a 120Hz screen.

const STACK_TOP = 88; // where a card pins, under the page chrome
const MAX_DEPTH = 3; // cards deeper than this are already fully settled

type Motion = { scale: number; lift: number; tilt: number; shade: number };
const atRest = (): Motion => ({ scale: 1, lift: 0, tilt: 0, shade: 0 });

const CardStack = ({ children }: { children: ReactNode }) => {
  const root = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const host = root.current;
    if (!host) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    // Below 640px the deck is a plain column (globals.css), so measuring every
    // card on every scroll there would be work nobody sees.
    const wide = window.matchMedia("(min-width: 640px)");
    let cards: HTMLElement[] = [];
    let state: Motion[] = [];
    let target: Motion[] = [];
    let frame = 0;
    let last = 0;

    // Query by class, not host.children: the cards are rendered inside
    // PropertyDetailsForm, so the only direct child here is that component's
    // own wrapper. Looking one level down found a single element and animated
    // the wrapper instead of the deck.
    const collect = () => {
      cards = Array.from(host.querySelectorAll<HTMLElement>(".stack-card"));
      state = cards.map(atRest);
      target = cards.map(atRest);
    };

    const measure = () => {
      cards.forEach((card, i) => {
        // How far the cards after this one have covered it. Each contributes
        // at most 1, so depth is "how many are sitting on top".
        let depth = 0;
        for (let j = i + 1; j < cards.length; j++) {
          const rect = cards[j]!.getBoundingClientRect();
          const travel = Math.max(rect.height * 0.6, 1);
          depth += Math.min(Math.max((STACK_TOP + travel - rect.top) / travel, 0), 1);
          if (depth >= MAX_DEPTH) break;
        }
        depth = Math.min(depth, MAX_DEPTH);
        target[i] = {
          scale: 1 - 0.035 * depth,
          lift: -10 * depth,
          tilt: -3.2 * depth,
          shade: Math.min(0.42, 0.16 * depth),
        };
      });
    };

    const draw = (now: number) => {
      frame = 0;
      const delta = Math.min(48, last ? now - last : 16.7);
      last = now;
      // Snap straight to the target when the reader has asked for less motion.
      const blend = reduced.matches ? 1 : 1 - Math.exp(-delta / 80);
      let moving = false;

      cards.forEach((card, i) => {
        const to = target[i]!;
        const at = state[i]!;
        for (const key of ["scale", "lift", "tilt", "shade"] as const) {
          const gap = to[key] - at[key];
          const tolerance = key === "lift" ? 0.015 : 0.00015;
          if (Math.abs(gap) > tolerance) {
            at[key] += gap * blend;
            moving = true;
          } else at[key] = to[key];
        }
        card.style.setProperty("--card-scale", at.scale.toFixed(5));
        card.style.setProperty("--card-lift", `${at.lift.toFixed(3)}px`);
        card.style.setProperty("--card-tilt", `${at.tilt.toFixed(3)}deg`);
        card.style.setProperty("--shade", at.shade.toFixed(4));
      });

      if (moving) frame = requestAnimationFrame(draw);
    };

    const kick = () => {
      if (!wide.matches) return;
      measure();
      if (!frame) frame = requestAnimationFrame(draw);
    };

    collect();
    kick();

    window.addEventListener("scroll", kick, { passive: true });
    window.addEventListener("resize", kick);
    // Sections appear and disappear as the seller picks a property type, so
    // the card list is not fixed for the life of the page.
    const observer = new MutationObserver(() => {
      collect();
      kick();
    });
    observer.observe(host, { childList: true, subtree: true });

    return () => {
      window.removeEventListener("scroll", kick);
      window.removeEventListener("resize", kick);
      observer.disconnect();
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <div ref={root} className="card-stack">
      {children}
    </div>
  );
};

export default CardStack;
