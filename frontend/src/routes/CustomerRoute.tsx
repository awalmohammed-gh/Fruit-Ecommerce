import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import Loading from "../components/card/Loading";

// Customer pages (checkout, orders, addresses, account). Reads only the customer session.
export default function CustomerRoute() {
  const { user, loading, error, retrySession, signedOut } = useCustomerAuth();
  const location = useLocation();
  if (loading) return <Loading label="Loading your account" />;
  if (error) {
    return (
      <div className="min-h-[calc(100dvh-9rem)] flex flex-col items-center justify-center p-6 text-center">
        <p role="alert">{error}</p>
        <button onClick={retrySession} className="mt-4 text-app-green underline">Try again</button>
      </div>
    );
  }
  if (user) return <Outlet />;
  // Pressing Sign out on a customer page leaves for the homepage; it shouldn't queue the page up for the next sign-in.
  if (signedOut) return <Navigate to="/" replace />;
  // Otherwise the shopper signs in and comes back here (checkout, orders, addresses, account).
  return <Navigate to="/login" replace state={{ from: location.pathname + location.search + location.hash }} />;
}
