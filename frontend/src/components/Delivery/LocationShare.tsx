import { useEffect, useRef, useState } from "react";
import { NavigationIcon } from "lucide-react";
import toast from "../toast/toast";
import { deliveryApi, type PartnerDelivery } from "../../frontApisRoute/delivery";

const SEND_EVERY = 15_000;

// Shares the partner's position with customers whose order they're carrying, at most every 15 seconds.
// Only shown while the partner has picked up at least one order.
export default function LocationShare({ deliveries }: { deliveries: PartnerDelivery[] }) {
  const [sharing, setSharing] = useState(false);
  const carrying = deliveries.filter((delivery) => delivery.status === "Picked Up" || delivery.status === "On The Way").map((delivery) => delivery._id);
  const carryingRef = useRef<string[]>([]);
  useEffect(() => { carryingRef.current = carrying; });

  useEffect(() => {
    if (!sharing) return;
    if (!("geolocation" in navigator)) {
      toast.error("This device can't share its location");
      return;
    }
    let lastSent = 0;
    const watch = navigator.geolocation.watchPosition(
      (position) => {
        if (Date.now() - lastSent < SEND_EVERY) return;
        lastSent = Date.now();
        for (const id of carryingRef.current) deliveryApi.location(id, position.coords.latitude, position.coords.longitude).catch(() => {});
      },
      () => { toast.error("Allow location access to share your position with customers"); setSharing(false); },
      { enableHighAccuracy: true, maximumAge: 10_000 },
    );
    return () => navigator.geolocation.clearWatch(watch);
  }, [sharing]);

  if (!carrying.length) return null;
  return (
    <button type="button" onClick={() => setSharing((value) => !value)} aria-pressed={sharing}
      className={`h-10 px-3.5 text-sm font-semibold rounded-xl flex items-center gap-2 ${sharing ? "bg-app-green text-white" : "bg-white border border-app-border text-zinc-700 hover:bg-app-cream"}`}>
      <NavigationIcon className={`size-4 ${sharing ? "animate-pulse" : ""}`} aria-hidden="true" />
      {sharing ? "Sharing location" : "Share location"}
    </button>
  );
}
