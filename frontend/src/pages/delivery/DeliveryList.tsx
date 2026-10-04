import { PackageIcon } from "lucide-react";
import DeliveryCard from "../../components/Delivery/DeliveryCard";
import LocationShare from "../../components/Delivery/LocationShare";
import { EmptyCard, ErrorCard, LoadingCards } from "../../components/Delivery/States";
import { useDeliveryActions } from "../../components/Delivery/useDeliveryActions";
import { useActiveDeliveries } from "./useActiveDeliveries";

// Every delivery the partner currently holds, most urgent first.
export default function DeliveryList() {
  const { deliveries, loaded, error, reload } = useActiveDeliveries();
  const actions = useDeliveryActions(reload);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-app-text-light">{loaded ? `${deliveries.length} open ${deliveries.length === 1 ? "delivery" : "deliveries"}` : "Loading…"}</p>
        <LocationShare deliveries={deliveries} />
      </div>
      {error ? <ErrorCard message={error} onRetry={reload} />
        : !loaded ? <LoadingCards />
        : !deliveries.length ? <EmptyCard icon={PackageIcon} title="No Assigned Deliveries" text="You currently have no deliveries assigned to you." />
        : (
          <div className="grid gap-3 xl:grid-cols-2 xl:items-start">
            {deliveries.map((delivery, index) => <DeliveryCard key={delivery._id} delivery={delivery} actions={actions} highlight={index === 0} />)}
          </div>
        )}
      {loaded && deliveries.length > 0 && <p className="text-center text-xs text-app-text-light">Ask the customer for the 6-digit code on their order page to complete a delivery.</p>}
      {actions.dialogs}
    </div>
  );
}
