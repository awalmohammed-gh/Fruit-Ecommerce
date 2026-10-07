import Toaster from "./components/toast/Toaster";
import { Suspense, useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { lazyPage, whenIdle } from "./utils/lazyPage";
import Loading from "./components/card/Loading";
import AppLayout from "./layout/AppLayout";
import Home from "./pages/Home";
import CustomerRoute from "./routes/CustomerRoute";
import AdminRoute from "./routes/AdminRoute";
import NotFound from "./pages/NotFound";
import SeoManager from "./components/seo/SeoManager";
import FaviconManager from "./components/seo/FaviconManager";

// Customer pages
const Login = lazyPage(() => import("./pages/Login"));
const ProductPage = lazyPage(() => import("./pages/ProductPage"));
const MyOrders = lazyPage(() => import("./pages/MyOrders"));
const SearchResults = lazyPage(() => import("./pages/SearchResults"));
const Checkout = lazyPage(() => import("./pages/Checkout"));
const Cart = lazyPage(() => import("./pages/Cart"));
const FlashDeals = lazyPage(() => import("./pages/FlashDeals"));
const OrderTracking = lazyPage(() => import("./pages/OrderTracking"));
const Addresses = lazyPage(() => import("./pages/Addresses"));
const MyAccount = lazyPage(() => import("./pages/MyAccount"));
const Products = lazyPage(() => import("./pages/Product"));

// Admin area
const AdminLayout = lazyPage(() => import("./pages/admin/AdminLayout"));
const AdminLogin = lazyPage(() => import("./pages/admin/AdminLogin"));
const AdminDashboard = lazyPage(() => import("./pages/admin/AdminDashboard"));
const AdminProducts = lazyPage(() => import("./pages/admin/AdminProducts"));
const AdminProductForm = lazyPage(() => import("./pages/admin/AdminProductForm"));
const AdminOrders = lazyPage(() => import("./pages/admin/AdminOrders"));
const AdminDeliveryPartners = lazyPage(() => import("./pages/admin/AdminDeliveryPartners"));
const AdminDeliveryApplications = lazyPage(() => import("./pages/admin/AdminDeliveryApplications"));
const AdminDeliveryAssignments = lazyPage(() => import("./pages/admin/AdminDeliveryAssignments"));
const AdminCategories = lazyPage(() => import("./pages/admin/AdminCategories"));
const AdminCustomers = lazyPage(() => import("./pages/admin/AdminCustomers"));
const AdminInventory = lazyPage(() => import("./pages/admin/AdminInventory"));
const AdminDeals = lazyPage(() => import("./pages/admin/AdminDeals"));
const AdminRevenue = lazyPage(() => import("./pages/admin/AdminRevenue"));
const AdminReports = lazyPage(() => import("./pages/admin/AdminReports"));
const AdminSettings = lazyPage(() => import("./pages/admin/AdminSettings"));

// Delivery partner area
const DeliveryApply = lazyPage(() => import("./pages/delivery/DeliveryApply"));
const DeliveryStatus = lazyPage(() => import("./pages/delivery/DeliveryStatus"));
const DeliveryLogin = lazyPage(() => import("./pages/delivery/DeliveryLogin"));
const DeliveryLayout = lazyPage(() => import("./pages/delivery/DeliveryLayout"));
const DeliveryDashboard = lazyPage(() => import("./pages/delivery/DeliveryDashboard"));
const DeliveryHistory = lazyPage(() => import("./pages/delivery/DeliveryHistory"));
const DeliveryList = lazyPage(() => import("./pages/delivery/DeliveryList"));
const DeliveryDetail = lazyPage(() => import("./pages/delivery/DeliveryDetail"));
const DeliveryProfile = lazyPage(() => import("./pages/delivery/DeliveryProfile"));

// Only the store layout and the home page are in the first download; every other page's code (and the admin and
// delivery partner areas, with their charts, editors and map library) loads when it's first visited.
// Pages shoppers usually open next are fetched while the browser is idle, so moving on from the home page stays instant.
const likelyNext = [Products, ProductPage, Cart, FlashDeals, SearchResults, Login];

const App = () => {
  const { pathname } = useLocation();
  const storefront = !pathname.startsWith("/admin") && !pathname.startsWith("/delivery");
  useEffect(() => {
    if (storefront) whenIdle(() => likelyNext.forEach((page) => void page.preload().catch(() => {})));
  }, [storefront]);
  return (
    <>
      {/* GreenFarm toasts for the whole app: customer, admin and delivery partner pages */}
      <Toaster />
      {/* Title, description, canonical, sharing tags and structured data for the current address */}
      <SeoManager />
      {/* The favicon saved in Admin → Settings, on every page */}
      <FaviconManager />

      {/* Pages outside the store layout (sign-in, admin and partner areas) while their code loads. */}
      <Suspense fallback={<Loading fullScreen />}>
      <Routes>
        {/* Authentication no navbar and footer*/}
        <Route path="/login" element={<Login />} />

        {/* Main Pages */}
        <Route path="/" element={<AppLayout />}>
          <Route index element={<Home />} />
          <Route path="products" element={<Products />} />
          <Route path="category/:slug" element={<Products />} />
          <Route path="products/:id" element={<ProductPage />} />
          <Route path="search" element={<SearchResults />} />
          <Route path="deals" element={<FlashDeals />} />
          <Route path="cart" element={<Cart />} />
          <Route path="delivery-partner/apply" element={<DeliveryApply />} />
          <Route path="delivery-partner/status" element={<DeliveryStatus />} />
          <Route element={<CustomerRoute />}>
            <Route path="checkout" element={<Checkout />} />
            <Route path="my-orders" element={<MyOrders />} />
            <Route path="my-orders/:id" element={<OrderTracking />} />
            <Route path="my-address" element={<Addresses />} />
            <Route path="account" element={<MyAccount />} />
          </Route>
          {/* Anything else: a proper not-found page (the server marks it 404 and noindex), never a redirect home. */}
          <Route path="*" element={<NotFound />} />
        </Route>

        {/* Admin Pages */}
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route element={<AdminRoute />}>
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<Navigate to="dashboard" replace />} />
            <Route path="dashboard" element={<AdminDashboard />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="products/new" element={<AdminProductForm />} />
            <Route path="products/:id/edit" element={<AdminProductForm />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="categories" element={<AdminCategories />} />
            <Route path="customers" element={<AdminCustomers />} />
            <Route path="delivery/applications" element={<AdminDeliveryApplications />} />
            <Route path="delivery/partners" element={<AdminDeliveryPartners />} />
            <Route path="delivery/assignments" element={<AdminDeliveryAssignments />} />
            <Route path="delivery-partners" element={<Navigate to="/admin/delivery/partners" replace />} />
            <Route path="inventory" element={<AdminInventory />} />
            <Route path="inventory/low-stock" element={<AdminInventory lowStockOnly />} />
            <Route path="deals" element={<AdminDeals />} />
            <Route path="banners" element={<Navigate to="/admin/settings?section=banners" replace />} />
            <Route path="revenue" element={<AdminRevenue />} />
            <Route path="reports" element={<AdminReports />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>
        </Route>

        {/* Delivery partners: their own accounts and sign-in, separate from customers. The layout checks the partner session. */}
        <Route path="/delivery-partner/login" element={<DeliveryLogin />} />
        <Route path="/delivery-partner" element={<DeliveryLayout />}>
          <Route index element={<Navigate to="dashboard" replace />} />
          <Route path="dashboard" element={<DeliveryDashboard />} />
          <Route path="deliveries" element={<DeliveryList />} />
          <Route path="deliveries/:id" element={<DeliveryDetail />} />
          <Route path="history" element={<DeliveryHistory />} />
          <Route path="profile" element={<DeliveryProfile />} />
        </Route>
        <Route path="/delivery/*" element={<Navigate to="/delivery-partner/login" replace />} />
      </Routes>
      </Suspense>
    </>
  );
};

export default App;
