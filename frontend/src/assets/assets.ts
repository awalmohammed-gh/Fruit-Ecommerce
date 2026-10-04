import { MapPinIcon, PhoneIcon, MailIcon } from "lucide-react";
import { SiFacebook, SiX, SiInstagram } from "@icons-pack/react-simple-icons";
import hero_bg from "./hero_image.jpg";

export const assets = {
    hero_bg,
};

export const heroSectionData = {
    description: "Fresh, organic groceries delivered from local farms to your doorstep. Quality you can taste, convenience you deserve.",
    hero_image: hero_bg,
};

export const deliveryPartnerLoginImage = "https://images.unsplash.com/photo-1610832958506-aa56368176cf?w=200";

export const appPromoBannerData = {
  title: "Fresh Produce Delivered Fast",
  description:
    "Download the Green Farm app to shop farm-fresh groceries, track your orders in real time, and enjoy exclusive member discounts.",
};

export const footerData = {
    brand: {
        name: "Instacart",
        description: "Bringing fresh, organic groceries straight from local farms to your doorstep. Nourish your home with Earth's finest.",
        socials: [
            { icon: SiFacebook, link: "#" },
            { icon: SiX, link: "#" },
            { icon: SiInstagram, link: "#" },
        ],
    },

    sections: [
        {
            title: "Quick Links",
            links: [
                { label: "All Products", to: "/products" },
                { label: "Flash Deals", to: "/deals" },
                { label: "Track Order", to: "/orders" },
                { label: "Become a Delivery Partner", to: "/delivery-partner/apply" },
            ],
        },
        {
            title: "Customer Service",
            links: [
                { label: "My Account", to: "#" },
                { label: "Order History", to: "#" },
                { label: "Addresses", to: "#" },
                { label: "Help Center", href: "#" },
            ],
        },
    ],

    contact: [
        { icon: MapPinIcon, text: "123 Green Valley Rd, Portland" },
        { icon: PhoneIcon, text: "+1 (111) 123-4567" },
        { icon: MailIcon, text: "hello@example.com" },
    ],

    bottom: {
        copyright: "© 2026 Greatstack. All rights reserved.",
        links: [
            { label: "Privacy Policy", href: "#" },
            { label: "Terms of Service", href: "#" },
        ],
    },
};

export const statusColors: Record<string, string> = {
    "Order Placed": "bg-blue-100 text-blue-700",
    Confirmed: "bg-indigo-100 text-indigo-700",
    Assigned: "bg-indigo-100 text-indigo-700",
    Packed: "bg-purple-100 text-purple-700",
    "Out for Delivery": "bg-app-orange/10 text-app-orange",
    Delivered: "bg-green-100 text-green-700",
    Cancelled: "bg-red-100 text-red-700",
};

export const iconsForLeafpad = {
    truck: "https://cdn-icons-png.flaticon.com/512/3097/3097180.png",
    destination: "https://cdn-icons-png.flaticon.com/512/684/684908.png",
};
