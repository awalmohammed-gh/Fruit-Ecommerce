import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { adminSettingsApi, DEFAULT_ADMIN_PREFERENCES, type AdminPreferences } from "../frontApisRoute/adminSettings";
import { useAdminAuth } from "./AdminAuthContext";
import { configureAdminFormatting } from "../pages/admin/lib/format";
import { useAdminTheme } from "../hooks/useAdminTheme";
import "../pages/admin/adminTheme.css";

interface PreferencesContext {
  preferences: AdminPreferences;
  theme: "light" | "dark";
  loading: boolean;
  error: string | null;
  retry: () => void;
  save: (preferences: AdminPreferences) => Promise<void>;
}
const Context = createContext<PreferencesContext | null>(null);

/** The backend owns personal preferences. This provider applies them only inside the admin workspace. */
export function AdminPreferencesProvider({ children }: { children: ReactNode }) {
  const { admin } = useAdminAuth();
  const [preferences, setPreferences] = useState(DEFAULT_ADMIN_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const theme = useAdminTheme(preferences.appearance);

  useEffect(() => {
    let active = true;
    adminSettingsApi.preferences().then((result) => {
      if (!active) return;
      configureAdminFormatting(result.preferences);
      setPreferences(result.preferences);
      setError(null);
    }).catch((failure: unknown) => {
      if (active) setError(failure instanceof Error ? failure.message : "Unable to load preferences");
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; configureAdminFormatting(DEFAULT_ADMIN_PREFERENCES); };
  }, [admin?.email, attempt]);

  const save = async (draft: AdminPreferences) => {
    const result = await adminSettingsApi.savePreferences(draft);
    configureAdminFormatting(result.preferences);
    setPreferences(result.preferences);
    setError(null);
  };
  return <Context.Provider value={{ preferences, theme, loading, error, retry: () => { setLoading(true); setAttempt((value) => value + 1); }, save }}>{children}</Context.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAdminPreferences() {
  const context = useContext(Context);
  if (!context) throw new Error("Admin preferences need their provider");
  return context;
}
