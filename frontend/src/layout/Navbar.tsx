import { MenuIcon, SearchIcon, ShoppingBagIcon, XIcon } from "lucide-react";
import React, { useCallback, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useCustomerAuth } from "../context/CustomerAuthContext";
import { useClickOutside } from "../hooks/useClickOutside";
import CategoriesDropdown from "../components/navbar/CategoriesDropdown";
import MobileMenu from "../components/navbar/MobileMenu";
import UserMenu from "../components/navbar/UserMenu";
import { navLinks } from "../components/navbar/navConfig";

const Navbar = () => {
  const { user, isAuthenticated, loading: authLoading, error: authError, retrySession } = useCustomerAuth();
  const { cartCount } = useCart();
  const [searchQuery, setSearchQuery] = useState("");
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const navigate = useNavigate();
  const { search } = useLocation();
  const hasCategory = new URLSearchParams(search).has("category");

  const closeMobileMenu = useCallback(() => setMobileMenuOpen(false), []);
  useClickOutside(navRef, closeMobileMenu, mobileMenuOpen);

  const handleSearch = (e: React.SubmitEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) {
      navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`);
      setSearchQuery("");
      closeMobileMenu();
    }
  };

  const navLinkClass = (isActive: boolean) =>
    `text-sm font-medium transition-colors duration-300 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-green/30 ${
      isActive
        ? "text-app-orange border-b-2 border-app-green pb-0.5"
        : "text-gray-600 hover:text-app-green"
    }`;

  const searchForm = (className: string) => (
    <form onSubmit={handleSearch} role="search" className={className}>
      <div className="relative w-full">
        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-zinc-500" />
        <input
          type="text"
          placeholder="Search fresh produce..."
          aria-label="Search products"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2 text-sm bg-green-50 rounded-full ring ring-green/15 focus:ring-2 focus:ring-app-green/30 transition-shadow"
        />
      </div>
    </form>
  );

  return (
    <nav ref={navRef} className="sticky top-0 z-40 bg-white border-b border-app-border shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center h-16 gap-3 lg:gap-8">
        {/* Hamburger (tablet & mobile) */}
        <button
          type="button"
          onClick={() => setMobileMenuOpen((prev) => !prev)}
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileMenuOpen}
          className="lg:hidden -ml-1 p-1.5 rounded-lg text-zinc-900 hover:bg-green-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-green/30"
        >
          {mobileMenuOpen ? <XIcon className="size-5" /> : <MenuIcon className="size-5" />}
        </button>

        <Link to={"/"} onClick={closeMobileMenu} className="text-[22px] font-semibold shrink-0">
          Green<span className="font-bold text-green-700">Farm</span>
        </Link>

        {/* Desktop links */}
        <div className="hidden lg:flex items-center gap-8">
          {navLinks.slice(0, 2).map((link) => (
            <NavLink
              key={link.path}
              to={link.path}
              end
              className={({ isActive }) => navLinkClass(isActive && !hasCategory)}
            >
              {link.name}
            </NavLink>
          ))}
          <CategoriesDropdown />
          {navLinks.slice(2).map((link) => (
            <NavLink key={link.path} to={link.path} className={({ isActive }) => navLinkClass(isActive)}>
              {link.name}
            </NavLink>
          ))}
        </div>

        {/* Inline search (md+) */}
        {searchForm("hidden md:flex flex-1 max-w-sm ml-auto")}

        {/* Right side */}
        <div className="flex items-center gap-2 sm:gap-3 ml-auto md:ml-0 shrink-0">
          <Link
            to="/cart"
            onClick={() => { closeMobileMenu(); window.scrollTo(0, 0); }}
            aria-label={`Cart, ${cartCount} item${cartCount === 1 ? "" : "s"}`}
            className="relative p-1.5 rounded-full hover:bg-green-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-green/30"
          >
            <ShoppingBagIcon className="size-5 text-zinc-900" />
            {cartCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-app-orange text-white text-[10px] font-semibold rounded-full flex-center">
                {cartCount > 99 ? "99+" : cartCount}
              </span>
            )}
          </Link>

          {authLoading ? <span role="status" aria-label="Loading account" className="size-8 rounded-full bg-green-50 animate-pulse" /> : authError ? <button onClick={retrySession} className="text-xs text-app-green" title={authError}>Retry account</button> : <UserMenu key={user?._id ?? "guest"} user={user} />}
        </div>
      </div>

      {/* Search below the bar on small screens */}
      {searchForm("md:hidden px-4 sm:px-6 pb-3")}

      <MobileMenu open={mobileMenuOpen} onClose={closeMobileMenu} isAuthenticated={isAuthenticated || authLoading || !!authError} />
    </nav>
  );
};

export default Navbar;
