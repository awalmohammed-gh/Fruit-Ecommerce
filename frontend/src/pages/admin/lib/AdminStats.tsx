import { createContext, useContext, type ReactNode } from "react";
import { productsApi, type ProductStats } from "../../../frontApisRoute/products";
import { customersApi, type CustomerStats } from "../../../frontApisRoute/customers";
import { deliveryAdminApi } from "../../../frontApisRoute/delivery";
import { useLowStockThreshold } from "./settings";
import { useResource } from "../../../hooks/useResource";

interface AdminStats {
  products: ProductStats | null;
  customers: CustomerStats | null;
  /** Delivery partner applications waiting for review. */
  pendingApplications: number;
  loading: boolean;
  error: string | null;
  /** Call after any change that affects counts (stock, products, customer status, application reviews). */
  refresh: () => void;
}
const AdminStatsContext = createContext<AdminStats | null>(null);

// Store-wide counts shared by the sidebar badges, dashboard and inventory screens.
export function AdminStatsProvider({ children }: { children: ReactNode }) {
  const threshold = useLowStockThreshold();
  const { data, loading, error, reload } = useResource(`stats:${threshold}`, async () => {
    const [products, customers, applications] = await Promise.all([productsApi.stats(threshold), customersApi.stats(), deliveryAdminApi.applications({ status: "Pending" })]);
    return { products: products.stats, customers: customers.stats, pendingApplications: applications.counts.Pending };
  });
  return (
    <AdminStatsContext.Provider value={{ products: data?.products ?? null, customers: data?.customers ?? null, pendingApplications: data?.pendingApplications ?? 0, loading, error, refresh: reload }}>
      {children}
    </AdminStatsContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAdminStats() {
  const context = useContext(AdminStatsContext);
  if (!context) throw new Error("useAdminStats must be used inside AdminStatsProvider");
  return context;
}
