import { AdminPreferencesProvider, useAdminPreferences } from "../../context/AdminPreferencesContext";
import { useCallback, useState } from "react";
import { Outlet } from "react-router-dom";
import AdminNavbar from "./AdminNavbar";
import AdminSidebar from "./AdminSidebar";
import { LoadingState } from "../../components/admin/States";
import { useAdminAuth } from "../../context/AdminAuthContext";
import { AdminStatsProvider } from "./lib/AdminStats";
import styles from "./AdminLayout.module.css";

export default function AdminLayout() {
  return <AdminPreferencesProvider><AdminWorkspace /></AdminPreferencesProvider>;
}

function AdminWorkspace() {
  const { preferences, loading: preferencesLoading } = useAdminPreferences();
  const [menuOpen, setMenuOpen] = useState(false);
  const closeMenu = useCallback(() => setMenuOpen(false), []);
  // On a refresh the session is checked first; the sidebar and header stay, only the content area waits.
  const { loading } = useAdminAuth();

  return (
    <AdminStatsProvider>
      <div className={`${styles.shell} ${preferences.sidebar === "collapsed" ? styles.collapsed : ""}`}>
        <AdminSidebar open={menuOpen} onClose={closeMenu} />
        <div className={styles.main}>
          <AdminNavbar menuOpen={menuOpen} onOpenMenu={() => setMenuOpen(true)} />
          <main className={styles.content}>
            {loading || preferencesLoading ? <div className={styles.contentLoading}><LoadingState label={loading ? "Checking your admin session" : "Loading your workspace preferences"} /></div> : <Outlet />}
          </main>
        </div>
      </div>
    </AdminStatsProvider>
  );
}
