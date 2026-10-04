import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { ApiError } from "../frontApisRoute/client";
import { deliveryApi, PARTNER_BLOCKED_EVENT, type PartnerApplication } from "../frontApisRoute/delivery";
import { SESSION_CHANGED_EVENT, SESSION_ENDED_EVENT, announceSessionChange, type Account } from "../frontApisRoute/session";

/** The delivery partner signed in via /delivery-partner/login (the deliveryPartnerToken cookie). Never a customer or the admin. */
interface PartnerAuth {
  partner: PartnerApplication | null; isAuthenticated: boolean; loading: boolean; error: string | null;
  login: (email: string, password: string) => Promise<void>;
  activate: (email: string, reference: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Re-reads the partner, e.g. after a profile update or when the API refuses a request. */
  refresh: () => void;
}
interface PartnerAuthState extends PartnerAuth { requestCheck: () => void }
const PartnerAuthContext = createContext<PartnerAuthState | undefined>(undefined);

export function PartnerAuthProvider({ children }: { children: ReactNode }) {
  // Only driver pages ask (see usePartnerAuth), so shoppers never trigger a partner check.
  const [requested, setRequested] = useState(false);
  const [checked, setChecked] = useState(false);
  const [partner, setPartner] = useState<PartnerApplication | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const refresh = useCallback(() => setAttempt((value) => value + 1), []);

  // On load (and refresh) of a driver page, and when the partner signs in or out in another tab.
  useEffect(() => {
    if (!requested) return;
    let active = true;
    deliveryApi.me().then(({ partner }) => { if (active) { setPartner(partner); setError(null); } })
      .catch((failure: unknown) => {
        if (!active) return;
        setPartner(null);
        // 401: signed out or expired. 403: suspended or no longer allowed in. Either way, back to sign-in.
        if (failure instanceof ApiError && (failure.status === 401 || failure.status === 403)) setError(null);
        else setError(failure instanceof Error ? failure.message : "Unable to check your session");
      }).finally(() => { if (active) setChecked(true); });
    return () => { active = false; };
  }, [requested, attempt]);

  useEffect(() => {
    const ended = (event: Event) => { if ((event as CustomEvent<Account>).detail === "partner") setPartner(null); };
    const changed = (event: Event) => { if ((event as CustomEvent<Account>).detail === "partner") refresh(); };
    window.addEventListener(SESSION_ENDED_EVENT, ended);
    window.addEventListener(SESSION_CHANGED_EVENT, changed);
    window.addEventListener(PARTNER_BLOCKED_EVENT, refresh);
    return () => {
      window.removeEventListener(SESSION_ENDED_EVENT, ended);
      window.removeEventListener(SESSION_CHANGED_EVENT, changed);
      window.removeEventListener(PARTNER_BLOCKED_EVENT, refresh);
    };
  }, [refresh]);

  const signedIn = (result: { partner: PartnerApplication }) => {
    setPartner(result.partner);
    setError(null);
    setChecked(true);
    announceSessionChange("partner");
  };
  const login = async (email: string, password: string) => signedIn(await deliveryApi.login(email, password));
  const activate = async (email: string, reference: string, password: string) => signedIn(await deliveryApi.activate(email, reference, password));
  const logout = async () => {
    await deliveryApi.logout();
    setPartner(null);
    announceSessionChange("partner");
  };
  const requestCheck = useCallback(() => setRequested(true), []);

  return (
    <PartnerAuthContext.Provider value={{ partner, isAuthenticated: !!partner, loading: !checked, error, login, activate, logout, refresh, requestCheck }}>
      {children}
    </PartnerAuthContext.Provider>
  );
}
// eslint-disable-next-line react-refresh/only-export-components
export function usePartnerAuth(): PartnerAuth {
  const context = useContext(PartnerAuthContext);
  if (!context) throw new Error("usePartnerAuth must be used within PartnerAuthProvider");
  const { requestCheck } = context;
  // The first driver page to render asks the server whether a partner is signed in.
  useEffect(requestCheck, [requestCheck]);
  return context;
}
