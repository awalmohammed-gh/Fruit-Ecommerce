import { Fragment, useRef, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowUpRightIcon, ChevronDownIcon, ChevronRightIcon, LoaderCircleIcon, LogOutIcon, MenuIcon, SearchIcon, SettingsIcon, ShieldCheckIcon, UserIcon } from "lucide-react";
import toast from "../../components/toast/toast";
import { useAdminAuth } from "../../context/AdminAuthContext";
import { breadcrumbFor } from "./lib/navigation";
import ui from "../../components/admin/ui.module.css";
import styles from "./AdminNavbar.module.css";

interface AdminNavbarProps { menuOpen: boolean; onOpenMenu: () => void }

// The application toolbar: where you are, product search, and the admin account menu.
export default function AdminNavbar({ menuOpen, onOpenMenu }: AdminNavbarProps) {
  const { admin, logout: adminLogout } = useAdminAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const [query, setQuery] = useState("");
  const account = useRef<HTMLDetailsElement>(null);
  const name = admin?.fullName || "Administrator";
  const crumbs = breadcrumbFor(pathname);
  const current = crumbs[crumbs.length - 1]!;

  const closeAccount = () => { if (account.current) account.current.open = false; };

  const search = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = query.trim();
    navigate(text ? `/admin/products?q=${encodeURIComponent(text)}` : "/admin/products");
    setQuery("");
  };

  const signOut = async () => {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await adminLogout();
      navigate("/admin/login", { replace: true });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to sign out. Please try again.");
    } finally {
      setSigningOut(false);
    }
  };

  return (
    <header className={styles.header}>
      <button type="button" className={`${ui.iconButton} ${styles.menuButton}`} onClick={onOpenMenu} aria-label="Open menu" aria-expanded={menuOpen} aria-controls="admin-sidebar">
        <MenuIcon aria-hidden="true" />
      </button>

      <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
        <ol>
          {crumbs.map((crumb, index) => (
            <Fragment key={crumb.label}>
              {index > 0 && <li aria-hidden="true" className={styles.crumbSeparator}><ChevronRightIcon size={14} /></li>}
              <li className={crumb === current ? styles.crumbCurrent : styles.crumb} aria-current={crumb === current ? "page" : undefined}>
                {crumb.to ? <Link to={crumb.to}>{crumb.label}</Link> : crumb.label}
              </li>
            </Fragment>
          ))}
        </ol>
      </nav>

      <form role="search" className={styles.search} onSubmit={search}>
        <SearchIcon aria-hidden="true" />
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search products…" aria-label="Search products" />
      </form>

      <details ref={account} className={styles.account} onKeyDown={(event) => {
        if (event.key === "Escape" && account.current?.open) {
          closeAccount();
          account.current.querySelector("summary")?.focus();
        }
      }} onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) event.currentTarget.open = false;
      }}>
        <summary className={styles.accountButton} aria-label="Admin account options">
          <span className={styles.avatar}>{admin?.avatar ? <img src={admin.avatar} alt="" onError={(event) => { event.currentTarget.style.display = "none"; }} /> : name.charAt(0).toUpperCase()}</span>
          <span className={styles.accountText}><strong>{name}</strong><span>Administrator</span></span>
          <ChevronDownIcon size={15} className={styles.chevron} aria-hidden="true" />
        </summary>
        <div className={styles.dropdown}>
          <div className={styles.identity}>
            <span className={styles.access}><ShieldCheckIcon size={14} aria-hidden="true" /> Admin access</span>
            <strong>{name}</strong><span>{admin?.email}</span>
          </div>
          <Link to="/admin/settings?section=account" className={styles.dropdownAction} onClick={closeAccount}>Account <UserIcon size={16} aria-hidden="true" /></Link>
          <Link to="/admin/settings" className={styles.dropdownAction} onClick={closeAccount}>Settings <SettingsIcon size={16} aria-hidden="true" /></Link>
          <Link to="/" className={styles.dropdownAction}>View store <ArrowUpRightIcon size={16} aria-hidden="true" /></Link>
          <div className={styles.dropdownDivider} />
          <button type="button" className={`${styles.dropdownAction} ${styles.signOut}`} onClick={signOut} disabled={signingOut}>
            {signingOut ? "Signing out…" : "Log out"}
            {signingOut ? <LoaderCircleIcon size={16} aria-hidden="true" /> : <LogOutIcon size={16} aria-hidden="true" />}
          </button>
        </div>
      </details>
    </header>
  );
}
