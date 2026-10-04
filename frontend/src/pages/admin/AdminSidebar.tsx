import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { ArrowUpRightIcon, LeafIcon, XIcon, PanelLeftCloseIcon, PanelLeftOpenIcon } from "lucide-react";
import { useAdminPreferences } from "../../context/AdminPreferencesContext";
import toast from "../../components/toast/toast";
import { adminNavigation } from "./lib/navigation";
import { useAdminStats } from "./lib/AdminStats";
import ui from "../../components/admin/ui.module.css";
import styles from "./AdminLayout.module.css";

export default function AdminSidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { preferences, save } = useAdminPreferences();
  const [saving, setSaving] = useState(false);
  const toggleSidebar = async () => {
    setSaving(true);
    try { await save({ ...preferences, sidebar: preferences.sidebar === "expanded" ? "collapsed" : "expanded" }); }
    catch (error) { toast.error(error instanceof Error ? error.message : "Unable to save sidebar preference"); }
    finally { setSaving(false); }
  };
  const { products, pendingApplications } = useAdminStats();
  // Keep stock problems visible from every page.
  const restock = products ? products.lowStock + products.outOfStock : 0;

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <>
      {open && <button type="button" className={styles.scrim} aria-label="Close menu" onClick={onClose} />}
      <aside id="admin-sidebar" className={`${styles.sidebar} ${open ? styles.sidebarOpen : ""}`} aria-label="Admin">
        <div className={styles.brandRow}>
          <Link to="/admin/dashboard" className={styles.brand} onClick={onClose} aria-label="GreenFarm management dashboard">
            <span className={styles.brandIcon}><LeafIcon size={18} aria-hidden="true" /></span>
            <span>Green<strong>Farm</strong><span className={styles.brandLabel}>MANAGEMENT</span></span>
          </Link>
          <button type="button" className={`${ui.iconButton} ${styles.closeButton}`} onClick={onClose} aria-label="Close menu">
            <XIcon aria-hidden="true" />
          </button>
        </div>

        <nav className={styles.nav} aria-label="Admin sections">
          {adminNavigation.map((section) => (
            <div key={section.title} className={styles.section}>
              <p className={styles.sectionTitle}>{section.title}</p>
              {section.items.map((item) => (
                <NavLink key={item.to} title={item.label} to={item.to} end={item.end} onClick={onClose} className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ""}`}>
                  <item.icon aria-hidden="true" />
                  <span className={styles.linkLabel}>{item.label}</span>
                  {item.badge === "lowStock" && restock > 0 && (
                    <span className={styles.linkBadge} aria-label={`${restock} products need restocking`}>{restock}</span>
                  )}
                  {item.badge === "pendingApplications" && pendingApplications > 0 && (
                    <span className={styles.linkBadge} aria-label={`${pendingApplications} delivery applications waiting for review`}>{pendingApplications}</span>
                  )}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        <div className={styles.sidebarFooter}>
          <button type="button" className={`${styles.storeLink} ${styles.collapseButton}`} onClick={toggleSidebar} disabled={saving} title={preferences.sidebar === "expanded" ? "Collapse sidebar" : "Expand sidebar"} aria-label={preferences.sidebar === "expanded" ? "Collapse sidebar" : "Expand sidebar"}>
            {preferences.sidebar === "expanded" ? <PanelLeftCloseIcon aria-hidden="true" /> : <PanelLeftOpenIcon aria-hidden="true" />}<span>Collapse sidebar</span>
          </button>
          <Link to="/" aria-label="View store" title="View store" className={styles.storeLink}>View store <ArrowUpRightIcon aria-hidden="true" /></Link>
        </div>
      </aside>
    </>
  );
}
