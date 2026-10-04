import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { Order } from "../types";
import toast from "../components/toast/toast";
import { ordersApi } from "../frontApisRoute/orders";
import { useResource } from "../hooks/useResource";
import Loading from "../components/card/Loading";
import {
  ArrowLeftIcon,
  MapPinIcon,
  PhoneIcon,
  PackageIcon,
  CreditCardIcon,
  CalendarIcon,
  UserIcon,
} from "lucide-react";
import { OrderOTP } from "../components/OrderTracking/OrderOTP";
import LiveMap from "../components/OrderTracking/LiveMap";
import { OrderTimeLine } from "../components/OrderTracking/OrderTimeLine";
import { TRANSPORT_LABEL } from "../utils/delivery";

const OrderTracking = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const result = useResource(`order:${id}`, () => ordersApi.get(id ?? ""));
  const order: Order | null = result.data?.order ?? null;
  const [cancelling, setCancelling] = useState(false);
  const active = !!order && order.status !== "Delivered" && order.status !== "Cancelled";
  const { reload } = result;
  // Status, rider and live location change while the order is on its way.
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(reload, 15000);
    return () => clearInterval(timer);
  }, [active, reload]);

  if (!order && !result.error) {
    return <Loading />;
  }

  if (!order) {
    return (
      <div role="alert" className="max-w-lg mx-auto px-6 py-24 text-center">
        <h1 className="text-xl font-bold text-gray-800 mb-2">We couldn't load this order</h1>
        <p className="text-sm text-app-text-light mb-6">{result.error}</p>
        <button type="button" onClick={() => navigate("/my-orders")} className="px-6 py-2.5 bg-app-green text-white text-sm font-medium rounded-xl">Back to my orders</button>
      </div>
    );
  }

  const canCancel = order.status === "Order Placed" || order.status === "Confirmed";
  const cancelOrder = async () => {
    if (!window.confirm("Cancel this order? Items go back on the shelf for other shoppers.")) return;
    setCancelling(true);
    try {
      await ordersApi.cancel(order._id);
      toast.success("Order cancelled");
      reload();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to cancel this order");
    } finally {
      setCancelling(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Delivered":
        return "bg-green-100 text-green-700 border-green-200";
      case "Cancelled":
        return "bg-red-100 text-red-700 border-red-200";
      case "Out for Delivery":
        return "bg-blue-100 text-blue-700 border-blue-200 animate-pulse";
      default:
        return "bg-orange-100 text-orange-700 border-orange-200";
    }
  };

  return (
    <div className="bg-app-cream pb-20 ">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* Back Button */}
        <button
          onClick={() => navigate("/my-orders")}
          className="flex items-center gap-2 text-sm text-app-text-light hover:text-app-green transition-all duration-300 group mb-6"
        >
          <ArrowLeftIcon className="size-4 group-hover:-translate-x-1 transition-transform duration-300" />
          Back to Orders
        </button>

        {/* Order Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
              Order #{order.number}
            </h1>
            <div className="flex items-center gap-3 mt-1.5">
              <div className="flex items-center gap-1.5 text-sm text-app-text-light">
                <CalendarIcon className="size-4" />
                <span>
                  {new Date(order.createdAt).toLocaleDateString("en-US", {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
              <span className="w-1 h-1 bg-app-border rounded-full"></span>
              <div className="flex items-center gap-1.5 text-sm text-app-text-light">
                <PackageIcon className="size-4" />
                <span>{order.items.length} {order.items.length === 1 ? "item" : "items"}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span
              className={`px-4 py-2 text-sm font-semibold rounded-full border-2 ${getStatusColor(order.status)}`}
            >
              {order.status}
            </span>
            {canCancel && (
              <button type="button" onClick={cancelOrder} disabled={cancelling} className="px-4 py-2 text-sm font-semibold rounded-full border-2 border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-50">
                {cancelling ? "Cancelling…" : "Cancel order"}
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Timeline & Map */}
          <div className="lg:col-span-2 space-y-6">
            {/* OTP Section */}
            <OrderOTP order={order} />

            {/* Live Tracking Map */}
            <LiveMap order={order} liveLocation={order.liveLocation ?? null} />

            {/* Progress Timeline */}
            <OrderTimeLine order={order} />

            {/* Delivery Partner */}
            {order?.deliveryPartner &&
              order.status !== "Delivered" &&
              order.status !== "Cancelled" && (
                <div className="bg-white rounded-2xl p-5 shadow-sm border border-app-border/50 hover:shadow-md transition-all duration-300">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <UserIcon className="size-4 text-app-green" />
                    Delivery Partner
                  </h3>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="size-12 rounded-full bg-app-green flex items-center justify-center shadow-md">
                        <span className="text-white font-bold text-base">
                          {order.deliveryPartner.fullName.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">
                          {order.deliveryPartner.fullName}
                        </p>
                        <p className="text-xs text-app-text-light capitalize flex items-center gap-1">
                          <span className="inline-block w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                          {TRANSPORT_LABEL[order.deliveryPartner.transportType]} • Delivery Partner
                        </p>
                      </div>
                    </div>
                    <a
                      href={`tel:${order.deliveryPartner.phone}`}
                      className="p-3 bg-app-green/10 rounded-xl hover:bg-app-green/20 transition-all duration-300 hover:scale-110 active:scale-95"
                    >
                      <PhoneIcon className="size-5 text-app-green" />
                    </a>
                  </div>
                </div>
              )}
          </div>

          {/* Right Column - Order Details */}
          <div className="space-y-5">
            {/* Delivery Address */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-app-border/50">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <MapPinIcon className="size-4 text-app-orange" />
                Delivery Address
              </h3>
              <div className="bg-app-cream/50 rounded-xl p-3">
                <p className="text-sm font-medium text-gray-800">
                  {order.shippingAddress.label} · {order.shippingAddress.fullName}
                </p>
                <p className="text-sm text-app-text-light leading-relaxed mt-1">
                  {[order.shippingAddress.addressLine1, order.shippingAddress.addressLine2].filter(Boolean).join(", ")}
                  <br />
                  {order.shippingAddress.city}, {order.shippingAddress.region}
                  {order.shippingAddress.digitalAddress && <><br />{order.shippingAddress.digitalAddress}</>}
                  <br />
                  {order.shippingAddress.phone}
                </p>
              </div>
            </div>

            {/* Payment Method */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-app-border/50">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <CreditCardIcon className="size-4 text-app-green" />
                Payment Method
              </h3>
              <div className="flex items-center justify-between">
                <span className="text-sm text-app-text-light">
                  Cash on Delivery
                </span>
                <span
                  className={`text-xs font-semibold px-2 py-1 rounded-full ${
                    order.isPaid
                      ? "bg-green-100 text-green-700"
                      : "bg-orange-100 text-orange-700"
                  }`}
                >
                  {order.isPaid ? "Paid" : "Pay on arrival"}
                </span>
              </div>
            </div>

            {/* Order Items */}
            <div className="bg-white rounded-2xl p-5 shadow-sm border border-app-border/50">
              <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                <PackageIcon className="size-4 text-app-orange" />
                Items ({order.items.length})
              </h3>
              <div className="space-y-3 max-h-60 overflow-y-auto custom-scrollbar pr-1">
                {order.items.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-2 hover:bg-app-cream/50 rounded-xl transition-colors duration-200"
                  >
                    <img
                      src={item.image}
                      alt={item.name}
                      className="size-12 rounded-xl object-cover border border-app-border/50 shadow-sm"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 truncate">
                        {item.name}
                      </p>
                      <p className="text-xs text-app-text-light">
                        Qty: {item.quantity} ×{" "}
                        {item.price.toLocaleString("en-GH", {
                          style: "currency",
                          currency: "GHS",
                        })}
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-app-orange">
                      {(item.price * item.quantity).toLocaleString("en-GH", {
                        style: "currency",
                        currency: "GHS",
                      })}
                    </span>
                  </div>
                ))}
              </div>

              {/* Price Breakdown */}
              <div className="mt-4 pt-3 border-t border-app-border/50 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-app-text-light">Subtotal</span>
                  <span className="font-medium text-gray-700">
                    {order.subtotal.toLocaleString("en-GH", {
                      style: "currency",
                      currency: "GHS",
                    })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-app-text-light">Delivery Fee</span>
                  <span className="font-medium text-gray-700">
                    {order.deliveryFee === 0 ? (
                      <span className="text-green-600">Free</span>
                    ) : (
                      order.deliveryFee.toLocaleString("en-GH", {
                        style: "currency",
                        currency: "GHS",
                      })
                    )}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-app-text-light">Tax</span>
                  <span className="font-medium text-gray-700">
                    {order.tax.toLocaleString("en-GH", {
                      style: "currency",
                      currency: "GHS",
                    })}
                  </span>
                </div>
                
                <div className="flex items-center justify-between pt-2 border-t-2 border-app-border/50">
                  <span className="font-semibold text-gray-800">Total</span>
                  <span className="text-xl font-bold text-app-orange">
                    {order.total.toLocaleString("en-GH", {
                      style: "currency",
                      currency: "GHS",
                    })}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderTracking;
