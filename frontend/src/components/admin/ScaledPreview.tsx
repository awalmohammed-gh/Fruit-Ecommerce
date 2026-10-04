import { useEffect, useRef, useState, type ReactNode } from "react";

// Renders a storefront section at desktop width, scaled down to fit, with interaction disabled.
export default function ScaledPreview({ width = 1280, height, children }: { width?: number; height: number; children: ReactNode }) {
  const frame = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(0.5);
  useEffect(() => {
    const element = frame.current;
    if (!element) return;
    const observer = new ResizeObserver(([entry]) => setScale(Math.min(1, entry!.contentRect.width / width)));
    observer.observe(element);
    return () => observer.disconnect();
  }, [width]);
  return (
    <div ref={frame} style={{ position: "relative", height: height * scale, overflow: "hidden", borderRadius: 12, border: "1px solid var(--gf-border)", background: "#fffdf7", color: "#1b3022", colorScheme: "light" }}>
      <div inert style={{ width, height, transform: `scale(${scale})`, transformOrigin: "top left", overflow: "hidden" }}>{children}</div>
    </div>
  );
}
