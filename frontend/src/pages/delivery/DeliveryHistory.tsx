import { Link, useSearchParams } from "react-router-dom";
import { ChevronLeftIcon, ChevronRightIcon, HistoryIcon } from "lucide-react";
import { deliveryApi } from "../../frontApisRoute/delivery";
import type { DeliveryStatus } from "../../types";
import { useResource } from "../../hooks/useResource";
import StatusBadge from "../../components/Delivery/StatusBadge";
import { EmptyCard, ErrorCard, LoadingCards } from "../../components/Delivery/States";
import { shortDate, time } from "../../utils/delivery";

const FILTERS: { value: "" | DeliveryStatus; label: string }[] = [
  { value: "", label: "All" },
  { value: "Delivered", label: "Delivered" },
  { value: "Failed Delivery", label: "Failed" },
];

// Finished deliveries as a simple list, newest first.
export default function DeliveryHistory() {
  const [params, setParams] = useSearchParams();
  const status = (params.get("status") ?? "") as "" | DeliveryStatus;
  const page = Math.max(1, Number(params.get("page")) || 1);
  const result = useResource(`partner-history:${status}:${page}`, () => deliveryApi.history({ status, page }));
  const rows = result.data?.deliveries;
  const pagination = result.data?.pagination;
  const go = (next: Record<string, string>) => setParams(Object.fromEntries(Object.entries(next).filter(([, value]) => value)));

  return (
    <div className="space-y-4">
      <div className="inline-flex gap-1 bg-white p-1 rounded-xl border border-app-border/60" role="group" aria-label="Filter history">
        {FILTERS.map((filter) => (
          <button key={filter.label} type="button" aria-pressed={status === filter.value} onClick={() => go({ status: filter.value })}
            className={`h-9 px-4 rounded-lg text-sm font-medium ${status === filter.value ? "bg-app-green text-white" : "text-zinc-600 hover:bg-app-cream"}`}>
            {filter.label}
          </button>
        ))}
      </div>

      {result.error && !rows ? <ErrorCard message={result.error} onRetry={result.reload} />
        : !rows ? <LoadingCards count={3} />
        : !rows.length ? <EmptyCard icon={HistoryIcon} title="No Delivery History" text="Your completed deliveries will appear here." />
        : (
          <ul className={`grid gap-2 lg:grid-cols-2 ${result.loading ? "opacity-60" : ""}`}>
            {rows.map((delivery) => (
              <li key={delivery._id}>
                <Link to={`/delivery-partner/deliveries/${delivery._id}`} className="block bg-white rounded-2xl border border-app-border/60 px-4 py-3 hover:border-app-green/30">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-semibold text-zinc-900">#{delivery.order?.number ?? "—"} · {delivery.order?.recipient.name}</p>
                      <p className="text-sm text-app-text-light truncate">{[delivery.order?.address.city, delivery.order?.address.region].filter(Boolean).join(", ")}</p>
                    </div>
                    <StatusBadge status={delivery.status} />
                  </div>
                  <p className="mt-2 text-xs text-app-text-light">
                    Assigned {shortDate(delivery.assignedAt)}
                    {delivery.completedAt && <> · Finished {shortDate(delivery.completedAt)}, {time(delivery.completedAt)}</>}
                  </p>
                  {delivery.failureReason && <p className="mt-1 text-xs text-red-700">{delivery.failureReason}</p>}
                </Link>
              </li>
            ))}
          </ul>
        )}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between gap-3 text-sm">
          <span className="text-app-text-light">Page {pagination.page} of {pagination.totalPages}</span>
          <div className="flex gap-2">
            <button type="button" aria-label="Previous page" disabled={pagination.page <= 1} onClick={() => go({ status, page: String(pagination.page - 1) })} className="size-11 rounded-xl bg-white border border-app-border flex-center disabled:opacity-40"><ChevronLeftIcon className="size-4" /></button>
            <button type="button" aria-label="Next page" disabled={pagination.page >= pagination.totalPages} onClick={() => go({ status, page: String(pagination.page + 1) })} className="size-11 rounded-xl bg-white border border-app-border flex-center disabled:opacity-40"><ChevronRightIcon className="size-4" /></button>
          </div>
        </div>
      )}
    </div>
  );
}
