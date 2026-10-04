import { useState } from "react";
import type { RevenueBucket } from "../../pages/admin/lib/orders";
import { axisMoney, money } from "../../pages/admin/lib/format";
import { Segmented } from "./Filters";
import styles from "./RevenueChart.module.css";

// Round axis ticks: 0, 250, 500… never 0, 237, 474.
function scale(max: number) {
  if (max <= 0) return { top: 100, ticks: [0, 25, 50, 75, 100] };
  const rough = max / 4;
  const magnitude = 10 ** Math.floor(Math.log10(rough));
  const step = [1, 2, 2.5, 5, 10].find((factor) => rough <= factor * magnitude)! * magnitude;
  const top = Math.ceil(max / step) * step;
  return { top, ticks: Array.from({ length: Math.round(top / step) + 1 }, (_, index) => index * step) };
}

interface RevenueChartProps { buckets: RevenueBucket[]; label: string }

/** Single-series column chart. Each column has its own hover/focus readout; the table view shows every value. */
export default function RevenueChart({ buckets, label }: RevenueChartProps) {
  const [view, setView] = useState<"chart" | "table">("chart");
  const [active, setActive] = useState<number | null>(null);
  const { top, ticks } = scale(Math.max(...buckets.map((bucket) => bucket.value)));
  const empty = buckets.every((bucket) => bucket.value === 0);
  const last = buckets.length - 1;

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <Segmented label="Revenue view" value={view} onChange={setView} options={[{ value: "chart", label: "Chart" }, { value: "table", label: "Table" }]} />
      </div>

      {view === "table" ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <caption className="sr-only">{label}</caption>
            <thead><tr><th scope="col">Period</th><th scope="col">Revenue</th></tr></thead>
            <tbody>
              {[...buckets].reverse().map((bucket) => <tr key={bucket.start.toISOString()}><td>{bucket.detail}</td><td>{money(bucket.value)}</td></tr>)}
            </tbody>
          </table>
        </div>
      ) : (
        <div className={`${styles.chart} ${buckets.length > 8 ? styles.dense : ""}`}>
          <div className={styles.yAxis} aria-hidden="true">
            {ticks.map((tick) => <span key={tick} className={styles.tick} style={{ bottom: `${(tick / top) * 100}%` }}>{axisMoney(tick)}</span>)}
          </div>
          <div className={styles.plot} role="group" aria-label={label} onPointerLeave={() => setActive(null)}>
            {ticks.slice(1).map((tick) => <span key={tick} className={styles.gridLine} style={{ bottom: `${(tick / top) * 100}%` }} aria-hidden="true" />)}
            <div className={styles.columns}>
              {buckets.map((bucket, index) => {
                const tooltipEdge = index < 2 ? styles.tooltipStart : index > last - 2 ? styles.tooltipEnd : "";
                const height = (bucket.value / top) * 100;
                return (
                  <button
                    key={bucket.start.toISOString()}
                    type="button"
                    className={styles.slot}
                    aria-label={`${bucket.detail}: ${money(bucket.value)}`}
                    onPointerEnter={() => setActive(index)}
                    onFocus={() => setActive(index)}
                    onBlur={() => setActive(null)}
                  >
                    <span className={styles.bar} style={{ height: bucket.value > 0 ? `max(${height}%, 2px)` : 0 }} aria-hidden="true" />
                    {active === index && (
                      <span className={`${styles.tooltip} ${tooltipEdge}`} style={{ bottom: `calc(${Math.min(height, 82)}% + 8px)` }} aria-hidden="true">
                        <strong>{money(bucket.value)}</strong>
                        <span>{bucket.detail}</span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {empty && <div className={styles.empty}><span>No revenue in this period yet</span></div>}
          </div>
          <div className={styles.xAxis} aria-hidden="true">
            {buckets.map((bucket, index) => <span key={bucket.start.toISOString()} data-keep={(last - index) % 3 === 0 || undefined} className={`${styles.xLabel} ${index === last ? styles.current : ""}`}>{bucket.label}</span>)}
          </div>
        </div>
      )}
    </div>
  );
}
