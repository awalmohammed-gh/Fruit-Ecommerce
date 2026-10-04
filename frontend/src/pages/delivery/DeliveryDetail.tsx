import { useState, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeftIcon, CheckIcon, MapPinIcon, MessageSquareTextIcon, NavigationIcon, PackageIcon, PhoneIcon, WalletIcon } from "lucide-react";
import { deliveryApi } from "../../frontApisRoute/delivery";
import { useResource } from "../../hooks/useResource";
import { PrimaryAction, SecondaryActions } from "../../components/Delivery/DeliveryCard";
import StatusBadge from "../../components/Delivery/StatusBadge";
import { ErrorCard, LoadingCards } from "../../components/Delivery/States";
import { useDeliveryActions } from "../../components/Delivery/useDeliveryActions";
import { cedis, deliveryStatusLabel, shortDate, time } from "../../utils/delivery";

const STEPS = ["Assigned", "Accepted", "Picked Up", "On The Way", "Delivered"] as const;

function Section({ icon: Icon, title, children }: { icon: typeof MapPinIcon; title: string; children: ReactNode }) {
  return (
    <section className="bg-white rounded-2xl border border-app-border/60 p-4">
      <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-app-text-light mb-2"><Icon className="size-4" aria-hidden="true" />{title}</h2>
      {children}
    </section>
  );
}

