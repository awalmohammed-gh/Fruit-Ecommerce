import { useState } from "react";
import type { Order } from "../types";
import { Link } from "react-router-dom";
import Loading from "../components/card/Loading";
import {
  Calendar,
  ChevronRightIcon,
  PackageIcon,
  ShoppingBagIcon,
  ClockIcon,
  CheckCircleIcon,
  TruckIcon,
} from "lucide-react";
import { statusColors } from "../assets/assets";
import { ordersApi } from "../frontApisRoute/orders";
import { useResource } from "../hooks/useResource";

const MyOrders = () => {
  const [activeTab, setActiveTab] = useState("all");
  const tabs = ["all", "Order Placed", "Out for Delivery", "Delivered", "Cancelled"];
  const result = useResource("my-orders", () => ordersApi.mine());
  const orders: Order[] = result.data?.orders ?? [];
  const loading = !result.data && !result.error;

  // Filter orders based on active tab
  const filteredOrders =
    activeTab === "all"
      ? orders
      : orders.filter((order) => order.status === activeTab);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Order Placed":
        return <ClockIcon className="size-3" />;
      case "Out for Delivery":
        return <TruckIcon className="size-3" />;
      case "Delivered":
        return <CheckCircleIcon className="size-3" />;
      default:
        return <PackageIcon className="size-3" />;
    }
  };

  if (loading) {
    return <Loading />;
  }

  if (result.error) {
    return (
      <div role="alert" className="max-w-lg mx-auto px-6 py-24 text-center">
        <h1 className="text-xl font-bold text-gray-800 mb-2">We couldn't load your orders</h1>
        <p className="text-sm text-app-text-light mb-6">{result.error}</p>
        <button type="button" onClick={result.reload} className="px-6 py-2.5 bg-app-green text-white text-sm font-medium rounded-xl">Try again</button>
      </div>
    );
  }

  return (
    <div className="bg-app-cream pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
              My Orders
            </h1>
            <p className="text-sm text-app-text-light mt-1">
              Track and manage all your orders in one place
            </p>
          </div>
          <div className="hidden sm:block">
            <span className="text-sm bg-white px-4 py-2 rounded-xl shadow-sm border border-app-border/50">
              Total:{" "}
              <span className="font-bold text-app-green">{orders.length}</span>{" "}
              orders
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-8 overflow-x-auto pb-3 custom-scrollbar">
          {tabs.map((tab) => (
            <button
              onClick={() => setActiveTab(tab)}
              key={tab}
              className={`px-5 py-2.5 text-sm font-medium rounded-xl whitespace-nowrap transition-all duration-300 ${
                activeTab === tab
                  ? "bg-app-green text-white shadow-md scale-[1.02]"
                  : "bg-white text-app-text-light hover:bg-gray-100 border border-app-border/50"
              }`}
            >
              {tab === "all" ? (
                <span className="flex items-center gap-2">
                  All Orders
                  <span className="bg-white/20 text-white text-xs px-2 py-0.5 rounded-full">
                    {orders.length}
                  </span>
                </span>
              ) : (
                tab
              )}
            </button>
          ))}
        </div>

        {/* Orders List */}
        <div className="space-y-4">
          {filteredOrders.length > 0 ? (
            filteredOrders.map((order) => (
              <Link
                to={`/my-orders/${order._id}`}
                key={order._id}
                className="block bg-white rounded-2xl p-5 hover:shadow-lg transition-all duration-300 border border-app-border/50 hover:border-app-green/30 group"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-3">
                      <p className="text-sm font-semibold text-gray-800">
                        Order #{order.number}
                      </p>
                      <span className="hidden sm:inline-block w-1.5 h-1.5 bg-app-border rounded-full"></span>
                      <div className="flex items-center gap-1.5 text-xs text-app-text-light">
                        <Calendar className="size-3" />
                        <span>
                          {new Date(order.createdAt).toLocaleDateString(
                            "en-GH",
                            {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            },
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-2 sm:mt-0">
                    <span
                      className={`px-3 py-1 text-xs font-semibold rounded-full flex items-center gap-1.5 ${
                        statusColors[order.status] ||
                        "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {getStatusIcon(order.status)}
                      {order.status}
                    </span>
                    <ChevronRightIcon className="size-4 text-app-text-light group-hover:text-app-green group-hover:translate-x-1 transition-all duration-300" />
                  </div>
                </div>

                {/* Product Images */}
                <div className="flex items-center gap-2 mb-3">
                  {order.items.slice(0, 4).map((item, index) => (
                    <div key={index} className="relative">
                      <img
                        className="size-12 sm:size-16 rounded-xl object-cover border border-app-border/50 shadow-sm"
                        src={item.image}
                        alt={item.name}
                      />
                    </div>
                  ))}
                  {order.items.length > 4 && (
                    <div className="size-12 sm:size-16 rounded-xl bg-app-cream border border-app-border/50 flex items-center justify-center text-xs font-semibold text-app-text-light">
                      +{order.items.length - 4}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="flex flex-wrap items-center justify-between pt-3 border-t border-app-border/50">
                  <span className="text-xs text-app-text-light">
                    {order.items.length}{" "}
                    {order.items.length === 1 ? "item" : "items"}
                    <span className="hidden sm:inline mx-2">•</span>
                    <span className="block sm:inline mt-1 sm:mt-0">
                      {order.items.reduce(
                        (acc, item) => acc + item.quantity,
                        0,
                      )}{" "}
                      units
                    </span>
                  </span>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-app-text-light">Total</span>
                    <span className="text-lg font-bold text-app-orange">
                      {order.total.toLocaleString("en-GH", {
                        style: "currency",
                        currency: "GHS",
                      })}
                    </span>
                  </div>
                </div>
              </Link>
            ))
          ) : (
            <div className="text-center py-20 bg-white rounded-2xl border border-app-border/50">
              <div className="max-w-sm mx-auto">
                <div className="w-24 h-24 bg-app-cream rounded-full flex items-center justify-center mx-auto mb-4">
                  <PackageIcon className="size-10 text-app-text-light" />
                </div>
                <h2 className="text-xl font-bold text-gray-800 mb-2">
                  No Orders Yet
                </h2>
                <p className="text-sm text-app-text-light mb-6">
                  Start shopping now to see your orders here
                </p>
                <Link
                  to={"/products"}
                  className="inline-flex items-center gap-2 px-6 py-2.5 bg-app-green text-white font-medium rounded-xl hover:bg-green-800 transition-all duration-300 shadow-md hover:shadow-lg"
                >
                  Start Shopping
                  <ShoppingBagIcon className="size-4" />
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Order Summary Stats */}
        {orders.length > 0 && (
          <div className="mt-8 grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl p-4 text-center border border-app-border/50">
              <p className="text-2xl font-bold text-app-green">
                {orders.length}
              </p>
              <p className="text-xs text-app-text-light">Total Orders</p>
            </div>
            <div className="bg-white rounded-xl p-4 text-center border border-app-border/50">
              <p className="text-2xl font-bold text-orange-500">
                {orders.filter((o) => o.status === "Out for Delivery").length}
              </p>
              <p className="text-xs text-app-text-light">In Transit</p>
            </div>
            <div className="bg-white rounded-xl p-4 text-center border border-app-border/50">
              <p className="text-2xl font-bold text-green-600">
                {orders.filter((o) => o.status === "Delivered").length}
              </p>
              <p className="text-xs text-app-text-light">Delivered</p>
            </div>
            <div className="bg-white rounded-xl p-4 text-center border border-app-border/50">
              <p className="text-2xl font-bold text-gray-800">
                GHS {orders.reduce((acc, o) => acc + o.total, 0).toFixed(0)}
              </p>
              <p className="text-xs text-app-text-light">Total Spent</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MyOrders;
