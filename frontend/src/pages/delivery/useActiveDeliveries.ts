import { useEffect, useMemo, useState } from "react";
import { deliveryApi } from "../../frontApisRoute/delivery";
import { useResource } from "../../hooks/useResource";
import { byUrgency } from "../../utils/delivery";

const REFRESH_EVERY = 30_000;

// The partner's open deliveries (most urgent first) and their counts, refreshed every 30 seconds
// so new assignments appear without a manual reload.
export function useActiveDeliveries() {
  const [version, setVersion] = useState(0);
  const deliveries = useResource(`partner-deliveries:${version}`, () => deliveryApi.active());
  const summary = useResource(`partner-summary:${version}`, () => deliveryApi.summary());
  const list = useMemo(() => [...(deliveries.data?.deliveries ?? [])].sort(byUrgency), [deliveries.data]);

  useEffect(() => {
    const timer = setInterval(() => setVersion((value) => value + 1), REFRESH_EVERY);
    return () => clearInterval(timer);
  }, []);

  return {
    deliveries: list,
    summary: summary.data?.summary ?? null,
    loaded: deliveries.data !== null,
    error: deliveries.data ? null : deliveries.error,
    reload: () => setVersion((value) => value + 1),
  };
}
