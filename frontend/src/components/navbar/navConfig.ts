export const navLinks = [
  { name: "Home", path: "/" },
  { name: "Products", path: "/products" },
  { name: "Deals", path: "/deals" },
];

// Shared open/close animation for navbar dropdown panels.
export const dropdownPanel = (open: boolean) =>
  `transition duration-200 ease-out ${
    open
      ? "opacity-100 translate-y-0 scale-100 visible"
      : "opacity-0 -translate-y-1 scale-95 invisible pointer-events-none"
  }`;
