import { Link } from "react-router-dom";
import { ArrowRightIcon, CheckCircle2Icon, ChevronRightIcon, ClockIcon, LoaderCircleIcon, MapPinIcon, MessageSquareTextIcon, PhoneIcon } from "lucide-react";
import type { PartnerDelivery } from "../../frontApisRoute/delivery";
import { NEXT_ACTION, cedis, time } from "../../utils/delivery";
import StatusBadge from "./StatusBadge";
import type { useDeliveryActions } from "./useDeliveryActions";

type Actions = Pick<ReturnType<typeof useDeliveryActions>, "working" | "next" | "decline" | "fail">;

/** Secondary options for each status. Only what fits the current step is shown. */
export function SecondaryActions({ delivery, actions }: { delivery: PartnerDelivery; actions: Actions }) {
  const busy = actions.working === delivery._id;
  const linkClass = "h-11 px-3 rounded-xl text-sm font-semibold disabled:opacity-50";
  if (delivery.status === "Assigned") {
    return <button type="button" onClick={() => actions.decline(delivery)} disabled={busy} className={`${linkClass} text-zinc-600 hover:bg-zinc-100`}>Decline</button>;
  }
  if (!NEXT_ACTION[delivery.status]) return null;
  return (
    <>
      {delivery.status === "On The Way" && (
        <button type="button" onClick={() => actions.fail(delivery, "Customer unreachable")} disabled={busy} className={`${linkClass} text-red-700 hover:bg-red-50`}>Customer unreachable</button>
      )}
      <button type="button" onClick={() => actions.fail(delivery)} disabled={busy} className={`${linkClass} text-red-700 hover:bg-red-50`}>Report failed delivery</button>
    </>
  );
}

/** The one button that moves this delivery forward. */
export function PrimaryAction({ delivery, actions }: { delivery: PartnerDelivery; actions: Actions }) {
  const action = NEXT_ACTION[delivery.status];
  if (!action) return null;
  const busy = actions.working === delivery._id;
  return (
    <button type="button" onClick={() => actions.next(delivery)} disabled={busy}
      className="w-full h-12 rounded-xl bg-app-green text-white text-base font-semibold flex-center gap-2 hover:bg-app-green-light active:scale-[0.99] disabled:opacity-60">
      {busy ? <LoaderCircleIcon className="size-5 animate-spin" aria-hidden="true" />
        : action.next === "Delivered" ? <CheckCircle2Icon className="size-5" aria-hidden="true" /> : <ArrowRightIcon className="size-5" aria-hidden="true" />}
      {action.label}
    </button>
  );
}

// A delivery as a card: who, where, how they pay, and the next thing to do.
export default function DeliveryCard({ delivery, actions, highlight = false }: { delivery: PartnerDelivery; actions: Actions; highlight?: boolean }) {
  const order = delivery.order;
  if (!order) return null;
  const { address, recipient } = order;

  return (
    <article className={`bg-white rounded-2xl border shadow-sm overflow-hidden ${highlight ? "border-app-green/40 ring-1 ring-app-green/20" : "border-app-border/60"}`} aria-labelledby={`delivery-${delivery._id}`}>
      <header className="px-4 pt-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 id={`delivery-${delivery._id}`} className="font-semibold text-app-green">
            <Link to={`/delivery-partner/deliveries/${delivery._id}`} className="hover:underline">Order #{order.number}</Link>
          </h3>
          <p className="text-xs text-app-text-light flex items-center gap-1 mt-0.5"><ClockIcon className="size-3" aria-hidden="true" /> Assigned {time(delivery.assignedAt)}</p>
        </div>
        <StatusBadge status={delivery.status} />
      </header>

      <div className="px-4 py-3 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="font-semibold text-zinc-900 min-w-0 truncate">{recipient.name}</p>
          {recipient.phone && (
            <a href={`tel:${recipient.phone}`} className="shrink-0 inline-flex items-center gap-1.5 h-10 px-3 rounded-xl bg-app-cream text-app-green text-sm font-semibold tabular-nums hover:bg-app-cream-dark">
              <PhoneIcon className="size-4" aria-hidden="true" /> {recipient.phone}
            </a>
          )}
        </div>

        <div className="flex items-start gap-2.5">
          <MapPinIcon className="size-5 text-app-orange shrink-0 mt-0.5" aria-hidden="true" />
          <div className="min-w-0 text-sm">
            <p className="text-zinc-900 font-medium">{[address.line1, address.line2].filter(Boolean).join(", ")}</p>
            <p className="text-zinc-600">{[address.city, address.region].filter(Boolean).join(", ")}</p>
            {address.digitalAddress && <p className="text-xs font-mono text-zinc-600 mt-0.5">GPS {address.digitalAddress}</p>}
          </div>
        </div>

        {delivery.notes && (
          <p className="flex items-start gap-2 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-900">
            <MessageSquareTextIcon className="size-4 shrink-0 mt-0.5" aria-hidden="true" />{delivery.notes}
          </p>
        )}

        <p className="text-sm text-zinc-600">
          Cash on delivery · <span className={order.isPaid ? "font-semibold text-green-700" : "font-semibold text-app-orange-dark"}>{order.isPaid ? "Paid" : `Collect ${cedis(order.total)}`}</span>
        </p>
      </div>

      <footer className="px-4 pb-4 space-y-1">
        <PrimaryAction delivery={delivery} actions={actions} />
        <div className="flex flex-wrap items-center justify-between gap-1">
          <div className="flex flex-wrap gap-1 -ml-3"><SecondaryActions delivery={delivery} actions={actions} /></div>
          <Link to={`/delivery-partner/deliveries/${delivery._id}`} className="h-11 inline-flex items-center gap-0.5 text-sm font-semibold text-app-green hover:underline">
            Details <ChevronRightIcon className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </footer>
    </article>
  );
}
