import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { authApi, type AdminAccount } from "../frontApisRoute/auth";
import { adminSettingsApi } from "../frontApisRoute/adminSettings";
import type { ProfileInput } from "../frontApisRoute/auth";
import { SESSION_CHANGED_EVENT, SESSION_ENDED_EVENT, announceSessionChange, type Account } from "../frontApisRoute/session";
export type { AdminAccount } from "../frontApisRoute/auth";

/** The admin signed in via /admin/login (the adminToken cookie). Never a customer. */
interface AdminAuth {
  admin: AdminAccount | null; isAuthenticated: boolean; loading: boolean;
  login: (email: string, password: string) => Promise<AdminAccount>;
  logout: () => Promise<void>;
  updateProfile: (input: ProfileInput) => Promise<void>;
}
interface AdminAuthState extends AdminAuth { requestCheck: () => void }
const AdminAuthContext = createContext<AdminAuthState | undefined>(undefined);

export function AdminAuthProvider({ children }: { children: ReactNode }) {
  // Only pages that use the admin area ask (see useAdminAuth), so shoppers never trigger an admin check.
  const [requested, setRequested] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [checked, setChecked] = useState(false);
  const [admin, setAdmin] = useState<AdminAccount | null>(null);

  // On load (and refresh) of an admin page, and when another tab signs the admin in or out.
  useEffect(() => {
    if (!requested) return;
    let active = true;
    authApi.adminCurrent().then(({ admin }) => { if (active) setAdmin(admin); })
      .catch(() => { if (active) setAdmin(null); })
      .finally(() => { if (active) setChecked(true); });
    return () => { active = false; };
  }, [requested, attempt]);

  useEffect(() => {
    const ended = (event: Event) => { if ((event as CustomEvent<Account>).detail === "admin") setAdmin(null); };
    const changed = (event: Event) => {
      if ((event as CustomEvent<Account>).detail !== "admin") return;
      setAdmin(null);
      setChecked(false);
      setAttempt((value) => value + 1);
    };
    window.addEventListener(SESSION_ENDED_EVENT, ended);
    window.addEventListener(SESSION_CHANGED_EVENT, changed);
    return () => {
      window.removeEventListener(SESSION_ENDED_EVENT, ended);
      window.removeEventListener(SESSION_CHANGED_EVENT, changed);
    };
  }, []);

  const login = async (email: string, password: string) => {
    const result = await authApi.adminLogin(email, password);
    setAdmin(result.admin);
    setChecked(true);
    announceSessionChange("admin");
    return result.admin;
  };
  const logout = async () => {
    await authApi.adminLogout();
    setAdmin(null);
    announceSessionChange("admin");
  };
  const requestCheck = useCallback(() => setRequested(true), []);
  const updateProfile = async (input: ProfileInput) => {
    setAdmin((await adminSettingsApi.profile(input)).admin);
    announceSessionChange("admin");
  };

  return (
    <AdminAuthContext.Provider value={{ admin, isAuthenticated: !!admin, loading: !checked, login, logout, updateProfile, requestCheck }}>
      {children}
    </AdminAuthContext.Provider>
  );
}
// eslint-disable-next-line react-refresh/only-export-components
export function useAdminAuth(): AdminAuth {
  const context = useContext(AdminAuthContext);
  if (!context) throw new Error("useAdminAuth must be used within AdminAuthProvider");
  const { requestCheck } = context;
  // The first admin page to render asks the server whether the admin is signed in.
  useEffect(requestCheck, [requestCheck]);
  return context;
}
