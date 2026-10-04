import { type LucideIcon,
  ClockIcon,
  CheckIcon,
  TruckIcon,
  PackageIcon,
  CircleIcon,
} from "lucide-react";
import type { Order } from "../../types";

export const OrderTimeLine = ({ order }: { order: Order }) => {
  const allStatuses = [
    "Order Placed",
    "Confirmed",
    "Packed",
    "Assigned",
    "Out for Delivery",
    "Delivered",
  ];
  const currentIdx = allStatuses.indexOf(order.status);

  const statusIcons: Record<string, LucideIcon> = {
    "Order Placed": ClockIcon,
    Confirmed: CheckIcon,
    Assigned: TruckIcon,
    Packed: PackageIcon,
    "Out for Delivery": TruckIcon,
    Delivered: CheckIcon,
  };

  const getStatusMessage = (status: string) => {
    switch (status) {
      case "Order Placed":
        return "Your order has been placed successfully";
      case "Confirmed":
        return "Your order has been confirmed by the seller";
      case "Packed":
        return "Your items are packed and ready for delivery";
      case "Assigned":
        return "A delivery partner has been assigned";
      case "Out for Delivery":
        return "Your order is on the way!";
      case "Delivered":
        return "Your order has been delivered";
      default:
        return "";
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-app-border/50 hover:shadow-md transition-all duration-300">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <span className="w-1 h-6 bg-app-orange rounded-full"></span>
          Delivery Progress
        </h2>
        <span className="text-xs text-app-text-light">
          {currentIdx + 1} of {allStatuses.length} steps
        </span>
      </div>

      <div className="space-y-0">
        {allStatuses.map((status, i) => {
          const Icon = statusIcons[status] || PackageIcon;
          const isCompleted = i <= currentIdx;
          const isCurrent = i === currentIdx;

          const historyEntry = order.statusHistory?.find(
            (h) => h.status === status,
          );

          return (
            <div key={status} className="flex gap-4 group">
              {/* Icon Column */}
              <div className="flex flex-col items-center">
                <div
                  className={`
                                    size-10 rounded-full flex items-center justify-center shrink-0 
                                    transition-all duration-300
                                    ${
                                      isCompleted
                                        ? "bg-app-green text-white shadow-md"
                                        : "bg-app-cream text-app-text-light border-2 border-app-border/50"
                                    }
                                    ${isCurrent ? "ring-4 ring-app-green/30 scale-110" : ""}
                                    ${!isCompleted && !isCurrent ? "group-hover:border-app-green/30" : ""}
                                `}
                >
                  {isCompleted && i === currentIdx ? (
                    <div className="relative">
                      <Icon className="size-4" />
                      <div className="absolute -top-1 -right-1 w-3 h-3 bg-white rounded-full animate-ping opacity-75"></div>
                    </div>
                  ) : (
                    <Icon className="size-4" />
                  )}
                </div>
                {i < allStatuses.length - 1 && (
                  <div
                    className={`
                                        w-0.5 h-14 
                                        transition-all duration-500
                                        ${i < currentIdx ? "bg-app-green" : "bg-app-border"}
                                        ${i === currentIdx ? "bg-gradient-to-b from-app-green to-app-border" : ""}
                                    `}
                  />
                )}
              </div>

              {/* Content Column */}
              <div
                className={`pb-7 flex-1 ${i === allStatuses.length - 1 ? "pb-0" : ""}`}
              >
                <div className="flex items-center gap-2">
                  <p
                    className={`
                                        text-sm font-semibold 
                                        transition-colors duration-300
                                        ${isCompleted ? "text-gray-800" : "text-app-text-light"}
                                    `}
                  >
                    {status}
                  </p>
                  {isCurrent && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold bg-app-orange text-white rounded-full animate-pulse">
                      <CircleIcon className="size-2 fill-white" />
                      Current
                    </span>
                  )}
                  {isCompleted && !isCurrent && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] text-green-600 font-medium">
                      <CheckIcon className="size-3" />
                      Done
                    </span>
                  )}
                </div>

                {/* Status message */}
                {isCompleted && (
                  <p className="text-xs text-app-text-light mt-0.5">
                    {getStatusMessage(status)}
                  </p>
                )}

                {/* Timestamp */}
                {historyEntry && (
                  <div className="flex items-center gap-1 mt-1">
                    <ClockIcon className="size-3 text-app-text-light" />
                    <p className="text-xs text-app-text-light">
                      {new Date(historyEntry.timestamp).toLocaleString(
                        "en-US",
                        {
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        },
                      )}
                    </p>
                  </div>
                )}

                {/* Progress bar for current step */}
                {isCurrent && i < allStatuses.length - 1 && (
                  <div className="mt-2 w-full max-w-[200px]">
                    <div className="h-1 bg-app-cream rounded-full overflow-hidden">
                      <div
                        className="h-full bg-app-orange rounded-full animate-progress"
                        style={{ width: "60%" }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
