import Toaster from "./components/toast/Toaster";
import { Navigate, Route, Routes } from "react-router-dom";
import Login from "./pages/Login";
import AppLayout from "./layout/AppLayout";
import Home from "./pages/Home";
import ProductPage from "./pages/ProductPage";
import MyOrders from "./pages/MyOrders";
import SearchResults from "./pages/SearchResults";
import Checkout from "./pages/Checkout";
import Cart from "./pages/Cart";
import FlashDeals from "./pages/FlashDeals";
import OrderTracking from "./pages/OrderTracking";
import Addresses from "./pages/Addresses";
import MyAccount from "./pages/MyAccount";
import CustomerRoute from "./routes/CustomerRoute";
import AdminRoute from "./routes/AdminRoute";
import AdminLayout from "./pages/admin/AdminLayout";
import AdminLogin from "./pages/admin/AdminLogin";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminProducts from "./pages/admin/AdminProducts";
import AdminProductForm from "./pages/admin/AdminProductForm";
import AdminOrders from "./pages/admin/AdminOrders";
import AdminDeliveryPartners from "./pages/admin/AdminDeliveryPartners";
import AdminDeliveryApplications from "./pages/admin/AdminDeliveryApplications";
import AdminDeliveryAssignments from "./pages/admin/AdminDeliveryAssignments";
import AdminCategories from "./pages/admin/AdminCategories";
import AdminCustomers from "./pages/admin/AdminCustomers";
import AdminInventory from "./pages/admin/AdminInventory";
import AdminDeals from "./pages/admin/AdminDeals";
import AdminRevenue from "./pages/admin/AdminRevenue";
import AdminReports from "./pages/admin/AdminReports";
import AdminSettings from "./pages/admin/AdminSettings";
import Products from "./pages/Product";
import DeliveryApply from "./pages/delivery/DeliveryApply";
import DeliveryStatus from "./pages/delivery/DeliveryStatus";
import DeliveryLogin from "./pages/delivery/DeliveryLogin";
import DeliveryLayout from "./pages/delivery/DeliveryLayout";
import DeliveryDashboard from "./pages/delivery/DeliveryDashboard";
import DeliveryHistory from "./pages/delivery/DeliveryHistory";
import DeliveryList from "./pages/delivery/DeliveryList";
import DeliveryDetail from "./pages/delivery/DeliveryDetail";
import DeliveryProfile from "./pages/delivery/DeliveryProfile";
import NotFound from "./pages/NotFound";
import SeoManager from "./components/seo/SeoManager";

const App = () => {
  return (
    <>
      {/* GreenFarm toasts for the whole app: customer, admin and delivery partner pages */}
      <Toaster />
      {/* Title, description, canonical, sharing tags and structured data for the current address */}
      <SeoManager />

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
    </>
  );
};

export default App;
