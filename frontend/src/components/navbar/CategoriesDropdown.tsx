import { ChevronDownIcon, LayoutGridIcon, ShoppingBasketIcon } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { Link, useLocation, useSearchParams } from "react-router-dom";
import { useStoreCategories } from "../../hooks/useStoreCategories";
import { useClickOutside } from "../../hooks/useClickOutside";
import { dropdownPanel } from "./navConfig";

const CategoriesDropdown = () => {
  const [open, setOpen] = useState(false);
  const { categories } = useStoreCategories();
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close, open);

  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const activeSlug = pathname.startsWith("/category/") ? pathname.slice("/category/".length) : pathname === "/products" ? searchParams.get("category") : null;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="menu"
        aria-expanded={open}
        className={`flex items-center gap-1 text-sm font-medium rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-green/30 ${
          activeSlug
            ? "text-app-orange border-b-2 border-app-green pb-0.5"
            : "text-gray-600 hover:text-app-green"
        }`}
      >
        Categories
        <ChevronDownIcon
          className={`size-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      <div
        role="menu"
        className={`absolute left-1/2 -translate-x-1/2 top-full mt-3 w-60 bg-white rounded-xl shadow-lg border border-app-border py-2 z-50 origin-top ${dropdownPanel(open)}`}
      >
        {categories.map((cat) => (
          <Link
            key={cat.slug}
            role="menuitem"
            to={`/category/${encodeURIComponent(cat.slug)}`}
            onClick={close}
            className={`dropdown-link ${activeSlug === cat.slug ? "text-app-green! font-medium bg-green-50" : ""}`}
          >
            {cat.image ? <img src={cat.image} alt="" className="size-5 object-contain" /> : <ShoppingBasketIcon className="size-5 p-0.5 text-app-green/60" aria-hidden="true" />}
            {cat.name}
          </Link>
        ))}
        <div className="border-t border-app-border mt-1 pt-1">
          <Link role="menuitem" to="/products" onClick={close} className="dropdown-link font-medium text-app-green!">
            <LayoutGridIcon size={16} />
            All Categories
          </Link>
        </div>
      </div>
    </div>
  );
};

export default CategoriesDropdown;
