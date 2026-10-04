import { useEffect, useState } from "react";
import toast from "../components/toast/toast";
import { ordersApi } from "../frontApisRoute/orders";
import { useResource } from "../hooks/useResource";
import { usePricing } from "../hooks/usePricing";
import { useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useAddresses } from "../hooks/useAddresses";
import type { SavedAddress } from "../frontApisRoute/addresses";
import {
  ArrowLeft,
  CheckIcon,
  CreditCard,
  MapPinIcon,
  ShoppingBagIcon,
  TruckIcon,
  ShieldCheckIcon,
  AlertTriangleIcon,
  type LucideIcon,
} from "lucide-react";
import CheckoutAddress from "../components/Checkout/CheckoutAddress";
import CheckoutPayment from "../components/Checkout/CheckoutPayment";
import CheckoutReview from "../components/Checkout/CheckoutReview";
import { newCheckoutKey } from "../utils/orderLimits";

const Checkout = () => {
  const navigate = useNavigate();
  const { items, cartTotal, clearCart, updateQuantity, removeFromCart, applyQuote } = useCart();
  const { pricing } = usePricing();
  const { addresses, loading: addressesLoading, error: addressesError, refresh } = useAddresses();
  const user = { addresses };

  const [step, setStep] = useState("address");
  const [loading, setLoading] = useState(false);
  // One ID per visit to checkout: placing the same order twice (double click, retry) still creates one.
  const [checkoutKey] = useState(newCheckoutKey);
  const [selectedAddressId, setSelectedAddressId] = useState("");
  const address = addresses.find((item) => item._id === selectedAddressId) ?? addresses.find((item) => item.isDefault) ?? addresses[0];
  const setAddress = (selected: SavedAddress) => setSelectedAddressId(selected._id);
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [orderError, setOrderError] = useState("");
  // The server prices the cart from the database; the amounts below are what the order will charge.
  const lines = items.map((item) => ({ productId: item.product._id, quantity: item.quantity }));
  const quoteResult = useResource(`quote:${lines.map((line) => `${line.productId}:${line.quantity}`).join(",")}`, () =>
    lines.length ? ordersApi.quote(lines).then((result) => result.quote) : Promise.resolve(null));
  const quote = quoteResult.data;
  useEffect(() => { if (quote) applyQuote(quote.items); }, [quote, applyQuote]);
  const subtotal = quote?.subtotal ?? cartTotal;
  const deliveryFee = quote?.deliveryFee ?? 0;
  const tax = quote?.tax ?? 0;
  const total = quote?.total ?? cartTotal;
  const problems = quote?.problems ?? [];
  const freeOver = pricing?.freeDeliveryOver ?? 0;
  const reviewItems = (quote?.items ?? []).map((line) => ({ product: { _id: line.product, name: line.name, image: line.image, price: line.price }, quantity: line.quantity }));
  // Brings the cart in line with what's actually available.
  const fixCart = () => {
    for (const problem of problems) {
      if (problem.reason === "unavailable" || problem.available === 0) removeFromCart(problem.productId);
      else updateQuantity(problem.productId, problem.available);
    }
  };

  const steps: { key: string; label: string; icon: LucideIcon }[] = [
    { key: "address", label: "Address", icon: MapPinIcon },
    { key: "payment", label: "Payment", icon: CreditCard },
    { key: "review", label: "Review", icon: CheckIcon },
  ];

  const getStepStatus = (stepKey: string) => {
    const stepIndex = steps.findIndex((s) => s.key === stepKey);
    const currentIndex = steps.findIndex((s) => s.key === step);
    if (stepIndex < currentIndex) return "completed";
    if (stepIndex === currentIndex) return "current";
    return "upcoming";
  };

  const handlePlaceOrder = async () => {
    if (!address || loading) return;
    setLoading(true);
    setOrderError("");
    try {
      const { order } = await ordersApi.create({ addressId: address._id, paymentMethod: "cash", items: lines }, checkoutKey);
      clearCart();
      toast.success(`Order #${order.number} placed`);
      navigate(`/my-orders/${order._id}`, { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to place your order";
      setOrderError(message);
      toast.error(message);
      // Stock or prices may have changed; fetch a fresh quote.
      quoteResult.reload();
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="bg-app-cream flex items-center justify-center py-16">
        <div className="text-center max-w-sm mx-auto px-4">
          <div className="w-24 h-24 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-lg">
            <ShoppingBagIcon className="size-10 text-app-text-light" />
          </div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">
            Your cart is empty
          </h1>
          <p className="text-sm text-app-text-light mb-6">
            Add some fresh products to checkout
          </p>
          <button
            className="px-6 py-2.5 bg-app-green text-white text-sm font-medium rounded-xl hover:bg-green-800 transition-all duration-300 shadow-md hover:shadow-lg"
            onClick={() => navigate("/products")}
          >
            Browse Products
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-app-cream pb-20">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-sm text-app-text-light hover:text-app-green transition-all duration-300 group"
          >
            <ArrowLeft className="size-4 group-hover:-translate-x-1 transition-transform duration-300" />
            <span className="hidden sm:inline">Back to Cart</span>
          </button>
          <div className="h-6 w-px bg-app-border hidden sm:block"></div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-800">
              Checkout
            </h1>
            <p className="text-sm text-app-text-light hidden sm:block">
              Complete your purchase in a few easy steps
            </p>
          </div>
        </div>

        {/* Steps Progress */}
        <div className="flex items-center justify-between mb-8">
          {steps.map((s, index) => {
            const status = getStepStatus(s.key);
            return (
              <div key={index} className="flex items-center flex-1">
                <button
                  onClick={() => setStep(s.key)}
                  className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 relative ${
                    status === "current"
                      ? "bg-app-green text-white shadow-md scale-105"
                      : status === "completed"
                        ? "bg-green-100 text-green-700"
                        : "bg-white text-app-text-light hover:bg-gray-50"
                  }`}
                >
                  <div
                    className={`flex items-center justify-center ${
                      status === "completed" ? "text-green-600" : ""
                    }`}
                  >
                    {status === "completed" ? (
                      <CheckIcon className="size-4" />
                    ) : (
                      <s.icon className="size-4" />
                    )}
                  </div>
                  <span className="hidden sm:inline">{s.label}</span>
                  {status === "current" && (
                    <span className="absolute -top-2 -right-2 w-3 h-3 bg-orange-500 rounded-full animate-pulse"></span>
                  )}
                </button>
                {index < steps.length - 1 && (
                  <div
                    className={`flex-1 h-0.5 mx-3 transition-all duration-500 ${
                      index < steps.findIndex((s) => s.key === step)
                        ? "bg-app-green"
                        : "bg-app-border"
                    }`}
                  />
                )}
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Step indicator */}
            <div className="flex items-center gap-2 text-sm text-app-text-light">
              <span className="font-semibold text-app-green">
                Step {steps.findIndex((s) => s.key === step) + 1}
              </span>
              <span>of {steps.length}</span>
              <span className="w-1 h-1 bg-app-border rounded-full"></span>
              <span>{steps.find((s) => s.key === step)?.label}</span>
            </div>

            {problems.length > 0 && (
              <div role="alert" className="rounded-2xl border border-orange-200 bg-orange-50 p-4 text-sm text-orange-800">
                <p className="flex items-center gap-2 font-semibold"><AlertTriangleIcon className="size-4" /> Some items in your cart changed</p>
                <ul className="mt-2 space-y-1 list-disc pl-5">
                  {problems.map((problem) => (
                    <li key={problem.productId}>
                      {problem.reason === "unavailable" ? "A product is no longer sold" : problem.available === 0 ? `${problem.name} is out of stock` : `Only ${problem.available} of ${problem.name} left`}
                    </li>
                  ))}
                </ul>
                <button type="button" onClick={fixCart} className="mt-3 px-4 py-2 rounded-xl bg-white border border-orange-200 font-semibold hover:bg-orange-100">Update my cart</button>
              </div>
            )}
            {quoteResult.error && (
              <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                We couldn't check current prices: {quoteResult.error} <button type="button" onClick={quoteResult.reload} className="underline font-semibold">Try again</button>
              </div>
            )}
            {orderError && !problems.length && <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{orderError}</div>}

            {step === "address" && (
              <CheckoutAddress
                address={address}
                setAddress={setAddress}
                setStep={setStep}
                user={user}
                loading={addressesLoading}
                error={addressesError}
                refresh={refresh}
              />
            )}
            {step === "payment" && (
              <CheckoutPayment
                paymentMethod={paymentMethod}
                setPaymentMethod={setPaymentMethod}
                setStep={setStep}
              />
            )}
            {step === "review" && address && (
              <CheckoutReview
                address={address}
                items={reviewItems}
                handlePlaceOrder={handlePlaceOrder}
                loading={loading}
                disabled={!quote || problems.length > 0}
                total={total}
              />
            )}
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-app-border/50 sticky top-24">
              <h2 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
                <span className="w-1 h-5 bg-app-orange rounded-full"></span>
                Order Summary
              </h2>

              <div className="space-y-2.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-app-text-light">
                    Subtotal ({items.length} items)
                  </span>
                  <span className="font-medium text-gray-700">
                    {subtotal.toLocaleString("en-GH", {
                      style: "currency",
                      currency: "GHS",
                    })}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-app-text-light">Delivery Fee</span>
                  <span className="font-medium text-gray-700">
                    {!quote ? (
                      <span className="text-app-text-light">…</span>
                    ) : deliveryFee === 0 ? (
                      <span className="text-green-600">Free</span>
                    ) : (
                      deliveryFee.toLocaleString("en-GH", {
                        style: "currency",
                        currency: "GHS",
                      })
                    )}
                  </span>
                </div>

                <div className="flex justify-between">
                  <span className="text-app-text-light">Tax ({Math.round((pricing?.taxRate ?? 0) * 100)}%)</span>
                  <span className="font-medium text-gray-700">
                    {tax.toLocaleString("en-GH", {
                      style: "currency",
                      currency: "GHS",
                    })}
                  </span>
                </div>

                {deliveryFee > 0 && freeOver > 0 && (
                  <div className="bg-orange-50 rounded-lg p-2 text-center">
                    <p className="text-xs text-orange-600">
                       Add GHS {Math.max(0, freeOver - subtotal).toFixed(2)} more for free
                      delivery
                    </p>
                  </div>
                )}

                <div className="flex justify-between pt-3 border-t-2 border-app-border/50 font-bold">
                  <span className="text-gray-800">Total</span>
                  <span className="text-lg text-app-orange">
                    {total.toLocaleString("en-GH", {
                      style: "currency",
                      currency: "GHS",
                    })}
                  </span>
                </div>
              </div>

              {/* Trust badges */}
              <div className="mt-4 pt-4 border-t border-app-border/50">
                <div className="flex items-center justify-center gap-4 text-xs text-app-text-light">
                  <div className="flex items-center gap-1">
                    <TruckIcon className="size-3" />
                    <span>{freeOver ? `Free delivery over GHS ${freeOver}` : "Delivery to your door"}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <ShieldCheckIcon className="size-3" />
                    <span>Secure checkout</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Checkout;
