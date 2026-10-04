import type { DeliveryStatus } from "../../types";
import { deliveryStatusClass, deliveryStatusLabel } from "../../utils/delivery";

export default function StatusBadge({ status }: { status: DeliveryStatus }) {
  return (
    <span className={`inline-flex shrink-0 px-2.5 py-1 text-xs font-semibold rounded-full ring-1 ring-inset ${deliveryStatusClass[status]}`}>
      {deliveryStatusLabel(status)}
    </span>
  );
}
