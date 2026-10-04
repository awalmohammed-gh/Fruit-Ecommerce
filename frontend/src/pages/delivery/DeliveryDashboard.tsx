import { Link } from "react-router-dom";
import { ChevronRightIcon, PackageIcon } from "lucide-react";
import DeliveryCard from "../../components/Delivery/DeliveryCard";
import StatusBadge from "../../components/Delivery/StatusBadge";
import LocationShare from "../../components/Delivery/LocationShare";
import { EmptyCard, ErrorCard, LoadingCards } from "../../components/Delivery/States";
import { useDeliveryActions } from "../../components/Delivery/useDeliveryActions";
import { useActiveDeliveries } from "./useActiveDeliveries";
import { usePartner } from "./DeliveryLayout";

function greeting() {
  const hour = new Date().getHours();
  return hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
}

// Home: today's numbers, the delivery to handle now, and what's waiting after it.
export default function DeliveryDashboard() {
  const { partner } = usePartner();
  const { deliveries, summary, loaded, error, reload } = useActiveDeliveries();
  const actions = useDeliveryActions(reload);
  const [current, ...waiting] = deliveries;
  const stats = [
    { label: "Today", value: summary?.today },
    { label: "Assigned", value: summary?.assigned },
    { label: "In progress", value: summary?.inProgress },
    { label: "Completed", value: summary?.completed },
  ];

  return (
    <div className="space-y-6">
      <p className="text-sm text-app-text-light">
        {greeting()}, <span className="font-semibold text-zinc-800">{partner.fullName.split(" ")[0]}</span> · {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" })}
      </p>

      <section aria-label="Delivery summary" className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {stats.map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl border border-app-border/60 px-3 py-2.5 text-center">
            <p className="text-xl font-bold text-app-green tabular-nums">{value ?? "–"}</p>
            <p className="text-[11px] text-app-text-light leading-tight">{label}</p>
          </div>
        ))}
      </section>

      {/* Side by side when there is more than one delivery; a single card keeps a reading width. */}
      <div className={waiting.length ? "grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-start" : "max-w-3xl"}>
      <section aria-labelledby="current-heading" className="space-y-3 min-w-0">
        <div className="flex items-center justify-between gap-3">
          <h2 id="current-heading" className="font-semibold text-app-green">{current ? "Handle now" : "Current deliveries"}</h2>
          <LocationShare deliveries={deliveries} />
        </div>
        {error ? <ErrorCard message={error} onRetry={reload} />
          : !loaded ? <LoadingCards count={1} />
          : !current ? <EmptyCard icon={PackageIcon} title="No Assigned Deliveries" text="You currently have no deliveries assigned to you." />
          : <DeliveryCard delivery={current} actions={actions} highlight />}
      </section>

      {waiting.length > 0 && (
        <section aria-labelledby="waiting-heading" className="space-y-3 min-w-0">
          <div className="flex items-center justify-between">
            <h2 id="waiting-heading" className="font-semibold text-app-green">Up next <span className="text-app-text-light font-normal">({waiting.length})</span></h2>
            <Link to="/delivery-partner/deliveries" className="text-sm font-semibold text-app-green hover:underline">See all</Link>
          </div>
          <ul className="bg-white rounded-2xl border border-app-border/60 divide-y divide-app-border/60 overflow-hidden">
            {waiting.map((delivery) => (
              <li key={delivery._id}>
                <Link to={`/delivery-partner/deliveries/${delivery._id}`} className="flex items-center gap-3 px-4 py-3 min-h-14 hover:bg-app-cream/60">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-zinc-900 truncate">#{delivery.order?.number} · {delivery.order?.recipient.name}</p>
                    <p className="text-xs text-app-text-light truncate">{[delivery.order?.address.line1, delivery.order?.address.city].filter(Boolean).join(", ")}</p>
                  </div>
                  <StatusBadge status={delivery.status} />
                  <ChevronRightIcon className="size-4 text-app-text-light shrink-0" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      </div>
      {actions.dialogs}
    </div>
  );
}
