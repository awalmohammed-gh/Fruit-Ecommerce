import { Link } from "react-router-dom";
import type { Product } from "../../types";
import { Leaf, Minus, Plus, Star } from "lucide-react";
import { useCart } from "../../context/CartContext";
import { productPath, sizedImage } from "../../utils/links";
import { maxQuantity } from "../../utils/orderLimits";

const formatPrice = (price: number) =>
  price.toLocaleString("en-GH", { style: "currency", currency: "GHS" });

const ProductCard = ({ product }: { product: Product }) => {
  const { items, addToCart, updateQuantity } = useCart();
  const available = product.stock > 0;
  const cartItem = items.find((item) => item.product._id === product._id);

  return (
    <article className="group relative flex flex-col min-w-0 rounded-2xl border border-app-border bg-white p-2 sm:p-2.5 transition-all duration-300 hover:border-app-green/20 hover:shadow-lg hover:shadow-app-green/5 motion-safe:hover:-translate-y-0.5">
      <Link
        to={productPath(product)}
        aria-label={`View ${product.name}`}
        className="relative block aspect-square rounded-xl bg-[#f4f5f0] overflow-hidden"
      >
        <img
          src={sizedImage(product.image, 480)}
          alt={`${product.name} product image`}
          loading="lazy"
          decoding="async"
          width={320}
          height={320}
          className={`w-full h-full object-contain p-4 sm:p-6 transition-transform duration-500 motion-safe:group-hover:scale-105 ${available ? "" : "opacity-50 grayscale"}`}
        />
        <div className="absolute top-2 left-2 right-2 flex items-start justify-between gap-1">
          {product.discount > 0 ? (
            <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] sm:text-xs font-semibold text-orange-800">
              -{product.discount}%
            </span>
          ) : <span />}
          {product.isOrganic && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-0.5 text-[10px] sm:text-xs font-semibold text-app-green">
              <Leaf className="size-3" aria-hidden="true" />
              <span className="hidden sm:inline">Organic</span>
            </span>
          )}
        </div>
        {!available && (
          <span className="absolute bottom-2 left-2 rounded-full bg-white px-2.5 py-1 text-[10px] sm:text-xs font-semibold text-gray-600">
            Out of stock
          </span>
        )}
      </Link>

      <div className="flex flex-col flex-1 px-1.5 pt-3 pb-1">
        <div className="flex items-center justify-between gap-2 text-xs text-app-text-light">
          <span>Per {product.unit}</span>
          {product.rating > 0 && (
            <span className="inline-flex items-center gap-1">
              <Star className="size-3.5 text-amber-600 fill-amber-500" aria-hidden="true" />
              <span className="font-medium text-gray-700">{product.rating}</span>
              <span className="hidden sm:inline">({product.reviewCount})</span>
            </span>
          )}
        </div>
        <Link
          to={productPath(product)}
          className="mt-1.5 text-sm font-semibold text-app-green leading-snug hover:text-app-orange-dark"
        >
          <h3 className="line-clamp-2 min-h-10">{product.name}</h3>
        </Link>

        <div className="mt-auto pt-3 flex items-end justify-between gap-2">
          <div className="min-w-0">
            <p className="text-base sm:text-lg font-bold text-app-green leading-none">
              {formatPrice(product.price)}
            </p>
            {product.originalPrice > product.price && (
              <p className="text-xs text-app-text-light line-through mt-1">
                {formatPrice(product.originalPrice)}
              </p>
            )}
          </div>

          {cartItem ? (
            <div
              role="group"
              aria-label={`${product.name} quantity in cart`}
              className="flex items-center rounded-full bg-app-green text-white shrink-0"
            >
              <button
                type="button"
                aria-label="Decrease quantity"
                onClick={() => updateQuantity(product._id, cartItem.quantity - 1)}
                className="size-8 sm:size-9 flex-center rounded-full hover:bg-app-green-light"
              >
                <Minus className="size-3.5" />
              </button>
              <output aria-live="polite" className="min-w-5 text-center text-sm font-semibold">
                {cartItem.quantity}
              </output>
              <button
                type="button"
                aria-label="Increase quantity"
                disabled={cartItem.quantity >= maxQuantity(product)}
                onClick={() => updateQuantity(product._id, cartItem.quantity + 1)}
                className="size-8 sm:size-9 flex-center rounded-full hover:bg-app-green-light disabled:opacity-40"
              >
                <Plus className="size-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => addToCart(product)}
              disabled={!available}
              aria-label={available ? `Add ${product.name} to cart` : `${product.name} is out of stock`}
              className="size-9 sm:size-10 shrink-0 flex-center rounded-full border border-app-green/20 bg-green-50 text-app-green hover:bg-app-green hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-green/30 disabled:bg-gray-100 disabled:text-gray-400 disabled:border-transparent disabled:cursor-not-allowed transition-colors"
            >
              <Plus className="size-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </article>
  );
};
export default ProductCard;
