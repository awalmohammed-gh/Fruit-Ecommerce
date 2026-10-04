import { Link } from "react-router-dom";
import { MapPin, Phone, Mail } from "lucide-react";
import {
  SiFacebook,
  SiInstagram,
  SiYoutube,
} from "@icons-pack/react-simple-icons";
import { FaXTwitter } from "react-icons/fa6";
import { useSiteContent } from "../hooks/useSiteContent";

const Footer = () => {
  // Description and contact details from Admin → Settings → Store Information.
  const store = useSiteContent().data?.store;
  return (
    <footer className="bg-app-green text-white mt-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 gap-y-10">
          {/* Site Name & Description */}
          <div className="space-y-4">
            <Link to="/" className="inline-block">
              <h2 className="text-2xl font-bold">
                Green<span className="text-green-500">Farm</span>
              </h2>
            </Link>
            {store?.description && <p className="text-gray-400 text-sm leading-relaxed">{store.description}</p>}
            {/* Social Icons */}
            <div className="flex items-center gap-3 pt-2">
              <a
                href="#"
                className="p-2 bg-gray-800 rounded-full hover:bg-green-600 transition-colors duration-300"
                aria-label="Facebook"
              >
                <SiFacebook className="w-4 h-4 text-white" />
              </a>
              <a
                href="#"
                className="p-2 bg-gray-800 rounded-full hover:bg-green-600 transition-colors duration-300"
                aria-label="Twitter"
              >
                <FaXTwitter className="w-4 h-4 text-white" />
              </a>
              <a
                href="#"
                className="p-2 bg-gray-800 rounded-full hover:bg-green-600 transition-colors duration-300"
                aria-label="Instagram"
              >
                <SiInstagram className="w-4 h-4 text-white" />
              </a>
              <a
                href="#"
                className="p-2 bg-gray-800 rounded-full hover:bg-green-600 transition-colors duration-300"
                aria-label="YouTube"
              >
                <SiYoutube className="w-4 h-4 text-white" />
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Quick Links</h3>
            <ul className="space-y-2">
              <li>
                <Link
                  to="/products"
                  className="text-gray-400 hover:text-green-500 transition-colors duration-300 text-sm"
                >
                  All Products
                </Link>
              </li>
              <li>
                <Link
                  to="/deals"
                  className="text-gray-400 hover:text-green-500 transition-colors duration-300 text-sm"
                >
                  Flash Deals
                </Link>
              </li>
              <li>
                <Link
                  to="/my-orders"
                  className="text-gray-400 hover:text-green-500 transition-colors duration-300 text-sm"
                >
                  Track Order
                </Link>
              </li>
              <li>
                <Link
                  to="/delivery-partner/apply"
                  className="text-gray-400 hover:text-green-500 transition-colors duration-300 text-sm"
                >
                  Become a Delivery Partner
                </Link>
              </li>
            </ul>
          </div>

          {/* Customer Service */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">
              Customer Service
            </h3>
            <ul className="space-y-2">
              <li>
                <Link
                  to="/account"
                  className="text-gray-400 hover:text-green-500 transition-colors duration-300 text-sm"
                >
                  My Account
                </Link>
              </li>
              <li>
                <Link
                  to="/my-orders"
                  className="text-gray-400 hover:text-green-500 transition-colors duration-300 text-sm"
                >
                  Order History
                </Link>
              </li>
              <li>
                <Link
                  to="/my-address"
                  className="text-gray-400 hover:text-green-500 transition-colors duration-300 text-sm"
                >
                  Addresses
                </Link>
              </li>
              <li>
                {store?.email && <a
                  href={`mailto:${store.email}`}
                  className="text-gray-400 hover:text-green-500 transition-colors duration-300 text-sm"
                >
                  Help Center
                </a>}
              </li>
            </ul>
          </div>

          {/* Contact Us */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-white">Contact Us</h3>
            <ul className="space-y-3">
              {store?.address && <li className="flex items-start gap-3">
                <MapPin className="w-4 h-4 text-green-500 mt-0.5 shrink-0" aria-hidden="true" />
                <span className="text-gray-400 text-sm">{store.address}</span>
              </li>}
              {store?.phone && <li className="flex items-center gap-3">
                <Phone className="w-4 h-4 text-green-500 shrink-0" aria-hidden="true" />
                <a
                  href={`tel:${store.phone.replace(/[^\d+]/g, "")}`}
                  className="text-gray-400 hover:text-green-500 transition-colors duration-300 text-sm"
                >
                  {store.phone}
                </a>
              </li>}
              {store?.email && <li className="flex items-center gap-3 min-w-0">
                <Mail className="w-4 h-4 text-green-500 shrink-0" aria-hidden="true" />
                <a
                  href={`mailto:${store.email}`}
                  className="text-gray-400 hover:text-green-500 transition-colors duration-300 text-sm break-all"
                >
                  {store.email}
                </a>
              </li>}
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-gray-800 mt-10 pt-6 text-center">
          <p className="text-gray-400 text-xs">
            &copy; {new Date().getFullYear()} GreenFarm. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
