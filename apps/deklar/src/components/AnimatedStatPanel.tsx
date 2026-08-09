"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { formatKr } from "@/lib/format";

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

// Eases 0 -> target over durationMs, starting only once `active` flips true —
// lets the panel wait for scroll-into-view instead of counting up off-screen.
function useCountUp(target: number, active: boolean, durationMs = 1100): number {
  const [value, setValue] = useState(0);
  const startedRef = useRef(false);

  useEffect(() => {
    if (!active || startedRef.current) return;
    startedRef.current = true;

    // Respect prefers-reduced-motion by collapsing the animation to a single
    // frame rather than calling setState synchronously here.
    const effectiveDuration = prefersReducedMotion() ? 1 : durationMs;

    let raf: number;
    const start = performance.now();
    function tick(now: number) {
      const t = Math.min((now - start) / effectiveDuration, 1);
      const eased = 1 - Math.pow(1 - t, 3); // ease-out cubic
      setValue(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, target, durationMs]);

  return value;
}

function useInView<T extends HTMLElement>(): [React.RefObject<T | null>, boolean] {
  const ref = useRef<T>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.4 },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return [ref, inView];
}

export interface Finding {
  icon: ReactNode;
  label: string;
  amountOre: number;
}

interface AnimatedStatPanelProps {
  label: string;
  totalOre: number;
  caption: string;
  findings: Finding[];
}

export function AnimatedStatPanel({
  label,
  totalOre,
  caption,
  findings,
}: AnimatedStatPanelProps) {
  const [ref, inView] = useInView<HTMLDivElement>();
  const total = useCountUp(totalOre, inView);

  return (
    <div className="stat-panel" ref={ref}>
      <span className="stat-label">{label}</span>
      <div className="stat-panel-glow" aria-hidden="true" />
      <div className="stat-number">{formatKr(total)}</div>
      <p className="stat-caption">{caption}</p>
      <div className="finding-list">
        {findings.map((finding, index) => (
          <FindingRow
            key={finding.label}
            finding={finding}
            active={inView}
            delayMs={index * 220}
          />
        ))}
      </div>
    </div>
  );
}

function FindingRow({
  finding,
  active,
  delayMs,
}: {
  finding: Finding;
  active: boolean;
  delayMs: number;
}) {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => setRevealed(true), delayMs);
    return () => clearTimeout(timer);
  }, [active, delayMs]);

  const amount = useCountUp(finding.amountOre, revealed, 700);

  return (
    <div className={`finding-row${revealed ? " revealed" : ""}`}>
      <span className="finding-icon">{finding.icon}</span>
      <span className="finding-label">{finding.label}</span>
      <span className="finding-amount">{formatKr(amount)}</span>
    </div>
  );
}
