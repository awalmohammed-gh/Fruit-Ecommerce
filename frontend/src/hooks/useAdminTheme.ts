import { useLayoutEffect, useSyncExternalStore } from "react";
import type { AdminPreferences } from "../frontApisRoute/adminSettings";

const SYSTEM_DARK = "(prefers-color-scheme: dark)";
const systemDark = () => window.matchMedia(SYSTEM_DARK).matches;
const subscribe = (onChange: () => void) => {
  const query = window.matchMedia(SYSTEM_DARK);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};

/** Follow OS changes while System is selected; explicit Light/Dark always take precedence. */
export function useAdminTheme(appearance: AdminPreferences["appearance"]) {
  const prefersDark = useSyncExternalStore(subscribe, systemDark);
  const theme = appearance === "system" ? (prefersDark ? "dark" : "light") : appearance;
  // The root also covers dialogs and toast portals. Restore it when leaving the admin workspace.
  useLayoutEffect(() => {
    const root = document.documentElement;
    const previous = root.getAttribute("data-admin-theme");
    root.setAttribute("data-admin-theme", theme);
    return () => {
      if (previous === null) root.removeAttribute("data-admin-theme");
      else root.setAttribute("data-admin-theme", previous);
    };
  }, [theme]);

  return theme;
}
