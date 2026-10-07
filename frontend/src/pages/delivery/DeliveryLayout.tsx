import { Suspense, useState } from "react";
import NotificationBell from "../../components/notifications/NotificationBell";
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate, useOutletContext } from "react-router-dom";
import { HistoryIcon, HomeIcon, LogOutIcon, PackageIcon, PanelLeftCloseIcon, PanelLeftOpenIcon, TruckIcon, UserIcon } from "lucide-react";
import toast from "../../components/toast/toast";
import type { PartnerApplication } from "../../frontApisRoute/delivery";
import { usePartnerAuth } from "../../context/PartnerAuthContext";
import Loading from "../../components/card/Loading";

/**
 * Every workspace page, in one place: navigation, page title and description, and how wide the page may get.
 * "wide" pages (lists of cards) use the whole content area; the others stay at a comfortable reading width.
 */
const pages = [
  { to: "/delivery-partner/dashboard", label: "Dashboard", short: "Home", icon: HomeIcon, description: "Today's deliveries and what to do next.", wide: true },
  { to: "/delivery-partner/deliveries", label: "Assigned Deliveries", short: "Deliveries", icon: PackageIcon, description: "Every delivery you're holding, most urgent first.", wide: true },
  { to: "/delivery-partner/history", label: "Delivery History", short: "History", icon: HistoryIcon, description: "Deliveries you've finished, newest first.", wide: true },
  { to: "/delivery-partner/profile", label: "Profile", short: "Profile", icon: UserIcon, description: "Keep your contact details current so GreenFarm can reach you.", wide: false },
];
const DETAIL_PAGE = { label: "Delivery details", description: "Where to go, who to call and the next step.", wide: false };
const pageFor = (pathname: string) => (/\/deliveries\/[^/]+$/.test(pathname) ? DETAIL_PAGE : pages.find((page) => pathname.startsWith(page.to)) ?? pages[0]!);

// Header and content share this container, so they always line up.
const CONTAINER = "w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8";
const SIDEBAR_KEY = "greenfarm.driver.sidebar";
const readCollapsed = () => { try { return localStorage.getItem(SIDEBAR_KEY) === "collapsed"; } catch { return false; } };

interface PartnerContext { partner: PartnerApplication; refreshPartner: () => void }
// eslint-disable-next-line react-refresh/only-export-components
export const usePartner = () => useOutletContext<PartnerContext>();

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/delivery-partner/dashboard" className="flex items-center gap-2.5 min-w-0" aria-label="GreenFarm driver workspace">
      <span className="size-9 rounded-xl bg-app-green text-white flex-center shrink-0"><TruckIcon className="size-5" aria-hidden="true" /></span>
      {!compact && (
        <span className="leading-tight min-w-0">
          <span className="block font-semibold text-app-green">GreenFarm</span>
          <span className="block text-[10px] font-semibold tracking-widest text-app-text-light">DRIVER WORKSPACE</span>
        </span>
      )}
    </Link>
  );
}

/**
 * Driver workspace shell: sidebar + main area (header, then page content).
 * The page itself scrolls; the sidebar stays put. Pages only render their content: titles, padding and
 * offsets for the header and phone navigation all live here.
 */
