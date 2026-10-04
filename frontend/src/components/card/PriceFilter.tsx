import { useEffect, useId, useRef, useState } from "react";
import { ChevronDown, Check } from "lucide-react";

interface Props { minPrice: string; maxPrice: string; onApply: (min: string, max: string) => void; }
const presets = [{ label: "Up to GHS 50", min: "", max: "50" }, { label: "GHS 50–100", min: "50", max: "100" }, { label: "GHS 100 & above", min: "100", max: "" }];

export default function PriceFilter({ minPrice, maxPrice, onApply }: Props) {
  const [min, setMin] = useState(minPrice);
  const [max, setMax] = useState(maxPrice);
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const id = useId();
  const invalid = min !== "" && max !== "" && Number(min) > Number(max);
  useEffect(() => {
    const closeOnOutside = (event: PointerEvent) => {
      const details = detailsRef.current;
      if (details?.open && event.target instanceof Node && !details.contains(event.target)) details.open = false;
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      const details = detailsRef.current;
      if (event.key === "Escape" && details?.open) {
        details.open = false;
        details.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, []);

  const apply = (from: string, to: string) => {
    onApply(from, to);
    if (detailsRef.current) {
      detailsRef.current.open = false;
      detailsRef.current.querySelector("summary")?.focus();
    }
  };
  return (
    <details ref={detailsRef} className="market-price" onToggle={(event) => { if (event.currentTarget.open) { setMin(minPrice); setMax(maxPrice); } }}>
      <summary className={`market-filter-button ${minPrice || maxPrice ? "active" : ""}`}>Price range{(minPrice || maxPrice) && <span className="market-dot" />}<ChevronDown size={14} aria-hidden="true" /></summary>
      <div className="market-price-popover">
        <p className="market-popover-title">A budget that works for you</p>
        <div className="market-price-presets">{presets.map((preset) => <button key={preset.label} type="button" onClick={() => apply(preset.min, preset.max)}>{preset.label}{minPrice === preset.min && maxPrice === preset.max && <Check size={14} />}</button>)}</div>
        <form onSubmit={(event) => { event.preventDefault(); if (!invalid) apply(min, max); }}>
          <p className="market-field-hint">Or set your own range</p>
          <div className="market-price-inputs">
            <div><label htmlFor={`${id}-min`}>From (GHS)</label><div><input id={`${id}-min`} type="number" min="0" step="0.01" placeholder="0" value={min} onChange={(event) => setMin(event.target.value)} /></div></div>
            <div><label htmlFor={`${id}-max`}>To (GHS)</label><div><input id={`${id}-max`} type="number" min="0" step="0.01" placeholder="Any" value={max} onChange={(event) => setMax(event.target.value)} /></div></div>
          </div>
          {invalid && <p role="status" className="market-price-error">Maximum must be at least your minimum.</p>}
          <div className="market-price-actions"><button type="button" onClick={() => apply("", "")}>Clear price</button><button type="submit" disabled={invalid}>Apply range</button></div>
        </form>
      </div>
    </details>
  );
}
