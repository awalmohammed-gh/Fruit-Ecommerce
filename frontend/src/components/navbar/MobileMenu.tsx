import { ChevronDownIcon, LayoutGridIcon, ShoppingBasketIcon } from "lucide-react";
import { useState } from "react";
import { Link, NavLink, useLocation, useSearchParams } from "react-router-dom";
import { useStoreCategories } from "../../hooks/useStoreCategories";
import { navLinks } from "./navConfig";
import { sizedImage } from "../../utils/links";

interface MobileMenuProps {
  open: boolean;
  onClose: () => void;
  isAuthenticated: boolean;
}

const MobileMenu = ({ open, onClose, isAuthenticated }: MobileMenuProps) => {
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  // The closed menu is only collapsed, so its pictures would otherwise download with every page.
  // They load the first time the category list is shown.
  const [opened, setOpened] = useState(false);
  if (open && categoriesOpen && !opened) setOpened(true);
  const { categories } = useStoreCategories();
  const { pathname } = useLocation();
  const [searchParams] = useSearchParams();
  const activeSlug = pathname === "/products" ? searchParams.get("category") : null;

  const linkClass = (isActive: boolean) =>
    `flex items-center justify-between w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
      isActive ? "text-app-orange bg-green-50" : "text-gray-700 hover:bg-green-50 hover:text-app-green"
    }`;

  return (
    <div
      className={`lg:hidden grid transition-[grid-template-rows] duration-300 ease-out border-app-border ${
        open ? "grid-rows-[1fr] border-t" : "grid-rows-[0fr]"
      }`}
    >
      <div className="overflow-hidden">
        <div className="max-h-[calc(100dvh-8rem)] overflow-y-auto px-4 sm:px-6 py-3 space-y-1">
          {navLinks.slice(0, 2).map((link) => (
            <NavLink
              key={link.path}
              to={link.path}
              end
              onClick={onClose}
              className={({ isActive }) => linkClass(isActive && !activeSlug)}
            >
              {link.name}
            </NavLink>
          ))}

          <button
            type="button"
            onClick={() => setCategoriesOpen((prev) => !prev)}
            aria-expanded={categoriesOpen}
            className={linkClass(!!activeSlug)}
          >
            Categories
            <ChevronDownIcon
              className={`size-4 transition-transform duration-200 ${categoriesOpen ? "rotate-180" : ""}`}
            />
          </button>
          <div
            className={`grid transition-[grid-template-rows] duration-300 ease-out ${
              categoriesOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
            }`}
          >
            <div className="overflow-hidden">
              <div className="ml-3 pl-3 border-l border-app-border py-1 space-y-0.5">
                {categories.map((cat) => (
                  <Link
                    key={cat.slug}
                    to={`/category/${encodeURIComponent(cat.slug)}`}
                    onClick={onClose}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                      activeSlug === cat.slug
                        ? "text-app-green font-medium bg-green-50"
                        : "text-zinc-500 hover:bg-green-50 hover:text-zinc-900"
                    }`}
                  >
                    {cat.image && opened ? <img src={sizedImage(cat.image, 40)} alt="" width={20} height={20} className="size-5 object-contain" /> : cat.image ? <span className="size-5" aria-hidden="true" /> : <ShoppingBasketIcon className="size-5 p-0.5 text-app-green/60" aria-hidden="true" />}
                    {cat.name}
                  </Link>
                ))}
                <Link
                  to="/products"
                  onClick={onClose}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-app-green hover:bg-green-50"
                >
                  <LayoutGridIcon size={16} />
                  All Categories
                </Link>
              </div>
            </div>
          </div>

          {navLinks.slice(2).map((link) => (
            <NavLink
              key={link.path}
              to={link.path}
              onClick={onClose}
              className={({ isActive }) => linkClass(isActive)}
            >
              {link.name}
            </NavLink>
          ))}

          {!isAuthenticated && (
            // Keep a create-account shortcut in the mobile navigation.
            <div className="sm:hidden pt-3 mt-2 border-t border-app-border">
              <Link
                to="/login?mode=signup"
                onClick={onClose}
                className="block text-center px-4 py-2 text-sm font-medium text-green-950 border border-app-border rounded-full hover:bg-green-50"
              >
                Sign Up
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default MobileMenu;