export default function DeliveryLayout() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { partner, loading, error, logout, refresh } = usePartnerAuth();
  const [collapsed, setCollapsed] = useState(readCollapsed);

  // Signed out (and nothing left to check): back to the sign-in page.
  if (!partner && !loading && !error) return <Navigate to="/delivery-partner/login" replace />;

  const page = pageFor(pathname);
  // While the account loads on a refresh, the sidebar, header and bottom navigation already show;
  // only the content area waits (and shows a problem there if the account can't be loaded).
  const initial = partner ? partner.fullName.charAt(0).toUpperCase() : "";
  const placeholder = <span className="block h-3 w-24 rounded-full bg-app-green/10 animate-pulse" aria-hidden="true" />;
  const toggleSidebar = () => {
    setCollapsed((value) => {
      try { localStorage.setItem(SIDEBAR_KEY, value ? "open" : "collapsed"); } catch { /* remembered for this visit only */ }
      return !value;
    });
  };
  const signOut = async () => {
    try {
      await logout();
      navigate("/delivery-partner/login", { replace: true });
    } catch {
      toast.error("Couldn't reach the server. Please try again.");
    }
  };

  return (
    <div className="min-h-dvh bg-app-cream lg:flex">
      {/* Desktop sidebar: part of the flex row (not fixed), so the main area always gets exactly the width that's left. */}
      <aside className={`hidden lg:flex lg:flex-col shrink-0 h-dvh sticky top-0 bg-white border-r border-app-border py-5 transition-[width] duration-200 ${collapsed ? "w-19 px-3" : "w-60 px-4"}`}>
        <div className={collapsed ? "flex justify-center" : ""}><Brand compact={collapsed} /></div>
        <nav aria-label="Driver workspace" className="mt-8 space-y-1">
          {pages.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} title={collapsed ? label : undefined} aria-label={collapsed ? label : undefined}
              className={({ isActive }) => `flex items-center gap-3 h-11 rounded-xl text-sm font-medium ${collapsed ? "justify-center" : "px-3"} ${isActive ? "bg-app-green text-white" : "text-zinc-600 hover:bg-app-cream"}`}>
              <Icon className="size-4.5 shrink-0" aria-hidden="true" />{!collapsed && label}
            </NavLink>
          ))}
        </nav>
        <div className={`mt-auto border-t border-app-border pt-4 flex items-center gap-3 ${collapsed ? "flex-col" : ""}`}>
          <span className="size-9 rounded-full bg-app-green/10 text-app-green font-semibold flex-center shrink-0" aria-hidden="true">{initial}</span>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-zinc-800 truncate">{partner ? partner.fullName : placeholder}</div>
              <p className="text-xs text-app-text-light">Delivery partner</p>
            </div>
          )}
          <button type="button" onClick={signOut} aria-label="Sign out" title="Sign out" className="p-2 text-zinc-500 hover:text-red-600 hover:bg-red-50 rounded-lg"><LogOutIcon className="size-4" /></button>
        </div>
      </aside>

      {/* min-w-0 lets the main area shrink below its content's width, so wide content can't push past the sidebar. */}
      <div className="flex-1 min-w-0 flex flex-col min-h-dvh">
        <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-app-border">
          <div className={`${CONTAINER} h-14 flex items-center gap-3`}>
            <div className="lg:hidden"><Brand /></div>
            <button type="button" onClick={toggleSidebar} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-pressed={collapsed}
              className="hidden lg:inline-flex -ml-2 p-2 text-zinc-500 hover:text-app-green hover:bg-app-cream rounded-lg">
              {collapsed ? <PanelLeftOpenIcon className="size-5" aria-hidden="true" /> : <PanelLeftCloseIcon className="size-5" aria-hidden="true" />}
            </button>
            <div className="ml-auto flex items-center gap-2">
              {partner && <NotificationBell key={partner._id} account="partner" ownerId={partner._id} />}
              <Link to="/delivery-partner/profile" className="flex items-center gap-2 rounded-full pr-1" aria-label="My profile">
                <span className="hidden sm:block text-sm font-medium text-zinc-700">{partner ? partner.fullName.split(" ")[0] : placeholder}</span>
                <span className={`size-8 rounded-full text-white text-sm font-semibold flex-center ${partner ? "bg-app-green" : "bg-app-green/10 animate-pulse"}`} aria-hidden="true">{initial}</span>
              </Link>
              <button type="button" onClick={signOut} aria-label="Sign out" title="Sign out" className="lg:hidden p-2.5 text-zinc-500 hover:text-red-600 hover:bg-red-50 rounded-xl"><LogOutIcon className="size-5" /></button>
            </div>
          </div>
        </header>

        {/* The one content shell for every page. pb-28 on phones keeps content clear of the bottom navigation. */}
        <main className={`${CONTAINER} flex-1 py-6 pb-28 lg:pb-10 wrap-break-word ${partner ? "" : "flex flex-col"}`}>
          {partner ? (
            <div className={page.wide ? "" : "max-w-3xl"}>
              <div className="mb-5">
                <h1 className="text-xl sm:text-2xl font-semibold text-app-green">{page.label}</h1>
                <p className="text-sm text-app-text-light mt-0.5">{page.description}</p>
              </div>
              <Suspense fallback={<Loading fill label="Loading" />}>
                <Outlet context={{ partner, refreshPartner: refresh } satisfies PartnerContext} />
              </Suspense>
            </div>
          ) : loading ? <Loading fill label="Opening your workspace" /> : (
            <div role="alert" className="flex-1 flex flex-col items-center justify-center gap-3 text-center">
              <p className="font-semibold text-zinc-800">We couldn't open your workspace</p>
              <p className="text-sm text-app-text-light">{error}</p>
              <button type="button" onClick={refresh} className="px-5 py-2.5 bg-app-green text-white text-sm font-medium rounded-xl">Try again</button>
            </div>
          )}
        </main>
      </div>

      {/* Phones and tablets: thumb-reachable bottom navigation instead of the sidebar */}
      <nav aria-label="Driver workspace" className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-app-border grid grid-cols-4 pb-[env(safe-area-inset-bottom)]">
        {pages.map(({ to, short, icon: Icon }) => (
          <NavLink key={to} to={to} className={({ isActive }) => `flex flex-col items-center justify-center gap-1 h-16 text-xs font-medium ${isActive ? "text-app-green" : "text-zinc-500"}`}>
            {({ isActive }) => (
              <>
                <span className={`px-4 py-1 rounded-full ${isActive ? "bg-app-green/10" : ""}`}><Icon className="size-5" aria-hidden="true" /></span>
                {short}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
