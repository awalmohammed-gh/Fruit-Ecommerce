import {
  BadgePercentIcon,
  BoxesIcon,
  ClipboardCheckIcon,
  FileTextIcon,
  FolderTreeIcon,
  LayoutDashboardIcon,
  PackageIcon,
  RouteIcon,
  SettingsIcon,
  ShoppingBagIcon,
  TrendingUpIcon,
  TriangleAlertIcon,
  TruckIcon,
  UsersIcon,
  type LucideIcon,
} from "lucide-react";

export interface NavItem { to: string; label: string; icon: LucideIcon; end?: boolean; badge?: "lowStock" | "pendingApplications" }
export interface NavSection { title: string; items: NavItem[] }

// Single source for the sidebar, the header breadcrumb and page titles.
export const adminNavigation: NavSection[] = [
  { title: "Overview", items: [{ to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboardIcon, end: true }] },
  {
    title: "Commerce",
    items: [
      { to: "/admin/products", label: "Products", icon: PackageIcon },
      { to: "/admin/categories", label: "Categories", icon: FolderTreeIcon },
      { to: "/admin/orders", label: "Orders", icon: ShoppingBagIcon },
      { to: "/admin/customers", label: "Customers", icon: UsersIcon },
    ],
  },
  {
    title: "Delivery Management",
    items: [
      { to: "/admin/delivery/applications", label: "Delivery Applications", icon: ClipboardCheckIcon, badge: "pendingApplications" },
      { to: "/admin/delivery/partners", label: "Delivery Partners", icon: TruckIcon },
      { to: "/admin/delivery/assignments", label: "Delivery Assignments", icon: RouteIcon },
    ],
  },
  {
    title: "Inventory",
    items: [
      { to: "/admin/inventory", label: "Stock Management", icon: BoxesIcon, end: true },
      { to: "/admin/inventory/low-stock", label: "Low Stock", icon: TriangleAlertIcon, badge: "lowStock" },
    ],
  },
  {
    title: "Marketing",
    items: [
      { to: "/admin/deals", label: "Deals & Discounts", icon: BadgePercentIcon },
    ],
  },
  {
    title: "Business",
    items: [
      { to: "/admin/revenue", label: "Revenue", icon: TrendingUpIcon },
      { to: "/admin/reports", label: "Reports", icon: FileTextIcon },
    ],
  },
  { title: "System", items: [{ to: "/admin/settings", label: "Settings", icon: SettingsIcon }] },
];

export interface Crumb { label: string; to?: string }

export function breadcrumbFor(pathname: string): Crumb[] {
  const path = pathname.replace(/\/+$/, "") || "/admin";
  if (path === "/admin" || path === "/admin/dashboard") return [{ label: "Overview" }, { label: "Dashboard" }];
  if (path === "/admin/products/new") return [{ label: "Products", to: "/admin/products" }, { label: "Add product" }];
  if (/^\/admin\/products\/[^/]+\/edit$/.test(path)) return [{ label: "Products", to: "/admin/products" }, { label: "Edit product" }];
  for (const section of adminNavigation) {
    const item = [...section.items].sort((a, b) => b.to.length - a.to.length)
      .find((entry) => path === entry.to || (!entry.end && path.startsWith(`${entry.to}/`)));
    if (item) return [{ label: section.title }, { label: item.label }];
  }
  return [{ label: "Admin" }];
}
