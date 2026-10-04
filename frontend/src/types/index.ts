// Shapes returned by the GreenFarm API.

export interface Category {
    slug: string;
    name: string;
    image: string;
}

export interface Product {
    _id: string;
    name: string;
    description: string;
    price: number;
    originalPrice: number;
    image: string;
    category: string;
    unit: string;
    stock: number;
    isOrganic: boolean;
    rating: number;
    reviewCount: number;
    discount: number;
    /** Readable address: /products/cheese-200g. Older saved carts may not have it yet. */
    slug?: string;
    seoTitle?: string;
    seoDescription?: string;
    createdAt: string;
    updatedAt?: string;
}

export interface CartItem {
    product: Product;
    quantity: number;
}

export interface OrderItem {
    product: string;
    name: string;
    image: string;
    unit: string;
    price: number;
    quantity: number;
}

// A copy of the customer's saved address, taken when the order was placed.
export interface OrderAddress {
    label: string;
    fullName: string;
    phone: string;
    addressLine1: string;
    addressLine2?: string;
    city: string;
    region: string;
    digitalAddress?: string;
    landmark?: string;
    country?: string;
}

// Packed means ready for delivery; from Assigned on, the status follows the delivery partner.
export type OrderStatus = "Order Placed" | "Confirmed" | "Packed" | "Assigned" | "Out for Delivery" | "Delivered" | "Cancelled";
export type DeliveryStatus = "Assigned" | "Accepted" | "Picked Up" | "On The Way" | "Delivered" | "Failed Delivery" | "Declined" | "Reassigned" | "Cancelled";
export type TransportType = "motorbike" | "bicycle" | "car" | "van" | "other";

export interface DeliveryHistoryEntry { status: DeliveryStatus; note: string; by: "management" | "partner"; at: string }

// One partner's attempt at delivering an order (admin view of an order).
export interface OrderAssignment {
    _id: string;
    status: DeliveryStatus;
    active: boolean;
    assignedAt: string;
    completedAt: string | null;
    notes: string;
    failureReason: string;
    history: DeliveryHistoryEntry[];
    deliveryPartner: { _id: string; fullName: string; phone: string } | null;
}

export interface Order {
    _id: string;
    number: string;
    customer: { name: string; email: string; phone: string };
    items: OrderItem[];
    shippingAddress: OrderAddress;
    paymentMethod: "cash";
    isPaid: boolean;
    paidAt: string | null;
    subtotal: number;
    deliveryFee: number;
    tax: number;
    total: number;
    status: OrderStatus;
    statusHistory: { status: OrderStatus; timestamp: string; note: string }[];
    cancelReason: string;
    deliveryPartner: { _id: string; fullName: string; phone: string; transportType: TransportType } | null;
    // Latest delivery attempt; separate from payment (isPaid) and the order status.
    deliveryStatus: DeliveryStatus | null;
    // Admin only: every delivery attempt, oldest first.
    assignments?: OrderAssignment[];
    // Only present for the customer, while a partner is on the way.
    deliveryOtp?: string;
    liveLocation?: { lat: number; lng: number; updatedAt: string };
    createdAt: string;
    updatedAt: string;
}
