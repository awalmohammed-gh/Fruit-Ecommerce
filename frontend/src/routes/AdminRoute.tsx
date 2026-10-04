import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAdminAuth } from "../context/AdminAuthContext";

// Admin pages. Reads only the admin session; a customer or delivery partner sign-in never counts.
// While the session is being checked the admin layout already shows (sidebar and header), with a loader
// in the content area only; see AdminLayout.
export default function AdminRoute() {
  const { admin, loading } = useAdminAuth();
  const location = useLocation();
  if (loading || admin) return <Outlet />;
  return <Navigate to="/admin/login" replace state={{ from: location.pathname + location.search }} />;
}
