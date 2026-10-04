import { useEffect } from "react";
import toast from "../components/toast/toast";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, ChevronRight, Leaf, Minus, Plus, ShoppingBasket, Trash2, Truck } from "lucide-react";
import { useCart } from "../context/CartContext";
import { productPath } from "../utils/links";
import "./cart.css";
import { maxQuantity } from "../utils/orderLimits";

const money = (value: number) => value.toLocaleString("en-GH", { style: "currency", currency: "GHS" });

const Cart = () => {
  const { items, cartCount, cartTotal, updateQuantity, removeFromCart } = useCart();
  useEffect(() => { window.scrollTo(0, 0); }, []);
  const savings = items.reduce((total, item) => total + Math.max(0, item.product.originalPrice - item.product.price) * item.quantity, 0);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7 sm:py-10 text-app-green">
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-app-text-light mb-7"><Link to="/">Home</Link><ChevronRight className="size-3" aria-hidden="true" /><span aria-current="page">Your basket</span></nav>
      <header className="flex flex-wrap justify-between items-end gap-4 mb-8">
        <div><p className="text-[10px] font-semibold tracking-[0.18em] text-app-orange-dark mb-3">GOOD THINGS, ALL IN ONE PLACE</p><h1 className="font-serif text-4xl sm:text-5xl tracking-tight">Your basket.</h1><p role="status" aria-live="polite" className="text-sm text-app-text-light mt-3">{cartCount ? `${cartCount} ${cartCount === 1 ? "item" : "items"} for your next good meal.` : "A little fresh is waiting for you."}</p></div>
        <Link to="/products" className="inline-flex items-center gap-2 text-sm font-medium hover:text-app-orange-dark"><ArrowLeft className="size-4" aria-hidden="true" />Keep shopping</Link>
      </header>
      {items.length ? <div className="basket-layout">
        <section aria-label="Items in your cart" className="basket-items">
          <div className="basket-column-headings text-[10px] uppercase tracking-widest text-app-text-light"><span>In your basket</span><span>Quantity</span><span className="text-right">Item total</span></div>
          <ul className="rounded-2xl border border-app-border bg-white divide-y divide-app-border">
            {items.map(({ product, quantity }) => (
              <li key={product._id} className="basket-item-row">
                <div className="flex gap-4 items-center min-w-0">
                  <Link to={productPath(product)} aria-label={`View ${product.name}`} className="size-20 sm:size-24 shrink-0 rounded-xl bg-[#f3f2e8] p-2"><img src={product.image} alt="" width={96} height={96} className="w-full h-full object-contain" /></Link>
                  <div className="min-w-0"><Link to={productPath(product)} className="text-sm font-semibold hover:text-app-orange-dark"><h2>{product.name}</h2></Link><p className="text-xs text-app-text-light mt-1.5">{money(product.price)} / {product.unit}</p>
                    {product.isOrganic && <span className="inline-flex gap-1 items-center text-[10px] text-green-700 mt-2"><Leaf className="size-3" aria-hidden="true" />Organic</span>}
                    <button type="button" onClick={() => { removeFromCart(product._id); toast.info(`${product.name} removed from cart`, { duration: 2500 }); }} aria-label={`Remove ${product.name} from cart`} className="flex items-center gap-1.5 text-xs text-app-text-light hover:text-red-700 mt-2"><Trash2 className="size-3.5" aria-hidden="true" />Remove</button>
                  </div>
                </div>
                <div className="basket-item-actions">
                  <div role="group" aria-label={`Quantity of ${product.name}`} className="inline-flex w-fit items-center rounded-xl border border-app-border bg-app-cream/40">
                    <button type="button" aria-label={quantity === 1 ? `Remove ${product.name}` : `Decrease ${product.name} quantity`} onClick={() => updateQuantity(product._id, quantity - 1)} className="size-11 flex-center rounded-l-xl hover:bg-green-50"><Minus className="size-3.5" aria-hidden="true" /></button>
                    <output className="min-w-7 text-center text-sm font-semibold" aria-live="polite">{quantity}</output>
                    <button type="button" aria-label={`Increase ${product.name} quantity`} disabled={quantity >= maxQuantity(product)} onClick={() => updateQuantity(product._id, quantity + 1)} className="size-11 flex-center rounded-r-xl hover:bg-green-50 disabled:opacity-30 disabled:cursor-not-allowed"><Plus className="size-3.5" aria-hidden="true" /></button>
                  </div>
                  <div className="text-right"><p className="text-sm font-semibold">{money(product.price * quantity)}</p>{product.originalPrice > product.price && <p className="text-xs text-app-text-light line-through mt-1">{money(product.originalPrice * quantity)}</p>}</div>
                </div>
              </li>
            ))}
          </ul>
          <div className="flex gap-3 items-start mt-5 text-xs text-app-text-light leading-relaxed"><Truck className="size-4 shrink-0 text-app-green" aria-hidden="true" /><p>Your groceries, delivered to your door. Delivery and tax are shown at checkout.</p></div>
        </section>
        <aside aria-labelledby="cart-summary-heading" className="basket-summary rounded-2xl border border-app-border bg-[#f0f1e6] p-6 sm:p-7">
          <p className="text-[10px] tracking-widest text-app-text-light font-semibold mb-3">READY WHEN YOU ARE</p><h2 id="cart-summary-heading" className="font-serif text-2xl mb-6">Basket summary</h2>
          <div className="flex justify-between gap-3 text-sm mb-4"><span className="text-app-text-light">Subtotal ({cartCount} {cartCount === 1 ? "item" : "items"})</span><span className="font-semibold">{money(cartTotal)}</span></div>
          {savings > 0 && <p className="text-xs rounded-lg bg-white/70 px-3 py-3 mb-4 text-green-800">A little extra goodness: you save <strong>{money(savings)}</strong> on this basket.</p>}
          <p className="text-xs text-app-text-light leading-relaxed border-t border-app-green/10 pt-4">Delivery fees and tax will be calculated at checkout.</p>
          <Link to="/checkout" className="flex items-center justify-center gap-3 bg-app-green text-white rounded-xl px-4 py-3.5 mt-6 text-sm font-semibold hover:bg-app-green-light">Continue to checkout <ArrowRight className="size-4" aria-hidden="true" /></Link>
          <Link to="/products" className="flex items-center justify-center py-3 mt-2 text-xs font-medium hover:text-app-orange-dark">Add a few more favourites</Link>
        </aside>
      </div> : <section className="rounded-3xl border border-app-border bg-white text-center px-6 py-16 sm:py-20">
        <div className="size-20 rounded-full bg-[#f0f1e6] flex-center mx-auto mb-6"><ShoppingBasket className="size-8" aria-hidden="true" /></div><h2 className="font-serif text-3xl">Your basket has room for good things.</h2><p className="text-sm text-app-text-light mt-3 mb-7">Start with fresh fruit, or restock your everyday favourites.</p><Link to="/products" className="inline-flex items-center gap-3 px-6 py-3 rounded-full bg-app-green text-white text-sm font-semibold">Explore the market <ArrowRight className="size-4" aria-hidden="true" /></Link>
      </section>}
    </div>
  );
};
export default Cart;