// One delivery: where to go, who to call, what to collect, and the next step.
export default function DeliveryDetail() {
  const { id = "" } = useParams();
  const [version, setVersion] = useState(0);
  const result = useResource(`partner-delivery:${id}:${version}`, () => deliveryApi.get(id));
  const actions = useDeliveryActions(() => setVersion((value) => value + 1));
  const delivery = result.data?.delivery;
  const order = delivery?.order;

  const back = <Link to="/delivery-partner/deliveries" className="inline-flex items-center gap-1.5 text-sm font-semibold text-app-green hover:underline"><ArrowLeftIcon className="size-4" aria-hidden="true" /> All deliveries</Link>;
  if (result.error && !delivery) return <div className="space-y-4">{back}<ErrorCard message={result.error} onRetry={() => setVersion((value) => value + 1)} /></div>;
  if (!delivery || !order) return <div className="space-y-4">{back}<LoadingCards count={2} /></div>;

  const { address, recipient } = order;
  const where = [address.line1, address.line2, address.city, address.region].filter(Boolean).join(", ");
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([address.digitalAddress, where, "Ghana"].filter(Boolean).join(", "))}`;
  const reached = (step: string) => delivery.history.find((entry) => entry.status === step);
  const open = delivery.status === "Assigned" || delivery.status === "Accepted" || delivery.status === "Picked Up" || delivery.status === "On The Way";

  return (
    <div className="space-y-4">
      {back}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-2xl font-semibold text-app-green">Order #{order.number}</p>
          <p className="text-xs text-app-text-light">Assigned {shortDate(delivery.assignedAt)}, {time(delivery.assignedAt)}</p>
        </div>
        <StatusBadge status={delivery.status} />
      </div>

      {/* Progress through the steps, with the time each one happened */}
      {open || delivery.status === "Delivered" ? (
        <ol className="grid grid-cols-5 gap-1 text-center">
          {STEPS.map((step) => {
            const done = reached(step);
            return (
              <li key={step} className="space-y-1">
                <span className={`block h-1.5 rounded-full ${done ? "bg-app-green" : "bg-app-border"}`} />
                <span className={`block text-[10px] leading-tight ${done ? "text-app-green font-semibold" : "text-app-text-light"}`}>{step}</span>
                {done && <span className="block text-[10px] text-app-text-light tabular-nums">{time(done.at)}</span>}
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800">{deliveryStatusLabel(delivery.status)}{delivery.failureReason ? `: ${delivery.failureReason}` : ""}</p>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
      <div className="space-y-4 min-w-0">
      <Section icon={PhoneIcon} title="Customer">
        <p className="font-semibold text-zinc-900 text-lg">{recipient.name}</p>
        {recipient.phone && (
          <a href={`tel:${recipient.phone}`} className="mt-2 flex items-center justify-center gap-2 h-12 rounded-xl bg-app-cream text-app-green font-semibold tabular-nums hover:bg-app-cream-dark">
            <PhoneIcon className="size-4" aria-hidden="true" /> Call {recipient.phone}
          </a>
        )}
      </Section>

      <Section icon={MapPinIcon} title="Delivery address">
        <p className="text-base text-zinc-900 font-medium">{[address.line1, address.line2].filter(Boolean).join(", ")}</p>
        <p className="text-zinc-700">{[address.city, address.region].filter(Boolean).join(", ")}</p>
        <dl className="mt-3 space-y-1 text-sm">
          {address.digitalAddress && <div className="flex gap-2"><dt className="text-app-text-light w-28 shrink-0">GhanaPost GPS</dt><dd className="font-mono text-zinc-800">{address.digitalAddress}</dd></div>}
          {address.landmark && <div className="flex gap-2"><dt className="text-app-text-light w-28 shrink-0">Landmark</dt><dd className="text-zinc-800">{address.landmark}</dd></div>}
        </dl>
        <a href={mapsUrl} target="_blank" rel="noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-app-green hover:underline">
          <NavigationIcon className="size-4" aria-hidden="true" /> Open in Maps
        </a>
      </Section>

      {delivery.notes && (
        <Section icon={MessageSquareTextIcon} title="Delivery notes">
          <p className="text-sm text-zinc-800">{delivery.notes}</p>
        </Section>
      )}

      <Section icon={PackageIcon} title={`Items (${order.items.reduce((sum, item) => sum + item.quantity, 0)})`}>
        <ul className="space-y-1 text-sm">
          {order.items.map((item, index) => (
            <li key={index} className="flex justify-between gap-3"><span className="text-zinc-800">{item.name} <span className="text-app-text-light">· {item.unit}</span></span><span className="font-semibold">×{item.quantity}</span></li>
          ))}
        </ul>
      </Section>

      {delivery.history.length > 0 && (
        <Section icon={CheckIcon} title="Updates">
          <ol className="space-y-2 text-sm">
            {[...delivery.history].reverse().map((entry, index) => (
              <li key={`${entry.at}-${index}`} className="flex gap-3">
                <span className="text-app-text-light tabular-nums w-12 shrink-0">{time(entry.at)}</span>
                <span className="text-zinc-800"><strong className="font-semibold">{deliveryStatusLabel(entry.status)}</strong>{entry.note ? ` · ${entry.note}` : ""}</span>
              </li>
            ))}
          </ol>
        </Section>
      )}

      </div>
      <aside className="space-y-4 min-w-0 lg:sticky lg:top-20">
      <Section icon={WalletIcon} title="Payment">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm text-zinc-700">Cash on delivery</p>
            <p className={`text-sm font-semibold ${order.isPaid ? "text-green-700" : "text-app-orange-dark"}`}>{order.isPaid ? "Paid" : "Not paid yet: collect on arrival"}</p>
          </div>
          <p className="text-xl font-bold text-zinc-900 tabular-nums">{cedis(order.total)}</p>
        </div>
      </Section>

      {/* The next step: pinned above the phone navigation, or in the sticky side column on desktop */}
      {open && (
        <div className="sticky bottom-20 z-20 lg:static bg-white/95 backdrop-blur rounded-2xl border border-app-border/60 shadow-lg lg:shadow-sm p-3 space-y-1">
          <PrimaryAction delivery={delivery} actions={actions} />
          <div className="flex flex-wrap justify-center gap-1"><SecondaryActions delivery={delivery} actions={actions} /></div>
        </div>
      )}
      </aside>
      </div>
      {actions.dialogs}
    </div>
  );
}
